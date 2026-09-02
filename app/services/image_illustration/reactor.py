"""Post-proceso ReActor: face swap sobre la imagen generada por Forge."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Protocol

from app.services.image_illustration.forge_client import ForgeClientError
from app.services.image_illustration.reactor_settings import (
    ReactorGenderPass,
    ReactorResolvedPlan,
    resolve_reactor_plan,
)


class ReactorCapableForge(Protocol):
    def reactor_swap(
        self,
        *,
        source_image: bytes,
        target_image: bytes,
        params: dict[str, Any],
    ) -> bytes:
        ...


class ReactorConfigurationError(ValueError):
    """ReActor activado pero falta configuración obligatoria."""


def is_reactor_enabled(rules: dict[str, Any] | None) -> bool:
    panel = rules if isinstance(rules, dict) else {}
    if panel.get("reactor_enabled"):
        return True
    reactor = panel.get("reactor")
    return bool(isinstance(reactor, dict) and reactor.get("enabled"))


def load_source_image(path: str) -> bytes:
    data = Path(path).read_bytes()
    if not data:
        raise ReactorConfigurationError(f"Imagen fuente ReActor vacía: {path}")
    return data


def _pass_params(plan: ReactorResolvedPlan, gender_pass: ReactorGenderPass | None) -> dict[str, Any]:
    params = plan.base.to_api_dict()
    if gender_pass is not None:
        params["select_source"] = 1
        params["face_model"] = gender_pass.face_model
        params["gender_target"] = gender_pass.gender_target
        params["gender_source"] = 0
    return params


def _source_bytes_for_pass(
    plan: ReactorResolvedPlan,
    target_image: bytes,
    gender_pass: ReactorGenderPass | None,
) -> bytes:
    if gender_pass is not None:
        return target_image
    if not plan.source_image_path:
        raise ReactorConfigurationError("ReActor sin imagen fuente ni facemodels de género")
    return load_source_image(plan.source_image_path)


def apply_reactor_if_configured(
    forge: ReactorCapableForge,
    target_image: bytes,
    rules: dict[str, Any] | None,
) -> tuple[bytes, dict[str, Any]]:
    """
    Si ReActor está activo, aplica face swap y devuelve la imagen final.
    Con facemodels por género ejecuta un pase por cada uno (mujer/hombre).
    """
    plan = resolve_reactor_plan(rules)
    if plan is None:
        if is_reactor_enabled(rules):
            raise ReactorConfigurationError(
                "ReActor activado: configura facemodels Mujer/Hombre en el panel "
                "o FORGE_REACTOR_SOURCE_IMAGE en .env"
            )
        return target_image, {}

    passes: list[ReactorGenderPass | None]
    if plan.gender_passes:
        passes = list(plan.gender_passes)
    else:
        passes = [None]

    image = target_image
    t0 = time.perf_counter()
    pass_meta: list[dict[str, Any]] = []
    try:
        for gender_pass in passes:
            params = _pass_params(plan, gender_pass)
            source_bytes = _source_bytes_for_pass(plan, image, gender_pass)
            image = forge.reactor_swap(
                source_image=source_bytes,
                target_image=image,
                params=params,
            )
            if gender_pass is not None:
                pass_meta.append(
                    {
                        "gender": gender_pass.label,
                        "face_model": gender_pass.face_model,
                        "gender_target": gender_pass.gender_target,
                    }
                )
    except ForgeClientError as exc:
        raise ForgeClientError(f"ReActor: {exc}") from exc

    reactor_time_ms = round((time.perf_counter() - t0) * 1000.0, 1)
    meta: dict[str, Any] = {
        "reactor_applied": True,
        "reactor_model": plan.base.model,
        "reactor_face_restorer": plan.base.face_restorer,
        "reactor_time_ms": reactor_time_ms,
    }
    if plan.source_image_path and not plan.gender_passes:
        meta["reactor_source"] = Path(plan.source_image_path).name
    if pass_meta:
        meta["reactor_gender_passes"] = pass_meta
    return image, meta
