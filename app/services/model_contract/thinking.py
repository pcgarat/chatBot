"""Normalización del valor `think` según el contrato (coerce, no 422)."""

from __future__ import annotations

from typing import Any

from app.services.model_contract.models import ThinkingCapability


def _is_disabled(value: Any) -> bool:
    return value is False or value == "false" or value == 0 or value == "0"


def _is_enabled_true(value: Any) -> bool:
    return value is True or value == "true" or value == 1 or value == "1"


def normalize_think_value(thinking: ThinkingCapability, value: Any) -> Any | None:
    """
    Devuelve el valor de think a enviar, o None si no debe enviarse.

    Si can_disable es False, false/true se coaccionan a true_maps_to (o default).
    Recetas pueden traer bool nativo o strings ("false", "max").
    """
    if thinking.kind == "none":
        return None
    if value is None:
        return thinking.default

    if _is_disabled(value):
        if not thinking.can_disable:
            return thinking.true_maps_to if thinking.true_maps_to is not None else thinking.default
        if thinking.kind == "boolean":
            return False
        return False

    if _is_enabled_true(value):
        if thinking.true_maps_to is not None:
            return thinking.true_maps_to
        if thinking.kind == "boolean":
            return True
        return True

    token = str(value)
    for allowed in thinking.values:
        if str(allowed) == token:
            return allowed
    return thinking.default
