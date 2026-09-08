"""Local browser-test fixture: temporary database, dummy accounts, no services."""
import os
import sys
import tempfile
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="wex-browser-") as directory:
        os.environ["DATABASE_URL"] = "sqlite:///" + str(Path(directory) / "test.db")
        os.environ["SECRET_KEY"] = "browser-tests-local-secret-key-only"
        os.environ["BASE_URL"] = "http://127.0.0.1:8765"
        os.environ["COOKIE_SECURE"] = "false"
        os.environ["SESSION_COOKIE_SECURE"] = "false"
        for key in ("REDIS_URL", "RESEND_API_KEY", "STRIPE_SECRET_KEY", "SMTP_PASSWORD"):
            os.environ.pop(key, None)
        import main
        import models
        from database import SessionLocal, engine
        from import_data import import_data
        import uvicorn

        # Test-only mailbox. This route is never registered by the application launcher.
        outbox = []

        def capture_mail(email, code, name, url):
            outbox.append({"email": email, "code": code, "url": url})

        main.is_email_service_configured = lambda: True
        main.send_verification_email = capture_mail
        main.send_password_reset_email = capture_mail

        @main.app.get('/__test/mailbox')
        def mailbox():
            return outbox

        import_data()
        with SessionLocal() as db:
            for index in (1, 2, 3):
                user = models.User(name=f"Browser Learner {index}", email=f"browser{index}@example.com",
                                   public_id=f"WEX-BROWSER-{index}",
                                   password_hash=main.hash_password("BrowserTest123"),
                                   expires_at=datetime.utcnow() + timedelta(days=30 if index != 3 else -1))
                db.add(user)
                db.flush()
                attempt = models.UserTestAttempt(user_id=user.id, test_id=1, score=0, passed=False,
                                                finished_at=datetime.utcnow())
                db.add(attempt)
                db.flush()
                for question in db.query(models.Question).filter_by(test_id=1).limit(2).all():
                    db.add(models.UserAnswer(attempt_id=attempt.id, question_id=question.id,
                                             selected_answer_ids="[]", is_correct=False))
            db.add(models.User(name='Browser Admin', email='browser-admin@example.com',
                               password_hash=main.hash_password('BrowserAdmin123'),
                               public_id='WEX-BROWSER-ADMIN', is_admin=True, is_super_admin=True,
                               expires_at=datetime.utcnow() + timedelta(days=30)))
            db.commit()
            main.ensure_exam_mode_test(db)
        try:
            uvicorn.run(main.app, host="127.0.0.1", port=8765, lifespan="off", log_level="warning")
        finally:
            engine.dispose()
