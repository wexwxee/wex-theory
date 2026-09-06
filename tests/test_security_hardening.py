import asyncio
import json
import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch


os.environ["SECRET_KEY"] = "security-tests-secret-key-with-enough-entropy"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.pop("REDIS_URL", None)
os.environ.pop("TRUST_PROXY_HEADERS", None)

import main  # noqa: E402
import models  # noqa: E402
from database import SessionLocal, engine  # noqa: E402
from starlette.requests import Request  # noqa: E402


def make_request(payload=None, *, client="10.0.0.5", forwarded_for=None):
    body = json.dumps(payload or {}).encode("utf-8")
    headers = [(b"content-type", b"application/json")]
    if forwarded_for is not None:
        headers.append((b"x-forwarded-for", forwarded_for.encode("ascii")))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/promo-codes/redeem",
        "raw_path": b"/api/promo-codes/redeem",
        "query_string": b"",
        "headers": headers,
        "client": (client, 12345),
        "server": ("testserver", 80),
    }
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(scope, receive)


class SecurityHardeningTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(bind=engine)
        models.Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()
        os.environ.pop("TRUST_PROXY_HEADERS", None)

    def make_user(self):
        user = models.User(
            email="promo-user@example.com",
            password_hash="test",
            name="Promo User",
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow(),
            is_admin=False,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def test_debug_environment_route_is_not_registered(self):
        paths = {getattr(route, "path", None) for route in main.app.routes}
        self.assertNotIn("/api/debug-env", paths)

    def test_admin_setup_token_is_never_accepted_in_a_get_url(self):
        setup_routes = [
            route for route in main.app.routes
            if getattr(route, "path", None) == "/setup-admin-xk92"
        ]
        self.assertEqual(len(setup_routes), 1)
        self.assertEqual(setup_routes[0].methods, {"POST"})

    def test_forwarded_for_is_ignored_until_proxy_trust_is_enabled(self):
        request = make_request(forwarded_for="198.51.100.8, 203.0.113.20")
        self.assertEqual(main.get_client_ip(request), "10.0.0.5")

    def test_trusted_proxy_uses_rightmost_valid_forwarded_address(self):
        os.environ["TRUST_PROXY_HEADERS"] = "true"
        request = make_request(forwarded_for="attacker-value, 198.51.100.8, 203.0.113.20")
        self.assertEqual(main.get_client_ip(request), "203.0.113.20")

    def test_trusted_proxy_rejects_a_malformed_closest_address(self):
        os.environ["TRUST_PROXY_HEADERS"] = "true"
        request = make_request(forwarded_for="198.51.100.8, malformed")
        self.assertEqual(main.get_client_ip(request), "10.0.0.5")

    def test_same_user_cannot_redeem_promo_twice(self):
        user = self.make_user()
        promo = models.PromoCode(
            code="WEX-ABC234",
            duration_days=7,
            max_uses=5,
            current_uses=0,
            expires_at=datetime.utcnow() + timedelta(days=1),
            is_active=True,
        )
        self.db.add(promo)
        self.db.commit()

        with patch.object(main, "get_current_user", return_value=user):
            first = asyncio.run(main.api_redeem_promo_code(
                make_request({"code": promo.code}), self.db
            ))
            expiry_after_first = user.expires_at
            second = asyncio.run(main.api_redeem_promo_code(
                make_request({"code": promo.code}), self.db
            ))

        self.db.refresh(promo)
        self.db.refresh(user)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 400)
        self.assertIn("already used", second.body.decode("utf-8"))
        self.assertEqual(promo.current_uses, 1)
        self.assertEqual(user.expires_at, expiry_after_first)
        self.assertEqual(self.db.query(models.PromoCodeRedemption).count(), 1)

    def test_different_users_can_redeem_same_promo(self):
        first_user = self.make_user()
        second_user = models.User(
            email="second-promo-user@example.com",
            password_hash="test",
            name="Second User",
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow(),
            is_admin=False,
        )
        promo = models.PromoCode(
            code="WEX-DEF567",
            duration_days=3,
            max_uses=2,
            current_uses=0,
            is_active=True,
        )
        self.db.add_all([second_user, promo])
        self.db.commit()

        with patch.object(main, "get_current_user", return_value=first_user):
            first = asyncio.run(main.api_redeem_promo_code(
                make_request({"code": promo.code}), self.db
            ))
        with patch.object(main, "get_current_user", return_value=second_user):
            second = asyncio.run(main.api_redeem_promo_code(
                make_request({"code": promo.code}), self.db
            ))

        self.db.refresh(promo)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(promo.current_uses, 2)
        self.assertFalse(promo.is_active)
        self.assertEqual(self.db.query(models.PromoCodeRedemption).count(), 2)


if __name__ == "__main__":
    unittest.main()
