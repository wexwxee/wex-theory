"""Topic tests: WEXTheory's own practice tests by teaching-plan section, stored as ordinary tests
(ids 201 and up) so the test room, scoring, results and mistake review need nothing new."""
import json
import os
import re
import unittest
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("SECRET_KEY", "topic-tests-secret-key-with-enough-entropy")
os.environ.pop("REDIS_URL", None)

import models  # noqa: E402
import review  # noqa: E402
import sign_tests  # noqa: E402
import topic_tests  # noqa: E402
from database import SessionLocal, engine  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data/topic_tests.json").read_text(encoding="utf-8"))
# Section 1 of the category B teaching plan (version 1.1, May 2026): every point a statement may cite.
SECTION_1_POINTS = {"1.1.1": 6, "1.1.2": 3, "1.1.3": 7, "1.1.4": 7, "1.1.5": 5, "1.1.6": 6, "1.2.1": 4,
                    "1.2.2": 12, "1.2.3": 23, "1.2.4": 20, "1.2.5": 13, "1.2.6": 29, "1.2.7": 18, "1.2.8": 3,
                    "1.2.9": 13, "1.2.10": 1, "1.3.1": 6}
SOURCE = re.compile(r"^(1\.[1-3]\.\d+) \((\d+)\)((?:, \(\d+\))*)$")


class TopicTestDataTests(unittest.TestCase):
    def test_ids_never_clash_with_other_tests(self):
        self.assertEqual([test["id"] for test in topic_tests.tests()], [201])
        self.assertEqual(topic_tests.number(201), 1)
        # Free sample (0), Theory Tests 1-13, Exam Mode (14) and the road-sign tests stay their own.
        self.assertFalse(topic_tests.test_ids() & (set(range(0, 15)) | sign_tests.test_ids()))

    def test_each_test_has_25_complete_bilingual_questions(self):
        for test in topic_tests.tests():
            questions = topic_tests.questions(test["id"])
            self.assertEqual(len(questions), topic_tests.QUESTIONS_PER_TEST, test["id"])
            self.assertEqual(len({q["id"] for q in questions}), len(questions))
            self.assertEqual(len({q["image"] for q in questions}), len(questions))
            for question in questions:
                for field in ("prompt", "alt", "explanation"):
                    self.assertTrue(all(question[field][lang].strip() for lang in ("en", "ru")), (question["id"], field))
                statements = question["statements"]
                self.assertTrue(2 <= len(statements) <= 4, question["id"])
                self.assertTrue(any(s["correct"] for s in statements), question["id"])
                for statement in statements:
                    self.assertIs(type(statement["correct"]), bool)
                    self.assertTrue(all(statement["text"][lang].strip() and statement["why"][lang].strip()
                                        for lang in ("en", "ru")), question["id"])

    def test_every_statement_cites_a_real_point_of_the_tests_section(self):
        for test in topic_tests.tests():
            for question in topic_tests.questions(test["id"]):
                self.assertTrue(question["section"].startswith(test["section"] + "."), question["id"])
                for statement in question["statements"]:
                    for part in statement["source"].split(";"):
                        match = SOURCE.match(part.strip())
                        self.assertTrue(match, (question["id"], part))
                        point, numbers = match.group(1), [int(n) for n in re.findall(r"\d+", match.group(2) + match.group(3))]
                        self.assertIn(point, SECTION_1_POINTS, (question["id"], part))
                        self.assertTrue(all(1 <= n <= SECTION_1_POINTS[point] for n in numbers), (question["id"], part))

    def test_answers_are_not_always_in_the_same_places(self):
        # A learner must not be able to pass by ticking a fixed pattern.
        questions = topic_tests.questions(201)
        patterns = {tuple(s["correct"] for s in q["statements"]) for q in questions}
        self.assertGreaterEqual(len(patterns), 6)
        self.assertTrue(any(not q["statements"][0]["correct"] for q in questions))
        self.assertTrue(any(sum(s["correct"] for s in q["statements"]) == 1 for q in questions))

    def test_every_picture_is_where_the_test_room_looks(self):
        for question in topic_tests.questions(201):
            path = sign_tests.image_path(question)
            self.assertTrue(path.startswith("Topics/"), question["id"])
            self.assertTrue((ROOT / "test-images" / path).is_file(), question["id"])

    def test_the_explanation_ends_with_the_sources(self):
        question = topic_tests.questions(201)[1]
        text = topic_tests.explanation(question, "ru")
        self.assertTrue(text.startswith(question["explanation"]["ru"]))
        self.assertTrue(text.endswith("Источник: учебный план Færdselsstyrelsen для категории B (версия 1.1, май 2026), "
                                      "1.2.3 (4), (22)."))
        self.assertIn("Source: Færdselsstyrelsen's teaching plan", topic_tests.explanation(question, "en"))
        # Points from different parts of the plan stay apart, in the order the statements cite them.
        self.assertEqual(topic_tests.sources(topic_tests.questions(201)[0]), ["1.2.4 (2), (4), (8), (15)", "1.2.1 (1), (2)"])


class TopicTestSyncTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(bind=engine)
        models.Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_sync_stores_the_test_as_ordinary_questions_and_answers(self):
        topic_tests.sync(self.db)
        row = self.db.query(models.Test).filter_by(id=201).one()
        self.assertEqual(row.title, "Car & Equipment Test 1")
        questions = self.db.query(models.Question).filter_by(test_id=201).order_by(models.Question.question_index).all()
        self.assertEqual([q.question_index for q in questions], list(range(1, 26)))
        for question, item in zip(questions, topic_tests.questions(201)):
            self.assertEqual(question.question_text, item["prompt"]["en"])
            self.assertEqual(question.question_text_ru, item["prompt"]["ru"])
            self.assertEqual(question.image_path, sign_tests.image_path(item))
            self.assertEqual([(a.text, a.text_ru, a.is_correct) for a in sorted(question.answers, key=lambda a: a.id)],
                             [(s["text"]["en"], s["text"]["ru"], s["correct"]) for s in item["statements"]])

    def test_a_second_sync_keeps_ids_and_leaves_the_sign_tests_alone(self):
        sign_tests.sync(self.db)
        signs_before = {(a.question_id, a.id, a.text) for a in self.db.query(models.Answer).all()}
        topic_tests.sync(self.db)
        before = {(a.question_id, a.id) for a in self.db.query(models.Answer).all()}
        topic_tests.sync(self.db)
        self.assertEqual({(a.question_id, a.id) for a in self.db.query(models.Answer).all()}, before)
        signs_after = {(a.question_id, a.id, a.text) for a in self.db.query(models.Answer).join(models.Question)
                       .filter(models.Question.test_id.in_(sign_tests.test_ids())).all()}
        self.assertEqual(signs_after, signs_before)

    def test_mistake_review_names_the_topic_test(self):
        topic_tests.sync(self.db)
        question = self.db.query(models.Question).filter_by(test_id=201, question_index=3).one()
        self.assertEqual(review.as_payload(question)["test_label"], "Car & Equipment Test 1")


if __name__ == "__main__":
    unittest.main()
