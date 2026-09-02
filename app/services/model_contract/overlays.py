"""Carga overlays sparse por proveedor (config/model_overlays/{provider}.json)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_OVERLAYS_DIR = Path(__file__).resolve().parents[3] / "config" / "model_overlays"
_cache: dict[str, dict[str, Any]] = {}


def load_overlays(provider_name: str) -> dict[str, Any]:
    """
    Overlay por modelo: deltas de params, capabilities, recipes, quirks.

    Si no hay archivo, JSON inválido o no es un objeto, devuelve {}.
    """
    if provider_name in _cache:
        return _cache[provider_name]
    path = _OVERLAYS_DIR / f"{provider_name}.json"
    if not path.exists():
        _cache[provider_name] = {}
        return _cache[provider_name]
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        _cache[provider_name] = {}
        return _cache[provider_name]
    if not isinstance(data, dict):
        _cache[provider_name] = {}
        return _cache[provider_name]
    _cache[provider_name] = data
    return data
