import os
import stripe

STRIPE_SECRET_KEY     = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID       = os.environ.get("STRIPE_PRICE_ID", "")
CLIENT_URL            = os.environ.get("CLIENT_URL", "http://localhost:8000")

stripe.api_key = STRIPE_SECRET_KEY


def get_or_create_customer(user) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(
        email=user.email,
        name=user.name,
        metadata={"user_id": str(user.id)},
    )
    return customer.id


def create_checkout_session(customer_id: str, user_id: int) -> str:
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        mode="subscription",
        success_url=f"{CLIENT_URL}/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{CLIENT_URL}/cancel",
        metadata={"user_id": str(user_id)},
    )
    return session.url


def create_portal_session(customer_id: str) -> str:
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{CLIENT_URL}/dashboard",
    )
    return session.url


def construct_webhook_event(payload: bytes, sig_header: str):
    return stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
