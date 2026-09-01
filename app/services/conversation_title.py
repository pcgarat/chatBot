"""Título automático: primera frase del último mensaje, solo letras/números/espacios."""

from __future__ import annotations

import re

TITLE_MAX_LEN = 512
TITLE_SOFT_MAX_LEN = 80

_HTML_OR_MARKER_RE = re.compile(
    r"<[^>]+>|⟦img:[^⟧]+⟧",
    re.IGNORECASE,
)
_FIRST_UNIT_RE = re.compile(r"[\n\r]+|[.!?…]+(?:\s|$)")
_NON_ALNUM_RE = re.compile(r"[^\w\s]", re.UNICODE)
_SPACES_RE = re.compile(r"\s+")


def _clip_words(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    clipped = text[:limit].rsplit(" ", 1)[0].strip()
    return clipped or text[:limit]


def derive_auto_title(content: str | None) -> str:
    """Primera frase o línea del mensaje, sin markup ni signos; vacío si no queda texto útil."""
    raw = _HTML_OR_MARKER_RE.sub(" ", content or "")
    match = _FIRST_UNIT_RE.search(raw)
    sentence = raw[: match.start()] if match else raw
    cleaned = _NON_ALNUM_RE.sub("", sentence)
    cleaned = cleaned.replace("_", "")
    cleaned = _SPACES_RE.sub(" ", cleaned).strip()
    if not cleaned:
        return ""
    return _clip_words(cleaned, TITLE_SOFT_MAX_LEN)[:TITLE_MAX_LEN]
