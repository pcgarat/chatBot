"""Purga de ilustraciones en disco no incrustadas en mensajes."""

import os

from app import crud
from app.services.image_illustration import storage
from app.services.image_illustration.orphan_files import (
    collect_orphan_filenames,
    find_orphan_filenames,
    purge_orphan_files,
    referenced_illustrated_filenames,
)


PNG = b"\x89PNG\r\n\x1a\n"


def test_find_orphan_filenames_skips_referenced_and_dotfiles():
    orphans = find_orphan_filenames(
        ["keep.png", "gone.png", ".hidden"],
        {"keep.png"},
        grace_seconds=0,
    )
    assert orphans == ["gone.png"]


def test_find_orphan_filenames_respects_grace():
    orphans = find_orphan_filenames(
        ["fresh.png"],
        set(),
        mtimes={"fresh.png": 100.0},
        now=110.0,
        grace_seconds=30,
    )
    assert orphans == []
    stale = find_orphan_filenames(
        ["old.png"],
        set(),
        mtimes={"old.png": 100.0},
        now=200.0,
        grace_seconds=30,
    )
    assert stale == ["old.png"]


def test_referenced_filenames_from_message_html():
    names = referenced_illustrated_filenames(
        [
            'A <img src="/api/illustrated-images/a.png" class="chat-illustration" />',
            "sin fotos",
        ]
    )
    assert names == {"a.png"}


def _embedded(name: str) -> str:
    return f'<img src="/api/illustrated-images/{name}" class="chat-illustration" />'


def test_purge_orphans_keeps_embedded_and_trashed_messages(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DEFAULT_DIR", tmp_path / "illustrated")
    keep = storage.save_illustrated_image("keep", PNG)
    trash_keep = storage.save_illustrated_image("trash", PNG)
    orphan = storage.save_illustrated_image("orphan", PNG)

    conv = crud.create_conversation(db_session, title="activa", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", _embedded(keep))
    trashed = crud.create_conversation(db_session, title="papelera", model_id="m", provider="ollama")
    crud.add_message(db_session, trashed.id, "assistant", _embedded(trash_keep))
    crud.delete_conversation(db_session, trashed.id)

    crud.save_illustrated_image_meta(
        db_session,
        message_id=msg.id,
        filename=orphan,
        scene_id="orphan",
        mode="txt2img",
        params={"prompt": "x"},
    )

    preview = collect_orphan_filenames(db_session, grace_seconds=0)
    assert set(preview) == {orphan}

    deleted_files, deleted_meta = purge_orphan_files(db_session, grace_seconds=0)
    assert deleted_files == 1
    assert deleted_meta == 1
    assert storage.resolve_illustrated_path(keep) is not None
    assert storage.resolve_illustrated_path(trash_keep) is not None
    assert storage.resolve_illustrated_path(orphan) is None
    assert crud.get_illustrated_image_meta(db_session, orphan) is None


def test_purge_orphans_skips_recent_unreferenced_files(db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DEFAULT_DIR", tmp_path / "illustrated")
    fresh = storage.save_illustrated_image("fresh", PNG)
    preview = collect_orphan_filenames(db_session, grace_seconds=30)
    assert fresh not in preview
    assert collect_orphan_filenames(db_session, grace_seconds=0) == [fresh]


def test_hard_delete_from_trash_removes_embedded_photo_files(db_session, tmp_path, monkeypatch):
    """Vaciar/borrar definitivo de papelera elimina fotos incrustadas en disco."""
    monkeypatch.setattr(storage, "DEFAULT_DIR", tmp_path / "illustrated")
    name = storage.save_illustrated_image("gone", PNG)
    conv = crud.create_conversation(db_session, title="papelera", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", _embedded(name))
    crud.save_illustrated_image_meta(
        db_session,
        message_id=msg.id,
        filename=name,
        scene_id="gone",
        mode="txt2img",
        params={"prompt": "x"},
    )
    crud.delete_conversation(db_session, conv.id)

    assert crud.hard_delete_conversation(db_session, conv.id) is True
    assert storage.resolve_illustrated_path(name) is None
    assert crud.get_illustrated_image_meta(db_session, name) is None


def test_orphans_api_purge(client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DEFAULT_DIR", tmp_path / "illustrated")
    keep = storage.save_illustrated_image("keep", PNG)
    orphan = storage.save_illustrated_image("orphan", PNG)
    orphan_path = tmp_path / "illustrated" / orphan
    stale = orphan_path.stat().st_mtime - 120
    os.utime(orphan_path, (stale, stale))
    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    crud.add_message(db_session, conv.id, "assistant", _embedded(keep))

    listed = client.get("/api/illustrated-images/orphans")
    assert listed.status_code == 200
    assert listed.json()["count"] == 1

    purged = client.post("/api/illustrated-images/orphans/purge")
    assert purged.status_code == 200
    body = purged.json()
    assert body["deleted_files"] == 1
    assert storage.resolve_illustrated_path(keep) is not None
    assert storage.resolve_illustrated_path(orphan) is None
