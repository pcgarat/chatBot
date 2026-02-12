"""
Carga y expone la configuración de parámetros de generación por proveedor.

El archivo de configuración (JSON) define qué parámetros soporta cada proveedor
y cómo se mapean a la API (api_key). Solo se envían parámetros que el usuario
ha modificado; si no se envía ninguno, el proveedor usa sus defaults.

Fuente: config/provider_params.json (raíz del proyecto).
"""

from pathlib import Path
from typing import Any

# Ruta al archivo de config (raíz del proyecto / config / provider_params.json)
_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "provider_params.json"

# Caché en memoria del config cargado
_config_cache: dict[str, dict[str, Any]] | None = None


def _load_config() -> dict[str, dict[str, Any]]:
    """Lee el JSON de parámetros por proveedor. Usa caché en memoria."""
    global _config_cache
    if _config_cache is not None:
        return _config_cache
    if not _CONFIG_PATH.exists():
        _config_cache = {}
        return _config_cache
    import json
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    _config_cache = data if isinstance(data, dict) else {}
    return _config_cache


def get_params_config(provider_name: str) -> dict[str, dict[str, Any]]:
    """
    Devuelve la configuración de parámetros para un proveedor.

    Cada entrada del dict tiene: api_key, type, default, y opcionalmente min, max.
    Si el proveedor no está en el config, devuelve {}.

    Returns:
        Dict param_id -> { "api_key", "type", "default", "min"?, "max"? }
    """
    config = _load_config()
    return config.get(provider_name, {})


def list_providers_with_params() -> list[str]:
    """Lista los nombres de proveedores que tienen parámetros definidos en el config."""
    config = _load_config()
    return list(config.keys())


def set_nested(d: dict, path: str, value: Any) -> None:
    """
    Escribe un valor en un dict siguiendo una ruta de claves (ej. "options.temperature").

    Modifica d in-place. Crea dicts intermedios si no existen.
    """
    keys = path.split(".")
    for key in keys[:-1]:
        d = d.setdefault(key, {})
    d[keys[-1]] = value


def build_extra_body(provider_name: str, model_params: dict[str, Any] | None) -> dict[str, Any]:
    """
    Construye el fragmento de payload a fusionar con la petición al proveedor.

    Usa get_params_config(provider_name) para mapear cada clave de model_params
    al api_key del proveedor (ej. options.temperature). Si model_params es None
    o vacío, devuelve {}.

    Args:
        provider_name: Nombre del proveedor (ollama, mancer, ...).
        model_params: Parámetros que el usuario ha modificado (solo esos se envían).

    Returns:
        Dict listo para merge en el body (ej. {"options": {"temperature": 0.8}}).
    """
    if not model_params:
        return {}
    specs = get_params_config(provider_name)
    if not specs:
        return {}
    extra: dict[str, Any] = {}
    for key, value in model_params.items():
        if key not in specs:
            continue
        spec = specs[key]
        api_key = spec.get("api_key")
        if not api_key:
            continue
        # Normalizar valor según tipo (string_list debe ser lista de strings)
        param_type = spec.get("type", "string")
        if param_type == "string_list" and isinstance(value, str):
            value = [s.strip() for s in value.split("\n") if s.strip()] if value else []
        elif param_type == "int" and value is not None:
            try:
                value = int(value)
            except (TypeError, ValueError):
                continue
        elif param_type == "float" and value is not None:
            try:
                value = float(value)
            except (TypeError, ValueError):
                continue
        set_nested(extra, api_key, value)
    return extra
