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


def overlays_path(provider_name: str) -> Path:
    """Ruta del JSON de overlays del proveedor."""
    return _OVERLAYS_DIR / f"{provider_name}.json"


def save_overlays(provider_name: str, data: dict[str, Any], *, path: Path | None = None) -> Path:
    """
    Persiste overlays y invalida la caché del proveedor.

    Si el archivo ya existe, conserva el texto de las entradas cuyo valor no cambió
    (evita reformatear todo el JSON al añadir un modelo).

    Returns:
        Path escrito.
    """
    target = path if path is not None else overlays_path(provider_name)
    target.parent.mkdir(parents=True, exist_ok=True)
    text = _dumps_overlays_preserving(target, data)
    target.write_text(text, encoding="utf-8")
    _cache.pop(provider_name, None)
    return target


def _dumps_overlays_preserving(target: Path, data: dict[str, Any]) -> str:
    if target.exists():
        try:
            old_text = target.read_text(encoding="utf-8")
            old_data = json.loads(old_text)
        except (json.JSONDecodeError, OSError):
            old_text = None
            old_data = None
        if isinstance(old_data, dict) and old_data:
            spans = _top_level_key_spans(old_text or "")
            style = _detect_style(old_text or "")
            ordered = [k for k in old_data if k in data]
            ordered.extend(k for k in data if k not in old_data)
            parts: list[str] = []
            for key in ordered:
                if (
                    key in old_data
                    and key in spans
                    and old_data[key] == data[key]
                ):
                    start, end = spans[key]
                    parts.append((old_text or "")[start:end])
                else:
                    parts.append(_format_top_level_entry(key, data[key], style=style))
            return "{\n" + ",\n".join(f"  {p}" for p in parts) + "\n}\n"

    style = "compact"
    parts = [_format_top_level_entry(k, v, style=style) for k, v in data.items()]
    if not parts:
        return "{}\n"
    return "{\n" + ",\n".join(f"  {p}" for p in parts) + "\n}\n"


def _detect_style(text: str) -> str:
    """Heurística: arrays de primitivas en una línea → compact; si no, expanded."""
    if '": [' in text and '": [\n' not in text.replace('": []', ""):
        # Hay algún array no vacío en la misma línea que la clave
        for line in text.splitlines():
            stripped = line.strip()
            if '": [' in stripped and not stripped.endswith("[],") and not stripped.endswith("[]"):
                if "]" in stripped:
                    return "compact"
    if '": { "' in text or '": {"' in text:
        return "compact"
    return "expanded"


def _top_level_key_spans(text: str) -> dict[str, tuple[int, int]]:
    """Mapa clave → span [start, end) de `\"key\": value` en el objeto raíz."""
    decoder = json.JSONDecoder()
    i = text.find("{")
    if i < 0:
        return {}
    i += 1
    spans: dict[str, tuple[int, int]] = {}
    n = len(text)
    while True:
        while i < n and text[i] in " \t\r\n,":
            i += 1
        if i >= n or text[i] == "}":
            break
        if text[i] != '"':
            raise ValueError(f"JSON de overlays inesperado en offset {i}")
        key, key_end = decoder.raw_decode(text, i)
        j = key_end
        while j < n and text[j] in " \t\r\n":
            j += 1
        if j >= n or text[j] != ":":
            raise ValueError(f"Se esperaba ':' tras clave {key!r}")
        j += 1
        while j < n and text[j] in " \t\r\n":
            j += 1
        _, value_end = decoder.raw_decode(text, j)
        spans[str(key)] = (i, value_end)
        i = value_end
    return spans


def _format_top_level_entry(key: str, value: Any, *, style: str) -> str:
    key_json = json.dumps(key, ensure_ascii=False)
    if style == "compact":
        val_json = _dumps_compact(value, indent=2, level=1)
        return f"{key_json}: {val_json}"
    val_json = json.dumps(value, ensure_ascii=False, indent=2)
    lines = val_json.split("\n")
    if len(lines) == 1:
        return f"{key_json}: {val_json}"
    indented = lines[0] + "\n" + "\n".join("  " + line for line in lines[1:])
    return f"{key_json}: {indented}"


def _is_primitive(value: Any) -> bool:
    return value is None or isinstance(value, (bool, int, float, str))


def _is_primitive_dict(obj: dict[str, Any]) -> bool:
    return all(_is_primitive(v) for v in obj.values())


def _is_shallow_inline_dict(obj: dict[str, Any]) -> bool:
    """Objeto que cabe en una línea (primitivos o un dict anidado solo de primitivos)."""
    for value in obj.values():
        if _is_primitive(value):
            continue
        if isinstance(value, dict) and _is_primitive_dict(value):
            continue
        return False
    return True


def _dumps_compact(obj: Any, *, indent: int = 2, level: int = 0) -> str:
    """Serializa al estilo compacto de ollama.json (arrays cortos y dicts planos en línea)."""
    pad = " " * (indent * level)
    pad_inner = " " * (indent * (level + 1))

    if isinstance(obj, dict):
        if not obj:
            return "{}"
        if _is_primitive_dict(obj):
            inner = ", ".join(
                f"{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}"
                for k, v in obj.items()
            )
            return "{ " + inner + " }"
        if level > 0 and _is_shallow_inline_dict(obj):
            inner = ", ".join(
                f"{json.dumps(k, ensure_ascii=False)}: {_dumps_compact(v, indent=indent, level=0)}"
                for k, v in obj.items()
            )
            return "{ " + inner + " }"
        parts = [
            f"{pad_inner}{json.dumps(k, ensure_ascii=False)}: {_dumps_compact(v, indent=indent, level=level + 1)}"
            for k, v in obj.items()
        ]
        return "{\n" + ",\n".join(parts) + "\n" + pad + "}"

    if isinstance(obj, list):
        if not obj:
            return "[]"
        if all(_is_primitive(x) for x in obj):
            return "[" + ", ".join(json.dumps(x, ensure_ascii=False) for x in obj) + "]"
        if all(isinstance(x, dict) and _is_shallow_inline_dict(x) for x in obj):
            parts = [
                f"{pad_inner}{_dumps_compact(x, indent=indent, level=0)}"
                for x in obj
            ]
            return "[\n" + ",\n".join(parts) + "\n" + pad + "]"
        parts = [
            f"{pad_inner}{_dumps_compact(x, indent=indent, level=level + 1)}"
            for x in obj
        ]
        return "[\n" + ",\n".join(parts) + "\n" + pad + "]"

    return json.dumps(obj, ensure_ascii=False)
