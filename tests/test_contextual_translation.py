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
                models.WordTranslation.word_en.in_(["counting on", "from the right side"])
            )
        }
        self.assertEqual(values["counting on"], "рассчитываю на")
        self.assertEqual(values["from the right side"], "справа")

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
