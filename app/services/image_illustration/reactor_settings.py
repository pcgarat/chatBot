"""Resolución de parámetros ReActor: defaults .env + overrides del panel."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.config import settings


def parse_int_list(value: str | list[int] | None, *, default: list[int]) -> list[int]:
    if isinstance(value, list):
        out = [int(x) for x in value]
        return out or default
    text = str(value or "").strip()
    if not text:
        return list(default)
    parts = [p.strip() for p in text.split(",") if p.strip()]
    if not parts:
        return list(default)
    return [int(p) for p in parts]


@dataclass(frozen=True)
class ReactorEnvDefaults:
    source_image: str = ""
    model: str = "inswapper_128.onnx"
    source_faces_index: list[int] = field(default_factory=lambda: [0])
    face_index: list[int] = field(default_factory=lambda: [0])
    upscaler: str = "None"
    scale: float = 1.0
    upscale_visibility: float = 1.0
    face_restorer: str = "CodeFormer"
    restorer_visibility: float = 1.0
    codeformer_weight: float = 0.5
    restore_first: int = 1
    gender_source: int = 0
    gender_target: int = 0
    device: str = "CUDA"
    mask_face: int = 1
    select_source: int = 0
    face_model: str = ""
    source_folder: str = ""
    random_image: int = 0
    upscale_force: int = 0

    def to_api_dict(self) -> dict[str, Any]:
        return {
            "model": self.model,
            "source_faces_index": list(self.source_faces_index),
            "face_index": list(self.face_index),
            "upscaler": self.upscaler,
            "scale": self.scale,
            "upscale_visibility": self.upscale_visibility,
            "face_restorer": self.face_restorer,
            "restorer_visibility": self.restorer_visibility,
            "codeformer_weight": self.codeformer_weight,
            "restore_first": self.restore_first,
            "gender_source": self.gender_source,
            "gender_target": self.gender_target,
            "save_to_file": 0,
            "result_file_path": "",
            "device": self.device,
            "mask_face": self.mask_face,
            "select_source": self.select_source,
            "face_model": self.face_model,
            "source_folder": self.source_folder,
            "random_image": self.random_image,
            "upscale_force": self.upscale_force,
        }

    def to_panel_dict(self) -> dict[str, Any]:
        return {
            "source_image": self.source_image,
            "model": self.model,
            "source_faces_index": _join_int_list(self.source_faces_index),
            "face_index": _join_int_list(self.face_index),
            "upscaler": self.upscaler,
            "scale": self.scale,
            "upscale_visibility": self.upscale_visibility,
            "face_restorer": self.face_restorer,
            "restorer_visibility": self.restorer_visibility,
            "codeformer_weight": self.codeformer_weight,
            "restore_first": self.restore_first,
            "gender_source": self.gender_source,
            "gender_target": self.gender_target,
            "device": self.device,
            "mask_face": self.mask_face,
            "select_source": self.select_source,
            "face_model": self.face_model,
            "source_folder": self.source_folder,
            "random_image": self.random_image,
            "upscale_force": self.upscale_force,
        }


def _join_int_list(values: list[int]) -> str:
    return ",".join(str(v) for v in values)


def reactor_env_defaults() -> ReactorEnvDefaults:
    return ReactorEnvDefaults(
        source_image=(settings.forge_reactor_source_image or "").strip(),
        model=(settings.forge_reactor_model or "inswapper_128.onnx").strip() or "inswapper_128.onnx",
        source_faces_index=parse_int_list(
            settings.forge_reactor_source_faces_index,
            default=[0],
        ),
        face_index=parse_int_list(settings.forge_reactor_face_index, default=[0]),
        upscaler=settings.forge_reactor_upscaler,
        scale=float(settings.forge_reactor_scale),
        upscale_visibility=float(settings.forge_reactor_upscale_visibility),
        face_restorer=settings.forge_reactor_face_restorer,
        restorer_visibility=float(settings.forge_reactor_restorer_visibility),
        codeformer_weight=float(settings.forge_reactor_codeformer_weight),
        restore_first=int(settings.forge_reactor_restore_first),
        gender_source=int(settings.forge_reactor_gender_source),
        gender_target=int(settings.forge_reactor_gender_target),
        device=settings.forge_reactor_device,
        mask_face=int(settings.forge_reactor_mask_face),
        select_source=int(settings.forge_reactor_select_source),
        face_model=(settings.forge_reactor_face_model or "").strip(),
        source_folder=(settings.forge_reactor_source_folder or "").strip(),
        random_image=int(settings.forge_reactor_random_image),
        upscale_force=int(settings.forge_reactor_upscale_force),
    )


_PANEL_OVERRIDE_KEYS = (
    "model",
    "source_faces_index",
    "face_index",
    "upscaler",
    "scale",
    "upscale_visibility",
    "face_restorer",
    "restorer_visibility",
    "codeformer_weight",
    "restore_first",
    "gender_source",
    "gender_target",
    "device",
    "mask_face",
    "select_source",
    "face_model",
    "source_folder",
    "random_image",
    "upscale_force",
)


def _coerce_panel_value(key: str, value: Any, base: ReactorEnvDefaults) -> Any:
    if value is None:
        return getattr(base, key)
    if key in ("source_faces_index", "face_index"):
        if isinstance(value, list):
            return value
        return parse_int_list(str(value), default=getattr(base, key))
    if key in ("scale", "upscale_visibility", "restorer_visibility", "codeformer_weight"):
        return float(value)
    if key in (
        "restore_first",
        "gender_source",
        "gender_target",
        "mask_face",
        "select_source",
        "random_image",
        "upscale_force",
    ):
        return int(value)
    return str(value).strip() if isinstance(value, str) else value


def merge_reactor_panel(base: ReactorEnvDefaults, panel: dict[str, Any] | None) -> ReactorEnvDefaults:
    """Aplica overrides del panel; claves vacías/ausentes mantienen el valor base (.env)."""
    data = panel if isinstance(panel, dict) else {}
    kwargs: dict[str, Any] = {}
    for key in _PANEL_OVERRIDE_KEYS:
        raw = data.get(key)
        if raw is None or raw == "":
            continue
        kwargs[key] = _coerce_panel_value(key, raw, base)
    return ReactorEnvDefaults(
        source_image=base.source_image,
        model=kwargs.get("model", base.model),
        source_faces_index=kwargs.get("source_faces_index", base.source_faces_index),
        face_index=kwargs.get("face_index", base.face_index),
        upscaler=kwargs.get("upscaler", base.upscaler),
        scale=kwargs.get("scale", base.scale),
        upscale_visibility=kwargs.get("upscale_visibility", base.upscale_visibility),
        face_restorer=kwargs.get("face_restorer", base.face_restorer),
        restorer_visibility=kwargs.get("restorer_visibility", base.restorer_visibility),
        codeformer_weight=kwargs.get("codeformer_weight", base.codeformer_weight),
        restore_first=kwargs.get("restore_first", base.restore_first),
        gender_source=kwargs.get("gender_source", base.gender_source),
        gender_target=kwargs.get("gender_target", base.gender_target),
        device=kwargs.get("device", base.device),
        mask_face=kwargs.get("mask_face", base.mask_face),
        select_source=kwargs.get("select_source", base.select_source),
        face_model=kwargs.get("face_model", base.face_model),
        source_folder=kwargs.get("source_folder", base.source_folder),
        random_image=kwargs.get("random_image", base.random_image),
        upscale_force=kwargs.get("upscale_force", base.upscale_force),
    )


@dataclass(frozen=True)
class ReactorGenderPass:
    gender_target: int
    face_model: str
    label: str


@dataclass(frozen=True)
class ReactorResolvedPlan:
    base: ReactorEnvDefaults
    gender_passes: tuple[ReactorGenderPass, ...]
    source_image_path: str = ""

    @property
    def uses_source_image(self) -> bool:
        return not self.gender_passes and bool(self.source_image_path)


def reactor_panel_from_rules(rules: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(rules, dict):
        return {}
    panel = dict(rules.get("reactor") or {})
    if rules.get("reactor_enabled") and not panel.get("enabled"):
        panel["enabled"] = True
    return panel


def resolve_reactor_plan(rules: dict[str, Any] | None) -> ReactorResolvedPlan | None:
    panel = reactor_panel_from_rules(rules)
    if not panel.get("enabled"):
        return None

    base = merge_reactor_panel(reactor_env_defaults(), panel)
    passes: list[ReactorGenderPass] = []
    female_model = str(panel.get("female_face_model") or "").strip()
    male_model = str(panel.get("male_face_model") or "").strip()
    if panel.get("female_enabled") and female_model:
        passes.append(ReactorGenderPass(gender_target=1, face_model=female_model, label="female"))
    if panel.get("male_enabled") and male_model:
        passes.append(ReactorGenderPass(gender_target=2, face_model=male_model, label="male"))

    source_path = base.source_image
    if not passes and not source_path:
        return None
    if not passes and source_path and not Path(source_path).is_file():
        return None

    return ReactorResolvedPlan(
        base=base,
        gender_passes=tuple(passes),
        source_image_path=source_path if not passes else "",
    )
