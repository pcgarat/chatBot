from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# SQLite necesita connect_args para permitir acceso desde múltiples hilos en FastAPI
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Migración: añadir inject_instruction_every si no existe
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE conversations ADD COLUMN inject_instruction_every INTEGER"))
            conn.commit()
        except Exception:
            conn.rollback()
