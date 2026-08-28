"""Construcción de overrides de generación Forge desde el panel / schemas."""

from __future__ import annotations

from typing import Any

from app.services.image_illustration.models import ForgeParamOverrides

_PANEL_KEYS = ("steps", "width", "height", "seed")


def forge_overrides_from_optional(
    *,
    steps: int | None = None,
    width: int | None = None,
    height: int | None = None,
    seed: int | None = None,
) -> ForgeParamOverrides | None:
    """Devuelve overrides si hay al menos un valor; None si el panel no fuerza nada."""
    overrides = ForgeParamOverrides(
        steps=steps,
        width=width,
        height=height,
        seed=seed,
    )
    return None if overrides.is_empty() else overrides


def panel_params_from_fields(fields: dict[str, Any]) -> dict[str, int]:
    """Extrae steps/width/height/seed enteros presentes en campos parseados del infotext."""
    out: dict[str, int] = {}
    for key in _PANEL_KEYS:
        value = fields.get(key)
        if value is None:
            continue
        try:
            out[key] = int(value)
        except (TypeError, ValueError):
            continue
    return out
