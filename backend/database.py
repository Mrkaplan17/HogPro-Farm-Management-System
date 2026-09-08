import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Production/dev database is PostgreSQL, configured entirely via DATABASE_URL.
# Example local dev DSN (see docker-compose.yml):
#   postgresql+psycopg://piggery:piggery@127.0.0.1:5433/piggery
# Supabase / Render URLs are typically "postgresql://..." (no driver) and require
# SSL for non-local hosts; prepare_url() normalizes both so DATABASE_URL can be
# pasted straight from the provider's dashboard.
RAW_DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://piggery:piggery@127.0.0.1:5433/piggery",
)


def prepare_url(raw: str) -> str:
    scheme, sep, rest = raw.partition("://")
    if scheme in ("postgres", "postgresql"):
        raw = f"postgresql+psycopg://{rest}"
    host = rest.split("@")[-1].split(":")[0] if sep else ""
    if raw.startswith("postgresql+psycopg://") and host not in ("127.0.0.1", "localhost"):
        if "?sslmode=" not in raw:
            raw += ("&" if "?" in raw else "?") + "sslmode=require"
    return raw


DATABASE_URL = prepare_url(RAW_DATABASE_URL)

engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()