"""Optional AI explanation of a mistake: off by default, admin switch, access, storage."""
import asyncio
import json
import os
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "ai-explain-tests-secret-key-with-enough-entropy"
os.environ.pop("REDIS_URL", None)

import ai_explain
import main
import models
from database import SessionLocal, engine
from starlette.requests import Request


def request(data=None):
    async def receive():
        return {"type": "http.request", "body": json.dumps(data or {}).encode(), "more_body": False}
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [],
                    "query_string": b"", "scheme": "http", "server": ("testserver", 80),
                    "client": ("203.0.113.9", 1234)}, receive)


def body(response):
    return json.loads(response.body) if hasattr(response, "body") else response


class AiExplainTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(engine)
        models.Base.metadata.create_all(engine)
        main.RATE_LIMIT_BUCKETS.clear()
        self.db = SessionLocal()
        self.admin = models.User(name="Admin", email="admin@example.com", password_hash="x",
                                 expires_at=datetime(2030, 1, 1), is_admin=True)
        self.expired = models.User(name="Old", email="old@example.com", password_hash="x",
                                   expires_at=datetime(2020, 1, 1))
        self.db.add_all([self.admin, self.expired, models.Test(id=1, title="Test 1"), models.Test(id=5, title="Test 5")])
        self.db.flush()
        # (1, 1) is in the free sample, (5, 20) is a paid-only question.
        self.free_q, self.free_right, self.free_wrong = self.question(1, 1)
        self.paid_q, _, self.paid_wrong = self.question(5, 20)
        self.db.commit()
        os.environ["ANTHROPIC_API_KEY"] = "test-key"

    def tearDown(self):
        os.environ.pop("ANTHROPIC_API_KEY", None)
        self.db.close()

    def question(self, test_id, index):
        q = models.Question(test_id=test_id, question_index=index, question_text=f"Question {test_id}-{index}",
                            explanation="You must give way to the cyclist.")
        self.db.add(q)
        self.db.flush()
        right = models.Answer(question_id=q.id, text="Give way", is_correct=True)
        wrong = models.Answer(question_id=q.id, text="Drive on", is_correct=False)
        self.db.add_all([right, wrong])
        self.db.flush()
        return q, right, wrong

    def explain(self, user, payload):
        with patch.object(main, "get_current_user", return_value=user):
            return asyncio.run(main.api_ai_explain(request(payload), self.db))

    def switch(self, user, enabled):
        with patch.object(main, "get_current_user", return_value=user):
            return asyncio.run(main.api_admin_ai_explain(request({"enabled": enabled}), self.db))

    def test_off_by_default(self):
        self.assertEqual(asyncio.run(main.api_ai_explain_status(self.db)), {"enabled": False})
        response = self.explain(None, {"question_id": self.free_q.id, "selected_ids": [self.free_wrong.id]})
        self.assertEqual(response.status_code, 404)

    def test_only_admin_can_switch_and_key_is_required(self):
        self.assertEqual(self.switch(self.expired, True).status_code, 403)
        os.environ.pop("ANTHROPIC_API_KEY")
        result = self.switch(self.admin, True)
        self.assertEqual(result, {"switched_on": True, "key_configured": False, "enabled": False})
        os.environ["ANTHROPIC_API_KEY"] = "test-key"
        self.assertTrue(ai_explain.is_enabled(self.db))
        self.switch(self.admin, False)
        self.assertFalse(ai_explain.is_enabled(self.db))

    def test_paid_question_needs_access_free_question_does_not(self):
        self.switch(self.admin, True)
        with patch.object(ai_explain, "generate", AsyncMock(return_value="Look left first.")):
            denied = self.explain(self.expired, {"question_id": self.paid_q.id, "selected_ids": [self.paid_wrong.id]})
            self.assertEqual(denied.status_code, 403)
            guest = self.explain(None, {"question_id": self.free_q.id, "selected_ids": [self.free_wrong.id]})
        self.assertEqual(guest, {"text": "Look left first.", "cached": False})

    def test_each_case_is_generated_once_and_language_is_separate(self):
        self.switch(self.admin, True)
        payload = {"question_id": self.free_q.id, "selected_ids": [self.free_wrong.id, 999999], "lang": "en"}
        generate = AsyncMock(side_effect=["English text", "Русский текст"])
        with patch.object(ai_explain, "generate", generate):
            self.assertEqual(self.explain(None, payload)["cached"], False)
            self.assertEqual(self.explain(None, payload), {"text": "English text", "cached": True})
            self.assertEqual(self.explain(None, {**payload, "lang": "ru"})["text"], "Русский текст")
            self.assertEqual(self.explain(None, {**payload, "lang": "xx"})["cached"], True)
        self.assertEqual(generate.await_count, 2)
        stored = self.db.query(models.AiExplanation).order_by(models.AiExplanation.id).first()
        self.assertEqual(stored.selected_key, str(self.free_wrong.id))  # unknown ids are dropped

        case_text = generate.await_args_list[0].kwargs["case_text"]
        self.assertIn('"Give way" — correct; not selected', case_text)
        self.assertIn('"Drive on" — incorrect; selected by the student', case_text)
        self.assertIn("You must give way to the cyclist.", case_text)

    def test_correct_answer_is_not_sent_and_daily_limit_holds(self):
        self.switch(self.admin, True)
        generate = AsyncMock(return_value="text")
        with patch.object(ai_explain, "generate", generate):
            correct = self.explain(None, {"question_id": self.free_q.id, "selected_ids": [self.free_right.id]})
            self.assertEqual(correct.status_code, 400)
            with patch.dict(os.environ, {"AI_EXPLAIN_DAILY_LIMIT": "0"}):
                limited = self.explain(self.admin, {"question_id": self.paid_q.id, "selected_ids": []})
            self.assertEqual(limited.status_code, 429)
        generate.assert_not_awaited()

    def test_tutor_failure_is_reported_and_not_stored(self):
        self.switch(self.admin, True)
        failing = AsyncMock(side_effect=ai_explain.ExplainError("The AI tutor is not available right now."))
        with patch.object(ai_explain, "generate", failing):
            response = self.explain(None, {"question_id": self.free_q.id, "selected_ids": [self.free_wrong.id]})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(body(response)["error"], "The AI tutor is not available right now.")
        self.assertEqual(self.db.query(models.AiExplanation).count(), 0)

    def test_image_block_stays_inside_the_images_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "test-images"
            (root / "Test01").mkdir(parents=True)
            (root / "Test01" / "q1.jpg").write_bytes(b"\xff\xd8fake")
            (Path(tmp) / "secret.jpg").write_bytes(b"secret")
            block = ai_explain.image_block(root, "test-images/Test01/q1.jpg")
            self.assertEqual(block["source"]["media_type"], "image/jpeg")
            self.assertIsNone(ai_explain.image_block(root, "../secret.jpg"))
            self.assertIsNone(ai_explain.image_block(root, "Test01/missing.png"))
            self.assertIsNone(ai_explain.image_block(root, ""))


if __name__ == "__main__":
    unittest.main()
