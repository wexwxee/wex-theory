"""Persistent localhost preview with separate data and local-only email delivery."""
import os
import secrets
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def run():
    os.chdir(ROOT)
    local = ROOT / ".local"
    local.mkdir(exist_ok=True)
    secret_file = local / "secret-key"
    if not secret_file.exists():
        secret_file.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    os.environ.update({
        "DATABASE_URL": "sqlite:///" + (local / "preview.db").as_posix(),
        "SECRET_KEY": secret_file.read_text(encoding="utf-8").strip(),
        "APP_ENV": "development", "ENVIRONMENT": "development",
        "BASE_URL": "http://127.0.0.1:8010", "CLIENT_URL": "http://127.0.0.1:8010",
        "COOKIE_SECURE": "false", "SESSION_COOKIE_SECURE": "false",
        "TRUST_PROXY_HEADERS": "false", "PRIMARY_SUPER_ADMIN_EMAIL": "admin@local.test",
        "BOOTSTRAP_ADMIN_PASSWORD": "LocalAdmin123!",
    })
    for key in ("RENDER_SERVICE_ID", "RENDER_EXTERNAL_URL", "REDIS_URL", "RESEND_API_KEY",
                "STRIPE_SECRET_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
                "TELEGRAM_BOT_TOKEN"):
        os.environ.pop(key, None)

    import main
    import models
    import uvicorn
    from database import SessionLocal
    from import_data import import_data

    import_data()
    with SessionLocal() as db:
        for email, name, password, days, admin in [
            ("admin@local.test", "Local Admin", "LocalAdmin123!", 3650, True),
            ("student@local.test", "Test Student", "LocalStudent123!", 30, False),
            ("free@local.test", "Free Student", "LocalStudent123!", 0, False),
        ]:
            if not db.query(models.User).filter_by(email=email).first():
                db.add(models.User(email=email, name=name, password_hash=main.hash_password(password),
                                   expires_at=datetime.utcnow() + timedelta(days=days),
                                   is_admin=admin, is_super_admin=admin))
        db.commit()

    # Only this launcher replaces delivery; production code and authentication stay intact.
    def local_verification(recipient_email, code, recipient_name, confirm_url=None):
        message = f"\nTo: {recipient_email}\nCode: {code}\nLink: {confirm_url or ''}\n"
        with (local / "mail.txt").open("a", encoding="utf-8") as outbox:
            outbox.write(message)
        print("[LOCAL EMAIL] Verification saved to .local/mail.txt", flush=True)

    main.is_email_service_configured = lambda: True
    main.send_verification_email = local_verification
    main.send_password_reset_email = local_verification
    uvicorn.run(main.app, host="127.0.0.1", port=8010, proxy_headers=False)


if __name__ == "__main__":
    run()
