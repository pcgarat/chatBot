"""Puertos (interfaces) del hexágono de ilustración."""

from __future__ import annotations

from typing import Any, Protocol

from app.services.image_illustration.models import ForgeMode, LastGenerationPayload, ScenePlan


class LastPayloadSource(Protocol):
    def load(self) -> LastGenerationPayload:
        ...


class ForgeGenerationPort(Protocol):
    def generate(self, mode: ForgeMode, body: dict[str, Any]) -> bytes:
        """Genera una imagen; devuelve bytes (png/jpeg)."""
        ...


class ScenePlannerPort(Protocol):
    def plan(self, text: str, max_images: int) -> ScenePlan:
        ...
