import json
import os
import random
import re
import secrets
from collections import Counter, defaultdict, deque
import traceback
from pathlib import Path
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Optional
from urllib.parse import urlencode, quote
from fastapi import FastAPI, Request, Depends, HTTPException, Header, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func as sql_func, inspect as sql_inspect, text as sql_text, or_ as sql_or
from authlib.integrations.starlette_client import OAuth
import httpx

# Prometheus metrics (graceful: app must not crash if package missing)
try:
    from prometheus_fastapi_instrumentator import Instrumentator as _PromInstrumentator
except Exception as _e:
    _PromInstrumentator = None
    print(f"[METRICS] prometheus_fastapi_instrumentator unavailable: {_e}")

import models
from auth import (
    hash_password, verify_password, create_token, decode_token,
    get_current_user, user_has_access, get_user_access_expiry, SECRET_KEY,
)
from database import engine, get_db
from stripe_helpers import (
    get_or_create_customer, create_checkout_session,
    create_portal_session, construct_webhook_event,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WEX Theory")

# Instrument app with Prometheus metrics. /metrics endpoint is added later
# with an admin-only guard via a dependency.
if _PromInstrumentator is not None:
    try:
        _instrumentator = _PromInstrumentator(
            should_group_status_codes=True,
            should_ignore_untemplated=True,
            excluded_handlers=["/metrics", "/uploads/.*", "/static/.*"],
        ).instrument(app)
        print("[METRICS] Prometheus instrumentation enabled")
    except Exception as _e:
        _instrumentator = None
        print(f"[METRICS] Failed to enable instrumentation: {_e}")
else:
    _instrumentator = None

AUTH_COOKIE_NAME = "token"
CSRF_COOKIE_NAME = "csrf_token"
ACTIVITY_COOKIE_NAME = "wex_activity_sid"
AUTH_COOKIE_MAX_AGE = 86400 * 30
CSRF_COOKIE_MAX_AGE = 86400 * 30
ACTIVITY_COOKIE_MAX_AGE = 86400 * 30
ACTIVITY_ONLINE_WINDOW = timedelta(minutes=2)
ACTIVITY_5_MIN_WINDOW = timedelta(minutes=5)
ACTIVITY_10_MIN_WINDOW = timedelta(minutes=10)
ACTIVITY_RETENTION_WINDOW = timedelta(hours=24)
PUBLIC_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
BASE_DIR = Path(__file__).resolve().parent
CONTACT_UPLOAD_DIR = BASE_DIR / "uploads" / "contact"
SUPPORT_UPLOAD_DIR = BASE_DIR / "uploads" / "support"
ALLOWED_CONTACT_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt", ".log", ".json"}
MAX_CONTACT_UPLOAD_BYTES = 10 * 1024 * 1024

# Magic byte signatures for binary file types
MAGIC_SIGNATURES: dict[str, list[bytes]] = {
    ".png":  [b"\x89PNG\r\n\x1a\n"],
    ".jpg":  [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".gif":  [b"GIF87a", b"GIF89a"],
    ".pdf":  [b"%PDF"],
    ".webp": [b"RIFF"],  # RIFF....WEBP
}
# Text-based extensions (.txt, .log, .json) are not checked by magic bytes


def validate_file_magic(file_obj, ext: str) -> bool:
    """Validate that the file content matches the expected magic bytes for its extension."""
    signatures = MAGIC_SIGNATURES.get(ext)
    if signatures is None:
        return True  # text-based formats — no magic bytes to check
    header = file_obj.read(12)
    file_obj.seek(0)
    if not header:
        return False
    if ext == ".webp":
        return header[:4] == b"RIFF" and header[8:12] == b"WEBP"
    return any(header.startswith(sig) for sig in signatures)
CONTACT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SUPPORT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
QUESTION_TEXT_FIXES = {
    "You are required to turn right at the signal-controlled junction. There is no traffic directly behind you. How should":
        "You are required to turn right at the signal-controlled junction. There is no traffic directly behind you. How should you proceed?"
}
SYSTEM_SUPPORT_SENDERS = ["WEX Assistant", "Mia", "Nora", "Alex", "Support Bot"]
SYSTEM_SUPPORT_MESSAGES = [
    "Your request has been received. Please wait up to 32 hours for a reply from support.",
    "We received your message. Support usually replies within 32 hours.",
    "Thanks, your request is now in queue. We normally answer within 32 hours.",
]
PRIMARY_SUPER_ADMIN_EMAIL = "wexwxee@gmail.com"
TEMP_EMAIL_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "yopmail.com", "tempmail.com",
    "10minutemail.com", "sharklasers.com", "trashmail.com", "getnada.com",
    "dispostable.com", "maildrop.cc", "emailondeck.com", "temp-mail.org",
}
EMAIL_REGEX = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)
VERIFICATION_EMAIL_SENDER = "WEXTheory <no-reply@mail.wextheory.cv>"
RATE_LIMIT_BUCKETS: dict[str, deque] = defaultdict(deque)
RATE_LIMIT_CONFIG = {
    "auth_login": (8, 300),
    "auth_register": (5, 3600),
    "auth_register_verify": (12, 900),
    "auth_forgot_password": (5, 3600),
    "auth_reset_password": (8, 1800),
    "google_login": (10, 600),
    "contact_submit": (6, 1800),
    "support_reply": (30, 300),
}

# ─── Redis Rate Limiting (graceful fallback to in-memory) ─────────────────────
_redis_client = None
_REDIS_URL = (os.environ.get("REDIS_URL") or "").strip()

if _REDIS_URL:
    try:
        import redis as _redis_mod
        _redis_client = _redis_mod.Redis.from_url(
            _REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=2,
        )
        _redis_client.ping()
        print(f"[RATE LIMIT] Connected to Redis")
    except Exception as _e:
        _redis_client = None
        print(f"[RATE LIMIT] WARNING: Redis unavailable ({_e}), falling back to in-memory")
else:
    print("[RATE LIMIT] REDIS_URL not set, using in-memory rate limiting")


def _rate_limit_check_redis(key: str, limit: int, window: int) -> bool:
    """Sliding-window rate limit via Redis sorted set. Returns True if over limit."""
    import time as _time
    now = _time.time()
    pipe = _redis_client.pipeline(transaction=True)
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zcard(key)
    pipe.zadd(key, {f"{now}": now})
    pipe.expire(key, window)
    results = pipe.execute()
    count = results[1]
    if count >= limit:
        _redis_client.zrem(key, f"{now}")
        return True
    return False


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _cookie_secure(request: Optional[Request] = None) -> bool:
    if "COOKIE_SECURE" in os.environ:
        return _env_flag("COOKIE_SECURE")
    if request is None:
        return False
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    if forwarded_proto:
        return forwarded_proto.split(",")[0].strip().lower() == "https"
    return request.url.scheme == "https"


def _session_cookie_secure_default() -> bool:
    if "SESSION_COOKIE_SECURE" in os.environ:
        return _env_flag("SESSION_COOKIE_SECURE")
    base_url = _clean_env_value("BASE_URL")
    if base_url:
        return base_url.lower().startswith("https://")
    render_url = _clean_env_value("RENDER_EXTERNAL_URL")
    if render_url:
        return render_url.lower().startswith("https://")
    return False


def build_content_security_policy(request: Request) -> str:
    nonce = getattr(request.state, "csp_nonce", "")
    nonce_src = f"'nonce-{nonce}'" if nonce else ""
    script_src = ["'self'", "https://cdn.jsdelivr.net"]
    if nonce_src:
        script_src.append(nonce_src)
    # style-src keeps 'unsafe-inline' because 600+ inline style="..." attributes
    # across templates cannot use nonces — only <style> blocks can.
    directives = {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'self'"],
        "form-action": ["'self'"],
        "script-src": script_src,
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "connect-src": ["'self'"],
    }
    return "; ".join(f"{name} {' '.join(values)}" for name, values in directives.items())


def set_auth_cookie(response, token: str, request: Optional[Request] = None) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=AUTH_COOKIE_MAX_AGE,
        expires=AUTH_COOKIE_MAX_AGE,
        samesite="lax",
        secure=_cookie_secure(request),
        path="/",
    )


def clear_auth_cookie(response, request: Optional[Request] = None) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        samesite="lax",
        secure=_cookie_secure(request),
    )


def set_csrf_cookie(response, token: str, request: Optional[Request] = None) -> None:
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        max_age=CSRF_COOKIE_MAX_AGE,
        expires=CSRF_COOKIE_MAX_AGE,
        samesite="lax",
        secure=_cookie_secure(request),
        path="/",
    )


def set_activity_cookie(response, session_id: str, request: Optional[Request] = None) -> None:
    response.set_cookie(
        key=ACTIVITY_COOKIE_NAME,
        value=session_id,
        httponly=True,
        max_age=ACTIVITY_COOKIE_MAX_AGE,
        expires=ACTIVITY_COOKIE_MAX_AGE,
        samesite="lax",
        secure=_cookie_secure(request),
        path="/",
    )


def get_or_create_activity_session_id(request: Request) -> str:
    current = (request.cookies.get(ACTIVITY_COOKIE_NAME) or "").strip()
    return current or secrets.token_urlsafe(24)


def get_client_ip(request: Request) -> str:
    forwarded_for = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded_for:
        return forwarded_for
    client = request.client.host if request.client else ""
    return client or "unknown"


def check_rate_limit(
    request: Request,
    scope: str,
    *,
    message: str,
    redirect_to: Optional[str] = None,
    redirect_param: str = "error",
) -> Optional[JSONResponse | RedirectResponse]:
    global _redis_client
    limit, window_seconds = RATE_LIMIT_CONFIG[scope]
    key = f"rl:{scope}:{get_client_ip(request)}"
    over_limit = False

    # Try Redis first, fall back to in-memory on any error
    if _redis_client is not None:
        try:
            over_limit = _rate_limit_check_redis(key, limit, window_seconds)
        except Exception as e:
            print(f"[RATE LIMIT] Redis error, falling back to in-memory: {e}")
            _redis_client = None
            over_limit = _rate_limit_check_memory(key, limit, window_seconds)
    else:
        over_limit = _rate_limit_check_memory(key, limit, window_seconds)

    if over_limit:
        if redirect_to:
            separator = "&" if "?" in redirect_to else "?"
            return RedirectResponse(f"{redirect_to}{separator}{redirect_param}={quote(message)}", status_code=302)
        return JSONResponse({"error": message}, status_code=429)
    return None


def _rate_limit_check_memory(key: str, limit: int, window_seconds: int) -> bool:
    """In-memory sliding window rate limit. Returns True if over limit."""
    now = datetime.utcnow().timestamp()
    bucket = RATE_LIMIT_BUCKETS[key]
    while bucket and now - bucket[0] > window_seconds:
        bucket.popleft()
    if len(bucket) >= limit:
        return True
    bucket.append(now)
    return False


def get_or_create_csrf_token(request: Request) -> str:
    token = (request.cookies.get(CSRF_COOKIE_NAME) or "").strip()
    return token or secrets.token_urlsafe(32)


def is_same_origin_request(request: Request) -> bool:
    origin = (request.headers.get("origin") or "").strip()
    if not origin:
        return True
    return origin.rstrip("/") == get_request_base_url(request).rstrip("/")


def _new_public_user_id() -> str:
    return "WEX-" + "".join(secrets.choice(PUBLIC_ID_ALPHABET) for _ in range(8))


def is_email_service_configured() -> bool:
    return bool((os.environ.get("RESEND_API_KEY") or "").strip())


def _clean_env_value(name: str, default: str = "") -> str:
    value = os.environ.get(name, default)
    if value is None:
        return ""
    return str(value).strip().strip('"').strip("'").strip()


BOOTSTRAP_ADMIN_PASSWORD = _clean_env_value("BOOTSTRAP_ADMIN_PASSWORD")
ADMIN_SETUP_TOKEN = _clean_env_value("ADMIN_SETUP_TOKEN")


def get_public_base_url(request: Optional[Request] = None) -> str:
    configured = _clean_env_value("BASE_URL")
    if configured:
        return configured.rstrip("/")
    if request is not None:
        return str(request.base_url).rstrip("/")
    return ""


def get_request_base_url(request: Request) -> str:
    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip()
    forwarded_host = (request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
    if forwarded_proto and forwarded_host:
        return f"{forwarded_proto}://{forwarded_host}".rstrip("/")
    host = request.headers.get("host", "").strip()
    if host:
        return f"{request.url.scheme}://{host}".rstrip("/")
    return str(request.base_url).rstrip("/")


def normalize_activity_path(path: str) -> str:
    raw = str(path or "").strip()
    if not raw:
        return "/"
    if not raw.startswith("/"):
        raw = "/" + raw

    path_only = raw.split("?", 1)[0].split("#", 1)[0].strip() or "/"
    if path_only != "/" and path_only.endswith("/"):
        path_only = path_only.rstrip("/")

    if path_only.startswith("/api/") or path_only.startswith("/static/"):
        return ""
    if path_only.startswith("/test-images/") or path_only.startswith("/uploads/"):
        return ""

    parts = [part for part in path_only.split("/") if part]
    if not parts:
        return "/"

    normalized_parts: list[str] = []
    for index, part in enumerate(parts):
        if index == 1 and parts[0] == "test" and part.isdigit():
            normalized_parts.append(part)
            continue
        if part.isdigit():
            normalized_parts.append(":id")
            continue
        if re.fullmatch(r"[0-9a-fA-F\-]{8,}", part):
            normalized_parts.append(":id")
            continue
        normalized_parts.append(part)

    return "/" + "/".join(normalized_parts)


def build_live_activity_overview(db: Session) -> dict:
    now = datetime.utcnow()
    recent_cutoff = now - ACTIVITY_10_MIN_WINDOW
    rows = (
        db.query(models.LiveActivitySession)
        .filter(models.LiveActivitySession.last_seen >= recent_cutoff)
        .all()
    )

    online_cutoff = now - ACTIVITY_ONLINE_WINDOW
    active_5_cutoff = now - ACTIVITY_5_MIN_WINDOW

    online_rows = [row for row in rows if row.last_seen >= online_cutoff]
    latest_online_by_session: dict[str, models.LiveActivitySession] = {}
    for row in online_rows:
        previous = latest_online_by_session.get(row.session_id)
        if previous is None or row.last_seen > previous.last_seen:
            latest_online_by_session[row.session_id] = row

    online_sessions = set(latest_online_by_session.keys())
    active_5_sessions = {row.session_id for row in rows if row.last_seen >= active_5_cutoff}
    active_10_sessions = {row.session_id for row in rows}
    logged_in_online = sum(1 for row in latest_online_by_session.values() if row.is_authenticated)
    guests_online = max(len(online_sessions) - logged_in_online, 0)

    page_counts = Counter(row.page_path for row in online_rows if row.page_path)
    top_pages = [
        {"path": path, "count": count}
        for path, count in page_counts.most_common(6)
    ]

    return {
        "online_now": len(online_sessions),
        "active_5m": len(active_5_sessions),
        "active_10m": len(active_10_sessions),
        "logged_in_now": logged_in_online,
        "guests_now": guests_online,
        "top_pages": top_pages,
    }


def validate_registration_email(email: str) -> Optional[str]:
    if not email:
        return "Email is required"
    if not EMAIL_REGEX.match(email):
        return "Enter a valid email address"
    domain = email.split("@", 1)[1].lower()
    if domain in TEMP_EMAIL_DOMAINS:
        return "Temporary email addresses are not allowed"
    return None


def validate_password_strength(password: str) -> Optional[str]:
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r"[A-Za-z]", password):
        return "Password must contain at least one letter"
    if not re.search(r"\d", password):
        return "Password must contain at least one number"
    return None


def generate_email_verification_code() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(6))


def compute_admin_expiry(duration_value: int, duration_unit: str) -> datetime:
    unit = (duration_unit or "days").strip().lower()
    value = max(int(duration_value), 0)
    if value == 0:
        return datetime.utcnow()
    if unit == "minutes":
        return datetime.utcnow() + timedelta(minutes=value)
    if unit == "hours":
        return datetime.utcnow() + timedelta(hours=value)
    return datetime.utcnow() + timedelta(days=value)


def generate_unique_promo_code(db: Session) -> str:
    while True:
        code = "WEX-" + "".join(secrets.choice(PUBLIC_ID_ALPHABET) for _ in range(6))
        exists = db.query(models.PromoCode).filter(models.PromoCode.code == code).first()
        if not exists:
            return code


def apply_subscription_days(user: models.User, duration_days: int) -> datetime:
    now = datetime.utcnow()
    base_expiry = get_user_access_expiry(user) if user else None
    start_from = base_expiry if base_expiry and base_expiry > now else now
    new_expiry = start_from + timedelta(days=max(int(duration_days), 0))
    user.expires_at = new_expiry
    if duration_days > 0:
        user.subscription_status = "active"
    user.current_period_end = None
    return new_expiry


def get_promo_status(promo: models.PromoCode) -> str:
    now = datetime.utcnow()
    if not promo.is_active:
        return "Inactive"
    if promo.expires_at and promo.expires_at < now:
        return "Expired"
    if promo.max_uses is not None and promo.current_uses >= promo.max_uses:
        return "Used up"
    return "Active"


def is_super_admin_user(user: Optional[models.User]) -> bool:
    return bool(user and getattr(user, "is_super_admin", False))


def can_manage_admin_roles(actor: Optional[models.User]) -> bool:
    return is_super_admin_user(actor)


def is_protected_admin(target: Optional[models.User]) -> bool:
    return bool(target and getattr(target, "is_admin", False))


def render_verification_email_html(recipient_name: str, confirm_url: str, code: str) -> str:
    return templates.env.get_template("emails/verification_email.html").render(
        recipient_name=recipient_name,
        confirm_url=confirm_url,
        fallback_url=confirm_url,
        verification_code=code,
    )


def render_password_reset_email_html(recipient_name: str, reset_url: str, code: str) -> str:
    return templates.env.get_template("emails/password_reset_email.html").render(
        recipient_name=recipient_name,
        reset_url=reset_url,
        fallback_url=reset_url,
        reset_code=code,
    )


def render_account_removed_email_html(recipient_name: str) -> str:
    return templates.env.get_template("emails/account_removed_email.html").render(
        recipient_name=recipient_name,
        support_email="wexwxee@gmail.com",
        support_telegram="@wexwxeee",
    )


def send_verification_email(recipient_email: str, code: str, recipient_name: str, confirm_url: str) -> None:
    if not is_email_service_configured():
        raise RuntimeError("Email verification is not configured yet")

    resend_api_key = _clean_env_value("RESEND_API_KEY")
    configured_sender = _clean_env_value("RESEND_FROM_EMAIL", VERIFICATION_EMAIL_SENDER)
    sender = VERIFICATION_EMAIL_SENDER
    resend_api_url = _clean_env_value("RESEND_API_URL", "https://api.resend.com/emails")

    if not resend_api_key:
        raise RuntimeError("RESEND_API_KEY is empty")
    if configured_sender and configured_sender != VERIFICATION_EMAIL_SENDER:
        print(f"[EMAIL API] RESEND_FROM_EMAIL overridden to required sender {VERIFICATION_EMAIL_SENDER!r} (configured={configured_sender!r})")

    payload = {
        "from": sender,
        "to": [recipient_email],
        "subject": "Confirm your email for WEXTheory",
        "html": render_verification_email_html(recipient_name, confirm_url, code),
        "text": (
            f"Hello {recipient_name},\n\n"
            "Confirm your email to finish creating your WEXTheory account.\n\n"
            f"Verification code: {code}\n"
            f"Confirm link: {confirm_url}\n\n"
            "The verification link and code expire in 10 minutes.\n"
            "If you did not request this, you can ignore this email.\n"
        ),
    }

    print("[EMAIL API] provider='resend' url=%r from=%r to=%r" % (resend_api_url, sender, recipient_email))

    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            resend_api_url,
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Resend API error {response.status_code}: {response.text[:300]}")


def send_account_removed_email(recipient_email: str, recipient_name: str) -> None:
    if not is_email_service_configured():
        print(f"[EMAIL API] account_removed skipped: email service not configured for {recipient_email!r}")
        return

    resend_api_key = _clean_env_value("RESEND_API_KEY")
    configured_sender = _clean_env_value("RESEND_FROM_EMAIL", VERIFICATION_EMAIL_SENDER)
    sender = VERIFICATION_EMAIL_SENDER
    resend_api_url = _clean_env_value("RESEND_API_URL", "https://api.resend.com/emails")

    if not resend_api_key:
        raise RuntimeError("RESEND_API_KEY is empty")
    if configured_sender and configured_sender != VERIFICATION_EMAIL_SENDER:
        print(f"[EMAIL API] RESEND_FROM_EMAIL overridden to required sender {VERIFICATION_EMAIL_SENDER!r} (configured={configured_sender!r})")

    payload = {
        "from": sender,
        "to": [recipient_email],
        "subject": "Your WEXTheory account has been removed",
        "html": render_account_removed_email_html(recipient_name),
        "text": (
            f"Hello {recipient_name},\n\n"
            "Your WEXTheory account has been removed by administration.\n\n"
            "If you believe this was a mistake or would like to request a review, please contact us and we will look into it.\n\n"
            "Email: wexwxee@gmail.com\n"
            "Telegram: @wexwxeee\n\n"
            "Best regards,\n"
            "WEXTheory"
        ),
    }

    print("[EMAIL API] provider='resend' kind='account_removed' url=%r from=%r to=%r" % (resend_api_url, sender, recipient_email))

    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            resend_api_url,
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Resend API error {response.status_code}: {response.text[:300]}")


def send_password_reset_email(recipient_email: str, code: str, recipient_name: str, reset_url: str) -> None:
    if not is_email_service_configured():
        raise RuntimeError("Email verification is not configured yet")

    resend_api_key = _clean_env_value("RESEND_API_KEY")
    configured_sender = _clean_env_value("RESEND_FROM_EMAIL", VERIFICATION_EMAIL_SENDER)
    sender = VERIFICATION_EMAIL_SENDER
    resend_api_url = _clean_env_value("RESEND_API_URL", "https://api.resend.com/emails")

    if not resend_api_key:
        raise RuntimeError("RESEND_API_KEY is empty")
    if configured_sender and configured_sender != VERIFICATION_EMAIL_SENDER:
        print(f"[EMAIL API] RESEND_FROM_EMAIL overridden to required sender {VERIFICATION_EMAIL_SENDER!r} (configured={configured_sender!r})")

    payload = {
        "from": sender,
        "to": [recipient_email],
        "subject": "Reset your WEXTheory password",
        "html": render_password_reset_email_html(recipient_name, reset_url, code),
        "text": (
            f"Hello {recipient_name},\n\n"
            "We received a request to reset your WEXTheory password.\n\n"
            f"Reset code: {code}\n"
            f"Reset link: {reset_url}\n\n"
            "The reset link and code expire in 10 minutes.\n"
            "If you did not request this, you can ignore this email.\n"
        ),
    }

    print("[EMAIL API] provider='resend' kind='password_reset' url=%r from=%r to=%r" % (resend_api_url, sender, recipient_email))

    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            resend_api_url,
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Resend API error {response.status_code}: {response.text[:300]}")


def generate_unique_public_user_id(db: Session) -> str:
    while True:
        candidate = _new_public_user_id()
        exists = db.query(models.User).filter(models.User.public_id == candidate).first()
        if not exists:
            return candidate


def ensure_user_public_id_column(db: Session) -> None:
    try:
        inspector = sql_inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("users")}
        if "public_id" not in columns:
            db.execute(sql_text("ALTER TABLE users ADD COLUMN public_id VARCHAR"))
            db.commit()
            print("[STARTUP] Added users.public_id column")
        db.execute(sql_text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_public_id ON users (public_id)"))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] public_id column setup skipped/error: {e}")


def ensure_super_admin_column(db: Session) -> None:
    try:
        inspector = sql_inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("users")}
        if "is_super_admin" not in columns:
            db.execute(sql_text("ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE"))
            db.commit()
            print("[STARTUP] Added users.is_super_admin column")
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] super admin column setup skipped/error: {e}")


def ensure_primary_super_admin(db: Session) -> None:
    try:
        db.query(models.User).filter(
            models.User.email != PRIMARY_SUPER_ADMIN_EMAIL,
            models.User.is_super_admin == True,
        ).update({models.User.is_super_admin: False}, synchronize_session=False)
        db.query(models.User).filter(
            models.User.email == PRIMARY_SUPER_ADMIN_EMAIL
        ).update(
            {
                models.User.is_admin: True,
                models.User.is_super_admin: True,
            },
            synchronize_session=False,
        )
        db.commit()
        print(f"[STARTUP] Super admin enforced for {PRIMARY_SUPER_ADMIN_EMAIL}")
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] super admin enforcement skipped/error: {e}")


def ensure_all_user_public_ids(db: Session) -> None:
    missing_users = db.query(models.User).filter(
        (models.User.public_id.is_(None)) | (models.User.public_id == "")
    ).all()
    if not missing_users:
        return
    for user in missing_users:
        user.public_id = generate_unique_public_user_id(db)
    db.commit()
    print(f"[STARTUP] Assigned public IDs to {len(missing_users)} users")


def ensure_contact_attachment_columns(db: Session) -> None:
    try:
        inspector = sql_inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("contact_messages")}
        for name in ("attachment_name", "attachment_path", "attachment_type"):
            if name not in columns:
                db.execute(sql_text(f"ALTER TABLE contact_messages ADD COLUMN {name} VARCHAR"))
                db.commit()
                print(f"[STARTUP] Added contact_messages.{name} column")
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] attachment column setup skipped/error: {e}")


def ensure_support_message_columns(db: Session) -> None:
    try:
        inspector = sql_inspect(engine)
        if "support_messages" not in inspector.get_table_names():
            return
        columns = {col["name"] for col in inspector.get_columns("support_messages")}
        if "sender_name" not in columns:
            db.execute(sql_text("ALTER TABLE support_messages ADD COLUMN sender_name VARCHAR"))
            db.commit()
            print("[STARTUP] Added support_messages.sender_name column")
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] support_messages column setup skipped/error: {e}")


def ensure_promo_codes_table(db: Session) -> None:
    try:
        inspector = sql_inspect(engine)
        if "promo_codes" not in inspector.get_table_names():
            models.PromoCode.__table__.create(bind=engine, checkfirst=True)
            print("[STARTUP] Created promo_codes table")
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] promo_codes table setup skipped/error: {e}")


def ensure_attempt_question_order_column(db: Session) -> None:
    try:
        inspector = sql_inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("user_test_attempts")}
        if "question_order_json" not in columns:
            db.execute(sql_text("ALTER TABLE user_test_attempts ADD COLUMN question_order_json TEXT"))
            db.commit()
            print("[STARTUP] Added user_test_attempts.question_order_json column")
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] attempt question order setup skipped/error: {e}")


def ensure_exam_wording_columns(db: Session) -> None:
    try:
        inspector = sql_inspect(engine)
        question_columns = {col["name"] for col in inspector.get_columns("questions")}
        if "exam_style_text" not in question_columns:
            db.execute(sql_text("ALTER TABLE questions ADD COLUMN exam_style_text TEXT"))
            db.commit()
            print("[STARTUP] Added questions.exam_style_text column")

        answer_columns = {col["name"] for col in inspector.get_columns("answers")}
        if "exam_style_text" not in answer_columns:
            db.execute(sql_text("ALTER TABLE answers ADD COLUMN exam_style_text TEXT"))
            db.commit()
            print("[STARTUP] Added answers.exam_style_text column")

        attempt_columns = {col["name"] for col in inspector.get_columns("user_test_attempts")}
        if "wording_mode" not in attempt_columns:
            db.execute(sql_text("ALTER TABLE user_test_attempts ADD COLUMN wording_mode VARCHAR DEFAULT 'original'"))
            db.commit()
            print("[STARTUP] Added user_test_attempts.wording_mode column")
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] exam wording columns setup skipped/error: {e}")


def ensure_translation_columns(db: Session) -> None:
    """Add Russian translation columns and word_translations table if missing."""
    try:
        inspector = sql_inspect(engine)
        question_columns = {col["name"] for col in inspector.get_columns("questions")}
        if "question_text_ru" not in question_columns:
            db.execute(sql_text("ALTER TABLE questions ADD COLUMN question_text_ru TEXT"))
            db.commit()
            print("[STARTUP] Added questions.question_text_ru column")
        if "explanation_ru" not in question_columns:
            db.execute(sql_text("ALTER TABLE questions ADD COLUMN explanation_ru TEXT"))
            db.commit()
            print("[STARTUP] Added questions.explanation_ru column")

        answer_columns = {col["name"] for col in inspector.get_columns("answers")}
        if "text_ru" not in answer_columns:
            db.execute(sql_text("ALTER TABLE answers ADD COLUMN text_ru TEXT"))
            db.commit()
            print("[STARTUP] Added answers.text_ru column")

        # word_translations table is created by metadata.create_all on startup
        existing_tables = set(inspector.get_table_names())
        if "word_translations" not in existing_tables:
            models.Base.metadata.tables["word_translations"].create(bind=engine)
            print("[STARTUP] Created word_translations table")
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] translation columns setup skipped/error: {e}")


def ensure_exam_mode_test(db: Session) -> None:
    try:
        exam_test = db.query(models.Test).filter(models.Test.id == EXAM_MODE_TEST_ID).first()
        if not exam_test:
            db.add(models.Test(
                id=EXAM_MODE_TEST_ID,
                title=EXAM_MODE_TEST_TITLE,
                description=EXAM_MODE_TEST_DESCRIPTION,
            ))
            db.commit()
            print("[STARTUP] Created Exam Mode test row")
        else:
            updated = False
            if exam_test.title != EXAM_MODE_TEST_TITLE:
                exam_test.title = EXAM_MODE_TEST_TITLE
                updated = True
            if exam_test.description != EXAM_MODE_TEST_DESCRIPTION:
                exam_test.description = EXAM_MODE_TEST_DESCRIPTION
                updated = True
            if updated:
                db.commit()
                print("[STARTUP] Updated Exam Mode test metadata")
    except Exception as e:
        db.rollback()
        print(f"[STARTUP] exam mode test setup skipped/error: {e}")


def save_contact_attachment(upload: UploadFile) -> tuple[str, str, str]:
    original_name = os.path.basename(upload.filename or "").strip()
    if not original_name:
        raise ValueError("Attachment filename is missing")

    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_CONTACT_EXTENSIONS:
        raise ValueError("Allowed files: images, PDF, TXT, LOG, JSON")

    if not validate_file_magic(upload.file, ext):
        raise ValueError("File content does not match its extension")

    CONTACT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(6)}{ext}"
    stored_path = CONTACT_UPLOAD_DIR / stored_name

    size = 0
    with stored_path.open("wb") as f:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_CONTACT_UPLOAD_BYTES:
                f.close()
                stored_path.unlink(missing_ok=True)
                raise ValueError("Attachment is too large. Max size is 10 MB")
            f.write(chunk)

    return original_name, f"/uploads/contact/{stored_name}", (upload.content_type or "")


def save_support_attachment(upload: UploadFile) -> tuple[str, str, str]:
    original_name = os.path.basename(upload.filename or "").strip()
    if not original_name:
        raise ValueError("Attachment filename is missing")

    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_CONTACT_EXTENSIONS:
        raise ValueError("Allowed files: images, PDF, TXT, LOG, JSON")

    if not validate_file_magic(upload.file, ext):
        raise ValueError("File content does not match its extension")

    SUPPORT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(6)}{ext}"
    stored_path = SUPPORT_UPLOAD_DIR / stored_name

    size = 0
    with stored_path.open("wb") as f:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_CONTACT_UPLOAD_BYTES:
                f.close()
                stored_path.unlink(missing_ok=True)
                raise ValueError("Attachment is too large. Max size is 10 MB")
            f.write(chunk)

    return original_name, f"/uploads/support/{stored_name}", (upload.content_type or "")


def get_uploaded_file(value) -> Optional[UploadFile]:
    if value is None:
        return None
    filename = getattr(value, "filename", None)
    file_obj = getattr(value, "file", None)
    if filename and file_obj is not None:
        return value
    return None


def create_support_system_message(db: Session, thread_id: int) -> None:
    sender_name = secrets.choice(SYSTEM_SUPPORT_SENDERS)
    body = secrets.choice(SYSTEM_SUPPORT_MESSAGES)
    db.add(models.SupportMessage(
        thread_id=thread_id,
        sender_role="system",
        sender_name=sender_name,
        body=body,
        read_by_user=True,
        read_by_admin=True,
        created_at=datetime.utcnow(),
    ))


def serialize_support_message(message: models.SupportMessage) -> dict:
    attachment_name = message.attachment_name or ""
    lower_name = attachment_name.lower()
    is_image = bool(message.attachment_path) and lower_name.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif"))
    return {
        "id": message.id,
        "sender_role": message.sender_role,
        "sender_name": message.sender_name or ("Support" if message.sender_role == "admin" else "System" if message.sender_role == "system" else "User"),
        "body": message.body or "",
        "attachment_name": attachment_name,
        "attachment_path": message.attachment_path or "",
        "attachment_type": message.attachment_type or "",
        "is_image": is_image,
        "created_at": message.created_at.strftime("%d %b %Y %H:%M"),
    }


def serialize_support_thread(thread: models.SupportThread, is_admin_view: bool) -> dict:
    last_message = thread.messages[-1] if thread.messages else None
    return {
        "id": thread.id,
        "subject": thread.subject,
        "status": thread.status,
        "created_at": thread.created_at.strftime("%d %b %Y %H:%M"),
        "updated_at": thread.updated_at.strftime("%d %b %Y %H:%M"),
        "unread_count": getattr(thread, "unread_count", 0),
        "user_name": thread.user.name,
        "user_email": thread.user.email,
        "user_public_id": thread.user.public_id,
        "preview": (last_message.body if last_message and last_message.body else (last_message.attachment_name if last_message else ""))[:100] if last_message else "",
        "has_attachment": bool(last_message and last_message.attachment_path),
        "messages": [serialize_support_message(m) for m in thread.messages],
    }


def ensure_question_text_fixes(db: Session) -> None:
    updated = 0
    for broken_text, fixed_text in QUESTION_TEXT_FIXES.items():
        updated += db.query(models.Question).filter(models.Question.question_text == broken_text).update(
            {models.Question.question_text: fixed_text},
            synchronize_session=False,
        )
    if updated:
        db.commit()
        print(f"[STARTUP] Fixed {updated} broken question text entries")


app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    same_site="lax",
    https_only=_session_cookie_secure_default(),
    max_age=AUTH_COOKIE_MAX_AGE,
)


def should_disable_cache(request: Request) -> bool:
    path = (request.url.path or "").rstrip("/") or "/"
    exact_paths = {
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/dashboard",
        "/profile",
        "/messages",
        "/support",
        "/admin",
        "/saved",
        "/subscription-expired",
    }
    prefix_paths = (
        "/test/",
        "/results",
    )
    if path in exact_paths:
        return True
    return any(path.startswith(prefix) for prefix in prefix_paths)


@app.middleware("http")
async def refresh_auth_session(request: Request, call_next):
    # Generate per-request CSP nonce for inline scripts
    request.state.csp_nonce = secrets.token_urlsafe(16)

    if request.method.upper() not in {"GET", "HEAD", "OPTIONS"} and request.url.path not in {"/stripe/webhook", "/api/stripe/webhook"}:
        cookie_token = (request.cookies.get(CSRF_COOKIE_NAME) or "").strip()
        header_token = (request.headers.get("x-csrf-token") or "").strip()
        if not cookie_token or not header_token or cookie_token != header_token or not is_same_origin_request(request):
            return JSONResponse({"error": "CSRF validation failed"}, status_code=403)

    response = await call_next(request)
    token = request.cookies.get(AUTH_COOKIE_NAME)
    payload = decode_token(token) if token else None
    if payload and payload.get("sub") and request.url.path not in {"/api/auth/logout", "/logout"}:
        refreshed = create_token(int(payload["sub"]))
        set_auth_cookie(response, refreshed, request)
    set_csrf_cookie(response, get_or_create_csrf_token(request), request)
    response.headers.setdefault("Content-Security-Policy", build_content_security_policy(request))
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if _cookie_secure(request):
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
    if should_disable_cache(request):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers.setdefault("Pragma", "no-cache")
        response.headers["Expires"] = "0"
    return response

# ─── Google OAuth ──────────────────────────────────────────────────────────────
oauth = OAuth()
_google_client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
_google_client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
if _google_client_id and _google_client_secret:
    oauth.register(
        name="google",
        client_id=_google_client_id,
        client_secret=_google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


@app.on_event("startup")
async def startup_init():
    # Log which database is being used
    _db_url = os.environ.get("DATABASE_URL", "sqlite:///./wex_theory.db")
    _db_type = "postgresql" if "postgres" in _db_url else "sqlite (LOCAL FALLBACK — DATA WILL RESET ON RESTART)"
    print(f"[STARTUP] DATABASE_URL env: {'SET' if os.environ.get('DATABASE_URL') else 'NOT SET'}")
    print(f"[STARTUP] DB type: {_db_type}")

    db = next(get_db())
    try:
        ensure_user_public_id_column(db)
        ensure_super_admin_column(db)
        ensure_all_user_public_ids(db)
        ensure_contact_attachment_columns(db)
        ensure_support_message_columns(db)
        ensure_promo_codes_table(db)
        ensure_attempt_question_order_column(db)
        ensure_exam_wording_columns(db)
        ensure_translation_columns(db)
        ensure_question_text_fixes(db)
        CONTACT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        # 1. Import test data if DB is empty
        test_count = db.query(models.Test).count()
        if test_count == 0:
            print("[STARTUP] No tests found — running import_data...")
            try:
                from import_data import import_data
                import_data()
                print("[STARTUP] Data import complete")
            except Exception as ie:
                print(f"[STARTUP] Data import error: {ie}")
                traceback.print_exc()
        else:
            print(f"[STARTUP] Tests already in DB: {test_count}")

        # 2. Fix image paths: rename .png → .jpg (images were converted to JPEG)
        png_count = db.query(models.Question).filter(
            models.Question.image_path.like("%.png")
        ).count()
        if png_count > 0:
            db.query(models.Question).filter(
                models.Question.image_path.like("%.png")
            ).update(
                {models.Question.image_path: sql_func.replace(
                    models.Question.image_path, ".png", ".jpg"
                )},
                synchronize_session=False,
            )
            db.commit()
            print(f"[STARTUP] Fixed {png_count} image paths: .png → .jpg")
        else:
            print("[STARTUP] Image paths OK (already .jpg)")

        # 3. Create default admin if not exists; migrate old admin@wex.com if present
        _admin_email = PRIMARY_SUPER_ADMIN_EMAIL
        existing = db.query(models.User).filter(models.User.email == _admin_email).first()
        if not existing:
            # Also check for old email and update it
            old_admin = db.query(models.User).filter(models.User.email == "admin@wex.com").first()
            if old_admin:
                old_admin.email = _admin_email
                old_admin.expires_at = datetime.utcnow() + timedelta(days=3650)
                old_admin.is_admin = True
                old_admin.is_super_admin = True
                old_admin.subscription_status = "active"
                db.commit()
                print(f"[STARTUP] Admin migrated: admin@wex.com → {_admin_email}")
            elif BOOTSTRAP_ADMIN_PASSWORD:
                u = models.User(
                    name="Admin",
                    public_id=generate_unique_public_user_id(db),
                    email=_admin_email,
                    password_hash=hash_password(BOOTSTRAP_ADMIN_PASSWORD),
                    created_at=datetime.utcnow(),
                    expires_at=datetime.utcnow() + timedelta(days=3650),
                    is_admin=True,
                    is_super_admin=True,
                    subscription_status="active",
                )
                db.add(u)
                db.commit()
                print(f"[STARTUP] Admin created from BOOTSTRAP_ADMIN_PASSWORD: {_admin_email}")
            else:
                print(f"[STARTUP] Super admin {_admin_email} not found and BOOTSTRAP_ADMIN_PASSWORD is not set")
        else:
            # Ensure existing admin keeps elevated access without forcing a password reset
            existing.subscription_status = "active"
            existing.expires_at = max(existing.expires_at, datetime.utcnow() + timedelta(days=3650))
            existing.is_admin = True
            existing.is_super_admin = True
            db.commit()
            print(f"[STARTUP] Admin exists and refreshed: id={existing.id}")

        ensure_primary_super_admin(db)
        ensure_exam_mode_test(db)

    except Exception as e:
        print(f"[STARTUP] Error: {e}")
        traceback.print_exc()
    finally:
        db.close()


app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/test-images", StaticFiles(directory="test-images"), name="test-images")

@app.get("/favicon.ico")
async def favicon():
    return FileResponse(str(BASE_DIR / "static" / "favicon.svg"), media_type="image/svg+xml")


# Uploads served with Content-Disposition: attachment to prevent XSS via uploaded files
@app.get("/uploads/{subdir:path}/{filename:path}")
async def serve_upload(subdir: str, filename: str):
    safe_subdir = os.path.basename(subdir)
    safe_filename = os.path.basename(filename)
    file_path = BASE_DIR / "uploads" / safe_subdir / safe_filename
    if not file_path.is_file():
        return JSONResponse({"error": "Not found"}, status_code=404)
    return FileResponse(
        path=str(file_path),
        filename=safe_filename,
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )
templates = Jinja2Templates(directory="templates")
templates.env.globals["asset_version"] = "20260328-live-activity"

FREE_SAMPLE_TEST_ID = 0
FREE_SAMPLE_TEST_TITLE = "Test 0"
FREE_SAMPLE_TEST_DESCRIPTION = "Starter sample with 15 fixed practice questions."
EXAM_MODE_TEST_ID = 14
EXAM_MODE_TEST_TITLE = "Exam Mode"
EXAM_MODE_TEST_DESCRIPTION = "Exam Mode with 25 mixed questions from the full practice library."
EXAM_MODE_IMAGE_PATH = "Test14/screenshots/q01.jpg"
EXAM_MODE_QUESTION_COUNT = 25
EXAM_MODE_PASS_SCORE = 20
WORDING_MODE_ORIGINAL = "original"
WORDING_MODE_EXAM = "exam"
FREE_SAMPLE_QUESTION_MAP = [
    (1, 1),
    (2, 3),
    (3, 5),
    (4, 7),
    (5, 9),
    (6, 11),
    (7, 13),
    (8, 15),
    (9, 17),
    (10, 19),
    (11, 21),
    (12, 23),
    (13, 25),
    (4, 12),
    (9, 6),
]


def is_free_sample_test(test_id: int) -> bool:
    return test_id == FREE_SAMPLE_TEST_ID


def is_exam_mode_test(test_id: int) -> bool:
    return test_id == EXAM_MODE_TEST_ID


def supports_exam_style_wording(test_id: int) -> bool:
    return 1 <= test_id <= 13


def build_free_sample_test():
    return SimpleNamespace(
        id=FREE_SAMPLE_TEST_ID,
        title=FREE_SAMPLE_TEST_TITLE,
        description=FREE_SAMPLE_TEST_DESCRIPTION,
    )


def get_free_sample_questions(db: Session):
    questions = []
    for idx, (test_id, question_index) in enumerate(FREE_SAMPLE_QUESTION_MAP, start=1):
        q = (
            db.query(models.Question)
            .options(selectinload(models.Question.answers))
            .filter(
                models.Question.test_id == test_id,
                models.Question.question_index == question_index,
            )
            .first()
        )
        if not q:
            continue
        q.sample_index = idx
        questions.append(q)
    return questions


def build_exam_mode_test():
    return SimpleNamespace(
        id=EXAM_MODE_TEST_ID,
        title=EXAM_MODE_TEST_TITLE,
        description=EXAM_MODE_TEST_DESCRIPTION,
    )


def ordered_answers(question: models.Question):
    return sorted(question.answers, key=lambda answer: answer.id)


def normalize_wording_mode(raw_value: Optional[str], *, test_id: Optional[int] = None) -> str:
    value = str(raw_value or "").strip().lower()
    if test_id is not None and not supports_exam_style_wording(test_id):
        return WORDING_MODE_ORIGINAL
    if value == WORDING_MODE_EXAM:
        return WORDING_MODE_EXAM
    return WORDING_MODE_ORIGINAL


def resolve_question_text(question: models.Question, wording_mode: str) -> str:
    if wording_mode != WORDING_MODE_EXAM:
        return question.question_text
    manual = (getattr(question, "exam_style_text", None) or "").strip()
    return manual or question.question_text


def resolve_answer_text(answer: models.Answer, wording_mode: str) -> str:
    if wording_mode != WORDING_MODE_EXAM:
        return answer.text
    manual = (getattr(answer, "exam_style_text", None) or "").strip()
    return manual or answer.text


def apply_wording_to_question(question: models.Question, wording_mode: str) -> models.Question:
    question.display_question_text = resolve_question_text(question, wording_mode)
    for answer in ordered_answers(question):
        answer.display_text = resolve_answer_text(answer, wording_mode)
    return question


def serialize_test_question(question: models.Question, *, display_index: Optional[int] = None, wording_mode: str = WORDING_MODE_ORIGINAL):
    return {
        "id": question.id,
        "question_index": display_index or question.question_index,
        "question_text": resolve_question_text(question, wording_mode),
        "question_text_ru": getattr(question, "question_text_ru", None),
        "explanation": question.explanation or "",
        "explanation_ru": getattr(question, "explanation_ru", None),
        "image_path": question.image_path,
        "answers": [
            {
                "id": a.id,
                "text": resolve_answer_text(a, wording_mode),
                "text_ru": getattr(a, "text_ru", None),
            }
            for a in ordered_answers(question)
        ],
    }


def get_exam_mode_question_ids(db: Session) -> list[int]:
    rows = (
        db.query(models.Question.id)
        .filter(models.Question.test_id >= 1, models.Question.test_id <= 13)
        .order_by(models.Question.id)
        .all()
    )
    return [row[0] for row in rows]


def parse_selected_answer_ids(raw_value: Optional[str]) -> list[int]:
    try:
        parsed = json.loads(raw_value or "[]")
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    answer_ids: list[int] = []
    for item in parsed:
        try:
            answer_ids.append(int(item))
        except (TypeError, ValueError):
            continue
    return answer_ids


def get_attempt_expected_question_total(db: Session, attempt: models.UserTestAttempt, *, default_total: int = 25) -> int:
    if is_exam_mode_test(attempt.test_id):
        return EXAM_MODE_QUESTION_COUNT
    count = db.query(models.Question.id).filter(models.Question.test_id == attempt.test_id).count()
    return count or default_total


def is_full_attempt(db: Session, attempt: models.UserTestAttempt) -> bool:
    expected_total = get_attempt_expected_question_total(db, attempt)
    if expected_total <= 0:
        return False
    if len(attempt.user_answers) != expected_total:
        return False
    answered_count = sum(1 for ua in attempt.user_answers if parse_selected_answer_ids(ua.selected_answer_ids))
    return answered_count == expected_total


def load_questions_in_custom_order(db: Session, question_ids: list[int]) -> list[models.Question]:
    if not question_ids:
        return []
    questions = (
        db.query(models.Question)
        .options(selectinload(models.Question.answers))
        .filter(models.Question.id.in_(question_ids))
        .all()
    )
    q_map = {q.id: q for q in questions}
    return [q_map[qid] for qid in question_ids if qid in q_map]


def parse_attempt_question_ids(attempt: Optional[models.UserTestAttempt]) -> list[int]:
    if not attempt or not attempt.question_order_json:
        return []
    try:
        raw = json.loads(attempt.question_order_json)
    except (TypeError, ValueError):
        return []
    if not isinstance(raw, list):
        return []
    parsed: list[int] = []
    seen: set[int] = set()
    for item in raw:
        try:
            qid = int(item)
        except (TypeError, ValueError):
            continue
        if qid in seen:
            continue
        seen.add(qid)
        parsed.append(qid)
    return parsed


def get_unfinished_exam_attempt(db: Session, user_id: int) -> Optional[models.UserTestAttempt]:
    return (
        db.query(models.UserTestAttempt)
        .filter(
            models.UserTestAttempt.user_id == user_id,
            models.UserTestAttempt.test_id == EXAM_MODE_TEST_ID,
            models.UserTestAttempt.finished_at.is_(None),
        )
        .order_by(models.UserTestAttempt.started_at.desc())
        .first()
    )


def create_exam_attempt(db: Session, user: models.User) -> models.UserTestAttempt:
    ensure_exam_mode_test(db)

    pool_ids = get_exam_mode_question_ids(db)
    if len(pool_ids) < EXAM_MODE_QUESTION_COUNT:
        raise RuntimeError("Not enough questions available for Exam Mode")

    selected_ids = random.sample(pool_ids, EXAM_MODE_QUESTION_COUNT)
    attempt = models.UserTestAttempt(
        user_id=user.id,
        test_id=EXAM_MODE_TEST_ID,
        started_at=datetime.utcnow(),
        question_order_json=json.dumps(selected_ids),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def get_or_create_exam_attempt(db: Session, user: models.User, *, fresh: bool = False) -> models.UserTestAttempt:
    ensure_exam_mode_test(db)
    if not fresh:
        existing = get_unfinished_exam_attempt(db, user.id)
        existing_ids = parse_attempt_question_ids(existing)
        if existing and len(existing_ids) == EXAM_MODE_QUESTION_COUNT:
            return existing
    return create_exam_attempt(db, user)


def get_questions_for_attempt(db: Session, attempt: models.UserTestAttempt) -> list[models.Question]:
    if is_exam_mode_test(attempt.test_id):
        return load_questions_in_custom_order(db, parse_attempt_question_ids(attempt))
    return (
        db.query(models.Question)
        .options(selectinload(models.Question.answers))
        .filter(models.Question.test_id == attempt.test_id)
        .order_by(models.Question.question_index)
        .all()
    )


# ─── One-time setup endpoint ───────────────────────────────────────────────────

@app.get("/setup-admin-xk92")
async def setup_admin(request: Request, db: Session = Depends(get_db)):
    token = str(request.query_params.get("token", "")).strip()
    if not ADMIN_SETUP_TOKEN or token != ADMIN_SETUP_TOKEN:
        raise HTTPException(status_code=404, detail="Not found")
    _admin_email = PRIMARY_SUPER_ADMIN_EMAIL
    existing = db.query(models.User).filter(models.User.email == _admin_email).first()
    if existing:
        existing.expires_at = datetime.utcnow() + timedelta(days=3650)
        existing.is_admin = True
        existing.is_super_admin = True
        existing.subscription_status = "active"
        db.commit()
        ensure_primary_super_admin(db)
        return {"status": "updated", "email": _admin_email, "id": existing.id}
    if not BOOTSTRAP_ADMIN_PASSWORD:
        return JSONResponse({"error": "BOOTSTRAP_ADMIN_PASSWORD is required to create the first admin"}, status_code=400)
    u = models.User(
        name="Admin",
        public_id=generate_unique_public_user_id(db),
        email=_admin_email,
        password_hash=hash_password(BOOTSTRAP_ADMIN_PASSWORD),
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=3650),
        is_admin=True,
        is_super_admin=True,
        subscription_status="active",
    )
    db.add(u)
    db.commit()
    ensure_primary_super_admin(db)
    return {"status": "created", "id": u.id}


# ─── Google OAuth pages ────────────────────────────────────────────────────────

@app.get("/auth/google")
async def google_login(request: Request):
    limited = check_rate_limit(
        request,
        "google_login",
        message="too_many_google_attempts",
        redirect_to="/login",
        redirect_param="google_error",
    )
    if limited:
        return limited
    if not _google_client_id:
        return RedirectResponse("/login?error=google_not_configured", status_code=302)
    base_url = get_request_base_url(request)
    redirect_uri = base_url + "/auth/google/callback"
    print(f"[GOOGLE LOGIN] redirect_uri={redirect_uri}")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@app.get("/auth/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    print(f"[GOOGLE CB] query params: {dict(request.query_params)}")
    try:
        token = await oauth.google.authorize_access_token(request)
        print(f"[GOOGLE CB] token keys: {list(token.keys())}")
        info = token.get("userinfo") or {}
        print(f"[GOOGLE CB] userinfo: {info}")
        email = info.get("email", "").lower().strip()
        name = info.get("name", email.split("@")[0] if email else "User")
        if not email:
            print("[GOOGLE CB] ERROR: no email in userinfo")
            return RedirectResponse("/login?error=no_email", status_code=302)

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(
                name=name,
                public_id=generate_unique_public_user_id(db),
                email=email,
                password_hash="google_oauth",
                created_at=datetime.utcnow(),
                expires_at=datetime.utcnow(),  # no automatic premium — admin grants access
                is_admin=False,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"[GOOGLE CB] New user created: id={user.id} email={email}")
        else:
            print(f"[GOOGLE CB] Existing user: id={user.id} email={email}")

        jwt_token = create_token(user.id)
        redirect = "/admin" if user.is_admin else "/dashboard"
        print(f"[GOOGLE CB] Issuing JWT, redirecting to {redirect}")

        # Build redirect response with cookie explicitly
        resp = RedirectResponse(url=redirect, status_code=302)
        set_auth_cookie(resp, jwt_token, request)
        return resp
    except Exception as e:
        err_str = str(e)
        print(f"[GOOGLE CB ERROR] {err_str}")
        traceback.print_exc()
        from urllib.parse import quote
        return RedirectResponse(f"/login?google_error={quote(err_str[:120])}", status_code=302)


# ─── Public pages ──────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("token")
    if token and decode_token(token):
        return RedirectResponse("/dashboard", status_code=302)
    return templates.TemplateResponse(request, "index.html", {"request": request})


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(request, "login.html", {"request": request})


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse(request, "register.html", {"request": request})


@app.get("/forgot-password", response_class=HTMLResponse)
async def forgot_password_page(request: Request):
    return templates.TemplateResponse(request, "forgot_password.html", {"request": request})


@app.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page(request: Request):
    return templates.TemplateResponse(request, "reset_password.html", {"request": request})


def complete_email_verification(db: Session, email: str, code: str):
    pending = (
        db.query(models.EmailVerificationCode)
        .filter(
            models.EmailVerificationCode.email == email,
            models.EmailVerificationCode.purpose == "register"
        )
        .order_by(models.EmailVerificationCode.created_at.desc())
        .first()
    )
    if not pending:
        return None, "Verification code not found. Request a new one."
    if pending.expires_at < datetime.utcnow():
        db.delete(pending)
        db.commit()
        return None, "Verification code expired. Request a new one."
    if pending.code != code:
        return None, "Invalid verification code"

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        db.delete(pending)
        db.commit()
        return None, "This email is already registered"

    user = models.User(
        name=pending.name,
        public_id=generate_unique_public_user_id(db),
        email=email,
        password_hash=pending.password_hash,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow(),
        is_admin=False,
        subscription_status="free",
    )
    db.add(user)
    db.flush()
    db.query(models.EmailVerificationCode).filter(
        models.EmailVerificationCode.email == email,
        models.EmailVerificationCode.purpose == "register"
    ).delete(synchronize_session=False)
    db.commit()
    return user, None


def complete_password_reset(db: Session, email: str, code: str, new_password: str):
    pending = (
        db.query(models.EmailVerificationCode)
        .filter(
            models.EmailVerificationCode.email == email,
            models.EmailVerificationCode.purpose == "reset_password"
        )
        .order_by(models.EmailVerificationCode.created_at.desc())
        .first()
    )
    if not pending:
        return "Reset code not found. Request a new one."
    if pending.expires_at < datetime.utcnow():
        db.delete(pending)
        db.commit()
        return "Reset code expired. Request a new one."
    if pending.code != code:
        return "Invalid reset code"

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        db.delete(pending)
        db.commit()
        return "User not found"

    password_error = validate_password_strength(new_password)
    if password_error:
        return password_error

    user.password_hash = hash_password(new_password)
    db.query(models.EmailVerificationCode).filter(
        models.EmailVerificationCode.email == email,
        models.EmailVerificationCode.purpose == "reset_password"
    ).delete(synchronize_session=False)
    db.commit()
    return None


@app.get("/about", response_class=HTMLResponse)
async def about_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse(request, "about.html", {"request": request, "user": user})


@app.get("/faq", response_class=HTMLResponse)
async def faq_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse(request, "faq.html", {"request": request, "user": user})


@app.get("/contact", response_class=HTMLResponse)
async def contact_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse(request, "contact.html", {"request": request, "user": user})


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse(request, "privacy.html", {"request": request, "user": user})


@app.get("/subscription-expired", response_class=HTMLResponse)
async def expired_page(request: Request):
    return templates.TemplateResponse(request, "subscription_expired.html", {"request": request})


# ─── Auth API ──────────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
async def api_register(request: Request, db: Session = Depends(get_db)):
    limited = check_rate_limit(
        request,
        "auth_register",
        message="Too many registration attempts. Please try again later.",
    )
    if limited:
        return limited
    try:
        data = await request.json()
        print(f"[REGISTER] received: name={data.get('name')} email={data.get('email')}")

        name     = str(data.get("name", "")).strip()
        email    = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))

        if not name or not email or not password:
            return JSONResponse({"error": "All fields are required"}, status_code=400)
        email_error = validate_registration_email(email)
        if email_error:
            return JSONResponse({"error": email_error}, status_code=400)
        password_error = validate_password_strength(password)
        if password_error:
            return JSONResponse({"error": password_error}, status_code=400)
        if not is_email_service_configured():
            return JSONResponse({"error": "Email verification is not configured on the server yet"}, status_code=503)

        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            print(f"[REGISTER] email taken: {email}")
            return JSONResponse({"error": "This email is already registered"}, status_code=400)

        db.query(models.EmailVerificationCode).filter(
            models.EmailVerificationCode.email == email,
            models.EmailVerificationCode.purpose == "register"
        ).delete(synchronize_session=False)

        code = generate_email_verification_code()
        pending = models.EmailVerificationCode(
            email=email,
            name=name,
            password_hash=hash_password(password),
            code=code,
            purpose="register",
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            created_at=datetime.utcnow(),
        )
        db.add(pending)
        db.commit()
        confirm_url = get_public_base_url(request) + "/verify-email?" + urlencode({
            "email": email,
            "code": code,
        })
        try:
            send_verification_email(email, code, name, confirm_url)
        except Exception:
            db.query(models.EmailVerificationCode).filter(
                models.EmailVerificationCode.email == email,
                models.EmailVerificationCode.purpose == "register"
            ).delete(synchronize_session=False)
            db.commit()
            raise

        print(f"[REGISTER] verification sent: email={email}")
        return JSONResponse({
            "success": True,
            "requires_verification": True,
            "email": email,
            "message": "We sent a 6-digit verification code to your email",
        })

    except Exception as e:
        db.rollback()
        print(f"[REGISTER ERROR] {e}")
        traceback.print_exc()
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)


@app.post("/api/auth/register/verify")
async def api_register_verify(request: Request, db: Session = Depends(get_db)):
    limited = check_rate_limit(
        request,
        "auth_register_verify",
        message="Too many verification attempts. Please wait a moment and try again.",
    )
    if limited:
        return limited
    try:
        data = await request.json()
        email = str(data.get("email", "")).strip().lower()
        code = str(data.get("code", "")).strip()

        if not email or not code:
            return JSONResponse({"error": "Email and verification code are required"}, status_code=400)
        user, error = complete_email_verification(db, email, code)
        if error:
            status_code = 404 if "not found" in error.lower() else 400
            return JSONResponse({"error": error}, status_code=status_code)

        token = create_token(user.id)
        resp = JSONResponse({"success": True, "redirect": "/dashboard"})
        set_auth_cookie(resp, token, request)
        print(f"[REGISTER VERIFY] success: id={user.id} email={email}")
        return resp
    except Exception as e:
        db.rollback()
        print(f"[REGISTER VERIFY ERROR] {e}")
        traceback.print_exc()
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)


@app.post("/api/auth/forgot-password")
async def api_forgot_password(request: Request, db: Session = Depends(get_db)):
    limited = check_rate_limit(
        request,
        "auth_forgot_password",
        message="Too many reset requests. Please try again later.",
    )
    if limited:
        return limited
    try:
        data = await request.json()
        email = str(data.get("email", "")).strip().lower()
        if not email:
            return JSONResponse({"error": "Email is required"}, status_code=400)
        email_error = validate_registration_email(email)
        if email_error:
            return JSONResponse({"error": email_error}, status_code=400)
        if not is_email_service_configured():
            return JSONResponse({"error": "Email sending is not configured on the server yet"}, status_code=503)

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            return JSONResponse({"success": True, "message": "If this email exists, we sent reset instructions."})

        db.query(models.EmailVerificationCode).filter(
            models.EmailVerificationCode.email == email,
            models.EmailVerificationCode.purpose == "reset_password"
        ).delete(synchronize_session=False)

        code = generate_email_verification_code()
        pending = models.EmailVerificationCode(
            email=email,
            name=user.name,
            password_hash=user.password_hash,
            code=code,
            purpose="reset_password",
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            created_at=datetime.utcnow(),
        )
        db.add(pending)
        db.commit()

        reset_url = get_public_base_url(request) + "/reset-password?" + urlencode({
            "email": email,
            "code": code,
        })
        try:
            send_password_reset_email(email, code, user.name, reset_url)
        except Exception:
            db.query(models.EmailVerificationCode).filter(
                models.EmailVerificationCode.email == email,
                models.EmailVerificationCode.purpose == "reset_password"
            ).delete(synchronize_session=False)
            db.commit()
            raise

        return JSONResponse({"success": True, "message": "If this email exists, we sent reset instructions.", "email": email})
    except Exception as e:
        db.rollback()
        print(f"[FORGOT PASSWORD ERROR] {e}")
        traceback.print_exc()
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)


@app.post("/api/auth/reset-password")
async def api_reset_password(request: Request, db: Session = Depends(get_db)):
    limited = check_rate_limit(
        request,
        "auth_reset_password",
        message="Too many password reset attempts. Please try again later.",
    )
    if limited:
        return limited
    try:
        data = await request.json()
        email = str(data.get("email", "")).strip().lower()
        code = str(data.get("code", "")).strip()
        password = str(data.get("password", ""))

        if not email or not code or not password:
            return JSONResponse({"error": "Email, reset code and new password are required"}, status_code=400)

        error = complete_password_reset(db, email, code, password)
        if error:
            return JSONResponse({"error": error}, status_code=400)

        return JSONResponse({"success": True, "redirect": "/login?reset=1"})
    except Exception as e:
        db.rollback()
        print(f"[RESET PASSWORD ERROR] {e}")
        traceback.print_exc()
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)


@app.get("/verify-email")
async def verify_email_link(email: str, code: str, request: Request, db: Session = Depends(get_db)):
    email = str(email or "").strip().lower()
    code = str(code or "").strip()
    if not email or not code:
        return RedirectResponse(f"/register?error={quote('Verification link is incomplete')}", status_code=302)

    user, error = complete_email_verification(db, email, code)
    if error:
        return RedirectResponse(
            f"/register?error={quote(error)}&email={quote(email)}&code={quote(code)}",
            status_code=302,
        )

    token = create_token(user.id)
    resp = RedirectResponse("/dashboard?verified=1", status_code=302)
    set_auth_cookie(resp, token, request)
    print(f"[VERIFY LINK] success: id={user.id} email={email}")
    return resp


@app.post("/api/auth/login")
async def api_login(request: Request, db: Session = Depends(get_db)):
    limited = check_rate_limit(
        request,
        "auth_login",
        message="Too many login attempts. Please wait a few minutes and try again.",
    )
    if limited:
        return limited
    try:
        data = await request.json()
        email    = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        print(f"[LOGIN] email={email}")

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"[LOGIN] not found: {email}")
            return JSONResponse({"error": "Invalid email or password"}, status_code=401)
        if not verify_password(password, user.password_hash):
            print(f"[LOGIN] wrong password: {email}")
            return JSONResponse({"error": "Invalid email or password"}, status_code=401)

        token = create_token(user.id)
        redirect = "/admin" if user.is_admin else "/dashboard"
        resp = JSONResponse({"success": True, "redirect": redirect, "is_admin": user.is_admin})
        set_auth_cookie(resp, token, request)
        print(f"[LOGIN] success: id={user.id} admin={user.is_admin}")
        return resp

    except Exception as e:
        print(f"[LOGIN ERROR] {e}")
        traceback.print_exc()
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)


@app.post("/api/auth/logout")
async def api_logout(request: Request):
    resp = JSONResponse({"success": True})
    clear_auth_cookie(resp, request)
    return resp


@app.get("/logout")
async def logout_get(request: Request):
    resp = RedirectResponse("/", status_code=302)
    clear_auth_cookie(resp, request)
    return resp


@app.get("/api/auth/me")
async def api_me(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    return JSONResponse({
        "id": user.id, "name": user.name, "email": user.email,
        "is_admin": user.is_admin, "expires_at": user.expires_at.isoformat(),
    })


# ─── Protected pages ───────────────────────────────────────────────────────────

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, db: Session = Depends(get_db)):
    token_cookie = request.cookies.get("token")
    print(f"[DASHBOARD] token cookie present: {bool(token_cookie)}")
    user = get_current_user(request, db)
    print(f"[DASHBOARD] user resolved: {user.email if user else None}")
    if not user:
        return RedirectResponse("/login", status_code=302)

    ensure_exam_mode_test(db)
    tests = [build_free_sample_test(), *db.query(models.Test).order_by(models.Test.id).all()]
    finished = (
        db.query(models.UserTestAttempt)
        .options(selectinload(models.UserTestAttempt.user_answers))
        .filter(
            models.UserTestAttempt.user_id == user.id,
            models.UserTestAttempt.finished_at.isnot(None),
        )
        .order_by(models.UserTestAttempt.finished_at.desc(), models.UserTestAttempt.id.desc())
        .all()
    )

    latest_scores: dict[int, int] = {}
    latest_scores_by_mode: dict[int, dict[str, Optional[int]]] = {
        test_id: {
            WORDING_MODE_ORIGINAL: None,
            WORDING_MODE_EXAM: None,
        }
        for test_id in range(1, 14)
    }
    for a in finished:
        if not is_full_attempt(db, a):
            continue
        if a.test_id not in latest_scores:
            latest_scores[a.test_id] = a.score or 0
        if supports_exam_style_wording(a.test_id):
            wording_mode = normalize_wording_mode(getattr(a, "wording_mode", None), test_id=a.test_id)
            if latest_scores_by_mode[a.test_id].get(wording_mode) is None:
                latest_scores_by_mode[a.test_id][wording_mode] = a.score or 0

    images: dict[int, str] = {}
    exam_wording_statuses: dict[int, dict[str, int | str]] = {}
    sample_questions = get_free_sample_questions(db)
    images[FREE_SAMPLE_TEST_ID] = sample_questions[0].image_path if sample_questions else ""
    wording_rows = (
        db.query(models.Question.test_id, models.Question.exam_style_text)
        .filter(models.Question.test_id >= 1, models.Question.test_id <= 13)
        .all()
    )
    wording_progress: dict[int, dict[str, int]] = {
        test_id: {"total": 0, "filled": 0}
        for test_id in range(1, 14)
    }
    for test_id, exam_style_text in wording_rows:
        wording_progress[test_id]["total"] += 1
        if str(exam_style_text or "").strip():
            wording_progress[test_id]["filled"] += 1

    for test_id, counts in wording_progress.items():
        total = counts["total"]
        filled = counts["filled"]
        if total == 0 or filled == 0:
            label = "Not Started"
        elif filled < total:
            label = "In Progress"
        else:
            label = "Ready"
        exam_wording_statuses[test_id] = {
            "label": label,
            "filled": filled,
            "total": total,
        }

    for t in tests:
        if t.id == FREE_SAMPLE_TEST_ID:
            continue
        if is_exam_mode_test(t.id):
            images[t.id] = EXAM_MODE_IMAGE_PATH
            continue
        q = db.query(models.Question).filter(
            models.Question.test_id == t.id,
            models.Question.question_index == 1
        ).first()
        images[t.id] = q.image_path if q else ""

    completed = sum(1 for test_id, score in latest_scores.items() if test_id != FREE_SAMPLE_TEST_ID and score >= EXAM_MODE_PASS_SCORE)
    library_total = sum(1 for t in tests if t.id != FREE_SAMPLE_TEST_ID)
    has_full_access = user_has_access(user)
    access_expires_at = None if user.is_admin else get_user_access_expiry(user)

    return templates.TemplateResponse(request, "dashboard.html", {
        "request": request, "user": user, "tests": tests,
        "latest_scores": latest_scores, "images": images,
        "latest_scores_by_mode": latest_scores_by_mode,
        "completed": completed, "has_access": has_full_access,
        "library_total": library_total,
        "exam_wording_statuses": exam_wording_statuses,
        "access_expires_at": access_expires_at,
        "now": datetime.utcnow(),
    })


@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)

    attempts = (
        db.query(models.UserTestAttempt)
        .filter(
            models.UserTestAttempt.user_id == user.id,
            models.UserTestAttempt.finished_at.isnot(None),
        )
        .order_by(models.UserTestAttempt.finished_at.desc())
        .all()
    )
    return templates.TemplateResponse(request, "profile.html", {
        "request": request, "user": user, "attempts": attempts,
        "now": datetime.utcnow(),
    })


@app.get("/promo-code", response_class=HTMLResponse)
async def promo_code_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    access_expires_at = None if user.is_admin else get_user_access_expiry(user)
    return templates.TemplateResponse(request, "promo_code.html", {
        "request": request,
        "user": user,
        "has_access": user_has_access(user),
        "access_expires_at": access_expires_at,
        "now": datetime.utcnow(),
    })


@app.get("/messages", response_class=HTMLResponse)
async def messages_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)

    thread_id_raw = request.query_params.get("thread")
    thread_id = int(thread_id_raw) if thread_id_raw and thread_id_raw.isdigit() else None
    threads = (
        db.query(models.SupportThread)
        .options(selectinload(models.SupportThread.user), selectinload(models.SupportThread.messages))
        .filter(models.SupportThread.user_id == user.id)
        .order_by(models.SupportThread.updated_at.desc())
        .all()
    )
    for thread in threads:
        thread.unread_count = sum(1 for m in thread.messages if not m.read_by_user and m.sender_role in ("admin", "system"))
    active_thread = None
    if threads:
        active_thread = next((t for t in threads if t.id == thread_id), threads[0])
        unread = [m for m in active_thread.messages if not m.read_by_user and m.sender_role in ("admin", "system")]
        for message in unread:
            message.read_by_user = True
        if unread:
            db.commit()
            active_thread.unread_count = 0

    return templates.TemplateResponse(request, "support.html", {
        "request": request,
        "user": user,
        "threads": threads,
        "active_thread": active_thread,
        "is_admin_view": False,
        "now": datetime.utcnow(),
    })


@app.get("/support", response_class=HTMLResponse)
async def support_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    if not user.is_admin:
        return RedirectResponse("/dashboard", status_code=302)

    thread_id_raw = request.query_params.get("thread")
    thread_id = int(thread_id_raw) if thread_id_raw and thread_id_raw.isdigit() else None
    threads = (
        db.query(models.SupportThread)
        .options(selectinload(models.SupportThread.user), selectinload(models.SupportThread.messages))
        .order_by(models.SupportThread.updated_at.desc())
        .all()
    )
    for thread in threads:
        thread.unread_count = sum(1 for m in thread.messages if not m.read_by_admin and m.sender_role == "user")
    active_thread = None
    if threads:
        active_thread = next((t for t in threads if t.id == thread_id), threads[0])
        unread = [m for m in active_thread.messages if not m.read_by_admin and m.sender_role == "user"]
        for message in unread:
            message.read_by_admin = True
        if unread:
            db.commit()
            active_thread.unread_count = 0

    return templates.TemplateResponse(request, "support.html", {
        "request": request,
        "user": user,
        "threads": threads,
        "active_thread": active_thread,
        "is_admin_view": True,
        "now": datetime.utcnow(),
    })


@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    if not user.is_admin:
        return RedirectResponse("/dashboard", status_code=302)

    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    messages = db.query(models.ContactMessage).order_by(
        models.ContactMessage.created_at.desc()
    ).all()
    ensure_promo_codes_table(db)
    promo_codes = db.query(models.PromoCode).order_by(
        models.PromoCode.created_at.desc()
    ).all()
    unread_count = sum(1 for m in messages if not m.is_read)
    activity_overview = build_live_activity_overview(db)
    active_tab = str(request.query_params.get("tab", "users") or "users").strip().lower()
    if active_tab not in {"users", "messages", "promos"}:
        active_tab = "users"

    return templates.TemplateResponse(request, "admin.html", {
        "request": request, "user": user, "users": users,
        "messages": messages, "unread_count": unread_count,
        "promo_codes": promo_codes,
        "promo_status": get_promo_status,
        "active_tab": active_tab,
        "now": datetime.utcnow(),
        "can_manage_admin_roles": can_manage_admin_roles(user),
        "activity_overview": activity_overview,
    })


@app.post("/api/activity/ping")
async def api_activity_ping(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
    except Exception:
        data = {}

    raw_path = str(data.get("path", "") or "").strip()
    tab_id = str(data.get("tab_id", "") or "").strip()
    page_path = normalize_activity_path(raw_path)
    if not page_path or not tab_id:
        return JSONResponse({"success": True, "tracked": False})

    if len(tab_id) > 80:
        tab_id = tab_id[:80]

    session_id = get_or_create_activity_session_id(request)
    now = datetime.utcnow()
    current_user = get_current_user(request, db)

    existing = (
        db.query(models.LiveActivitySession)
        .filter(
            models.LiveActivitySession.session_id == session_id,
            models.LiveActivitySession.tab_id == tab_id,
        )
        .first()
    )
    if not existing:
        existing = models.LiveActivitySession(
            session_id=session_id,
            tab_id=tab_id,
            created_at=now,
        )
        db.add(existing)

    existing.page_path = page_path
    existing.is_authenticated = bool(current_user)
    existing.last_seen = now

    if random.random() < 0.04:
        db.query(models.LiveActivitySession).filter(
            models.LiveActivitySession.last_seen < (now - ACTIVITY_RETENTION_WINDOW)
        ).delete(synchronize_session=False)

    db.commit()
    response = JSONResponse({"success": True, "tracked": True})
    set_activity_cookie(response, session_id, request)
    return response


# ─── Free test (no auth) ───────────────────────────────────────────────────────

@app.get("/test/1/free", response_class=HTMLResponse)
async def free_test_page(request: Request, db: Session = Depends(get_db)):
    return RedirectResponse("/test/0", status_code=302)


@app.get("/api/tests/1/questions/free")
async def api_free_questions(db: Session = Depends(get_db)):
    questions = get_free_sample_questions(db)
    return [
        {"id": q.id, "question_index": getattr(q, "sample_index", q.question_index), "question_text": q.question_text,
         "image_path": q.image_path, "answers": [{"id": a.id, "text": a.text} for a in ordered_answers(q)]}
        for q in questions
    ]


@app.post("/api/tests/1/check/free")
async def api_free_check(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    user_answers = body.get("answers", {})

    questions = get_free_sample_questions(db)

    results = []
    score = 0
    for q in questions:
        correct_ids = [a.id for a in ordered_answers(q) if a.is_correct]
        selected = user_answers.get(str(q.id), [])
        is_correct = set(selected) == set(correct_ids)
        if is_correct:
            score += 1
        results.append({
            "question_id": q.id, "question_index": getattr(q, "sample_index", q.question_index),
            "correct_ids": correct_ids, "selected_ids": selected,
            "is_correct": is_correct, "explanation": q.explanation,
            "image_path": q.image_path,
        })
    total = len(questions)
    return {"score": score, "passed": score >= 12, "total": total, "results": results, "test_title": FREE_SAMPLE_TEST_TITLE}


@app.get("/api/tests/0/questions/free")
async def api_free_sample_questions_legacy(db: Session = Depends(get_db)):
    return await api_free_questions(db)


@app.post("/api/tests/0/check/free")
async def api_free_sample_check(request: Request, db: Session = Depends(get_db)):
    return await api_free_check(request, db)


# ─── Test pages ────────────────────────────────────────────────────────────────

@app.get("/test/{test_id}", response_class=HTMLResponse)
async def test_page(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not is_free_sample_test(test_id):
        if not user:
            return RedirectResponse("/login", status_code=302)
        if not user_has_access(user):
            return RedirectResponse("/subscription-expired" if getattr(user, "subscription_status", "free") != "free" else "/pricing", status_code=302)

    if is_exam_mode_test(test_id):
        ensure_exam_mode_test(db)
    test = build_free_sample_test() if is_free_sample_test(test_id) else db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404)
    wording_mode = WORDING_MODE_ORIGINAL
    if supports_exam_style_wording(test_id):
        raw_wording_mode = request.query_params.get("wording")
        if raw_wording_mode not in {WORDING_MODE_ORIGINAL, WORDING_MODE_EXAM}:
            return RedirectResponse(f"/test/{test_id}/overview", status_code=302)
        wording_mode = normalize_wording_mode(raw_wording_mode, test_id=test_id)
    return templates.TemplateResponse(request, "test.html", {
        "request": request,
        "user": user,
        "test": test,
        "wording_mode": wording_mode,
    })


@app.get("/test/{test_id}/overview", response_class=HTMLResponse)
async def overview_page(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    if not is_free_sample_test(test_id) and not user_has_access(user):
        return RedirectResponse("/subscription-expired" if getattr(user, "subscription_status", "free") != "free" else "/pricing", status_code=302)
    if not supports_exam_style_wording(test_id):
        return RedirectResponse(f"/test/{test_id}", status_code=302)
    if is_exam_mode_test(test_id):
        ensure_exam_mode_test(db)
    test = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404)
    return templates.TemplateResponse(request, "overview.html", {
        "request": request,
        "user": user,
        "test": test,
        "wording_original": WORDING_MODE_ORIGINAL,
        "wording_exam": WORDING_MODE_EXAM,
    })


@app.get("/results/free", response_class=HTMLResponse)
async def free_results_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse(request, "results_free.html", {
        "request": request,
        "user": user,
    })


@app.get("/test/{test_id}/results/{attempt_id}", response_class=HTMLResponse)
async def results_page(test_id: int, attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
        models.UserTestAttempt.test_id == test_id,
    ).first()
    if not attempt:
        raise HTTPException(status_code=404)

    wording_mode = normalize_wording_mode(getattr(attempt, "wording_mode", None), test_id=attempt.test_id)
    questions = get_questions_for_attempt(db, attempt)
    ua_map = {ua.question_id: ua for ua in attempt.user_answers}
    question_results = []
    for idx, q in enumerate(questions):
        apply_wording_to_question(q, wording_mode)
        ua = ua_map.get(q.id)
        answers = ordered_answers(q)
        correct_ids = [a.id for a in answers if a.is_correct]
        selected_ids = json.loads(ua.selected_answer_ids) if ua else []
        question_results.append({
            "modal_index": idx,
            "display_index": idx + 1,
            "question": q,
            "answers": answers,
            "is_correct": ua.is_correct if ua else False,
            "selected_ids": selected_ids,
            "correct_ids": correct_ids,
        })
    bookmarked_question_ids = {
        row[0]
        for row in db.query(models.Bookmark.question_id).filter(
            models.Bookmark.user_id == user.id,
            models.Bookmark.question_id.in_([q.id for q in questions]),
        ).all()
    }
    saved_question_results = [
        qr for qr in question_results if qr["question"].id in bookmarked_question_ids
    ]
    is_triumph = False
    triumph_data = None
    if (
        attempt.test_id == EXAM_MODE_TEST_ID
        and attempt.score is not None
        and len(question_results) > 0
        and attempt.score >= len(question_results)
    ):
        completed_prior = {
            row[0] for row in db.query(models.UserTestAttempt.test_id).filter(
                models.UserTestAttempt.user_id == user.id,
                models.UserTestAttempt.test_id.in_(list(range(1, 14))),
                models.UserTestAttempt.score == 25,
                models.UserTestAttempt.finished_at.isnot(None),
            ).distinct().all()
        }
        if len(completed_prior) >= 13:
            is_triumph = True
            triumph_data = {
                "user_name": (user.name or user.email.split("@")[0]),
                "user_email": user.email,
                "date": (attempt.finished_at or datetime.utcnow()).strftime("%d %b %Y"),
                "total_questions": 350,
            }

    return templates.TemplateResponse(request, "results.html", {
        "request": request, "user": user, "test": attempt.test,
        "attempt": attempt, "question_results": question_results,
        "bookmarked_question_ids": bookmarked_question_ids,
        "saved_question_results": saved_question_results,
        "is_exam_mode": is_exam_mode_test(attempt.test_id),
        "error_count": len(question_results) - (attempt.score or 0),
        "wording_mode": wording_mode,
        "is_triumph": is_triumph,
        "triumph_data": triumph_data,
    })


@app.get("/test/{test_id}/review/{attempt_id}", response_class=HTMLResponse)
async def review_page(test_id: int, attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
        models.UserTestAttempt.test_id == test_id,
    ).first()
    if not attempt:
        raise HTTPException(status_code=404)

    wording_mode = normalize_wording_mode(getattr(attempt, "wording_mode", None), test_id=attempt.test_id)
    questions = get_questions_for_attempt(db, attempt)
    ua_map = {ua.question_id: ua for ua in attempt.user_answers}
    review_data = []
    for q in questions:
        apply_wording_to_question(q, wording_mode)
        ua = ua_map.get(q.id)
        answers = ordered_answers(q)
        review_data.append({
            "question": q, "answers": answers,
            "selected_ids": json.loads(ua.selected_answer_ids) if ua else [],
            "is_correct": ua.is_correct if ua else False,
        })
    return templates.TemplateResponse(request, "review.html", {
        "request": request, "user": user, "test": attempt.test,
        "attempt": attempt, "review_data": review_data, "wording_mode": wording_mode,
    })


# ─── Test API ──────────────────────────────────────────────────────────────────

@app.get("/api/tests")
async def api_tests(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    ensure_exam_mode_test(db)
    tests = [build_free_sample_test(), *db.query(models.Test).order_by(models.Test.id).all()]
    return [{"id": t.id, "title": t.title} for t in tests]


@app.get("/api/tests/{test_id}/questions")
async def api_questions(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    wording_mode = normalize_wording_mode(request.query_params.get("wording"), test_id=test_id)
    if not is_free_sample_test(test_id) and not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if is_free_sample_test(test_id):
        questions = get_free_sample_questions(db)
        if not questions:
            return JSONResponse({"error": "No questions found for this test"}, status_code=404)
        return [serialize_test_question(q, display_index=getattr(q, "sample_index", q.question_index)) for q in questions]
    if not user_has_access(user):
        return JSONResponse({"error": "Subscription required"}, status_code=403)
    if is_exam_mode_test(test_id):
        attempt_id_raw = request.query_params.get("attempt_id")
        attempt = None
        if attempt_id_raw and attempt_id_raw.isdigit():
            attempt = db.query(models.UserTestAttempt).filter(
                models.UserTestAttempt.id == int(attempt_id_raw),
                models.UserTestAttempt.user_id == user.id,
                models.UserTestAttempt.test_id == EXAM_MODE_TEST_ID,
            ).first()
        if not attempt:
            attempt = get_unfinished_exam_attempt(db, user.id)
        if not attempt:
            return JSONResponse({"error": "Exam session not started"}, status_code=400)
        questions = get_questions_for_attempt(db, attempt)
        if len(questions) != EXAM_MODE_QUESTION_COUNT:
            return JSONResponse({"error": "Exam session is incomplete"}, status_code=500)
        return [serialize_test_question(q, display_index=idx + 1) for idx, q in enumerate(questions)]
    questions = (
        db.query(models.Question)
        .options(selectinload(models.Question.answers))
        .filter(models.Question.test_id == test_id)
        .order_by(models.Question.question_index)
        .all()
    )
    if not questions:
        return JSONResponse({"error": "No questions found for this test"}, status_code=404)
    return [serialize_test_question(q, wording_mode=wording_mode) for q in questions]


@app.post("/api/tests/{test_id}/start")
async def api_start_test(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    wording_mode = normalize_wording_mode(request.query_params.get("wording"), test_id=test_id)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if not is_free_sample_test(test_id) and not user_has_access(user):
        return JSONResponse({"error": "Subscription required"}, status_code=403)

    if is_free_sample_test(test_id):
        return JSONResponse({"error": "Starter test does not create attempts"}, status_code=400)
    if is_exam_mode_test(test_id):
        try:
            fresh = str(request.query_params.get("fresh", "")).strip().lower() in {"1", "true", "yes"}
            attempt = get_or_create_exam_attempt(db, user, fresh=fresh)
            return {"attempt_id": attempt.id}
        except Exception as e:
            db.rollback()
            print(f"[START EXAM ERROR] user_id={user.id}: {e}")
            traceback.print_exc()
            return JSONResponse({"error": str(e)}, status_code=500)

    test = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        total = db.query(models.Test).count()
        print(f"[START] Test {test_id} not found. Total tests in DB: {total}")
        return JSONResponse({"error": f"Test {test_id} not found (DB has {total} tests)"}, status_code=404)

    try:
        attempt = models.UserTestAttempt(
            user_id=user.id,
            test_id=test_id,
            started_at=datetime.utcnow(),
            wording_mode=wording_mode,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        print(f"[START] attempt_id={attempt.id} user_id={user.id} test_id={test_id}")
        return {"attempt_id": attempt.id}
    except Exception as e:
        db.rollback()
        print(f"[START ERROR] user_id={user.id} test_id={test_id}: {e}")
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/attempts/{attempt_id}/answer")
async def api_save_answer(attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    question_id = body.get("question_id")
    answer_ids  = body.get("answer_ids", [])

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
    ).first()
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        return JSONResponse({"error": "Not found"}, status_code=404)

    correct_ids = {a.id for a in ordered_answers(question) if a.is_correct}
    is_correct  = set(answer_ids) == correct_ids

    existing = db.query(models.UserAnswer).filter(
        models.UserAnswer.attempt_id == attempt_id,
        models.UserAnswer.question_id == question_id,
    ).first()
    if existing:
        existing.selected_answer_ids = json.dumps(answer_ids)
        existing.is_correct = is_correct
    else:
        db.add(models.UserAnswer(
            attempt_id=attempt_id, question_id=question_id,
            selected_answer_ids=json.dumps(answer_ids), is_correct=is_correct,
        ))
    db.commit()
    return {"ok": True, "is_correct": is_correct}


@app.post("/api/attempts/{attempt_id}/answers/batch")
async def api_save_answers_batch(attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
    ).first()
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    body = await request.json()
    incoming = body.get("answers", [])  # [{question_id, answer_ids}, ...]

    question_ids = [a["question_id"] for a in incoming]
    questions = db.query(models.Question).options(
        selectinload(models.Question.answers)
    ).filter(models.Question.id.in_(question_ids)).all()
    q_map = {q.id: q for q in questions}

    # Delete existing answers for this attempt (idempotent re-submit)
    db.query(models.UserAnswer).filter(
        models.UserAnswer.attempt_id == attempt_id
    ).delete(synchronize_session=False)

    for ans in incoming:
        q = q_map.get(ans["question_id"])
        if not q:
            continue
        correct_ids = {a.id for a in ordered_answers(q) if a.is_correct}
        is_correct = set(ans.get("answer_ids", [])) == correct_ids
        db.add(models.UserAnswer(
            attempt_id=attempt_id,
            question_id=ans["question_id"],
            selected_answer_ids=json.dumps(ans.get("answer_ids", [])),
            is_correct=is_correct,
        ))

    db.commit()
    return {"ok": True}


@app.post("/api/attempts/{attempt_id}/finish")
async def api_finish_attempt(attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
    ).first()
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    try:
        score = sum(1 for ua in attempt.user_answers if ua.is_correct)
        total_questions = EXAM_MODE_QUESTION_COUNT if is_exam_mode_test(attempt.test_id) else 25
        errors = total_questions - score
        passed = errors <= 5 if is_exam_mode_test(attempt.test_id) else score >= EXAM_MODE_PASS_SCORE
        attempt.finished_at = datetime.utcnow()
        attempt.score = score
        attempt.passed = passed
        db.commit()
        return {"score": score, "passed": passed, "total": total_questions, "errors": errors}
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/attempts/{attempt_id}/review")
async def api_review(attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
    ).first()
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    ua_map = {ua.question_id: ua for ua in attempt.user_answers}
    questions = get_questions_for_attempt(db, attempt)
    wording_mode = normalize_wording_mode(getattr(attempt, "wording_mode", None), test_id=attempt.test_id)

    return [
        {
            "id": q.id, "question_index": idx + 1 if is_exam_mode_test(attempt.test_id) else q.question_index,
            "question_text": resolve_question_text(q, wording_mode), "image_path": q.image_path,
            "explanation": q.explanation,
            "is_correct": ua_map[q.id].is_correct if q.id in ua_map else False,
            "selected_ids": json.loads(ua_map[q.id].selected_answer_ids) if q.id in ua_map else [],
            "answers": [{"id": a.id, "text": resolve_answer_text(a, wording_mode), "is_correct": a.is_correct} for a in ordered_answers(q)],
        }
        for idx, q in enumerate(questions)
    ]


# ─── Debug ─────────────────────────────────────────────────────────────────────

@app.get("/api/debug-env")
async def debug_env():
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    key = key.strip()
    db_url = os.environ.get("DATABASE_URL", "")
    return {
        "anthropic_key_set": bool(key),
        "anthropic_key_preview": (key[:12] + "...") if key else "NOT SET",
        "anthropic_key_length": len(key),
        "database_url_set": bool(db_url),
    }


# ─── Dictionary (curated word translations) ───────────────────────────────────

_GOOGLE_TRANSLATE_URL = (
    "https://translate.googleapis.com/translate_a/single"
    "?client=gtx&sl=en&tl=ru&dt=t&q={q}"
)
_GOOGLE_TRANSLATE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


async def _google_translate_word(word: str) -> Optional[str]:
    """Single-shot Google Translate call. Returns ru translation or None.
    Used by the /api/dictionary smart fallback. Short timeout, no retries —
    if it fails the user just gets null and we don't poison the cache.
    """
    if not word or not word.strip():
        return None
    url = _GOOGLE_TRANSLATE_URL.format(q=quote(word.strip()[:120]))
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, headers=_GOOGLE_TRANSLATE_HEADERS)
            if resp.status_code != 200:
                return None
            data = resp.json()
        if not isinstance(data, list) or not isinstance(data[0], list):
            return None
        parts = []
        for chunk in data[0]:
            if isinstance(chunk, list) and chunk and isinstance(chunk[0], str):
                parts.append(chunk[0])
        translated = "".join(parts).strip()
        return translated or None
    except Exception as e:
        print(f"[dictionary] google translate failed for {word!r}: {e}")
        return None


@app.get("/api/dictionary/{word}")
async def api_dictionary(word: str, db: Session = Depends(get_db)):
    """Look up a word in the WordTranslation table with smart fallback.

    Flow:
      1. Look up the word in the DB. If found, return immediately.
      2. If missing, call Google Translate, save the result with
         is_curated=False, and return it.
      3. If Google fails, return {translation: null} so the frontend just
         shows "—" and we don't pollute the DB with garbage.

    Admins can later curate any auto-added row from /admin/translations.
    """
    cleaned = (word or "").strip().lower()
    if not cleaned or len(cleaned) > 64:
        return {"word": cleaned, "translation": None, "pos": None}

    # Only translate plausible English words — skip anything with digits or
    # weird characters so we don't waste translate calls on garbage.
    if not re.fullmatch(r"[a-z][a-z'-]{1,63}", cleaned):
        return {"word": cleaned, "translation": None, "pos": None}

    row = (
        db.query(models.WordTranslation)
        .filter(models.WordTranslation.word_en == cleaned)
        .first()
    )
    if row:
        return {
            "word": row.word_en,
            "translation": row.translation_ru,
            "pos": row.pos,
        }

    # ── Smart fallback: ask Google, then persist ───────────────────────────
    translation = await _google_translate_word(cleaned)
    if not translation:
        return {"word": cleaned, "translation": None, "pos": None}

    # Avoid storing identical-to-source "translations" (Google sometimes
    # echoes the input for proper nouns / unknown tokens).
    if translation.strip().lower() == cleaned:
        return {"word": cleaned, "translation": None, "pos": None}

    try:
        new_row = models.WordTranslation(
            word_en=cleaned,
            translation_ru=translation,
            pos=None,
            is_curated=False,
            updated_at=datetime.utcnow(),
        )
        db.add(new_row)
        db.commit()
    except Exception as e:
        # Race condition: another request inserted the same word a moment
        # earlier. Roll back and re-read it.
        db.rollback()
        print(f"[dictionary] insert race for {cleaned!r}: {e}")
        existing = (
            db.query(models.WordTranslation)
            .filter(models.WordTranslation.word_en == cleaned)
            .first()
        )
        if existing:
            return {
                "word": existing.word_en,
                "translation": existing.translation_ru,
                "pos": existing.pos,
            }

    return {"word": cleaned, "translation": translation, "pos": None}


# ─── Admin: translations editor ────────────────────────────────────────────────

ADMIN_TRANSLATIONS_PAGE_SIZE = 25
ADMIN_WORDS_PAGE_SIZE = 100


def _require_admin(request: Request, db: Session):
    user = get_current_user(request, db)
    if not user:
        return None, RedirectResponse("/login", status_code=302)
    if not user.is_admin:
        return None, RedirectResponse("/dashboard", status_code=302)
    return user, None


@app.get("/admin/translations", response_class=HTMLResponse)
async def admin_translations_page(
    request: Request,
    db: Session = Depends(get_db),
    q: str = "",
    page: int = 1,
    tab: str = "questions",
    wq: str = "",
    wpage: int = 1,
):
    user, redirect = _require_admin(request, db)
    if redirect:
        return redirect

    page = max(1, int(page or 1))
    wpage = max(1, int(wpage or 1))
    tab = (tab or "questions").strip().lower()
    if tab not in {"questions", "words"}:
        tab = "questions"

    # Questions list with optional search
    qq = db.query(models.Question)
    search = (q or "").strip()
    if search:
        like = f"%{search}%"
        qq = qq.filter(sql_or(
            models.Question.question_text.ilike(like),
            models.Question.question_text_ru.ilike(like),
            models.Question.explanation.ilike(like),
        ))
    total_questions = qq.count()
    questions = (
        qq.options(selectinload(models.Question.answers))
        .order_by(models.Question.id.asc())
        .offset((page - 1) * ADMIN_TRANSLATIONS_PAGE_SIZE)
        .limit(ADMIN_TRANSLATIONS_PAGE_SIZE)
        .all()
    )
    total_pages = max(1, (total_questions + ADMIN_TRANSLATIONS_PAGE_SIZE - 1) // ADMIN_TRANSLATIONS_PAGE_SIZE)

    # Word translations list
    ww = db.query(models.WordTranslation)
    wsearch = (wq or "").strip()
    if wsearch:
        wlike = f"%{wsearch.lower()}%"
        ww = ww.filter(sql_or(
            models.WordTranslation.word_en.ilike(wlike),
            models.WordTranslation.translation_ru.ilike(f"%{wsearch}%"),
        ))
    total_words = ww.count()
    words = (
        ww.order_by(models.WordTranslation.word_en.asc())
        .offset((wpage - 1) * ADMIN_WORDS_PAGE_SIZE)
        .limit(ADMIN_WORDS_PAGE_SIZE)
        .all()
    )
    total_wpages = max(1, (total_words + ADMIN_WORDS_PAGE_SIZE - 1) // ADMIN_WORDS_PAGE_SIZE)

    return templates.TemplateResponse(request, "admin_translations.html", {
        "request": request,
        "user": user,
        "active_tab": tab,
        "questions": questions,
        "q": search,
        "page": page,
        "total_pages": total_pages,
        "total_questions": total_questions,
        "words": words,
        "wq": wsearch,
        "wpage": wpage,
        "total_wpages": total_wpages,
        "total_words": total_words,
    })


@app.post("/api/admin/translations/question/{question_id}")
async def api_admin_update_question_translation(
    question_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user, redirect = _require_admin(request, db)
    if redirect:
        return JSONResponse({"success": False, "error": "forbidden"}, status_code=403)
    try:
        data = await request.json()
    except Exception:
        data = {}
    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        return JSONResponse({"success": False, "error": "not_found"}, status_code=404)

    if "question_text_ru" in data:
        question.question_text_ru = (data.get("question_text_ru") or "").strip() or None
    if "explanation_ru" in data:
        question.explanation_ru = (data.get("explanation_ru") or "").strip() or None

    answers_payload = data.get("answers") or {}
    if isinstance(answers_payload, dict) and answers_payload:
        ans_rows = (
            db.query(models.Answer)
            .filter(models.Answer.question_id == question_id)
            .all()
        )
        by_id = {a.id: a for a in ans_rows}
        for k, v in answers_payload.items():
            try:
                aid = int(k)
            except (TypeError, ValueError):
                continue
            row = by_id.get(aid)
            if row is not None:
                row.text_ru = (v or "").strip() or None

    db.commit()
    return {"success": True}


@app.post("/api/admin/word-translations")
async def api_admin_word_create(request: Request, db: Session = Depends(get_db)):
    user, redirect = _require_admin(request, db)
    if redirect:
        return JSONResponse({"success": False, "error": "forbidden"}, status_code=403)
    try:
        data = await request.json()
    except Exception:
        data = {}
    word_en = (data.get("word_en") or "").strip().lower()
    translation_ru = (data.get("translation_ru") or "").strip()
    pos = (data.get("pos") or "").strip() or None
    if not word_en or not translation_ru:
        return JSONResponse({"success": False, "error": "missing_fields"}, status_code=400)
    if len(word_en) > 64:
        return JSONResponse({"success": False, "error": "word_too_long"}, status_code=400)

    existing = (
        db.query(models.WordTranslation)
        .filter(models.WordTranslation.word_en == word_en)
        .first()
    )
    if existing:
        existing.translation_ru = translation_ru
        existing.pos = pos
        existing.is_curated = True
        existing.updated_at = datetime.utcnow()
    else:
        existing = models.WordTranslation(
            word_en=word_en,
            translation_ru=translation_ru,
            pos=pos,
            is_curated=True,
            updated_at=datetime.utcnow(),
        )
        db.add(existing)
    db.commit()
    return {
        "success": True,
        "id": existing.id,
        "word_en": existing.word_en,
        "translation_ru": existing.translation_ru,
        "pos": existing.pos,
    }


@app.post("/api/admin/word-translations/{word_id}")
async def api_admin_word_update(word_id: int, request: Request, db: Session = Depends(get_db)):
    user, redirect = _require_admin(request, db)
    if redirect:
        return JSONResponse({"success": False, "error": "forbidden"}, status_code=403)
    try:
        data = await request.json()
    except Exception:
        data = {}
    row = db.query(models.WordTranslation).filter(models.WordTranslation.id == word_id).first()
    if not row:
        return JSONResponse({"success": False, "error": "not_found"}, status_code=404)
    if "translation_ru" in data:
        new_tr = (data.get("translation_ru") or "").strip()
        if not new_tr:
            return JSONResponse({"success": False, "error": "empty_translation"}, status_code=400)
        row.translation_ru = new_tr
    if "pos" in data:
        row.pos = (data.get("pos") or "").strip() or None
    row.is_curated = True
    row.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True}


@app.post("/api/admin/word-translations/{word_id}/delete")
async def api_admin_word_delete(word_id: int, request: Request, db: Session = Depends(get_db)):
    user, redirect = _require_admin(request, db)
    if redirect:
        return JSONResponse({"success": False, "error": "forbidden"}, status_code=403)
    row = db.query(models.WordTranslation).filter(models.WordTranslation.id == word_id).first()
    if not row:
        return JSONResponse({"success": False, "error": "not_found"}, status_code=404)
    db.delete(row)
    db.commit()
    return {"success": True}


# ─── Bookmarks ─────────────────────────────────────────────────────────────────

@app.get("/api/bookmarks")
async def api_get_bookmarks(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    bookmarks = db.query(models.Bookmark).filter(
        models.Bookmark.user_id == user.id
    ).all()
    return [{"question_id": bm.question_id} for bm in bookmarks]


@app.post("/api/bookmarks/{question_id}")
async def api_toggle_bookmark(question_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    existing = db.query(models.Bookmark).filter(
        models.Bookmark.user_id == user.id,
        models.Bookmark.question_id == question_id,
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"bookmarked": False}
    bm = models.Bookmark(user_id=user.id, question_id=question_id, created_at=datetime.utcnow())
    db.add(bm)
    db.commit()
    return {"bookmarked": True}


@app.get("/saved", response_class=HTMLResponse)
async def saved_questions_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    bookmarks = (
        db.query(models.Bookmark)
        .options(selectinload(models.Bookmark.question).selectinload(models.Question.answers))
        .filter(models.Bookmark.user_id == user.id)
        .order_by(models.Bookmark.created_at.desc())
        .all()
    )
    return templates.TemplateResponse(request, "saved.html", {
        "request": request, "user": user, "bookmarks": bookmarks,
    })


# ─── Contact API ───────────────────────────────────────────────────────────────

@app.post("/api/contact")
async def api_contact(request: Request, db: Session = Depends(get_db)):
    limited = check_rate_limit(
        request,
        "contact_submit",
        message="Too many messages sent. Please try again later.",
    )
    if limited:
        return limited
    try:
        form = await request.form()
        attachment = get_uploaded_file(form.get("attachment"))
        attachment_name = None
        attachment_path = None
        attachment_type = None

        current_user = get_current_user(request, db)
        if current_user:
            if attachment:
                attachment_name, attachment_path, attachment_type = save_support_attachment(attachment)
            support_thread = models.SupportThread(
                user_id=current_user.id,
                subject=str(form.get("subject", "Support")),
                status="open",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(support_thread)
            db.flush()
            db.add(models.SupportMessage(
                thread_id=support_thread.id,
                sender_user_id=current_user.id,
                sender_role="user",
                sender_name=current_user.name,
                body=str(form.get("message", "")),
                attachment_name=attachment_name,
                attachment_path=attachment_path,
                attachment_type=attachment_type,
                created_at=datetime.utcnow(),
                read_by_user=True,
                read_by_admin=False,
            ))
            create_support_system_message(db, support_thread.id)
            db.commit()
            return JSONResponse({"success": True, "redirect": f"/messages?thread={support_thread.id}"})

        if attachment:
            attachment_name, attachment_path, attachment_type = save_contact_attachment(attachment)

        msg = models.ContactMessage(
            name=str(form.get("name", "")),
            email=str(form.get("email", "")),
            subject=str(form.get("subject", "General")),
            message=str(form.get("message", "")),
            attachment_name=attachment_name,
            attachment_path=attachment_path,
            attachment_type=attachment_type,
        )
        db.add(msg)
        db.commit()
        print(f"[CONTACT] from={form.get('email')} subject={form.get('subject')} attachment={attachment_name}")
        return JSONResponse({"success": True})
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    except Exception as e:
        print(f"[CONTACT ERROR] {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/support/threads/{thread_id}/reply")
async def api_support_reply(thread_id: int, request: Request, db: Session = Depends(get_db)):
    limited = check_rate_limit(
        request,
        "support_reply",
        message="Too many messages sent. Please wait a moment.",
    )
    if limited:
        return limited
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)

    thread = (
        db.query(models.SupportThread)
        .options(selectinload(models.SupportThread.user))
        .filter(models.SupportThread.id == thread_id)
        .first()
    )
    if not thread:
        return JSONResponse({"error": "Thread not found"}, status_code=404)
    if not user.is_admin and thread.user_id != user.id:
        return JSONResponse({"error": "Forbidden"}, status_code=403)

    form = await request.form()
    body = str(form.get("message", "")).strip()
    attachment = get_uploaded_file(form.get("attachment"))
    attachment_name = None
    attachment_path = None
    attachment_type = None

    if attachment:
        attachment_name, attachment_path, attachment_type = save_support_attachment(attachment)

    if not body and not attachment_name:
        return JSONResponse({"error": "Message or attachment is required"}, status_code=400)

    sender_role = "admin" if user.is_admin else "user"
    db.add(models.SupportMessage(
        thread_id=thread.id,
        sender_user_id=user.id,
        sender_role=sender_role,
        sender_name=(user.name if sender_role in ("user", "admin") else None),
        body=body,
        attachment_name=attachment_name,
        attachment_path=attachment_path,
        attachment_type=attachment_type,
        created_at=datetime.utcnow(),
        read_by_user=(sender_role == "user"),
        read_by_admin=(sender_role == "admin"),
    ))
    thread.updated_at = datetime.utcnow()
    if user.is_admin:
        thread.status = str(form.get("status", thread.status or "open"))
    else:
        thread.status = "open"
    db.commit()

    wants_json = (
        request.headers.get("x-requested-with", "").lower() == "xmlhttprequest"
        or "application/json" in request.headers.get("accept", "").lower()
    )
    if wants_json:
        return JSONResponse({
            "success": True,
            "thread_id": thread.id,
            "status": thread.status,
        })

    redirect_to = f"/support?thread={thread.id}" if user.is_admin else f"/messages?thread={thread.id}"
    return RedirectResponse(redirect_to, status_code=303)


@app.get("/api/support/threads-data")
async def api_support_threads_data(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    is_admin_view = user.is_admin and request.query_params.get("scope") == "admin"
    thread_id_raw = request.query_params.get("thread")
    thread_id = int(thread_id_raw) if thread_id_raw and thread_id_raw.isdigit() else None

    query = (
        db.query(models.SupportThread)
        .options(selectinload(models.SupportThread.user), selectinload(models.SupportThread.messages))
        .order_by(models.SupportThread.updated_at.desc())
    )
    if not is_admin_view:
        query = query.filter(models.SupportThread.user_id == user.id)

    threads = query.all()
    for thread in threads:
        if is_admin_view:
            thread.unread_count = sum(1 for m in thread.messages if not m.read_by_admin and m.sender_role == "user")
        else:
            thread.unread_count = sum(1 for m in thread.messages if not m.read_by_user and m.sender_role in ("admin", "system"))

    active_thread = next((t for t in threads if t.id == thread_id), threads[0] if threads else None)
    if active_thread:
        if is_admin_view:
            unread = [m for m in active_thread.messages if not m.read_by_admin and m.sender_role == "user"]
        else:
            unread = [m for m in active_thread.messages if not m.read_by_user and m.sender_role in ("admin", "system")]
        for message in unread:
            if is_admin_view:
                message.read_by_admin = True
            else:
                message.read_by_user = True
        if unread:
            db.commit()
            active_thread.unread_count = 0

    return {
        "threads": [serialize_support_thread(thread, is_admin_view) for thread in threads],
        "active_thread_id": active_thread.id if active_thread else None,
        "is_admin_view": is_admin_view,
    }


# ─── Admin API ─────────────────────────────────────────────────────────────────

@app.get("/metrics")
async def prometheus_metrics(request: Request, db: Session = Depends(get_db)):
    """Prometheus metrics endpoint, restricted to authenticated admins."""
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    if _instrumentator is None:
        return JSONResponse({"error": "Metrics disabled"}, status_code=503)
    try:
        from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
        from starlette.responses import Response as _Resp
        return _Resp(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/admin/api/stats")
async def admin_api_stats(request: Request, db: Session = Depends(get_db)):
    """JSON statistics for admin dashboard charts."""
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)

    now = datetime.utcnow()
    today = datetime(now.year, now.month, now.day)

    # 1. Registrations per day for the last 7 days
    registrations = []
    for i in range(6, -1, -1):
        day_start = today - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        count = db.query(sql_func.count(models.User.id)).filter(
            models.User.created_at >= day_start,
            models.User.created_at < day_end,
        ).scalar() or 0
        registrations.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "label": day_start.strftime("%a"),
            "count": int(count),
        })

    # 2. User role distribution
    total_users = db.query(sql_func.count(models.User.id)).scalar() or 0
    super_admins = db.query(sql_func.count(models.User.id)).filter(
        models.User.is_super_admin == True
    ).scalar() or 0
    admins = db.query(sql_func.count(models.User.id)).filter(
        models.User.is_admin == True,
        models.User.is_super_admin == False,
    ).scalar() or 0
    regular_users = max(int(total_users) - int(admins) - int(super_admins), 0)
    roles = {
        "users": regular_users,
        "admins": int(admins),
        "super_admins": int(super_admins),
    }

    # 3. Active live-activity sessions (online window from existing constant)
    online_cutoff = now - ACTIVITY_ONLINE_WINDOW
    try:
        active_sessions = db.query(sql_func.count(models.LiveActivitySession.id)).filter(
            models.LiveActivitySession.last_seen >= online_cutoff
        ).scalar() or 0
        authed_sessions = db.query(sql_func.count(models.LiveActivitySession.id)).filter(
            models.LiveActivitySession.last_seen >= online_cutoff,
            models.LiveActivitySession.is_authenticated == True,
        ).scalar() or 0
    except Exception:
        active_sessions = 0
        authed_sessions = 0

    return {
        "registrations_7d": registrations,
        "roles": roles,
        "active_sessions": {
            "total": int(active_sessions),
            "authenticated": int(authed_sessions),
            "anonymous": max(int(active_sessions) - int(authed_sessions), 0),
        },
        "generated_at": now.isoformat(),
    }


@app.get("/api/admin/users")
async def api_admin_users(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    now = datetime.utcnow()
    return [
        {"id": u.id, "public_id": u.public_id, "name": u.name, "email": u.email,
         "expires_at": u.expires_at.isoformat(), "is_admin": u.is_admin,
         "is_super_admin": bool(getattr(u, "is_super_admin", False)),
         "active": u.expires_at > now}
        for u in db.query(models.User).order_by(models.User.created_at.desc()).all()
    ]


@app.post("/api/admin/users")
async def api_admin_create_user(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    try:
        data = await request.json()
        email = str(data["email"]).lower().strip()
        duration_value = int(data.get("duration_value", data.get("days", 30)) or 0)
        duration_unit = str(data.get("duration_unit", "days") or "days")
        email_error = validate_registration_email(email)
        if email_error:
            return JSONResponse({"error": email_error}, status_code=400)
        password_error = validate_password_strength(str(data["password"]))
        if password_error:
            return JSONResponse({"error": password_error}, status_code=400)
        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            return JSONResponse({"error": "Email already registered"}, status_code=400)
        wants_admin = bool(data.get("is_admin", False))
        if wants_admin and not can_manage_admin_roles(user):
            return JSONResponse({"error": "Only the main admin can create other admins"}, status_code=403)
        u = models.User(
            name=data["name"], public_id=generate_unique_public_user_id(db), email=email,
            password_hash=hash_password(data["password"]),
            created_at=datetime.utcnow(),
            expires_at=compute_admin_expiry(duration_value, duration_unit),
            is_admin=wants_admin,
            is_super_admin=False,
        )
        db.add(u)
        if duration_value > 0:
            u.subscription_status = "active"
        db.commit()
        return JSONResponse({"success": True, "id": u.id, "public_id": u.public_id})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.put("/api/admin/users/{user_id}")
async def api_admin_update_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    admin = get_current_user(request, db)
    if not admin or not admin.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    data = await request.json()
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        return JSONResponse({"error": "Not found"}, status_code=404)
    target_is_admin = bool(u.is_admin)
    target_is_super_admin = bool(getattr(u, "is_super_admin", False))
    if target_is_super_admin and admin.id != u.id:
        return JSONResponse({"error": "The main admin account is protected"}, status_code=403)
    if target_is_admin and not can_manage_admin_roles(admin) and admin.id != u.id:
        return JSONResponse({"error": "Only the main admin can change other admin accounts"}, status_code=403)
    if "name" in data:
        u.name = data["name"]
    if "email" in data:
        email = str(data["email"]).lower().strip()
        email_error = validate_registration_email(email)
        if email_error:
            return JSONResponse({"error": email_error}, status_code=400)
        u.email = email
    if "password" in data and data["password"]:
        password_error = validate_password_strength(str(data["password"]))
        if password_error:
            return JSONResponse({"error": password_error}, status_code=400)
        u.password_hash = hash_password(data["password"])
    if "days" in data or "duration_value" in data:
        duration_value = int(data.get("duration_value", data.get("days", 0)) or 0)
        duration_unit = str(data.get("duration_unit", "days") or "days")
        u.expires_at = compute_admin_expiry(duration_value, duration_unit)
        # Keep subscription_status in sync so all UI checks are consistent
        if duration_value > 0:
            u.subscription_status = "active"
            u.current_period_end = None   # clear Stripe period end to avoid timer confusion
        else:
            u.subscription_status = "free"
            u.expires_at = datetime.utcnow()
    if "is_admin" in data:
        wants_admin = bool(data["is_admin"])
        if wants_admin != bool(u.is_admin):
            if not can_manage_admin_roles(admin):
                return JSONResponse({"error": "Only the main admin can change admin roles"}, status_code=403)
            if target_is_super_admin:
                return JSONResponse({"error": "The main admin role cannot be changed"}, status_code=403)
            u.is_admin = wants_admin
            if not wants_admin:
                u.is_super_admin = False
    db.commit()
    print(f"[ADMIN UPDATE] user_id={u.id} duration={data.get('duration_value', data.get('days'))} {data.get('duration_unit', 'days')} status={u.subscription_status} expires={u.expires_at}")
    return JSONResponse({"success": True})


@app.post("/api/admin/users/{user_id}/revoke-subscription")
async def api_admin_revoke_subscription(user_id: int, request: Request, db: Session = Depends(get_db)):
    admin = get_current_user(request, db)
    if not admin or not admin.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        return JSONResponse({"error": "Not found"}, status_code=404)
    if bool(getattr(u, "is_super_admin", False)):
        return JSONResponse({"error": "The main admin account is protected"}, status_code=403)
    if bool(u.is_admin):
        return JSONResponse({"error": "Admin subscriptions cannot be revoked here"}, status_code=403)
    if not user_has_access(u):
        return JSONResponse({"error": "This user has no active subscription"}, status_code=400)

    u.expires_at = datetime.utcnow()
    u.subscription_status = "free"
    u.current_period_end = None
    u.stripe_subscription_id = None
    db.commit()
    return JSONResponse({
        "success": True,
        "expires_at": u.expires_at.strftime('%d %b %Y %H:%M'),
        "status": "Expired",
    })


@app.delete("/api/admin/users/{user_id}")
async def api_admin_delete_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    admin = get_current_user(request, db)
    if not admin or not admin.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        return JSONResponse({"error": "Not found"}, status_code=404)
    if u.id == admin.id:
        return JSONResponse({"error": "Cannot delete yourself"}, status_code=400)
    if getattr(u, "is_super_admin", False):
        return JSONResponse({"error": "The main admin account cannot be deleted"}, status_code=403)
    if u.is_admin and not can_manage_admin_roles(admin):
        return JSONResponse({"error": "Only the main admin can delete other admins"}, status_code=403)

    deleted_email = u.email
    deleted_name = u.name
    try:
        send_account_removed_email(deleted_email, deleted_name)
    except Exception as e:
        print(f"[ADMIN DELETE] account removed email failed for {deleted_email!r}: {e}")

    db.query(models.UserAnswer).filter(
        models.UserAnswer.attempt_id.in_(
            db.query(models.UserTestAttempt.id).filter(models.UserTestAttempt.user_id == user_id)
        )
    ).delete(synchronize_session=False)
    db.query(models.UserTestAttempt).filter(models.UserTestAttempt.user_id == user_id).delete()
    db.delete(u)
    db.commit()
    return JSONResponse({"success": True})


@app.get("/api/admin/messages")
async def api_admin_messages(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    messages = db.query(models.ContactMessage).order_by(
        models.ContactMessage.created_at.desc()
    ).all()
    return [
        {"id": m.id, "name": m.name, "email": m.email, "subject": m.subject,
         "message": m.message, "created_at": m.created_at.isoformat(), "is_read": m.is_read}
        for m in messages
    ]


@app.put("/api/admin/messages/{msg_id}/read")
async def api_admin_mark_read(msg_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    msg = db.query(models.ContactMessage).filter(models.ContactMessage.id == msg_id).first()
    if not msg:
        return JSONResponse({"error": "Not found"}, status_code=404)
    msg.is_read = True
    db.commit()
    return JSONResponse({"success": True})


@app.post("/api/admin/promo-codes")
async def api_admin_create_promo_code(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    try:
        ensure_promo_codes_table(db)
        data = await request.json()
        duration_days = int(data.get("duration_days", 0) or 0)
        max_uses_raw = data.get("max_uses")
        expires_at_raw = str(data.get("expires_at", "") or "").strip()
        if duration_days <= 0:
            return JSONResponse({"error": "Duration must be at least 1 day"}, status_code=400)

        max_uses = None
        if max_uses_raw not in (None, "", 0, "0"):
            max_uses = int(max_uses_raw)
            if max_uses <= 0:
                return JSONResponse({"error": "Usage limit must be greater than 0"}, status_code=400)

        expires_at = None
        if expires_at_raw:
            try:
                expires_at = datetime.strptime(expires_at_raw, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
            except ValueError:
                return JSONResponse({"error": "Invalid expiry date"}, status_code=400)

        promo = models.PromoCode(
            code=generate_unique_promo_code(db),
            duration_days=duration_days,
            max_uses=max_uses,
            current_uses=0,
            expires_at=expires_at,
            created_at=datetime.utcnow(),
            is_active=True,
        )
        db.add(promo)
        db.commit()
        return JSONResponse({"success": True, "code": promo.code})
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/promo-codes/redeem")
async def api_redeem_promo_code(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        data = await request.json()
        code = str(data.get("code", "")).strip().upper()
        if not code:
            return JSONResponse({"error": "Enter a promo code"}, status_code=400)

        promo = db.query(models.PromoCode).filter(models.PromoCode.code == code).first()
        if not promo:
            return JSONResponse({"error": "Promo code not found"}, status_code=404)
        if not promo.is_active:
            return JSONResponse({"error": "This promo code is inactive"}, status_code=400)
        if promo.expires_at and promo.expires_at < datetime.utcnow():
            return JSONResponse({"error": "This promo code has expired"}, status_code=400)
        if promo.max_uses is not None and promo.current_uses >= promo.max_uses:
            return JSONResponse({"error": "This promo code has reached its usage limit"}, status_code=400)

        promo.current_uses += 1
        if promo.max_uses is not None and promo.current_uses >= promo.max_uses:
            promo.is_active = False

        new_expiry = apply_subscription_days(user, promo.duration_days)
        db.commit()
        return JSONResponse({
            "success": True,
            "message": f"Promo code applied. {promo.duration_days} days added.",
            "duration_days": promo.duration_days,
            "expires_at": new_expiry.isoformat(),
        })
    except Exception as e:
        db.rollback()
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── Pricing / Subscription pages ─────────────────────────────────────────────

@app.get("/pricing", response_class=HTMLResponse)
async def pricing_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse(request, "pricing.html", {
        "request": request,
        "user": user,
        "now": datetime.utcnow(),
        "has_access": user_has_access(user) if user else False,
        "access_expires_at": get_user_access_expiry(user) if user and not user.is_admin else None,
    })


@app.get("/success", response_class=HTMLResponse)
async def success_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    return templates.TemplateResponse(request, "success.html", {"request": request, "user": user})


@app.get("/cancel", response_class=HTMLResponse)
async def cancel_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse(request, "cancel.html", {"request": request, "user": user})


# ─── Stripe API ─────────────────────────────────────────────────────────────

@app.post("/api/create-checkout-session")
async def api_create_checkout(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        customer_id = get_or_create_customer(user)
        if not user.stripe_customer_id:
            user.stripe_customer_id = customer_id
            db.commit()
        url = create_checkout_session(customer_id, user.id)
        return JSONResponse({"url": url})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/billing-portal")
async def api_billing_portal(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        # Auto-create Stripe customer if not yet present
        if not user.stripe_customer_id:
            customer_id = get_or_create_customer(user)
            user.stripe_customer_id = customer_id
            db.commit()
        url = create_portal_session(user.stripe_customer_id)
        return JSONResponse({"url": url})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


async def _handle_stripe_webhook(request: Request, db: Session, stripe_signature: str):
    payload = await request.body()
    try:
        event = construct_webhook_event(payload, stripe_signature)
    except Exception as e:
        print(f"[WEBHOOK] Signature error: {e}")
        return JSONResponse({"error": "Invalid signature"}, status_code=400)

    event_id   = event["id"]
    event_type = event["type"]
    data_obj   = event["data"]["object"]
    print(f"[WEBHOOK] {event_type} (id={event_id})")

    # Idempotency: skip already-processed webhook events
    if db.query(models.StripeWebhookEvent).filter(
        models.StripeWebhookEvent.event_id == event_id
    ).first():
        print(f"[WEBHOOK] Duplicate event {event_id}, skipping")
        return JSONResponse({"received": True, "duplicate": True})

    if event_type == "checkout.session.completed":
        user_id = data_obj.get("metadata", {}).get("user_id")
        customer_id = data_obj.get("customer")
        subscription_id = data_obj.get("subscription")
        if user_id:
            u = db.query(models.User).filter(models.User.id == int(user_id)).first()
            if u:
                u.stripe_customer_id = customer_id
                u.stripe_subscription_id = subscription_id
                u.subscription_status = "active"
                db.commit()
                print(f"[WEBHOOK] User {user_id} activated")

    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        customer_id = data_obj.get("customer")
        status = data_obj.get("status")
        period_end = data_obj.get("current_period_end")
        u = db.query(models.User).filter(models.User.stripe_customer_id == customer_id).first()
        if u:
            u.subscription_status = status
            u.stripe_subscription_id = data_obj.get("id")
            if period_end:
                u.current_period_end = datetime.utcfromtimestamp(period_end)
            db.commit()
            print(f"[WEBHOOK] Subscription {status} for customer {customer_id}")

    elif event_type == "customer.subscription.deleted":
        customer_id = data_obj.get("customer")
        u = db.query(models.User).filter(models.User.stripe_customer_id == customer_id).first()
        if u:
            u.subscription_status = "canceled"
            u.stripe_subscription_id = None
            db.commit()
            print(f"[WEBHOOK] Subscription canceled for customer {customer_id}")

    # Record processed event for idempotency
    db.add(models.StripeWebhookEvent(event_id=event_id, event_type=event_type))
    db.commit()

    return JSONResponse({"received": True})


# Accept webhook on both paths (Stripe dashboard may be configured to either)
@app.post("/stripe/webhook")
async def stripe_webhook_root(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    return await _handle_stripe_webhook(request, db, stripe_signature)


@app.post("/api/stripe/webhook")
async def api_stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    return await _handle_stripe_webhook(request, db, stripe_signature)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
