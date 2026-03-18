import os
import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import Request
from sqlalchemy.orm import Session

SECRET_KEY = os.environ.get("SECRET_KEY", "wex-theory-secret-2026")
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
    except JWTError:
        return None


def get_current_user(request: Request, db: Session):
    token = request.cookies.get("token")
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    from models import User
    return db.query(User).filter(User.id == int(payload["sub"])).first()


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
