"""Practice scheduling and account isolation, using an isolated database."""
import asyncio
import json
import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "learning-tests-secret-key-with-enough-entropy"
os.environ.pop("REDIS_URL", None)

import main
import models
import review
from database import SessionLocal, engine
from starlette.requests import Request


def request(data=None):
    async def receive():
        return {"type": "http.request", "body": json.dumps(data).encode(), "more_body": False}
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [],
                    "query_string": b"", "scheme": "http", "server": ("testserver", 80)}, receive)


class LearningProgressTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(engine)
        models.Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.user = models.User(name="One", email="one@example.com", password_hash="x", expires_at=datetime(2030, 1, 1))
        self.other = models.User(name="Two", email="two@example.com", password_hash="x", expires_at=datetime(2030, 1, 1))
        self.db.add_all([self.user, self.other, models.Test(id=1, title="Test")])
        self.db.flush()
        self.question = models.Question(test_id=1, question_index=1, question_text="Question")
        self.db.add(self.question)
        self.db.flush()
        self.right = models.Answer(question_id=self.question.id, text="Right", is_correct=True)
        self.wrong = models.Answer(question_id=self.question.id, text="Wrong", is_correct=False)
        self.db.add_all([self.right, self.wrong])
        self.db.commit()
        self.mistake()

    def tearDown(self):
        self.db.close()

    def mistake(self):
        attempt = models.UserTestAttempt(user_id=self.user.id, test_id=1)
        self.db.add(attempt)
        self.db.flush()
        self.db.add(models.UserAnswer(attempt_id=attempt.id, question_id=self.question.id, is_correct=False))
        self.db.commit()

    def answer(self, key, now, correct=True):
        return review.record_answer(self.db, self.user.id, self.question.id,
                                    [self.right.id if correct else self.wrong.id], key, now)

    def test_schedule_1_3_7_21_and_mastery_without_changing_test_history(self):
        now = datetime(2026, 9, 7)
        for index, days in enumerate([1, 3, 7, 21]):
            self.assertEqual(review.missed_question_ids(self.db, self.user.id, now), [self.question.id])
            result = self.answer(f"request-number-{index}", now)
            self.assertEqual(result["due_at"], (now + timedelta(days=days)).isoformat() + "Z")
            self.assertEqual(review.missed_question_ids(self.db, self.user.id, now), [])
            now += timedelta(days=days)
        self.assertIsNone(self.answer("request-number-5", now)["due_at"])
        self.assertEqual(review.missed_question_ids(self.db, self.user.id, now + timedelta(days=100)), [])
        self.assertEqual(self.db.query(models.UserAnswer).count(), 1)
        self.assertFalse(self.db.query(models.UserAnswer).one().is_correct)

    def test_retry_does_not_advance_schedule_and_early_answer_is_rejected(self):
        now = datetime(2026, 9, 7)
        first = self.answer("request-number-1", now)
        self.assertEqual(self.answer("request-number-1", now), first)
        with self.assertRaises(ValueError):
            self.answer("request-number-2", now)
        self.assertEqual(self.db.query(models.ReviewProgress).one().streak, 1)

    def test_wrong_answer_resets_interval_and_new_test_mistake_reopens(self):
        now = datetime(2026, 9, 7)
        self.answer("request-number-1", now)
        now += timedelta(days=1)
        result = self.answer("request-number-2", now, correct=False)
        self.assertEqual(result["due_at"], (now + timedelta(days=1)).isoformat() + "Z")
        self.assertEqual(self.db.query(models.ReviewProgress).one().streak, 0)
        self.mistake()
        self.assertEqual(review.missed_question_ids(self.db, self.user.id, now), [self.question.id])

    def test_cannot_review_another_users_mistake_or_foreign_answer(self):
        with self.assertRaises(ValueError):
            review.record_answer(self.db, self.other.id, self.question.id, [self.right.id], "request-number-1")
        with self.assertRaises(ValueError):
            review.record_answer(self.db, self.user.id, self.question.id, [999999], "request-number-1")
        self.assertEqual(self.db.query(models.ReviewProgress).count(), 0)

    def call(self, handler, user, data=None):
        with patch("main.get_current_user", return_value=user):
            return asyncio.run(handler(request(data), db=self.db))

    def test_sign_progress_patches_reset_and_accounts_are_isolated(self):
        codes = [sign["code"] for sign in main.signs_catalogue.all_signs()][:2]
        self.call(main.api_save_sign_progress, self.user, {"progress": {codes[0]: {"box": 3}}})
        self.call(main.api_save_sign_progress, self.user, {"progress": {codes[1]: {"box": 0}}})
        self.assertEqual(len(self.call(main.api_sign_progress, self.user)["progress"]), 2)
        self.assertEqual(self.call(main.api_sign_progress, self.other)["progress"], {})
        self.call(main.api_save_sign_progress, self.other, {"progress": {codes[0]: {"box": 2}}})
        self.call(main.api_save_sign_progress, self.user, {"progress": {}, "reset": True})
        self.assertEqual(self.call(main.api_sign_progress, self.user)["progress"], {})
        self.assertEqual(self.call(main.api_sign_progress, self.other)["progress"][codes[0]]["box"], 2)

    def test_invalid_sign_payloads_do_not_write_and_login_is_required(self):
        code = main.signs_catalogue.all_signs()[0]["code"]
        for data in [[], {"progress": []}, {"progress": {"unknown": {"box": 0}}},
                     {"progress": {code: {"box": True}}}, {"progress": {code: {"box": 6}}}]:
            with self.assertRaises(main.HTTPException) as error:
                self.call(main.api_save_sign_progress, self.user, data)
            self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(self.db.query(models.SignProgress).count(), 0)
        for handler in [main.api_sign_progress, main.api_save_sign_progress, main.api_review_answer]:
            with self.assertRaises(main.HTTPException) as error:
                self.call(handler, None, {})
            self.assertEqual(error.exception.status_code, 401)

    def test_manual_extension_preserves_remaining_access(self):
        self.other.is_admin = True
        self.other.is_super_admin = True
        original_expiry = self.user.expires_at
        with patch("main.get_current_user", return_value=self.other):
            response = asyncio.run(main.api_admin_update_user(
                self.user.id, request({"duration_value": 30, "duration_unit": "days"}), self.db))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.user.expires_at, original_expiry + timedelta(days=30))
        with patch("main.get_current_user", return_value=self.other):
            response = asyncio.run(main.api_admin_update_user(
                self.user.id, request({"duration_value": 2, "duration_unit": "hours"}), self.db))
        self.assertEqual(self.user.expires_at, original_expiry + timedelta(days=30, hours=2))

    def test_activity_requires_consent_and_excludes_admin_from_live_and_visits(self):
        payload = {"path": "/signs", "tab_id": "test-tab", "reason": "load", "analytics_consent": False}
        response = self.call(main.api_activity_ping, self.user, payload)
        self.assertFalse(json.loads(response.body)["tracked"])
        self.other.is_admin = True
        payload["analytics_consent"] = True
        response = self.call(main.api_activity_ping, self.other, payload)
        self.assertFalse(json.loads(response.body)["tracked"])
        self.assertEqual(self.db.query(models.LiveActivitySession).count(), 0)
        response = self.call(main.api_activity_ping, self.user, payload)
        self.assertTrue(json.loads(response.body)["analytics_recorded"])
        overview = main.build_analytics_overview(self.db)
        self.assertEqual(overview["logged_in_week"], 1)
        self.assertEqual(main.build_live_activity_overview(self.db)["online_now"], 1)
        payload["tab_id"] = "guest-tab"
        response = self.call(main.api_activity_ping, None, payload)
        self.assertTrue(json.loads(response.body)["analytics_recorded"])
        self.assertEqual(main.build_analytics_overview(self.db)["guest_week"], 1)

    def test_invalid_admin_edits_do_not_grant_access_or_change_email(self):
        self.other.is_admin = True
        self.other.is_super_admin = True
        original = (self.user.expires_at, self.user.email)
        for payload in [{"email": self.other.email}, {"duration_value": -1},
                        {"duration_value": 1.5}, {"duration_value": True},
                        {"duration_value": 999999999},
                        {"duration_value": 7, "duration_unit": "weeks"}]:
            with patch("main.get_current_user", return_value=self.other):
                response = asyncio.run(main.api_admin_update_user(self.user.id, request(payload), self.db))
            self.assertEqual(response.status_code, 400, payload)
            self.db.refresh(self.user)
            self.assertEqual((self.user.expires_at, self.user.email), original)
