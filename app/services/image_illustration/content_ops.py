"""Operaciones sobre el content de un mensaje ilustrado (fotos y anclas)."""

from __future__ import annotations

import re
from urllib.parse import unquote, urlparse

_IMG_TAG_RE = re.compile(
    r'<img\b[^>]*class="[^"]*chat-illustration[^"]*"[^>]*/?>',
    re.IGNORECASE,
)

_ORPHAN_ANCHOR_RE = re.compile(
    r'<span\b[^>]*class="[^"]*chat-illustration-(?:error|placeholder)[^"]*"[^>]*>[\s\S]*?</span>'
    r"|⟦img:[^⟧]+⟧",
    re.IGNORECASE,
)

_SRC_ATTR_RE = re.compile(r"""\bsrc\s*=\s*(['"])(.*?)\1""", re.IGNORECASE)


def extract_illustrated_filenames(content: str) -> list[str]:
    """Nombres de fichero referenciados por imgs chat-illustration en el content."""
    names: list[str] = []
    seen: set[str] = set()
    for tag in _IMG_TAG_RE.finditer(content or ""):
        src_m = _SRC_ATTR_RE.search(tag.group(0))
        if not src_m:
            continue
        name = _filename_from_illustrated_src(src_m.group(2))
        if name and name not in seen:
            seen.add(name)
            names.append(name)
    return names


def _filename_from_illustrated_src(src: str) -> str | None:
    raw = unquote((src or "").strip())
    if not raw:
        return None
    path = urlparse(raw).path if "://" in raw else raw
    marker = "/illustrated-images/"
    idx = path.find(marker)
    if idx >= 0:
        name = path[idx + len(marker) :].lstrip("/")
    else:
        name = path.rsplit("/", 1)[-1]
    name = name.split("?", 1)[0].strip()
    if not name or "/" in name or "\\" in name or ".." in name:
        return None
    return name


def remove_all_photos(content: str) -> tuple[str, list[str]]:
    """
    Elimina todas las <img class="chat-illustration"> del content.
    Devuelve (nuevo_content, filenames referenciados).
    """
    filenames = extract_illustrated_filenames(content)
    cleaned = _IMG_TAG_RE.sub("", content or "")
    return _normalize_blank_lines(cleaned), filenames


def remove_orphan_anchors(content: str) -> str:
    """
    Elimina anclas sin imagen generada: marcadores ⟦img:id⟧,
    placeholders y errores. Conserva las fotos ya insertadas.
    """
    cleaned = _ORPHAN_ANCHOR_RE.sub("", content or "")
    return _normalize_blank_lines(cleaned)


def _normalize_blank_lines(text: str) -> str:
    cleaned = re.sub(r"\n{3,}", "\n\n", text or "")
    return cleaned.strip()
