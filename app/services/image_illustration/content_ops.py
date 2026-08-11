"""Operaciones sobre el content de un mensaje ilustrado (fotos y anclas)."""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
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

_PENDING_SLOT_RE = re.compile(
    r'<span\b(?=[^>]*\bclass="[^"]*chat-illustration-(?:placeholder|error)[^"]*")[^>]*>'
    r"[\s\S]*?</span>"
    r"|⟦img:([^⟧]+)⟧",
    re.IGNORECASE,
)

_DATA_SCENE_RE = re.compile(r"""\bdata-scene\s*=\s*(['"])(.*?)\1""", re.IGNORECASE)
_DATA_PROMPT_RE = re.compile(r"""\bdata-prompt\s*=\s*(['"])(.*?)\1""", re.IGNORECASE)
_PLACEHOLDER_BODY_PROMPT_RE = re.compile(
    r"Generando imagen…\s*\n\s*\n([\s\S]*)\Z",
    re.IGNORECASE,
)

_SRC_ATTR_RE = re.compile(r"""\bsrc\s*=\s*(['"])(.*?)\1""", re.IGNORECASE)


@dataclass(frozen=True)
class PendingIllustrationScene:
    """Ancla sin imagen: scene_id y prompt Forge si se pudo recuperar."""

    id: str
    prompt: str = ""


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


def extract_pending_illustration_scenes(content: str) -> list[PendingIllustrationScene]:
    """
    Escenas pendientes en orden de aparición: placeholders, errores y ⟦img:id⟧.
    El prompt se toma de data-prompt o, en placeholders, del cuerpo visible.
    """
    pending: list[PendingIllustrationScene] = []
    seen: set[str] = set()
    for match in _PENDING_SLOT_RE.finditer(content or ""):
        raw = match.group(0)
        marker_id = match.group(1)
        if marker_id is not None:
            scene_id = marker_id.strip()
            prompt = ""
        else:
            scene_m = _DATA_SCENE_RE.search(raw)
            if not scene_m:
                continue
            scene_id = html.unescape(scene_m.group(2)).strip()
            prompt = _prompt_from_pending_span(raw)
        if not scene_id or scene_id in seen:
            continue
        seen.add(scene_id)
        pending.append(PendingIllustrationScene(id=scene_id, prompt=prompt))
    return pending


def _prompt_from_pending_span(span_html: str) -> str:
    attr = _DATA_PROMPT_RE.search(span_html)
    if attr:
        return html.unescape(attr.group(2)).strip()
    close = span_html.find(">")
    if close < 0:
        return ""
    inner_end = span_html.rfind("</")
    if inner_end <= close:
        return ""
    inner = span_html[close + 1 : inner_end]
    body = _PLACEHOLDER_BODY_PROMPT_RE.search(html.unescape(inner))
    if not body:
        return ""
    prompt = body.group(1).strip()
    if prompt == "(sin prompt)":
        return ""
    return prompt


def _normalize_blank_lines(text: str) -> str:
    cleaned = re.sub(r"\n{3,}", "\n\n", text or "")
    return cleaned.strip()
