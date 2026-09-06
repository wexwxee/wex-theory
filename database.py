import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

LOCAL_DATABASE_URL = "sqlite:///./wex_theory.db"


def _is_production_environment(env=None):
    source = os.environ if env is None else env
    app_env = str(source.get("APP_ENV") or source.get("ENVIRONMENT") or "").strip().lower()
    return app_env in {"production", "prod"} or bool(
        source.get("RENDER_SERVICE_ID") or source.get("RENDER_EXTERNAL_URL")
    )


def _resolve_database_url(env=None):
    source = os.environ if env is None else env
    configured = str(source.get("DATABASE_URL") or "").strip()
    if configured:
        return configured
    if _is_production_environment(source):
        raise RuntimeError("DATABASE_URL is required in production; refusing local SQLite fallback")
    return LOCAL_DATABASE_URL


DATABASE_URL = _resolve_database_url()

# Render PostgreSQL connection strings start with "postgres://" but
# SQLAlchemy requires "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False; PostgreSQL does not
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
