"""Finished sign lessons are kept per account: the first score never changes, corrections only
raise the reviewed score, and a new question revision starts a new result."""
import asyncio
import json
import os
import unittest
from datetime import datetime
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "sign-lesson-tests-secret-key-with-enough-entropy"
os.environ.pop("REDIS_URL", None)

import main
import models
import sign_curriculum
import sign_lessons
import signs
import study
from database import SessionLocal, engine
from fastapi import HTTPException
from starlette.requests import Request


def request(data=None):
    async def receive():
        return {"type": "http.request", "body": json.dumps(data).encode(), "more_body": False}
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [],
                    "query_string": b"", "scheme": "http", "server": ("testserver", 80)}, receive)


def result(lesson="priority", **changes):
    total = len(sign_curriculum.for_lesson(lesson)["questions"])
    payload = {"lesson": lesson, "revision": sign_curriculum.revision(lesson), "first": total - 1,
               "total": total, "reviewed": total - 1, "recall_first": None, "recall_total": None}
    payload.update(changes)
    return payload


class SignLessonResultTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(engine)
        models.Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.user = models.User(name="One", email="one@example.com", password_hash="x", expires_at=datetime(2030, 1, 1))
        self.other = models.User(name="Two", email="two@example.com", password_hash="x", expires_at=datetime(2030, 1, 1))
        self.db.add_all([self.user, self.other])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def call(self, handler, user, data=None):
        with patch("main.get_current_user", return_value=user):
            return asyncio.run(handler(request(data), db=self.db))

    def saved(self, user=None):
        return self.call(main.api_sign_lesson_results, user or self.user)["results"]

    def test_first_score_stays_and_corrections_only_raise_the_reviewed_score(self):
        self.call(main.api_save_sign_lesson_result, self.user, result(first=1, reviewed=1))
        self.call(main.api_save_sign_lesson_result, self.user, result(first=3, reviewed=3, recall_first=5, recall_total=7))
        self.call(main.api_save_sign_lesson_result, self.user, result(first=0, reviewed=2))
        row = self.saved()["priority"]
        self.assertEqual((row["first"], row["reviewed"], row["total"]), (1, 3, len(sign_curriculum.for_lesson("priority")["questions"])))
        self.assertEqual((row["recall_first"], row["recall_total"]), (5, 7))
        self.call(main.api_save_sign_lesson_result, self.user, result(first=1, reviewed=1, recall_first=7, recall_total=7))
        self.assertEqual(self.saved()["priority"]["recall_first"], 5)
        self.assertEqual(self.saved(self.other), {})

    def test_a_result_for_an_older_revision_is_replaced_by_a_new_check(self):
        self.call(main.api_save_sign_lesson_result, self.user, result(first=3, reviewed=3))
        row = self.db.query(models.SignLessonResult).one()
        row.revision = "2026-01-01.old"
        self.db.commit()
        self.call(main.api_save_sign_lesson_result, self.user, result(first=1, reviewed=1))
        saved = self.saved()["priority"]
        self.assertEqual((saved["revision"], saved["first"], saved["reviewed"]), (sign_curriculum.revision("priority"), 1, 1))

    def test_invalid_results_are_rejected_without_writing(self):
        invalid = [
            {"lesson": "unknown"}, result(revision="2026-01-01.old"), result(total=99), result(first=3, reviewed=2),
            result(first=-1, reviewed=0), result(first=True, reviewed=1), result(recall_first=3, recall_total=99),
            result(recall_first=8, recall_total=7), result(recall_first=2), [], "priority",
        ]
        for data in invalid:
            with self.subTest(data=data), self.assertRaises(HTTPException) as error:
                self.call(main.api_save_sign_lesson_result, self.user, data)
            self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(self.db.query(models.SignLessonResult).count(), 0)
        for handler in (main.api_sign_lesson_results, main.api_save_sign_lesson_result):
            with self.assertRaises(HTTPException) as error:
                self.call(handler, None, result())
            self.assertEqual(error.exception.status_code, 401)

    def test_resetting_sign_progress_also_clears_this_accounts_lessons(self):
        self.call(main.api_save_sign_lesson_result, self.user, result())
        self.call(main.api_save_sign_lesson_result, self.other, result())
        self.call(main.api_save_sign_progress, self.user, {"progress": {}, "reset": True})
        self.assertEqual(self.saved(), {})
        self.assertIn("priority", self.saved(self.other))

    def test_study_suggests_the_first_lesson_without_a_finished_check(self):
        lessons = sign_lessons.all_lessons()
        self.assertEqual(study.overview(self.db, self.user.id)["lesson"]["id"], lessons[0]["id"])
        self.call(main.api_save_sign_lesson_result, self.user, result(lessons[0]["id"]))
        overview = study.overview(self.db, self.user.id)
        self.assertEqual(overview["lesson"]["id"], lessons[1]["id"])
        self.assertEqual((overview["lessons_done"], overview["lessons_total"]), (1, len(lessons)))


def test_only_source_checked_signs_are_marked_for_teaching():
    marked = [sign for sign in signs.all_signs() if sign["verified"]]
    assert len(marked) == signs.catalogue_meta()["reviewed"] == 163
    assert all(sign["teaching"].get("action") for sign in marked)
    assert not signs.by_code("F11")["verified"]
    assert "Variants" not in signs.by_code("A11")["name_en"]


def test_every_lesson_sign_is_checked_and_lessons_list_their_comparisons():
    for lesson in sign_lessons.all_lessons():
        assert all(signs.by_code(code)["verified"] for code in lesson["codes"])
        assert sign_curriculum.for_lesson(lesson["id"])["comparisons"]
    assert [lesson["id"] for lesson in sign_lessons.lessons_for_code("B11")][:2] == ["starter", "priority"]
    assert {tuple(item["codes"]) for item in sign_curriculum.comparisons_for("B18")} >= {("B18", "B19")}
