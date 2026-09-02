"""Políticas de historial derivadas de quirks del contrato (no if por modelo)."""

from __future__ import annotations

import re
from typing import Any, Sequence

OMIT_PRIOR_THINKING = "omit_prior_thinking"

_THINKING_KEYS = ("thinking", "thought")

_THOUGHT_BLOCKS = (
    re.compile(r"<think\b[^>]*>.*?</think>", re.DOTALL | re.IGNORECASE),
    re.compile(r"<thought\b[^>]*>.*?</thought>", re.DOTALL | re.IGNORECASE),
    re.compile(r"<thinking\b[^>]*>.*?</thinking>", re.DOTALL | re.IGNORECASE),
)

_EXTRA_BLANK_LINES = re.compile(r"\n{3,}")


def apply_history_quirks(
    messages: Sequence[dict[str, Any]],
    quirks: Sequence[str],
) -> list[dict[str, Any]]:
    """Copia de messages con quirks de historial aplicados.

    ``omit_prior_thinking``: no reenviar thought de turnos assistant previos
    (claves API ``thinking``/``thought`` y bloques ``<think>``/``<thought>`` en content).
    """
    if OMIT_PRIOR_THINKING not in {str(q) for q in quirks}:
        return [dict(m) for m in messages]

    return [
        _omit_prior_thinking(dict(raw)) if raw.get("role") == "assistant" else dict(raw)
        for raw in messages
    ]


def _omit_prior_thinking(msg: dict[str, Any]) -> dict[str, Any]:
    for key in _THINKING_KEYS:
        msg.pop(key, None)
    content = msg.get("content")
    if isinstance(content, str):
        msg["content"] = _strip_thought_blocks(content)
    return msg


def _strip_thought_blocks(content: str) -> str:
    text = content
    for pattern in _THOUGHT_BLOCKS:
        text = pattern.sub("", text)
    return _EXTRA_BLANK_LINES.sub("\n\n", text).strip()
