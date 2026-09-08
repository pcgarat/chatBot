"""Detección y borrado de ilustraciones en disco no incrustadas en ningún mensaje."""

from __future__ import annotations

import time
from collections.abc import Iterable
from pathlib import Path

from sqlalchemy.orm import Session

from app import crud
from app.services.image_illustration.content_ops import extract_illustrated_filenames
from app.services.image_illustration.storage import delete_illustrated_image, illustrated_dir

ORPHAN_GRACE_SECONDS = 30.0


def referenced_illustrated_filenames(contents: Iterable[str]) -> set[str]:
    """Filenames citados por <img class="chat-illustration"> en cualquier content."""
    names: set[str] = set()
    for content in contents:
        names.update(extract_illustrated_filenames(content or ""))
    return names


def find_orphan_filenames(
    disk_filenames: Iterable[str],
    referenced: set[str],
    *,
    mtimes: dict[str, float] | None = None,
    now: float | None = None,
    grace_seconds: float | None = None,
) -> list[str]:
    """Ficheros de disco que no están incrustados, salvo los recién escritos."""
    grace = ORPHAN_GRACE_SECONDS if grace_seconds is None else grace_seconds
    current = time.time() if now is None else now
    orphans: list[str] = []
    for name in disk_filenames:
        if not name or name.startswith("."):
            continue
        if name in referenced:
            continue
        if mtimes and grace > 0:
            mtime = mtimes.get(name)
            if mtime is not None and (current - mtime) < grace:
                continue
        orphans.append(name)
    return orphans


def _scan_illustrated_dir(directory: Path) -> tuple[list[str], dict[str, float]]:
    names: list[str] = []
    mtimes: dict[str, float] = {}
    if not directory.is_dir():
        return names, mtimes
    for path in directory.iterdir():
        if not path.is_file() or path.name.startswith("."):
            continue
        names.append(path.name)
        try:
            mtimes[path.name] = path.stat().st_mtime
        except OSError:
            continue
    return names, mtimes


def collect_orphan_filenames(
    db: Session,
    *,
    directory: Path | None = None,
    grace_seconds: float | None = None,
    now: float | None = None,
) -> list[str]:
    """Huérfanos actuales respecto a todos los mensajes (incluida papelera)."""
    disk_names, mtimes = _scan_illustrated_dir(directory or illustrated_dir())
    referenced = referenced_illustrated_filenames(crud.list_all_message_contents(db))
    return find_orphan_filenames(
        disk_names,
        referenced,
        mtimes=mtimes,
        now=now,
        grace_seconds=grace_seconds,
    )


def purge_orphan_files(
    db: Session,
    *,
    directory: Path | None = None,
    grace_seconds: float | None = None,
) -> tuple[int, int]:
    """Borra huérfanos del disco y sus metadatos. Devuelve (ficheros, filas meta)."""
    names = collect_orphan_filenames(
        db,
        directory=directory,
        grace_seconds=grace_seconds,
    )
    deleted_files = 0
    for name in names:
        if delete_illustrated_image(name):
            deleted_files += 1
    deleted_meta = crud.delete_illustrated_images_by_filenames(db, names)
    return deleted_files, deleted_meta
