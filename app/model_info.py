"""
Ficha de información por modelo (provider + usuario).

Persistencia en data/model_info.json. Clave: "{provider}:{model_name}".
Cada ficha tiene provider_info (datos del proveedor, ej. Ollama show) y user_info
(uncensored, instructions, tags). Los tags se derivan al vuelo de todas las fichas.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

# Ruta al archivo de datos (proyecto/data/model_info.json)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_MODEL_INFO_DIR = _PROJECT_ROOT / "data"
_MODEL_INFO_PATH = _MODEL_INFO_DIR / "model_info.json"
_MODEL_INFO_TMP = _MODEL_INFO_DIR / "model_info.json.tmp"

# Límites (checklist 1.1)
MAX_INSTRUCTIONS = 50
MAX_TAGS = 100
MAX_TAG_LENGTH = 50


def _storage_key(provider: str, model_name: str) -> str:
    """Clave única de almacenamiento: provider:model_name (model_name puede contener :)."""
    return f"{provider}:{model_name}"


def _ensure_data_dir() -> None:
    """Crea el directorio data/ si no existe."""
    _MODEL_INFO_DIR.mkdir(parents=True, exist_ok=True)


def _load_all() -> dict[str, dict[str, Any]]:
    """
    Carga todo el archivo JSON de fichas.
    Devuelve un dict clave -> { "provider_info": {...}, "user_info": {...} }.
    """
    _ensure_data_dir()
    if not _MODEL_INFO_PATH.exists():
        return {}
    try:
        with open(_MODEL_INFO_PATH, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def _save_all(data: dict[str, dict[str, Any]]) -> None:
    """
    Guarda el dict de fichas en JSON con escritura atómica (tmp + replace).
    """
    _ensure_data_dir()
    with open(_MODEL_INFO_TMP, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(_MODEL_INFO_TMP, _MODEL_INFO_PATH)


def _default_user_info() -> dict[str, Any]:
    """user_info por defecto."""
    return {
        "uncensored": False,
        "instructions": [],
        "tags": [],
    }


def _default_provider_info() -> dict[str, Any]:
    """provider_info por defecto (vacío)."""
    return {}


def _normalize_tag(tag: str) -> str:
    """Trim y límite de longitud. Por ahora se mantiene capitalización (no lowercase)."""
    t = (tag or "").strip()
    return t[:MAX_TAG_LENGTH] if len(t) > MAX_TAG_LENGTH else t


def get_model_info(provider: str, model_name: str) -> dict[str, Any]:
    """
    Obtiene la ficha de un modelo. Si no existe, devuelve ficha con user_info
    por defecto y provider_info vacío (no llama al proveedor).

    Returns:
        {"provider_info": dict, "user_info": dict}
    """
    key = _storage_key(provider, model_name)
    data = _load_all()
    if key in data:
        entry = data[key]
        return {
            "provider_info": entry.get("provider_info") or _default_provider_info(),
            "user_info": entry.get("user_info") or _default_user_info(),
        }
    return {
        "provider_info": _default_provider_info(),
        "user_info": _default_user_info(),
    }


def set_model_info(
    provider: str,
    model_name: str,
    provider_info: dict[str, Any] | None = None,
    user_info: dict[str, Any] | None = None,
) -> None:
    """
    Crea o reemplaza la ficha del modelo. Si se pasan provider_info/user_info
    parciales, se fusionan con los existentes (los que no se pasan se mantienen).
    """
    key = _storage_key(provider, model_name)
    data = _load_all()
    current = data.get(key, {})
    new_provider = {**_default_provider_info(), **current.get("provider_info", {}), **(provider_info or {})}
    new_user = {**_default_user_info(), **current.get("user_info", {}), **(user_info or {})}
    data[key] = {"provider_info": new_provider, "user_info": new_user}
    _save_all(data)


def update_user_info(
    provider: str,
    model_name: str,
    uncensored: bool | None = None,
    instructions: list[str] | None = None,
    tags: list[str] | None = None,
) -> None:
    """
    Actualiza solo user_info. Aplica límites y normalización de tags
    (trim, duplicados eliminados, longitud máxima por tag).
    """
    key = _storage_key(provider, model_name)
    data = _load_all()
    entry = data.get(key, {"provider_info": _default_provider_info(), "user_info": _default_user_info()})
    user = dict(entry.get("user_info") or _default_user_info())

    if uncensored is not None:
        user["uncensored"] = bool(uncensored)
    if instructions is not None:
        user["instructions"] = list(instructions)[:MAX_INSTRUCTIONS]
    if tags is not None:
        normalized = []
        seen = set()
        for t in tags:
            nt = _normalize_tag(t)
            if nt and nt not in seen:
                seen.add(nt)
                normalized.append(nt)
        user["tags"] = normalized[:MAX_TAGS]

    entry["user_info"] = user
    data[key] = entry
    _save_all(data)


def get_all_tags() -> list[str]:
    """
    Devuelve la lista de todos los tags únicos de todas las fichas (derivado al vuelo).
    """
    data = _load_all()
    tags: set[str] = set()
    for entry in data.values():
        for t in (entry.get("user_info") or {}).get("tags") or []:
            if t and isinstance(t, str):
                tags.add(t.strip())
    return sorted(tags)
