"""Puerto del repositorio de presets de reglas del planificador."""

from __future__ import annotations

from typing import Protocol

from app.services.planner_rule_presets.models import PlannerRulePreset


class PlannerRulePresetRepository(Protocol):
    def list_all(self) -> list[PlannerRulePreset]:
        ...

    def get(self, preset_id: str) -> PlannerRulePreset | None:
        ...

    def find_by_name_ci(self, name: str) -> PlannerRulePreset | None:
        ...

    def add(self, name: str, snapshot: dict) -> PlannerRulePreset:
        ...

    def update(
        self,
        preset_id: str,
        *,
        name: str | None = None,
        snapshot: dict | None = None,
    ) -> PlannerRulePreset | None:
        ...

    def delete(self, preset_id: str) -> bool:
        ...
