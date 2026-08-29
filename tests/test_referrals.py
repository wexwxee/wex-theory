import os
import unittest
import hashlib
import hmac
from datetime import datetime, timedelta


os.environ["SECRET_KEY"] = "referral-tests-secret-key-with-enough-entropy"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.pop("RESEND_API_KEY", None)
os.environ.pop("REDIS_URL", None)

import main  # noqa: E402
import models  # noqa: E402
from database import SessionLocal, engine  # noqa: E402


class ReferralTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(bind=engine)
        models.Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def make_user(
        self,
        email,
        code,
        *,
        age_days=10,
        ip_hash=None,
        device_hash=None,
        stripe_customer_id=None,
    ):
        user = models.User(
            email=email,
            email_canonical=main._canonicalize_referral_email(email),
            password_hash="test",
            name=email.split("@", 1)[0],
            created_at=datetime.utcnow() - timedelta(days=age_days),
            expires_at=datetime.utcnow(),
            is_admin=False,
            referral_code=code,
            referral_rewards_granted=0,
            signup_ip_hash=ip_hash,
            signup_device_hash=device_hash,
            stripe_customer_id=stripe_customer_id,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def bind(self, referrer, referred):
        return main.bind_referral_for_new_user(
            self.db,
            referred,
            referrer.referral_code,
            source="link",
        )

    def test_valid_referral_is_pending_and_only_friend_gets_initial_bonus(self):
        referrer = self.make_user("owner@example.com", "WEXR-ABC234", ip_hash="ip-a", device_hash="dev-a")
        referred = self.make_user(
            "friend@example.com", "WEXR-DEF567", age_days=0, ip_hash="ip-b", device_hash="dev-b"
        )
        referrer_expiry = referrer.expires_at

        ok, outcome = self.bind(referrer, referred)

        self.assertTrue(ok)
        self.assertEqual(outcome, "pending")
        row = self.db.query(models.Referral).one()
        self.assertEqual(row.status, "pending")
        self.assertEqual(row.reward_days_referrer, 0)
        self.assertEqual(row.reward_days_referred, main.REFERRAL_DAYS_REFERRED)
        self.assertEqual(referred.referred_by_user_id, referrer.id)
        self.assertGreater(referred.expires_at, datetime.utcnow() + timedelta(days=6))
        self.assertEqual(referrer.expires_at, referrer_expiry)

    def test_signed_referral_claim_rejects_tampering_and_expiry(self):
        token = main._sign_referral_cookie("WEXR-ABC234")
        self.assertEqual(main._decode_signed_referral_value(token), "WEXR-ABC234")
        self.assertIsNone(main._decode_signed_referral_value(token[:-1] + ("0" if token[-1] != "0" else "1")))

        old_timestamp = int((datetime.utcnow() - timedelta(days=31)).timestamp())
        payload = f"WEXR-ABC234|{old_timestamp}"
        signature = hmac.new(
            os.environ["SECRET_KEY"].encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:32]
        self.assertIsNone(main._decode_signed_referral_value(f"WEXR-ABC234.{old_timestamp}.{signature}"))

    def test_bonus_days_preserve_stripe_period_metadata(self):
        user = self.make_user(
            "paid@example.com",
            "WEXR-CDE234",
            stripe_customer_id="cus_test",
        )
        period_end = datetime.utcnow() + timedelta(days=30)
        user.current_period_end = period_end
        user.subscription_status = "active"

        new_expiry = main.apply_subscription_days(user, 14)

        self.assertEqual(user.current_period_end, period_end)
        self.assertGreater(new_expiry, period_end + timedelta(days=13))

    def test_gmail_alias_cannot_self_refer(self):
        referrer = self.make_user(
            "first.last+owner@gmail.com", "WEXR-GHJ234", ip_hash="ip-a", device_hash="dev-a"
        )
        referred = self.make_user(
            "firstlast+farm@googlemail.com", "WEXR-KLM567", age_days=0, ip_hash="ip-b", device_hash="dev-b"
        )

        ok, outcome = self.bind(referrer, referred)

        self.assertFalse(ok)
        self.assertEqual(outcome, "same_email_identity")
        row = self.db.query(models.Referral).one()
        self.assertEqual(row.status, "blocked")
        self.assertEqual(row.reward_days_referred, 0)
        self.assertIsNone(referred.referred_by_user_id)

    def test_same_device_is_blocked(self):
        referrer = self.make_user("owner@example.com", "WEXR-NPQ234", ip_hash="ip-a", device_hash="same")
        referred = self.make_user(
            "friend@example.net", "WEXR-RST567", age_days=0, ip_hash="ip-b", device_hash="same"
        )

        ok, outcome = self.bind(referrer, referred)

        self.assertFalse(ok)
        self.assertEqual(outcome, "same_device")
        self.assertEqual(self.db.query(models.Referral).one().status, "blocked")

    def test_device_cannot_claim_welcome_bonus_twice(self):
        first_referrer = self.make_user("one@example.com", "WEXR-UVW234", ip_hash="ip-a", device_hash="dev-a")
        second_referrer = self.make_user("two@example.com", "WEXR-XYZ567", ip_hash="ip-b", device_hash="dev-b")
        first_friend = self.make_user(
            "friend1@example.net", "WEXR-BCD234", age_days=0, ip_hash="ip-c", device_hash="farm-device"
        )
        second_friend = self.make_user(
            "friend2@example.net", "WEXR-EFG567", age_days=0, ip_hash="ip-d", device_hash="farm-device"
        )
        self.assertTrue(self.bind(first_referrer, first_friend)[0])

        ok, outcome = self.bind(second_referrer, second_friend)

        self.assertFalse(ok)
        self.assertEqual(outcome, "device_already_used")
        self.assertEqual(second_friend.expires_at.date(), datetime.utcnow().date())

    def test_new_referrer_cannot_create_fast_reward_chain(self):
        referrer = self.make_user(
            "new-owner@example.com", "WEXR-HJK234", age_days=0, ip_hash="ip-a", device_hash="dev-a"
        )
        referred = self.make_user(
            "friend@example.net", "WEXR-MNP567", age_days=0, ip_hash="ip-b", device_hash="dev-b"
        )

        ok, outcome = self.bind(referrer, referred)

        self.assertTrue(ok)
        self.assertEqual(outcome, "rewarded_referred_only")
        row = self.db.query(models.Referral).one()
        self.assertEqual(row.status, "referred_only")
        self.assertEqual(row.blocked_reason, "referrer_not_established")
        self.assertGreater(referred.expires_at, datetime.utcnow() + timedelta(days=6))

    def test_completing_twenty_unique_questions_rewards_inviter_once(self):
        referrer = self.make_user("owner@example.com", "WEXR-QRS234", ip_hash="ip-a", device_hash="dev-a")
        referred = self.make_user(
            "friend@example.net", "WEXR-TUV567", age_days=0, ip_hash="ip-b", device_hash="dev-b"
        )
        self.assertEqual(self.bind(referrer, referred), (True, "pending"))

        test = models.Test(id=1, title="Test", description="")
        self.db.add(test)
        self.db.flush()
        questions = []
        for index in range(1, 26):
            question = models.Question(test_id=test.id, question_index=index, question_text=f"Q{index}")
            self.db.add(question)
            questions.append(question)
        self.db.flush()
        attempt = models.UserTestAttempt(
            user_id=referred.id,
            test_id=test.id,
            started_at=datetime.utcnow() - timedelta(minutes=10),
            finished_at=datetime.utcnow(),
            score=0,
            passed=False,
        )
        self.db.add(attempt)
        self.db.flush()
        for question in questions[:20]:
            self.db.add(models.UserAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                selected_answer_ids="[]",
                is_correct=False,
            ))
        self.db.commit()

        outcome = main.qualify_pending_referral(self.db, referred, attempt)
        second_outcome = main.qualify_pending_referral(self.db, referred, attempt)

        self.assertEqual(outcome, "rewarded")
        self.assertEqual(second_outcome, "not_pending")
        row = self.db.query(models.Referral).one()
        self.assertEqual(row.status, "rewarded")
        self.assertEqual(row.reward_days_referrer, main.REFERRAL_DAYS_REFERRER)
        self.assertIsNotNone(row.qualified_at)
        self.assertEqual(referrer.referral_rewards_granted, 1)
        self.assertGreater(referrer.expires_at, datetime.utcnow() + timedelta(days=13))

    def test_fewer_than_twenty_questions_does_not_qualify(self):
        referrer = self.make_user("owner@example.com", "WEXR-WXY234", ip_hash="ip-a", device_hash="dev-a")
        referred = self.make_user(
            "friend@example.net", "WEXR-ZAB567", age_days=0, ip_hash="ip-b", device_hash="dev-b"
        )
        self.assertEqual(self.bind(referrer, referred), (True, "pending"))
        test = models.Test(id=2, title="Test", description="")
        self.db.add(test)
        self.db.flush()
        questions = []
        for index in range(1, 26):
            question = models.Question(test_id=test.id, question_index=index, question_text=f"Q{index}")
            self.db.add(question)
            questions.append(question)
        self.db.flush()
        attempt = models.UserTestAttempt(
            user_id=referred.id, test_id=test.id, started_at=datetime.utcnow(), finished_at=datetime.utcnow()
        )
        self.db.add(attempt)
        self.db.flush()
        for question in questions[:19]:
            self.db.add(models.UserAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                selected_answer_ids="[]",
                is_correct=False,
            ))
        self.db.commit()

        outcome = main.qualify_pending_referral(self.db, referred, attempt)

        self.assertEqual(outcome, "not_qualified")
        self.assertEqual(self.db.query(models.Referral).one().status, "pending")

    def test_final_annual_reward_is_trimmed_to_exact_cap(self):
        referrer = self.make_user("owner@example.com", "WEXR-DFG234", ip_hash="ip-a", device_hash="dev-a")
        old_friend = self.make_user(
            "old-friend@example.net", "WEXR-HJM567", age_days=100, ip_hash="ip-old", device_hash="dev-old"
        )
        referred = self.make_user(
            "friend@example.net", "WEXR-KNP234", age_days=0, ip_hash="ip-b", device_hash="dev-b"
        )
        self.db.add(models.Referral(
            referrer_id=referrer.id,
            referred_id=old_friend.id,
            status="rewarded",
            source="link",
            created_at=datetime.utcnow() - timedelta(days=60),
            reward_days_referrer=168,
            reward_days_referred=7,
        ))
        self.db.add(models.Referral(
            referrer_id=referrer.id,
            referred_id=referred.id,
            status="pending",
            source="link",
            reward_days_referrer=0,
            reward_days_referred=7,
        ))
        test = models.Test(id=3, title="Test", description="")
        self.db.add(test)
        self.db.flush()
        questions = []
        for index in range(1, 26):
            question = models.Question(test_id=test.id, question_index=index, question_text=f"Q{index}")
            self.db.add(question)
            questions.append(question)
        self.db.flush()
        attempt = models.UserTestAttempt(
            user_id=referred.id,
            test_id=test.id,
            started_at=datetime.utcnow() - timedelta(minutes=10),
            finished_at=datetime.utcnow(),
        )
        self.db.add(attempt)
        self.db.flush()
        for question in questions[:20]:
            self.db.add(models.UserAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                selected_answer_ids="[]",
                is_correct=False,
            ))
        self.db.commit()

        outcome = main.qualify_pending_referral(self.db, referred, attempt)

        self.assertEqual(outcome, "rewarded")
        pending_row = self.db.query(models.Referral).filter(models.Referral.referred_id == referred.id).one()
        self.assertEqual(pending_row.reward_days_referrer, 12)
        self.assertEqual(main._referral_days_used_this_year(self.db, referrer.id), 180)


if __name__ == "__main__":
    unittest.main()
