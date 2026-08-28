"""Modelos del dominio de ilustración."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ForgeMode(str, Enum):
    TXT2IMG = "txt2img"
    IMG2IMG = "img2img"


@dataclass
class SceneSpec:
    id: str
    prompt: str
    anchor_excerpt: str = ""
    paragraph_index: int | None = None


@dataclass
class ScenePlan:
    illustrate: bool
    reason: str = ""
    scenes: list[SceneSpec] = field(default_factory=list)


@dataclass(frozen=True)
class ForgeParamOverrides:
    """Overrides opcionales del panel Imágenes sobre el replay de Forge."""

    steps: int | None = None
    width: int | None = None
    height: int | None = None
    seed: int | None = None

    def as_dict(self) -> dict[str, int]:
        """Solo claves con valor definido (para fusionar en el body Forge)."""
        out: dict[str, int] = {}
        if self.steps is not None:
            out["steps"] = self.steps
        if self.width is not None:
            out["width"] = self.width
        if self.height is not None:
            out["height"] = self.height
        if self.seed is not None:
            out["seed"] = self.seed
        return out

    def is_empty(self) -> bool:
        return not self.as_dict()


@dataclass
class LastGenerationPayload:
    """Payload reconstruido del último gen; listo para POST a Forge (salvo prompt de escena)."""

    mode: ForgeMode
    body: dict[str, Any]
    recovered_fields: list[str] = field(default_factory=list)
    omitted_notes: list[str] = field(default_factory=list)
    source_image_path: str | None = None
    raw_info: str = ""
    override_settings: dict[str, Any] = field(default_factory=dict)
    modules: list[str] = field(default_factory=list)

    def body_with_prompt(
        self,
        prompt: str,
        overrides: ForgeParamOverrides | None = None,
    ) -> dict[str, Any]:
        """Copia el body sustituyendo prompt y, si hay, steps/width/height/seed del panel."""
        out = dict(self.body)
        out["prompt"] = prompt
        if overrides is not None:
            out.update(overrides.as_dict())
        if self.override_settings:
            merged = dict(out.get("override_settings") or {})
            merged.update(self.override_settings)
            out["override_settings"] = merged
        return out


@dataclass
class IllustrationEvent:
    type: str  # log | status | placeholder | image | error | done | llm_debug
    message: str = ""
    scene_id: str | None = None
    url: str | None = None
    content: str | None = None
    data: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"type": self.type}
        if self.message:
            d["message"] = self.message
        if self.scene_id is not None:
            d["scene_id"] = self.scene_id
        if self.url is not None:
            d["url"] = self.url
        if self.content is not None:
            d["content"] = self.content
        if self.data:
            d["data"] = self.data
        return d
