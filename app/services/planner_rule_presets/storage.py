"""Adaptador SQLAlchemy del repositorio de presets de reglas."""

from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import PlannerRulePresetRecord
from app.services.planner_rule_presets.models import PlannerRulePreset


class SqlAlchemyPlannerRulePresetRepository:
    def __init__(self, db: Session):
        self._db = db

    def list_all(self) -> list[PlannerRulePreset]:
        rows = (
            self._db.query(PlannerRulePresetRecord)
            .order_by(PlannerRulePresetRecord.updated_at.desc())
            .all()
        )
        return [self._to_entity(row) for row in rows]

    def get(self, preset_id: str) -> PlannerRulePreset | None:
        row = (
            self._db.query(PlannerRulePresetRecord)
            .filter(PlannerRulePresetRecord.id == preset_id)
            .first()
        )
        return self._to_entity(row) if row else None

    def find_by_name_ci(self, name: str) -> PlannerRulePreset | None:
        target = (name or "").strip().lower()
        if not target:
            return None
        rows = self._db.query(PlannerRulePresetRecord).all()
        for row in rows:
            if (row.name or "").strip().lower() == target:
                return self._to_entity(row)
        return None

    def add(self, name: str, snapshot: dict) -> PlannerRulePreset:
        row = PlannerRulePresetRecord(
            name=name,
            snapshot_json=json.dumps(snapshot, ensure_ascii=False),
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return self._to_entity(row)

    def update(
        self,
        preset_id: str,
        *,
        name: str | None = None,
        snapshot: dict | None = None,
    ) -> PlannerRulePreset | None:
        row = (
            self._db.query(PlannerRulePresetRecord)
            .filter(PlannerRulePresetRecord.id == preset_id)
            .first()
        )
        if not row:
            return None
        if name is not None:
            row.name = name
        if snapshot is not None:
            row.snapshot_json = json.dumps(snapshot, ensure_ascii=False)
        row.updated_at = datetime.utcnow()
        self._db.commit()
        self._db.refresh(row)
        return self._to_entity(row)

    def delete(self, preset_id: str) -> bool:
        row = (
            self._db.query(PlannerRulePresetRecord)
            .filter(PlannerRulePresetRecord.id == preset_id)
            .first()
        )
        if not row:
            return False
        self._db.delete(row)
        self._db.commit()
        return True

    @staticmethod
    def _to_entity(row: PlannerRulePresetRecord) -> PlannerRulePreset:
        try:
            snapshot = json.loads(row.snapshot_json or "{}")
        except json.JSONDecodeError:
            snapshot = {}
        if not isinstance(snapshot, dict):
            snapshot = {}
        return PlannerRulePreset(
            id=row.id,
            name=row.name,
            snapshot=snapshot,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
