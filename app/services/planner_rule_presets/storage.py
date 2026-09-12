"""Adaptador SQLAlchemy del repositorio de presets de reglas."""

from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import PlannerRulePresetRecord
from app.services.planner_rule_presets.models import PlannerRulePreset


class SqlAlchemyPlannerRulePresetRepository:
    def __init__(self, db: Session, user_id: str | None = None):
        self._db = db
        self._user_id = user_id

    def _owned(self):
        q = self._db.query(PlannerRulePresetRecord)
        if self._user_id is not None:
            q = q.filter(PlannerRulePresetRecord.user_id == self._user_id)
        return q

    def list_all(self) -> list[PlannerRulePreset]:
        rows = self._owned().order_by(PlannerRulePresetRecord.updated_at.desc()).all()
        return [self._to_entity(row) for row in rows]

    def get(self, preset_id: str) -> PlannerRulePreset | None:
        row = self._owned().filter(PlannerRulePresetRecord.id == preset_id).first()
        return self._to_entity(row) if row else None

    def find_by_name_ci(self, name: str) -> PlannerRulePreset | None:
        target = (name or "").strip().lower()
        if not target:
            return None
        for row in self._owned().all():
            if (row.name or "").strip().lower() == target:
                return self._to_entity(row)
        return None

    def add(self, name: str, snapshot: dict) -> PlannerRulePreset:
        row = PlannerRulePresetRecord(
            name=name,
            snapshot_json=json.dumps(snapshot, ensure_ascii=False),
            user_id=self._user_id,
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
        row = self._owned().filter(PlannerRulePresetRecord.id == preset_id).first()
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
        row = self._owned().filter(PlannerRulePresetRecord.id == preset_id).first()
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
