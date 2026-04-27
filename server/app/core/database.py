from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from app.core.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# (table, column, postgres_ddl, sqlite_ddl). Postgres DDL uses tz-aware timestamps
# and NOT NULL defaults; SQLite drops those because older DBs can't backfill NOT NULL
# without a table rewrite — we rely on the ORM default on future inserts instead.
_ADDITIVE_COLUMNS: list[tuple[str, str, str, str]] = [
    ("meetings", "scheduled_at", "TIMESTAMP WITH TIME ZONE", "TIMESTAMP"),
    ("meetings", "timezone_name", "VARCHAR(64)", "VARCHAR(64)"),
    ("meetings", "waiting_room_enabled", "BOOLEAN DEFAULT TRUE NOT NULL", "BOOLEAN DEFAULT 1"),
    ("meetings", "locked", "BOOLEAN DEFAULT FALSE NOT NULL", "BOOLEAN DEFAULT 0"),
    ("meeting_participants", "role", "VARCHAR(24) DEFAULT 'participant' NOT NULL", "VARCHAR(24) DEFAULT 'participant'"),
    ("meeting_participants", "status", "VARCHAR(24) DEFAULT 'admitted' NOT NULL", "VARCHAR(24) DEFAULT 'admitted'"),
    ("meeting_participants", "peer_id", "VARCHAR(32)", "VARCHAR(32)"),
    ("meeting_participants", "last_seen_at", "TIMESTAMP WITH TIME ZONE", "TIMESTAMP"),
    # Chat enhancements
    ("messages", "deleted_at", "TIMESTAMP WITH TIME ZONE", "TIMESTAMP"),
    ("messages", "reply_to_id", "INTEGER REFERENCES messages(id)", "INTEGER"),
    ("messages", "file_url", "VARCHAR(500)", "VARCHAR(500)"),
    ("messages", "file_name", "VARCHAR(255)", "VARCHAR(255)"),
    ("messages", "file_type", "VARCHAR(100)", "VARCHAR(100)"),
    ("messages", "file_size", "INTEGER", "INTEGER"),
    ("channel_members", "is_muted", "BOOLEAN DEFAULT FALSE NOT NULL", "BOOLEAN DEFAULT 0"),
    # Meeting password
    ("meetings", "password_hash", "VARCHAR(255)", "VARCHAR(255)"),
    # Per-meeting permissions (host/co-host always exempt)
    ("meetings", "chat_enabled", "BOOLEAN DEFAULT TRUE NOT NULL", "BOOLEAN DEFAULT 1"),
    ("meetings", "screenshare_enabled", "BOOLEAN DEFAULT TRUE NOT NULL", "BOOLEAN DEFAULT 1"),
]


def _apply_additive_migrations() -> None:
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    is_sqlite = engine.dialect.name == "sqlite"
    with engine.begin() as conn:
        for table, column, pg_ddl, sqlite_ddl in _ADDITIVE_COLUMNS:
            if table not in existing_tables:
                continue
            cols = {c["name"] for c in insp.get_columns(table)}
            if column in cols:
                continue
            ddl = sqlite_ddl if is_sqlite else pg_ddl
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def init_db() -> None:
    from app import models  # noqa: F401  ensure models are imported
    Base.metadata.create_all(bind=engine)
    _apply_additive_migrations()
