"""Casos de uso: listar, crear, actualizar y borrar presets de reglas."""

from __future__ import annotations

from app.services.planner_rule_presets.models import PlannerRulePreset
from app.services.planner_rule_presets.ports import PlannerRulePresetRepository
from app.services.planner_rule_presets.snapshot import normalize_rule_preset_snapshot
from app.services.workspace_profiles.snapshot import (
    SnapshotValidationError,
    normalize_profile_name,
)


class PresetNameConflict(ValueError):
    """Ya existe un preset con ese nombre."""


class PlannerRulePresetService:
    def __init__(self, repo: PlannerRulePresetRepository):
        self._repo = repo

    def list_presets(self) -> list[PlannerRulePreset]:
        return self._repo.list_all()

    def get_preset(self, preset_id: str) -> PlannerRulePreset | None:
        return self._repo.get(preset_id)

    def create_preset(self, name: str, snapshot: dict) -> PlannerRulePreset:
        clean_name = normalize_profile_name(name)
        body = normalize_rule_preset_snapshot(snapshot)
        existing = self._repo.find_by_name_ci(clean_name)
        if existing:
            raise PresetNameConflict(f"Ya existe un preset llamado «{existing.name}»")
        return self._repo.add(clean_name, body)

    def update_preset(
        self,
        preset_id: str,
        *,
        name: str | None = None,
        snapshot: dict | None = None,
    ) -> PlannerRulePreset | None:
        current = self._repo.get(preset_id)
        if not current:
            return None
        new_name = normalize_profile_name(name) if name is not None else None
        new_snapshot = normalize_rule_preset_snapshot(snapshot) if snapshot is not None else None
        if new_name is not None:
            clash = self._repo.find_by_name_ci(new_name)
            if clash and clash.id != preset_id:
                raise PresetNameConflict(f"Ya existe un preset llamado «{clash.name}»")
        return self._repo.update(preset_id, name=new_name, snapshot=new_snapshot)

    def delete_preset(self, preset_id: str) -> bool:
        return self._repo.delete(preset_id)


__all__ = [
    "PlannerRulePresetService",
    "PresetNameConflict",
    "SnapshotValidationError",
]
