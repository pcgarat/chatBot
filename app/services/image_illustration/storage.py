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


def sniff_image_format(data: bytes) -> tuple[str, str]:
    """
    Detecta media type y extensión a partir de magic bytes.
    Forge suele devolver JPEG aunque el cliente pida PNG.
    """
    head = data[:32] if data else b""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", ".jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", ".png"
    if len(head) >= 12 and head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "image/webp", ".webp"
    if head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
        return "image/gif", ".gif"
    return "application/octet-stream", ".bin"


def media_type_for_illustrated_file(path: Path) -> str:
    """Content-Type real del fichero (no solo por extensión)."""
    try:
        head = path.read_bytes()[:32]
    except OSError:
        return "application/octet-stream"
    media, _ = sniff_image_format(head)
    if media == "application/octet-stream":
        suf = path.suffix.lower()
        if suf in {".jpg", ".jpeg"}:
            return "image/jpeg"
        if suf == ".webp":
            return "image/webp"
        if suf == ".gif":
            return "image/gif"
        if suf == ".png":
            return "image/png"
    return media


def save_illustrated_image(scene_id: str, data: bytes, *, suffix: str | None = None) -> str:
    """Guarda bytes y devuelve el nombre de fichero (no path absoluto)."""
    safe_scene = "".join(c for c in scene_id if c.isalnum() or c in "-_")[:64] or "scene"
    if suffix is None:
        _, suffix = sniff_image_format(data or b"")
        if suffix == ".bin":
            suffix = ".png"
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


def delete_illustrated_image(filename: str) -> bool:
    """Borra el fichero del disco si existe y es seguro. True si se eliminó."""
    path = resolve_illustrated_path(filename)
    if path is None:
        return False
    try:
        path.unlink()
        return True
    except OSError:
        return False
