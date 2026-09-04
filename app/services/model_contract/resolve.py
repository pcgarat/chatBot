"""Resuelve el contrato efectivo: schema proveedor + show + overlay sparse."""

from __future__ import annotations

from typing import Any

from app.provider_params import get_params_config
from app.services.model_contract.models import (
    ModelCapabilities,
    ModelContract,
    Recipe,
    ThinkingCapability,
)
from app.services.model_contract.overlays import load_overlays
from app.services.model_contract.show_live import live_caps_from_show


def resolve_model_contract(
    provider: str,
    model_id: str,
    *,
    show: Any = None,
) -> ModelContract:
    """
    Merge: provider_params ← live show ← overlay.

    Overlay gana en defaults/max/thinking. Show aporta vision/tools/context
    y thinking boolean si no hay overlay de thinking. Show inválido se ignora.
    """
    show_dict = show if isinstance(show, dict) else {}
    overlay = _overlay_for(provider, model_id)
    base = _copy_specs(get_params_config(provider))
    live = live_caps_from_show(show_dict)

    params = _apply_live_context(base, live.get("context_length"))
    overlay_params = overlay.get("params") if isinstance(overlay.get("params"), dict) else {}
    params = _merge_param_specs(params, overlay_params)

    thinking = _resolve_thinking(overlay, live)
    params = _sync_think_param(params, thinking)

    ocaps = overlay.get("capabilities") if isinstance(overlay.get("capabilities"), dict) else {}
    vision = ocaps["vision"] if "vision" in ocaps else bool(live.get("vision"))
    tools = ocaps["tools"] if "tools" in ocaps else bool(live.get("tools"))
    structured = bool(ocaps.get("structured_output", False))

    return ModelContract(
        provider=provider,
        model=model_id,
        capabilities=ModelCapabilities(
            vision=bool(vision),
            tools=bool(tools),
            structured_output=structured,
            thinking=thinking,
        ),
        params=params,
        recipes=_recipes_from_overlay(overlay),
        quirks=_quirks_from_overlay(overlay),
    )


def _overlay_for(provider: str, model_id: str) -> dict[str, Any]:
    data = load_overlays(provider)
    entry = data.get(model_id) if isinstance(data, dict) else None
    return entry if isinstance(entry, dict) else {}


def _copy_specs(specs: dict[str, Any]) -> dict[str, Any]:
    return {k: dict(v) if isinstance(v, dict) else v for k, v in specs.items()}


def _merge_param_specs(base: dict[str, Any], overlay_params: dict[str, Any]) -> dict[str, Any]:
    out = _copy_specs(base)
    for key, delta in overlay_params.items():
        if not isinstance(delta, dict):
            continue
        current = out.get(key)
        if isinstance(current, dict):
            out[key] = {**current, **delta}
        else:
            out[key] = dict(delta)
    return out


def _apply_live_context(params: dict[str, Any], context_length: int | None) -> dict[str, Any]:
    if context_length is None:
        return params
    out = _copy_specs(params)
    spec = out.get("num_ctx")
    if isinstance(spec, dict):
        spec["max"] = context_length
    return out


def _resolve_thinking(overlay: dict[str, Any], live: dict[str, Any]) -> ThinkingCapability:
    ocaps = overlay.get("capabilities") if isinstance(overlay.get("capabilities"), dict) else {}
    raw = ocaps.get("thinking")
    if isinstance(raw, dict):
        return ThinkingCapability(
            kind=str(raw.get("kind") or "none"),
            values=_value_tokens(raw.get("values")),
            can_disable=bool(raw.get("can_disable", True)),
            true_maps_to=raw.get("true_maps_to"),
            default=raw.get("default"),
        )
    if live.get("thinking_flag"):
        return ThinkingCapability(kind="boolean")
    return ThinkingCapability(kind="none")


def _value_tokens(raw: Any) -> tuple[str, ...]:
    if not isinstance(raw, list):
        return ()
    tokens: list[str] = []
    for item in raw:
        if item is False:
            tokens.append("false")
        elif item is True:
            tokens.append("true")
        else:
            tokens.append(str(item))
    return tuple(tokens)


def _sync_think_param(params: dict[str, Any], thinking: ThinkingCapability) -> dict[str, Any]:
    out = _copy_specs(params)
    if thinking.kind == "none":
        out.pop("think", None)
        return out
    spec = dict(out.get("think") or {})
    spec.setdefault("api_key", "think")
    if thinking.kind == "levels":
        spec.setdefault("type", "enum")
        if thinking.values:
            spec.setdefault("values", list(thinking.values))
    else:
        spec.setdefault("type", "boolean")
    if thinking.default is not None:
        spec.setdefault("default", thinking.default)
    out["think"] = spec
    return out


def _recipes_from_overlay(overlay: dict[str, Any]) -> tuple[Recipe, ...]:
    raw = overlay.get("recipes") or []
    if not isinstance(raw, list):
        return ()
    recipes: list[Recipe] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        rid = item.get("id")
        label = item.get("label")
        if not rid or not label:
            continue
        params = item.get("params") if isinstance(item.get("params"), dict) else {}
        recipes.append(Recipe(id=str(rid), label=str(label), params=dict(params)))
    return tuple(recipes)


def _quirks_from_overlay(overlay: dict[str, Any]) -> tuple[str, ...]:
    raw = overlay.get("quirks") or []
    if not isinstance(raw, list):
        return ()
    return tuple(str(q) for q in raw if q)
