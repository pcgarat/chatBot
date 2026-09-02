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


# Caché de presets por proveedor: provider -> dict (model_name -> params)
_presets_cache: dict[str, dict[str, Any]] = {}


def get_presets(provider_name: str) -> dict[str, Any]:
    """
    Devuelve los presets de modelos para un proveedor.

    Lee config/{provider_name}.json (ej. config/ollama.json). Cada clave es un
    nombre de modelo y el valor es un dict de param_id -> { api_key, type, default, ... }.
    Si el archivo no existe o está vacío, devuelve {}.

    Returns:
        Dict model_name -> { param_id -> { "api_key", "type", "default", ... } }
    """
    global _presets_cache
    if provider_name in _presets_cache:
        return _presets_cache[provider_name]
    config_dir = Path(__file__).resolve().parent.parent / "config"
    preset_path = config_dir / f"{provider_name}.json"
    if not preset_path.exists():
        _presets_cache[provider_name] = {}
        return _presets_cache[provider_name]
    import json
    try:
        with open(preset_path, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        _presets_cache[provider_name] = {}
        return _presets_cache[provider_name]
    if not isinstance(data, dict):
        _presets_cache[provider_name] = {}
        return _presets_cache[provider_name]
    _presets_cache[provider_name] = data
    return data


def get_context_length_max(provider_name: str, model_name: str) -> int | None:
    """
    Devuelve el contexto máximo (tokens) para un modelo según su preset.

    Lee config/{provider_name}.json y busca el preset del modelo; si tiene
    el parámetro num_ctx (o equivalente) con "max", devuelve ese valor.
    Si no existe preset o no hay max definido, devuelve None.

    Usado para la barra de uso de contexto cuando no hay provider_info (show_model).
    """
    presets = get_presets(provider_name)
    if not isinstance(presets, dict):
        return None
    model_preset = presets.get(model_name)
    if not isinstance(model_preset, dict):
        return None
    # Ollama y otros usan num_ctx; otros proveedores podrían usar otro key
    for param_key in ("num_ctx", "context_length", "max_context"):
        spec = model_preset.get(param_key)
        if isinstance(spec, dict) and "max" in spec:
            try:
                return int(spec["max"])
            except (TypeError, ValueError):
                pass
    return None


def build_extra_body(
    provider_name: str,
    model_params: dict[str, Any] | None,
    model_id: str | None = None,
) -> dict[str, Any]:
    """
    Construye el fragmento de payload a fusionar con la petición al proveedor.

    Si hay model_id, usa las specs del contrato (overlay + think). Si no, el
    schema del proveedor. think se coacciona según el contrato (no 422).
    """
    if not model_params:
        return {}
    thinking = None
    if model_id:
        from app.services.model_contract import normalize_think_value, resolve_model_contract

        contract = resolve_model_contract(provider_name, model_id)
        specs = contract.params
        thinking = contract.capabilities.thinking
    else:
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
        if key == "think" and thinking is not None:
            value = normalize_think_value(thinking, value)
            if value is None:
                continue
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
        if param_type == "string_list" and (value is None or (isinstance(value, list) and len(value) == 0)):
            continue
        set_nested(extra, api_key, value)
    if extra.get("options") == {}:
        extra.pop("options", None)
    return extra
