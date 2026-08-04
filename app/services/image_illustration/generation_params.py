"""Construcción de metadatos Forge a persistir por imagen generada."""

from __future__ import annotations

from typing import Any

from app.services.image_illustration.forge_client import sanitize_forge_body_for_log
from app.services.image_illustration.models import ForgeMode


def build_stored_generation_params(
    mode: ForgeMode | str,
    body: dict[str, Any],
    *,
    generation_time_ms: float | None = None,
) -> dict[str, Any]:
    """
    Params seguros para BD/UI: body sanitizado (sin base64) + modo + modelo.
    Incluye prompt, steps, seed, sampler, width/height y tiempo de generación.
    """
    params = sanitize_forge_body_for_log(body or {})
    mode_value = mode.value if isinstance(mode, ForgeMode) else str(mode)
    params["mode"] = mode_value
    override = params.get("override_settings")
    if isinstance(override, dict):
        checkpoint = override.get("sd_model_checkpoint")
        if checkpoint:
            params["model"] = checkpoint
    if generation_time_ms is not None:
        params["generation_time_ms"] = round(float(generation_time_ms), 1)
    return params
