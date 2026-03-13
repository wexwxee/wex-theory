import os
import stripe


def _key() -> str:
    """Always read API key fresh from env so it works even if env is loaded after import."""
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    stripe.api_key = key
    return key


STRIPE_WEBHOOK_SECRET = ""  # read fresh in construct_webhook_event
CLIENT_URL = ""             # read fresh in each function


def _client_url() -> str:
    return os.environ.get("CLIENT_URL", "http://localhost:8000")


def _price_id() -> str:
    # Fallback to hardcoded price_id if env var not set
    return os.environ.get("STRIPE_PRICE_ID", "price_1TAXtPGsE8KZYfUOmaVbMAJj")


def get_or_create_customer(user) -> str:
    _key()
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(
        email=user.email,
        name=user.name,
        metadata={"user_id": str(user.id)},
    )
    return customer.id


def create_checkout_session(customer_id: str, user_id: int) -> str:
    _key()
    base = _client_url()
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": _price_id(), "quantity": 1}],
        mode="subscription",
        success_url=f"{base}/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base}/cancel",
        metadata={"user_id": str(user_id)},
    )
    return session.url


def create_portal_session(customer_id: str) -> str:
    _key()
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{_client_url()}/dashboard",
    )
    return session.url


def construct_webhook_event(payload: bytes, sig_header: str):
    _key()
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    return stripe.Webhook.construct_event(payload, sig_header, secret)
