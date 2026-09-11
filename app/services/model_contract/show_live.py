"""Extracción de capacidades live desde la respuesta Ollama show (API /api/show)."""

from __future__ import annotations

from typing import Any


def live_caps_from_show(show: dict[str, Any]) -> dict[str, Any]:
    """
    Capas fiables desde show: vision, tools, thinking_flag, context_length.

    Misma semántica que usaba resolve._live_from_show.
    """
    raw_caps = show.get("capabilities") or []
    if isinstance(raw_caps, str):
        raw_caps = [raw_caps]
    if not isinstance(raw_caps, list):
        raw_caps = []
    names = {str(c).lower() for c in raw_caps}
    return {
        "vision": "vision" in names,
        "tools": "tools" in names or "tool_use" in names,
        "thinking_flag": "thinking" in names,
        "context_length": context_length_from_show(show),
    }


def context_length_from_show(show: dict[str, Any]) -> int | None:
    """Context length desde model_info / details / raíz del show."""
    model_info = show.get("model_info") if isinstance(show.get("model_info"), dict) else {}
    details = show.get("details") if isinstance(show.get("details"), dict) else {}
    ctx = (
        model_info.get("llama.context_length")
        or model_info.get("context_length")
        or _prefixed_context_length(model_info)
        or details.get("context_length")
        or show.get("context_length")
    )
    try:
        return int(ctx) if ctx is not None else None
    except (TypeError, ValueError):
        return None


def _prefixed_context_length(model_info: dict[str, Any]) -> Any:
    """Ollama usa claves tipo llama.context_length / nemotron_h_moe.context_length."""
    for key, value in model_info.items():
        if isinstance(key, str) and key.endswith(".context_length"):
            return value
    return None
