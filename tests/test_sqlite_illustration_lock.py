"""Reproduce y evita 'database is locked' al persistir durante el stream de ilustración."""

from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from app import crud
from app.db import Base
from app.routers import api_images
from app.services.image_illustration.models import IllustrationEvent


def _make_file_db(path: Path, *, timeout_s: float | None = 0.1, wal: bool = False):
    connect_args: dict = {"check_same_thread": False}
    if timeout_s is not None:
        connect_args["timeout"] = timeout_s
    engine = create_engine(f"sqlite:///{path}", connect_args=connect_args)

    if wal:

        @event.listens_for(engine, "connect")
        def _pragma(dbapi_conn, _connection_record):
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute(f"PRAGMA busy_timeout={int((timeout_s or 0) * 1000)}")
            cur.close()

    Base.metadata.create_all(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine, Session


def test_update_message_content_fails_fast_when_sqlite_locked_without_wait(tmp_path):
    """Sin esperar el lock, un segundo writer falla con 'database is locked'."""
    db_path = tmp_path / "locked.db"
    engine, Session = _make_file_db(db_path, timeout_s=0.05, wal=False)
    try:
        with Session() as setup:
            conv = crud.create_conversation(setup, title="t", model_id="m", provider="ollama")
            msg = crud.add_message(setup, conv.id, "assistant", "texto original")
            cid, mid = conv.id, msg.id

        holder = sqlite3.connect(str(db_path), timeout=0.05, check_same_thread=False)
        holder.execute("BEGIN EXCLUSIVE")
        try:
            with Session() as writer:
                with pytest.raises(OperationalError, match="database is locked"):
                    crud.update_message_content(writer, cid, mid, "nuevo")
        finally:
            holder.rollback()
            holder.close()
    finally:
        engine.dispose()


def test_stream_illustration_does_not_write_via_request_session(tmp_path, monkeypatch):
    """
    El stream no debe reutilizar la sesión Depends(get_db): si esa sesión queda
    abierta/bloqueada al cerrar el generador, el fallback también ve 'database is locked'.
    """
    engine, Session = _make_file_db(tmp_path / "stream.db", timeout_s=5.0, wal=True)
    monkeypatch.setattr(api_images, "SessionLocal", Session)

    with Session() as setup:
        conv = crud.create_conversation(setup, title="t", model_id="m", provider="ollama")
        msg = crud.add_message(setup, conv.id, "assistant", "texto original")
        cid, mid = conv.id, msg.id

    request_db = Session()
    seen_dbs: list[object] = []
    real_update = crud.update_message_content

    def tracking_update(db, conversation_id, message_id, content):
        seen_dbs.append(db)
        return real_update(db, conversation_id, message_id, content)

    monkeypatch.setattr(api_images.crud, "update_message_content", tracking_update)

    events = [
        IllustrationEvent(
            type="placeholder",
            message="p",
            content="texto con ⟦img:s1⟧",
            scene_id="s1",
        ),
        IllustrationEvent(type="done", message="ok", content="texto con ⟦img:s1⟧"),
    ]

    list(
        api_images._stream_illustration_events(
            conversation_id=cid,
            message_id=mid,
            text="texto original",
            events=iter(events),
            debug=False,
        )
    )
    request_db.close()

    assert seen_dbs, "debe persistir al menos una vez"
    assert all(db is not request_db for db in seen_dbs), (
        "persistir con la sesión del request provoca locks al limpiar el StreamingResponse"
    )

    with Session() as check:
        saved = crud.get_message(check, cid, mid)
        assert saved is not None
        assert "⟦img:s1⟧" in (saved.content or "")

    engine.dispose()


def test_stream_illustration_persists_on_generator_close(tmp_path, monkeypatch):
    """Al cerrar el generador (cliente corta el NDJSON) el finally debe persistir sin error."""
    engine, Session = _make_file_db(tmp_path / "close.db", timeout_s=5.0, wal=True)
    monkeypatch.setattr(api_images, "SessionLocal", Session)

    with Session() as setup:
        conv = crud.create_conversation(setup, title="t", model_id="m", provider="ollama")
        msg = crud.add_message(setup, conv.id, "assistant", "texto original")
        cid, mid = conv.id, msg.id

    events = [
        IllustrationEvent(
            type="placeholder",
            message="p",
            content="parcial ⟦img:s1⟧",
            scene_id="s1",
        ),
        IllustrationEvent(type="done", message="ok", content="completo"),
    ]
    gen = api_images._stream_illustration_events(
        conversation_id=cid,
        message_id=mid,
        text="texto original",
        events=iter(events),
        debug=False,
    )
    first = next(gen)
    assert "placeholder" in first
    gen.close()  # GeneratorExit → finally

    with Session() as check:
        saved = crud.get_message(check, cid, mid)
        assert saved is not None
        assert "⟦img:s1⟧" in (saved.content or "")

    engine.dispose()


def test_stream_illustration_waits_out_transient_exclusive_lock(tmp_path, monkeypatch):
    """Con busy_timeout, un lock breve de otra conexión no tumba el stream."""
    db_path = tmp_path / "wait.db"
    engine, Session = _make_file_db(db_path, timeout_s=5.0, wal=True)
    monkeypatch.setattr(api_images, "SessionLocal", Session)

    with Session() as setup:
        conv = crud.create_conversation(setup, title="t", model_id="m", provider="ollama")
        msg = crud.add_message(setup, conv.id, "assistant", "texto original")
        cid, mid = conv.id, msg.id

    holder = sqlite3.connect(str(db_path), timeout=0.05, check_same_thread=False)
    holder.execute("BEGIN EXCLUSIVE")

    def release_soon():
        time.sleep(0.2)
        holder.rollback()
        holder.close()

    threading.Thread(target=release_soon, daemon=True).start()

    lines = list(
        api_images._stream_illustration_events(
            conversation_id=cid,
            message_id=mid,
            text="texto original",
            events=iter(
                [
                    IllustrationEvent(
                        type="placeholder",
                        message="p",
                        content="texto con ⟦img:s1⟧",
                        scene_id="s1",
                    ),
                    IllustrationEvent(type="done", message="ok", content="texto con ⟦img:s1⟧"),
                ]
            ),
            debug=False,
        )
    )
    assert lines
    with Session() as check:
        assert "⟦img:s1⟧" in (crud.get_message(check, cid, mid).content or "")
    engine.dispose()


def test_app_db_sqlite_engine_enables_busy_timeout_and_wal():
    """La config de producción debe tolerar writers concurrentes (stream + UI)."""
    from app import db as app_db

    url = str(app_db.engine.url)
    if not url.startswith("sqlite"):
        pytest.skip("solo aplica a SQLite")

    with app_db.engine.connect() as conn:
        mode = conn.execute(text("PRAGMA journal_mode")).scalar()
        busy = conn.execute(text("PRAGMA busy_timeout")).scalar()
    assert str(mode).lower() == "wal"
    assert int(busy) >= 5000
