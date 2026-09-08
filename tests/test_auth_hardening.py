import os
import unittest
from datetime import datetime, timedelta


os.environ["SECRET_KEY"] = "auth-hardening-tests-secret-key-with-enough-entropy"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.pop("APP_ENV", None)
os.environ.pop("ENVIRONMENT", None)
os.environ.pop("RENDER_SERVICE_ID", None)
os.environ.pop("RENDER_EXTERNAL_URL", None)
os.environ.pop("REDIS_URL", None)

import database  # noqa: E402
import main  # noqa: E402
import models  # noqa: E402
from database import SessionLocal, engine  # noqa: E402
from sqlalchemy import inspect, text  # noqa: E402
from auth import create_token, get_current_user, verify_password  # noqa: E402
from starlette.requests import Request  # noqa: E402


class AuthHardeningTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(bind=engine)
        models.Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def make_pending(self, *, code="123456", purpose="register", plaintext=False):
        email = "learner@example.com"
        pending = models.EmailVerificationCode(
            email=email,
            name="Learner",
            password_hash=main.hash_password("Password123"),
            code=(
                code
                if plaintext
                else main.hash_email_verification_code(email, purpose, code)
            ),
            purpose=purpose,
            failed_attempts=0,
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            created_at=datetime.utcnow(),
        )
        self.db.add(pending)
        self.db.commit()
        self.db.refresh(pending)
        return pending

    def test_new_codes_are_hashed_and_match_without_plaintext_storage(self):
        pending = self.make_pending(code="654321")

        self.assertTrue(pending.code.startswith("hmac-sha256:"))
        self.assertNotIn("654321", pending.code)
        self.assertTrue(main.email_verification_code_matches(pending, "654321"))
        self.assertFalse(main.email_verification_code_matches(pending, "000000"))

    def test_password_limit_counts_utf8_bytes(self):
        self.assertIsNone(main.validate_password_strength("A1" + "x" * 70))
        self.assertIn("too long", main.validate_password_strength("A1" + "x" * 71))
        self.assertIn("too long", main.validate_password_strength("A1" + "я" * 36))

    def test_code_locks_after_five_failed_attempts(self):
        pending = self.make_pending()

        for attempt_number in range(1, main.VERIFICATION_MAX_ATTEMPTS + 1):
            user, error = main.complete_email_verification(
                self.db, pending.email, "000000"
            )
            self.assertIsNone(user)
            if attempt_number < main.VERIFICATION_MAX_ATTEMPTS:
                self.assertEqual(error, "Invalid verification code")
            else:
                self.assertIn("Too many", error)

        self.db.refresh(pending)
        self.assertEqual(pending.failed_attempts, main.VERIFICATION_MAX_ATTEMPTS)
        self.assertGreater(pending.locked_until, datetime.utcnow())
        user, error = main.complete_email_verification(
            self.db, pending.email, "123456"
        )
        self.assertIsNone(user)
        self.assertIn("Too many", error)

    def test_lockout_also_blocks_immediate_code_reissue(self):
        pending = self.make_pending()
        pending.failed_attempts = main.VERIFICATION_MAX_ATTEMPTS
        pending.locked_until = datetime.utcnow() + timedelta(minutes=5)
        self.db.commit()

        wait_seconds = main.verification_resend_wait_seconds(
            self.db, pending.email, pending.purpose
        )

        self.assertGreater(wait_seconds, 4 * 60)

    def test_successful_hashed_code_creates_account(self):
        pending = self.make_pending(code="777777")
        pending_email = pending.email

        user, error = main.complete_email_verification(
            self.db, pending_email, "777777"
        )

        self.assertIsNone(error)
        self.assertIsNotNone(user)
        self.assertEqual(user.email, pending_email)
        self.assertEqual(
            self.db.query(models.EmailVerificationCode).count(), 0
        )

    def test_short_lived_legacy_plaintext_code_remains_compatible(self):
        pending = self.make_pending(code="246810", plaintext=True)

        user, error = main.complete_email_verification(
            self.db, pending.email, "246810"
        )

        self.assertIsNone(error)
        self.assertIsNotNone(user)

    def test_reset_invalidates_old_sessions_and_code_cannot_be_reused(self):
        user = models.User(email="learner@example.com", name="Learner",
                           password_hash=main.hash_password("OldPassword123"), expires_at=datetime.utcnow())
        self.db.add(user)
        self.db.commit()
        token = create_token(user.id, user.password_hash)
        def request(value):
            return Request({"type": "http", "headers": [(b"cookie", f"token={value}".encode())]})
        self.assertIsNotNone(get_current_user(request(token), self.db))
        self.make_pending(purpose="reset_password")
        self.assertIsNone(main.complete_password_reset(self.db, user.email, "123456", "NewPassword123"))
        self.assertIsNone(get_current_user(request(token), self.db))
        self.assertFalse(verify_password("OldPassword123", user.password_hash))
        self.assertTrue(verify_password("NewPassword123", user.password_hash))
        fresh = create_token(user.id, user.password_hash)
        self.assertIsNotNone(get_current_user(request(fresh), self.db))
        self.assertIn("not found", main.complete_password_reset(self.db, user.email, "123456", "ThirdPassword123"))

    def test_expired_reset_and_wrong_codes_do_not_change_password(self):
        user = models.User(email="learner@example.com", name="Learner",
                           password_hash=main.hash_password("OldPassword123"), expires_at=datetime.utcnow())
        self.db.add(user)
        self.db.commit()
        pending = self.make_pending(purpose="reset_password")
        self.assertIn("Invalid", main.complete_password_reset(self.db, user.email, "000000", "NewPassword123"))
        pending.expires_at = datetime.utcnow() - timedelta(seconds=1)
        self.db.commit()
        self.assertIn("expired", main.complete_password_reset(self.db, user.email, "123456", "NewPassword123"))
        self.assertTrue(verify_password("OldPassword123", user.password_hash))

    def test_production_database_never_falls_back_to_sqlite(self):
        with self.assertRaises(RuntimeError):
            database._resolve_database_url({"APP_ENV": "production"})
        self.assertEqual(
            database._resolve_database_url({}),
            database.LOCAL_DATABASE_URL,
        )
        self.assertEqual(
            database._resolve_database_url({
                "APP_ENV": "production",
                "DATABASE_URL": "postgresql://example/test",
            }),
            "postgresql://example/test",
        )

    def test_existing_verification_table_is_migrated_in_place(self):
        self.db.execute(text("DROP TABLE email_verification_codes"))
        self.db.execute(text("""
            CREATE TABLE email_verification_codes (
                id INTEGER PRIMARY KEY,
                email VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                password_hash VARCHAR NOT NULL,
                code VARCHAR NOT NULL,
                purpose VARCHAR NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME
            )
        """))
        self.db.commit()

        main.ensure_email_verification_security_columns(self.db)

        columns = {
            column["name"]
            for column in inspect(engine).get_columns("email_verification_codes")
        }
        self.assertIn("failed_attempts", columns)
        self.assertIn("locked_until", columns)


if __name__ == "__main__":
    unittest.main()
