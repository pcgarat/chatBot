"""Almacenamiento local de imágenes ilustradas."""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from app.config import _PROJECT_ROOT

DEFAULT_DIR = _PROJECT_ROOT / "data" / "illustrated"


def illustrated_dir() -> Path:
    path = DEFAULT_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_illustrated_image(scene_id: str, data: bytes, *, suffix: str = ".png") -> str:
    """Guarda bytes y devuelve el nombre de fichero (no path absoluto)."""
    safe_scene = "".join(c for c in scene_id if c.isalnum() or c in "-_")[:64] or "scene"
    name = f"{uuid4().hex}_{safe_scene}{suffix}"
    path = illustrated_dir() / name
    path.write_bytes(data)
    return name


def resolve_illustrated_path(filename: str) -> Path | None:
    """Resuelve un nombre de fichero seguro dentro del dir de ilustraciones."""
    if not filename or "/" in filename or "\\" in filename or ".." in filename:
        return None
    path = illustrated_dir() / filename
    if not path.is_file():
        return None
    return path
