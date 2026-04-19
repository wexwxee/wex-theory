import os
import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import Request
from sqlalchemy.orm import Session

SECRET_KEY = (os.environ.get("SECRET_KEY") or "").strip()
if not SECRET_KEY:
    raise ValueError(
        "SECRET_KEY environment variable is not set. "
        "The application cannot start without it. "
        "Set SECRET_KEY in your .env file or environment."
    )
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception as e:
        print(f"[VERIFY ERROR] {e}")
        return False


def create_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": datetime.utcnow() + timedelta(days=30)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        print(f"[DECODE_TOKEN] JWTError: {e!r}, token_len={len(token) if token else 0}, secret_len={len(SECRET_KEY)}")
        return None
    except Exception as e:
        print(f"[DECODE_TOKEN] Unexpected: {type(e).__name__}: {e!r}")
        return None


def get_current_user(request: Request, db: Session):
    token = request.cookies.get("token")
    if not token:
        print(f"[GET_USER] no token cookie")
        return None
    payload = decode_token(token)
    if not payload:
        print(f"[GET_USER] decode_token returned None")
        return None
    sub = payload.get("sub")
    print(f"[GET_USER] payload keys={list(payload.keys())}, sub={sub!r}")
    from models import User
    try:
        user_id = int(sub)
    except (TypeError, ValueError) as e:
        print(f"[GET_USER] sub not int-convertible: {e!r}")
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # Show what IS in the DB for diagnosis
        all_ids = [u.id for u in db.query(User).all()]
        print(f"[GET_USER] no user with id={user_id}; existing user ids in DB: {all_ids}")
    else:
        print(f"[GET_USER] resolved user id={user.id} email={user.email}")
    return user


def get_user_access_expiry(user):
    if not user:
        return None

    now = datetime.utcnow()
    expiry_candidates = []

    manual_expiry = getattr(user, "expires_at", None)
    if manual_expiry and manual_expiry > now:
        expiry_candidates.append(manual_expiry)

    subscription_status = str(getattr(user, "subscription_status", "free") or "free").lower()
    stripe_expiry = getattr(user, "current_period_end", None)
    if subscription_status in {"active", "trialing", "past_due"} and stripe_expiry and stripe_expiry > now:
        expiry_candidates.append(stripe_expiry)

    if not expiry_candidates:
        return None
    return max(expiry_candidates)


def user_has_access(user) -> bool:
    """True if user can access paid tests (Test 2+)."""
    if not user:
        return False
    # Admins always have full access
    if user.is_admin:
        return True
    return get_user_access_expiry(user) is not None
