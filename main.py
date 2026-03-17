import json
import os
import re
import secrets
import traceback
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Request, Depends, HTTPException, Header, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func as sql_func, inspect as sql_inspect, text as sql_text
from authlib.integrations.starlette_client import OAuth

import models
from auth import hash_password, verify_password, create_token, decode_token, get_current_user, user_has_access, SECRET_KEY
from database import engine, get_db
from stripe_helpers import (
    get_or_create_customer, create_checkout_session,
    create_portal_session, construct_webhook_event,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WEX Theory")
AUTH_COOKIE_NAME = "token"
AUTH_COOKIE_MAX_AGE = 86400 * 30
PUBLIC_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
BASE_DIR = Path(__file__).resolve().parent
CONTACT_UPLOAD_DIR = BASE_DIR / "uploads" / "contact"
SUPPORT_UPLOAD_DIR = BASE_DIR / "uploads" / "support"
ALLOWED_CONTACT_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt", ".log", ".json"}
MAX_CONTACT_UPLOAD_BYTES = 10 * 1024 * 1024
CONTACT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SUPPORT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
QUESTION_TEXT_FIXES = {
    "You are required to turn right at the signal-controlled junction. There is no traffic directly behind you. How should":
        "You are required to turn right at the signal-controlled junction. There is no traffic directly behind you. How should you proceed?"
}


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


def _new_public_user_id() -> str:
    return "WEX-" + "".join(secrets.choice(PUBLIC_ID_ALPHABET) for _ in range(8))


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


def save_contact_attachment(upload: UploadFile) -> tuple[str, str, str]:
    original_name = os.path.basename(upload.filename or "").strip()
    if not original_name:
        raise ValueError("Attachment filename is missing")

    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_CONTACT_EXTENSIONS:
        raise ValueError("Allowed files: images, PDF, TXT, LOG, JSON")

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


def create_support_system_message(db: Session, thread_id: int) -> None:
    db.add(models.SupportMessage(
        thread_id=thread_id,
        sender_role="system",
        body="Your request has been received. Please wait up to 32 hours for a reply from support.",
        read_by_user=True,
        read_by_admin=True,
        created_at=datetime.utcnow(),
    ))


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
    https_only=_env_flag("SESSION_COOKIE_SECURE", False),
    max_age=AUTH_COOKIE_MAX_AGE,
)


@app.middleware("http")
async def refresh_auth_session(request: Request, call_next):
    response = await call_next(request)
    token = request.cookies.get(AUTH_COOKIE_NAME)
    payload = decode_token(token) if token else None
    if payload and payload.get("sub") and request.url.path not in {"/api/auth/logout", "/logout"}:
        refreshed = create_token(int(payload["sub"]))
        set_auth_cookie(response, refreshed, request)
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
        ensure_all_user_public_ids(db)
        ensure_contact_attachment_columns(db)
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
        _admin_email = "wexwxee@gmail.com"
        existing = db.query(models.User).filter(models.User.email == _admin_email).first()
        if not existing:
            # Also check for old email and update it
            old_admin = db.query(models.User).filter(models.User.email == "admin@wex.com").first()
            if old_admin:
                old_admin.email = _admin_email
                old_admin.password_hash = hash_password("fruktozik22")
                old_admin.expires_at = datetime.utcnow() + timedelta(days=3650)
                old_admin.is_admin = True
                old_admin.subscription_status = "active"
                db.commit()
                print(f"[STARTUP] Admin migrated: admin@wex.com → {_admin_email}")
            else:
                u = models.User(
                    name="Admin",
                    public_id=generate_unique_public_user_id(db),
                    email=_admin_email,
                    password_hash=hash_password("fruktozik22"),
                    created_at=datetime.utcnow(),
                    expires_at=datetime.utcnow() + timedelta(days=3650),
                    is_admin=True,
                    subscription_status="active",
                )
                db.add(u)
                db.commit()
                print(f"[STARTUP] Admin created: {_admin_email}")
        else:
            # Ensure existing admin has correct password and subscription
            existing.password_hash = hash_password("fruktozik22")
            existing.subscription_status = "active"
            existing.is_admin = True
            db.commit()
            print(f"[STARTUP] Admin exists and refreshed: id={existing.id}")

    except Exception as e:
        print(f"[STARTUP] Error: {e}")
        traceback.print_exc()
    finally:
        db.close()


app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/test-images", StaticFiles(directory="test-images"), name="test-images")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
templates = Jinja2Templates(directory="templates")


# ─── One-time setup endpoint ───────────────────────────────────────────────────

@app.get("/setup-admin-xk92")
async def setup_admin(db: Session = Depends(get_db)):
    _admin_email = "wexwxee@gmail.com"
    existing = db.query(models.User).filter(models.User.email == _admin_email).first()
    if existing:
        existing.password_hash = hash_password("fruktozik22")
        existing.expires_at = datetime.utcnow() + timedelta(days=3650)
        existing.is_admin = True
        existing.subscription_status = "active"
        db.commit()
        return {"status": "updated", "email": _admin_email, "id": existing.id}
    u = models.User(
        name="Admin",
        public_id=generate_unique_public_user_id(db),
        email=_admin_email,
        password_hash=hash_password("fruktozik22"),
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=3650),
        is_admin=True,
        subscription_status="active",
    )
    db.add(u)
    db.commit()
    return {"status": "created", "id": u.id}


# ─── Google OAuth pages ────────────────────────────────────────────────────────

@app.get("/auth/google")
async def google_login(request: Request):
    if not _google_client_id:
        return RedirectResponse("/login?error=google_not_configured", status_code=302)
    base_url = os.environ.get("BASE_URL", str(request.base_url).rstrip("/"))
    redirect_uri = base_url + "/auth/google/callback"
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
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})


@app.get("/about", response_class=HTMLResponse)
async def about_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("about.html", {"request": request, "user": user})


@app.get("/faq", response_class=HTMLResponse)
async def faq_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("faq.html", {"request": request, "user": user})


@app.get("/contact", response_class=HTMLResponse)
async def contact_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("contact.html", {"request": request, "user": user})


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("privacy.html", {"request": request, "user": user})


@app.get("/subscription-expired", response_class=HTMLResponse)
async def expired_page(request: Request):
    return templates.TemplateResponse("subscription_expired.html", {"request": request})


# ─── Auth API ──────────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
async def api_register(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        print(f"[REGISTER] received: name={data.get('name')} email={data.get('email')}")

        name     = str(data.get("name", "")).strip()
        email    = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        # days only used when admin calls this endpoint directly; public registration gets no premium
        days     = int(data.get("days", 0))

        if not name or not email or not password:
            return JSONResponse({"error": "All fields are required"}, status_code=400)
        if len(password) < 6:
            return JSONResponse({"error": "Password must be at least 6 characters"}, status_code=400)

        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            print(f"[REGISTER] email taken: {email}")
            return JSONResponse({"error": "This email is already registered"}, status_code=400)

        user = models.User(
            name=name,
            public_id=generate_unique_public_user_id(db),
            email=email,
            password_hash=hash_password(password),
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=days),
            is_admin=(email == "wexwxee@gmail.com"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = create_token(user.id)
        resp = JSONResponse({"success": True, "redirect": "/dashboard"})
        set_auth_cookie(resp, token, request)
        print(f"[REGISTER] success: id={user.id} email={email} admin={user.is_admin}")
        return resp

    except Exception as e:
        print(f"[REGISTER ERROR] {e}")
        traceback.print_exc()
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)


@app.post("/api/auth/login")
async def api_login(request: Request, db: Session = Depends(get_db)):
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

    tests = db.query(models.Test).order_by(models.Test.id).all()
    finished = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.user_id == user.id,
        models.UserTestAttempt.finished_at.isnot(None),
    ).all()

    best_scores: dict[int, int] = {}
    for a in finished:
        if a.test_id not in best_scores or (a.score or 0) > best_scores[a.test_id]:
            best_scores[a.test_id] = a.score or 0

    images: dict[int, str] = {}
    for t in tests:
        q = db.query(models.Question).filter(
            models.Question.test_id == t.id,
            models.Question.question_index == 1
        ).first()
        images[t.id] = q.image_path if q else ""

    completed = sum(1 for s in best_scores.values() if s >= 20)
    has_full_access = user_has_access(user)

    return templates.TemplateResponse("dashboard.html", {
        "request": request, "user": user, "tests": tests,
        "best_scores": best_scores, "images": images,
        "completed": completed, "has_access": has_full_access,
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
    return templates.TemplateResponse("profile.html", {
        "request": request, "user": user, "attempts": attempts,
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

    return templates.TemplateResponse("support.html", {
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

    return templates.TemplateResponse("support.html", {
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
    unread_count = sum(1 for m in messages if not m.is_read)

    return templates.TemplateResponse("admin.html", {
        "request": request, "user": user, "users": users,
        "messages": messages, "unread_count": unread_count,
        "now": datetime.utcnow(),
    })


# ─── Free test (no auth) ───────────────────────────────────────────────────────

@app.get("/test/1/free", response_class=HTMLResponse)
async def free_test_page(request: Request, db: Session = Depends(get_db)):
    test = db.query(models.Test).filter(models.Test.id == 1).first()
    return templates.TemplateResponse("free_test.html", {"request": request, "test": test})


@app.get("/api/tests/1/questions/free")
async def api_free_questions(db: Session = Depends(get_db)):
    questions = db.query(models.Question).filter(
        models.Question.test_id == 1
    ).order_by(models.Question.question_index).all()
    return [
        {"id": q.id, "question_index": q.question_index, "question_text": q.question_text,
         "image_path": q.image_path, "answers": [{"id": a.id, "text": a.text} for a in q.answers]}
        for q in questions
    ]


@app.post("/api/tests/1/check/free")
async def api_free_check(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    user_answers = body.get("answers", {})

    questions = db.query(models.Question).filter(
        models.Question.test_id == 1
    ).order_by(models.Question.question_index).all()

    results = []
    score = 0
    for q in questions:
        correct_ids = [a.id for a in q.answers if a.is_correct]
        selected = user_answers.get(str(q.id), [])
        is_correct = set(selected) == set(correct_ids)
        if is_correct:
            score += 1
        results.append({
            "question_id": q.id, "question_index": q.question_index,
            "correct_ids": correct_ids, "selected_ids": selected,
            "is_correct": is_correct, "explanation": q.explanation,
            "image_path": q.image_path,
        })
    return {"score": score, "passed": score >= 20, "total": 25, "results": results}


# ─── Test pages ────────────────────────────────────────────────────────────────

@app.get("/test/{test_id}", response_class=HTMLResponse)
async def test_page(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    # Test 1: free for all authenticated users
    if test_id == 1:
        if not user:
            return RedirectResponse("/login", status_code=302)
    else:
        if not user:
            return RedirectResponse("/login", status_code=302)
        if not user_has_access(user):
            return RedirectResponse("/pricing", status_code=302)

    test = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404)
    return templates.TemplateResponse("test.html", {"request": request, "user": user, "test": test})


@app.get("/test/{test_id}/overview", response_class=HTMLResponse)
async def overview_page(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    test = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404)
    return templates.TemplateResponse("overview.html", {"request": request, "user": user, "test": test})


@app.get("/results/free", response_class=HTMLResponse)
async def free_results_page(request: Request):
    return templates.TemplateResponse("results_free.html", {"request": request})


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

    questions = db.query(models.Question).options(
        selectinload(models.Question.answers)
    ).filter(
        models.Question.test_id == test_id
    ).order_by(models.Question.question_index).all()
    ua_map = {ua.question_id: ua for ua in attempt.user_answers}
    question_results = []
    for q in questions:
        ua = ua_map.get(q.id)
        correct_ids = [a.id for a in q.answers if a.is_correct]
        selected_ids = json.loads(ua.selected_answer_ids) if ua else []
        question_results.append({
            "question": q,
            "answers": q.answers,
            "is_correct": ua.is_correct if ua else False,
            "selected_ids": selected_ids,
            "correct_ids": correct_ids,
        })
    return templates.TemplateResponse("results.html", {
        "request": request, "user": user, "test": attempt.test,
        "attempt": attempt, "question_results": question_results,
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

    questions = db.query(models.Question).options(
        selectinload(models.Question.answers)
    ).filter(
        models.Question.test_id == test_id
    ).order_by(models.Question.question_index).all()
    ua_map = {ua.question_id: ua for ua in attempt.user_answers}
    review_data = []
    for q in questions:
        ua = ua_map.get(q.id)
        review_data.append({
            "question": q, "answers": q.answers,
            "selected_ids": json.loads(ua.selected_answer_ids) if ua else [],
            "is_correct": ua.is_correct if ua else False,
        })
    return templates.TemplateResponse("review.html", {
        "request": request, "user": user, "test": attempt.test,
        "attempt": attempt, "review_data": review_data,
    })


# ─── Test API ──────────────────────────────────────────────────────────────────

@app.get("/api/tests")
async def api_tests(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    tests = db.query(models.Test).order_by(models.Test.id).all()
    return [{"id": t.id, "title": t.title} for t in tests]


@app.get("/api/tests/{test_id}/questions")
async def api_questions(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    # Test 2+ requires active subscription
    if test_id != 1 and not user_has_access(user):
        return JSONResponse({"error": "Subscription required"}, status_code=403)
    questions = db.query(models.Question).filter(
        models.Question.test_id == test_id
    ).order_by(models.Question.question_index).all()
    if not questions:
        return JSONResponse({"error": "No questions found for this test"}, status_code=404)
    return [
        {"id": q.id, "question_index": q.question_index, "question_text": q.question_text,
         "image_path": q.image_path, "answers": [{"id": a.id, "text": a.text} for a in q.answers]}
        for q in questions
    ]


@app.post("/api/tests/{test_id}/start")
async def api_start_test(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if test_id != 1 and not user_has_access(user):
        return JSONResponse({"error": "Subscription required"}, status_code=403)

    test = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        total = db.query(models.Test).count()
        print(f"[START] Test {test_id} not found. Total tests in DB: {total}")
        return JSONResponse({"error": f"Test {test_id} not found (DB has {total} tests)"}, status_code=404)

    try:
        attempt = models.UserTestAttempt(user_id=user.id, test_id=test_id, started_at=datetime.utcnow())
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

    correct_ids = {a.id for a in question.answers if a.is_correct}
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
        correct_ids = {a.id for a in q.answers if a.is_correct}
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
        passed = score >= 20
        attempt.finished_at = datetime.utcnow()
        attempt.score = score
        attempt.passed = passed
        db.commit()
        return {"score": score, "passed": passed, "total": 25}
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
    questions = db.query(models.Question).filter(
        models.Question.test_id == attempt.test_id
    ).order_by(models.Question.question_index).all()

    return [
        {
            "id": q.id, "question_index": q.question_index,
            "question_text": q.question_text, "image_path": q.image_path,
            "explanation": q.explanation,
            "is_correct": ua_map[q.id].is_correct if q.id in ua_map else False,
            "selected_ids": json.loads(ua_map[q.id].selected_answer_ids) if q.id in ua_map else [],
            "answers": [{"id": a.id, "text": a.text, "is_correct": a.is_correct} for a in q.answers],
        }
        for q in questions
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


# Translation moved to frontend (MyMemory free API — no key required)


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
    return templates.TemplateResponse("saved.html", {
        "request": request, "user": user, "bookmarks": bookmarks,
    })


# ─── Contact API ───────────────────────────────────────────────────────────────

@app.post("/api/contact")
async def api_contact(request: Request, db: Session = Depends(get_db)):
    try:
        form = await request.form()
        attachment = form.get("attachment")
        attachment_name = None
        attachment_path = None
        attachment_type = None

        current_user = get_current_user(request, db)
        if current_user:
            if isinstance(attachment, UploadFile) and attachment.filename:
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

        if isinstance(attachment, UploadFile) and attachment.filename:
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
    attachment = form.get("attachment")
    attachment_name = None
    attachment_path = None
    attachment_type = None

    if isinstance(attachment, UploadFile) and attachment.filename:
        attachment_name, attachment_path, attachment_type = save_support_attachment(attachment)

    if not body and not attachment_name:
        return JSONResponse({"error": "Message or attachment is required"}, status_code=400)

    sender_role = "admin" if user.is_admin else "user"
    db.add(models.SupportMessage(
        thread_id=thread.id,
        sender_user_id=user.id,
        sender_role=sender_role,
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

    redirect_to = f"/support?thread={thread.id}" if user.is_admin else f"/messages?thread={thread.id}"
    return RedirectResponse(redirect_to, status_code=303)


# ─── Admin API ─────────────────────────────────────────────────────────────────

@app.get("/api/admin/users")
async def api_admin_users(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    now = datetime.utcnow()
    return [
        {"id": u.id, "public_id": u.public_id, "name": u.name, "email": u.email,
         "expires_at": u.expires_at.isoformat(), "is_admin": u.is_admin,
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
        existing = db.query(models.User).filter(models.User.email == data["email"].lower()).first()
        if existing:
            return JSONResponse({"error": "Email already registered"}, status_code=400)
        u = models.User(
            name=data["name"], public_id=generate_unique_public_user_id(db), email=data["email"].lower(),
            password_hash=hash_password(data["password"]),
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=int(data.get("days", 30))),
            is_admin=data.get("is_admin", False),
        )
        db.add(u)
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
    if "name" in data:
        u.name = data["name"]
    if "email" in data:
        u.email = data["email"].lower()
    if "password" in data and data["password"]:
        u.password_hash = hash_password(data["password"])
    if "days" in data:
        days = int(data["days"])
        u.expires_at = datetime.utcnow() + timedelta(days=days)
        # Keep subscription_status in sync so all UI checks are consistent
        if days > 0:
            u.subscription_status = "active"
            u.current_period_end = None   # clear Stripe period end to avoid timer confusion
        else:
            u.subscription_status = "free"
            u.expires_at = datetime.utcnow()
    if "is_admin" in data:
        u.is_admin = data["is_admin"]
    db.commit()
    print(f"[ADMIN UPDATE] user_id={u.id} days={data.get('days')} status={u.subscription_status} expires={u.expires_at}")
    return JSONResponse({"success": True})


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


# ─── Pricing / Subscription pages ─────────────────────────────────────────────

@app.get("/pricing", response_class=HTMLResponse)
async def pricing_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("pricing.html", {"request": request, "user": user, "now": datetime.utcnow()})


@app.get("/success", response_class=HTMLResponse)
async def success_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    return templates.TemplateResponse("success.html", {"request": request, "user": user})


@app.get("/cancel", response_class=HTMLResponse)
async def cancel_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("cancel.html", {"request": request, "user": user})


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

    event_type = event["type"]
    data_obj   = event["data"]["object"]
    print(f"[WEBHOOK] {event_type}")

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
