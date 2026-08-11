"""Puertos (interfaces) del hexágono de ilustración."""

from __future__ import annotations

from typing import Any, Protocol

from app.services.image_illustration.models import (
    ForgeMode,
    LastGenerationPayload,
    ScenePlan,
    SceneSpec,
)
from app.services.image_illustration.coverage import ParagraphInfo


class LastPayloadSource(Protocol):
    def load(self) -> LastGenerationPayload:
        ...


class ForgeGenerationPort(Protocol):
    def generate(self, mode: ForgeMode, body: dict[str, Any]) -> bytes:
        """Genera una imagen; devuelve bytes (png/jpeg)."""
        ...


class ScenePlannerPort(Protocol):
    def plan(
        self,
        text: str,
        max_images: int,
        already_planned: list[SceneSpec] | None = None,
        coverage_block: str | None = None,
        assigned_paragraphs: list[ParagraphInfo] | None = None,
    ) -> ScenePlan:
        ...
