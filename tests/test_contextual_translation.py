import os
import unittest
from datetime import datetime


os.environ["SECRET_KEY"] = "context-translation-tests-secret-key"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.pop("RESEND_API_KEY", None)
os.environ.pop("REDIS_URL", None)

import main  # noqa: E402
import models  # noqa: E402
from database import SessionLocal, engine  # noqa: E402


class ContextualTranslationTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(bind=engine)
        models.Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def add_term(self, term, translation, *, curated=True):
        row = models.WordTranslation(
            word_en=term,
            translation_ru=translation,
            pos="phrase" if " " in term else "adv",
            is_curated=curated,
            updated_at=datetime.utcnow(),
        )
        self.db.add(row)
        self.db.commit()
        return row

    def test_normalizes_short_words_and_phrases_only(self):
        self.assertEqual(main._normalize_dictionary_term("  Hold   back! "), "hold back")
        self.assertEqual(main._normalize_dictionary_term("right-hand side"), "right-hand side")
        self.assertEqual(main._normalize_dictionary_term("I"), "i")
        self.assertEqual(main._normalize_dictionary_term("a"), "a")
        self.assertIsNone(main._normalize_dictionary_term("x"))
        self.assertIsNone(main._normalize_dictionary_term("one two three four five six"))
        self.assertIsNone(main._normalize_dictionary_term("<script>alert</script>"))
        self.assertIsNone(main._normalize_dictionary_term("40 km/h"))

    def test_selected_word_expands_to_curated_context_phrase(self):
        self.add_term("back", "назад")
        self.add_term("hold back", "уступить дорогу / пропустить")
        source = "I hold back for the cyclist."
        start = source.index("back")

        row, matched = main._find_contextual_dictionary_row(
            self.db,
            "back",
            source,
            start,
            start + len("back"),
        )

        self.assertIsNotNone(row)
        self.assertEqual(matched, "hold back")
        self.assertEqual(row.translation_ru, "уступить дорогу / пропустить")

    def test_unrelated_phrase_elsewhere_does_not_override_selection(self):
        self.add_term("hold back", "уступить дорогу / пропустить")
        self.add_term("cyclist", "велосипедист")
        source = "I hold back for the cyclist."
        start = source.index("cyclist")

        row, matched = main._find_contextual_dictionary_row(
            self.db,
            "cyclist",
            source,
            start,
            start + len("cyclist"),
        )

        self.assertIsNotNone(row)
        self.assertEqual(matched, "cyclist")

    def test_mismatched_offsets_cannot_borrow_another_phrase(self):
        self.add_term("hold back", "уступить дорогу / пропустить")
        self.add_term("cyclist", "велосипедист")
        source = "I hold back for the cyclist."
        wrong_start = source.index("back")

        row, matched = main._find_contextual_dictionary_row(
            self.db,
            "cyclist",
            source,
            wrong_start,
            wrong_start + len("back"),
        )

        self.assertIsNotNone(row)
        self.assertEqual(matched, "cyclist")

    def test_offsets_are_measured_against_untrimmed_source(self):
        self.add_term("hold back", "уступить дорогу / пропустить")
        source = "  I hold back for the cyclist.  "
        start = source.index("back")

        row, matched = main._find_contextual_dictionary_row(
            self.db,
            "back",
            source,
            start,
            start + len("back"),
        )

        self.assertIsNotNone(row)
        self.assertEqual(matched, "hold back")

    def test_local_lookup_miss_is_read_only(self):
        before = self.db.query(models.WordTranslation).count()

        payload = main._lookup_dictionary_term("unknownword", self.db)

        self.assertIsNone(payload["translation"])
        self.assertEqual(payload["source"], "unavailable")
        self.assertEqual(self.db.query(models.WordTranslation).count(), before)

    def test_context_terms_replace_an_automatic_wrong_value(self):
        self.add_term("hold back", "сдерживаться", curated=False)

        main.ensure_contextual_translation_terms(self.db)

        row = self.db.query(models.WordTranslation).filter_by(word_en="hold back").one()
        self.assertEqual(row.translation_ru, "уступить дорогу / пропустить")
        self.assertTrue(row.is_curated)

    def test_screenshot_ambiguities_have_curated_phrase_meanings(self):
        main.ensure_contextual_translation_terms(self.db)

        values = {
            row.word_en: row.translation_ru
            for row in self.db.query(models.WordTranslation).filter(
                models.WordTranslation.word_en.in_([
                    "counting on",
                    "from the right",
                    "from the right side",
                    "overtake",
                    "stay behind",
                ])
            )
        }
        self.assertEqual(values["counting on"], "рассчитываю на")
        self.assertEqual(values["from the right"], "справа")
        self.assertEqual(values["from the right side"], "справа")
        self.assertEqual(values["overtake"], "обгонять / обогнать")
        self.assertEqual(values["stay behind"], "оставаться позади")

    def test_composes_i_overtake_as_word_glosses(self):
        main.ensure_contextual_translation_terms(self.db)

        glosses = main._compose_dictionary_glosses(self.db, "I overtake")

        self.assertEqual(
            [(item["term"], item["translation"]) for item in glosses],
            [("I", "я"), ("overtake", "обгонять / обогнать")],
        )

    def test_composes_article_and_noun_without_dropping_article(self):
        self.add_term("moped", "мопед")

        glosses = main._compose_dictionary_glosses(self.db, "the moped")

        self.assertEqual(
            [(item["term"], item["translation"]) for item in glosses],
            [("the", "артикль, обычно не переводится"), ("moped", "мопед")],
        )

    def test_composed_gloss_prefers_a_long_curated_phrase(self):
        self.add_term("stay", "оставаться")
        self.add_term("behind", "позади")
        main.ensure_contextual_translation_terms(self.db)

        glosses = main._compose_dictionary_glosses(self.db, "will stay behind")

        self.assertEqual(
            [(item["term"], item["translation"]) for item in glosses],
            [
                ("will", "показатель будущего времени"),
                ("stay behind", "оставаться позади"),
            ],
        )

    def test_composed_gloss_requires_full_selection_coverage(self):
        main.ensure_contextual_translation_terms(self.db)

        glosses = main._compose_dictionary_glosses(
            self.db,
            "I overtake frobnicate",
        )

        self.assertEqual(glosses, [])

    def test_composed_gloss_finds_a_complete_path_before_longest_dead_end(self):
        self.add_term("alpha beta gamma", "длинный тупик")
        self.add_term("alpha beta", "первая половина")
        self.add_term("gamma delta", "вторая половина")

        glosses = main._compose_dictionary_glosses(
            self.db,
            "alpha beta gamma delta",
        )

        self.assertEqual(
            [item["term"] for item in glosses],
            ["alpha beta", "gamma delta"],
        )

    def test_composed_gloss_handles_common_preposition_without_fluent_claim(self):
        self.add_term("cyclist", "велосипедист")

        glosses = main._compose_dictionary_glosses(self.db, "for the cyclist")

        self.assertEqual(
            [item["term"] for item in glosses],
            ["for", "the", "cyclist"],
        )

    def test_exact_from_the_right_works_at_a_hyphen_boundary(self):
        main.ensure_contextual_translation_terms(self.db)
        source = "I wait for traffic from the right-hand side."
        selected = "from the right"
        start = source.index(selected)

        row, matched = main._find_contextual_dictionary_row(
            self.db,
            selected,
            source,
            start,
            start + len(selected),
        )

        self.assertIsNotNone(row)
        self.assertEqual(matched, "from the right")
        self.assertEqual(row.translation_ru, "справа")

    def test_composed_gloss_lookup_is_read_only(self):
        self.add_term("moped", "мопед")
        before = self.db.query(models.WordTranslation).count()

        glosses = main._compose_dictionary_glosses(self.db, "the moped")

        self.assertTrue(glosses)
        self.assertEqual(self.db.query(models.WordTranslation).count(), before)

    def test_example_answer_typo_and_translation_are_corrected(self):
        question = models.Question(
            test_id=2,
            question_index=16,
            question_text="You are driving at 40 km/h and are going straight ahead at the intersection. How will you continue?",
        )
        self.db.add(question)
        self.db.flush()
        typo = models.Answer(
            question_id=question.id,
            text="I look to seen what is happening on both sides before I drive into the intersection.",
            text_ru="Прежде чем выехать на перекресток, я смотрю, что происходит с обеих сторон.",
        )
        phrase = models.Answer(
            question_id=question.id,
            text="I hold back for the cyclist.",
            text_ru="Я сдерживаюсь перед велосипедистом.",
        )
        self.db.add_all([typo, phrase])
        self.db.commit()

        main.ensure_question_text_fixes(self.db)

        self.db.refresh(question)
        self.db.refresh(typo)
        self.db.refresh(phrase)
        self.assertIn("Как вы продолжите движение?", question.question_text_ru)
        self.assertIn("look to see", typo.text)
        self.assertEqual(phrase.text_ru, "Я уступаю дорогу велосипедисту.")


if __name__ == "__main__":
    unittest.main()
