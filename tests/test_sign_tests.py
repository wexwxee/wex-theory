"""Road-sign tests 1-4: 25 exam-style sign situations each, stored as ordinary tests 101-104 so the
test room, scoring, results and mistake review need nothing new."""
import json
import os
import unittest
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("SECRET_KEY", "sign-tests-secret-key-with-enough-entropy")
os.environ.pop("REDIS_URL", None)

import models  # noqa: E402
import review  # noqa: E402
import sign_curriculum  # noqa: E402
import sign_lessons  # noqa: E402
import sign_tests  # noqa: E402
import signs  # noqa: E402
from database import SessionLocal, engine  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data/signs/sign_tests.json").read_text(encoding="utf-8"))
LESSON_SITUATIONS = json.loads((ROOT / "data/signs/situations.json").read_text(encoding="utf-8"))["situations"]


def topic(situation):
    return situation.get("lesson") or situation["topic_lesson"]


class SignTestDataTests(unittest.TestCase):
    def test_four_tests_of_25_different_situations_that_cover_every_lesson(self):
        tests = sign_tests.tests()
        self.assertEqual([test["id"] for test in tests], [101, 102, 103, 104])
        self.assertEqual([test["number"] for test in tests], [1, 2, 3, 4])
        # The ids must never clash with the free sample (0), Theory Tests 1-13 or Exam Mode (14).
        self.assertFalse(sign_tests.test_ids() & set(range(0, 15)))
        lesson_ids = {lesson["id"] for lesson in sign_lessons.all_lessons()}
        for test in tests:
            situations = sign_tests.questions(test["id"])
            self.assertEqual(len(situations), sign_tests.QUESTIONS_PER_TEST, test["id"])
            self.assertEqual(len({item["id"] for item in situations}), sign_tests.QUESTIONS_PER_TEST, test["id"])
            self.assertEqual({topic(item) for item in situations}, lesson_ids, test["id"])

    def test_test_only_situations_are_complete_bilingual_and_use_checked_signs(self):
        known_sources = {source["id"] for source in sign_curriculum.catalogue()["sources"]}
        lesson_ids = {item["id"] for item in LESSON_SITUATIONS}
        lessons = {lesson["id"]: lesson for lesson in sign_lessons.all_lessons()}
        for item in DATA["extra_situations"]:
            self.assertNotIn(item["id"], lesson_ids)
            self.assertIn(item["topic_lesson"], lessons, item["id"])
            self.assertTrue(item["codes"] and all(signs.by_code(code) and signs.by_code(code)["teaching"]
                                                  for code in item["codes"]), item["id"])
            self.assertTrue(2 <= len(item["statements"]) <= 4 and any(s["correct"] for s in item["statements"]), item["id"])
            for field in ("prompt", "alt", "explanation"):
                self.assertTrue(all(item[field][lang].strip() for lang in ("en", "ru")), (item["id"], field))
            for statement in item["statements"]:
                self.assertIs(type(statement["correct"]), bool)
                self.assertTrue(all(statement["text"][lang].strip() and statement["why"][lang].strip()
                                    for lang in ("en", "ru")), item["id"])
            self.assertTrue(item["source_ids"] and set(item["source_ids"]) <= known_sources and item["basis"], item["id"])

    def test_every_picture_is_where_the_test_room_looks(self):
        for test in sign_tests.tests():
            for item in sign_tests.questions(test["id"]):
                self.assertTrue((ROOT / "test-images" / sign_tests.image_path(item)).is_file(), item["id"])

    def test_the_explanation_names_every_statement_and_its_verdict(self):
        item = sign_tests.questions(101)[0]
        text = sign_tests.explanation(item, "ru")
        self.assertTrue(text.startswith(item["explanation"]["ru"]))
        for statement in item["statements"]:
            self.assertIn(statement["why"]["ru"], text)
            self.assertIn(f"— {'верно' if statement['correct'] else 'неверно'}. {statement['why']['ru']}", text)


class SignTestSyncTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(bind=engine)
        models.Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_sync_creates_the_tests_as_ordinary_questions_and_answers(self):
        sign_tests.sync(self.db)
        for test in sign_tests.tests():
            row = self.db.query(models.Test).filter_by(id=test["id"]).one()
            self.assertEqual(row.title, test["title"])
            questions = self.db.query(models.Question).filter_by(test_id=test["id"]).order_by(models.Question.question_index).all()
            self.assertEqual([q.question_index for q in questions], list(range(1, 26)))
            for question, item in zip(questions, sign_tests.questions(test["id"])):
                self.assertEqual(question.question_text_ru, item["prompt"]["ru"])
                self.assertEqual([a.is_correct for a in sorted(question.answers, key=lambda a: a.id)],
                                 [s["correct"] for s in item["statements"]])

    def test_a_second_sync_keeps_question_and_answer_ids(self):
        sign_tests.sync(self.db)
        before = {(a.question_id, a.id) for a in self.db.query(models.Answer).all()}
        question = self.db.query(models.Question).filter_by(test_id=101, question_index=1).one()
        question.question_text = "edited by hand"
        self.db.add(models.Answer(question_id=question.id, text="extra", is_correct=False))
        self.db.commit()
        sign_tests.sync(self.db)
        self.assertEqual({(a.question_id, a.id) for a in self.db.query(models.Answer).all()}, before)
        self.assertEqual(self.db.query(models.Question).filter_by(test_id=101, question_index=1).one().question_text,
                         sign_tests.questions(101)[0]["prompt"]["en"])

    def test_the_course_page_offers_the_sign_tests_after_the_lessons(self):
        from fastapi.testclient import TestClient
        import main
        page = TestClient(main.app).get("/signs/lessons")
        self.assertEqual(page.status_code, 200)
        self.assertIn('id="signTests"', page.text)
        for test in sign_tests.tests():
            self.assertIn(f'href="/test/{test["id"]}"', page.text)
        self.assertIn("https://dtp.fstyr.dk/", page.text)

    def test_mistake_review_names_the_sign_test(self):
        sign_tests.sync(self.db)
        question = self.db.query(models.Question).filter_by(test_id=103, question_index=2).one()
        self.assertEqual(review.as_payload(question)["test_label"], "Road signs test 3")


if __name__ == "__main__":
    unittest.main()
