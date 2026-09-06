import asyncio
import os
import re
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch


os.environ["SECRET_KEY"] = "results-tests-secret-key-with-enough-entropy"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.pop("REDIS_URL", None)

import main  # noqa: E402
import models  # noqa: E402
from database import SessionLocal, engine  # noqa: E402
from starlette.requests import Request  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]


def make_request(path):
    return Request({
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    })


class ResultsRenderingTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(bind=engine)
        models.Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_server_html_contains_final_score_without_javascript(self):
        user = models.User(
            email="results@example.com",
            password_hash="test",
            name="Results User",
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow(),
            is_admin=False,
        )
        test = models.Test(id=1, title="Test 1", description="")
        self.db.add_all([user, test])
        self.db.flush()
        question = models.Question(
            test_id=test.id,
            question_index=1,
            question_text="Question?",
            explanation="Explanation",
        )
        self.db.add(question)
        self.db.flush()
        correct_answer = models.Answer(
            question_id=question.id,
            text="Correct",
            is_correct=True,
        )
        self.db.add(correct_answer)
        self.db.flush()
        attempt = models.UserTestAttempt(
            user_id=user.id,
            test_id=test.id,
            started_at=datetime.utcnow(),
            finished_at=datetime.utcnow(),
            score=1,
            passed=False,
        )
        self.db.add(attempt)
        self.db.flush()
        self.db.add(models.UserAnswer(
            attempt_id=attempt.id,
            question_id=question.id,
            selected_answer_ids=f"[{correct_answer.id}]",
            is_correct=True,
        ))
        self.db.commit()

        request = make_request(f"/test/{test.id}/results/{attempt.id}")
        with patch.object(main, "get_current_user", return_value=user):
            response = asyncio.run(main.results_page(
                test.id, attempt.id, request, self.db
            ))
        html = response.body.decode("utf-8")

        self.assertIn('id="scoreDisplay">1</span>/1 correct', html)
        self.assertRegex(html, r'id="statCorrect"[^>]*>1</div>')
        self.assertRegex(html, r'id="statWrong"[^>]*>0</div>')
        self.assertRegex(html, r'id="statPct"[^>]*>100%</div>')
        self.assertIn('id="scoreBar" style="height:100%;width:100%;', html)

    def test_results_script_does_not_animate_semantic_numbers_from_zero(self):
        source = (ROOT / "static" / "js" / "results-viewer.js").read_text(encoding="utf-8")
        self.assertNotIn("requestAnimationFrame(tick)", source)
        self.assertIn("correct.textContent = SCORE", source)


if __name__ == "__main__":
    unittest.main()
