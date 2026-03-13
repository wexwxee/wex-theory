import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import Request
from sqlalchemy.orm import Session

SECRET_KEY = "wex-theory-secret-2026"
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


def user_has_access(user) -> bool:
    """True if user can access paid tests (Test 2+)."""
    if not user:
        return False
    # Admins always have full access
    if user.is_admin:
        return True
    # Stripe active subscription only
    return getattr(user, "subscription_status", "free") == "active"
