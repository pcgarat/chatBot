"""Adaptador SQLAlchemy del repositorio de perfiles."""

from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import WorkspaceProfileRecord
from app.services.workspace_profiles.models import WorkspaceProfile


class SqlAlchemyWorkspaceProfileRepository:
    def __init__(self, db: Session):
        self._db = db

    def list_all(self) -> list[WorkspaceProfile]:
        rows = (
            self._db.query(WorkspaceProfileRecord)
            .order_by(WorkspaceProfileRecord.updated_at.desc())
            .all()
        )
        return [self._to_entity(row) for row in rows]

    def get(self, profile_id: str) -> WorkspaceProfile | None:
        row = self._db.query(WorkspaceProfileRecord).filter(WorkspaceProfileRecord.id == profile_id).first()
        return self._to_entity(row) if row else None

    def find_by_name_ci(self, name: str) -> WorkspaceProfile | None:
        target = (name or "").strip().lower()
        if not target:
            return None
        rows = self._db.query(WorkspaceProfileRecord).all()
        for row in rows:
            if (row.name or "").strip().lower() == target:
                return self._to_entity(row)
        return None

    def add(self, name: str, snapshot: dict) -> WorkspaceProfile:
        row = WorkspaceProfileRecord(name=name, snapshot_json=json.dumps(snapshot, ensure_ascii=False))
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return self._to_entity(row)

    def update(
        self,
        profile_id: str,
        *,
        name: str | None = None,
        snapshot: dict | None = None,
    ) -> WorkspaceProfile | None:
        row = self._db.query(WorkspaceProfileRecord).filter(WorkspaceProfileRecord.id == profile_id).first()
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

    def delete(self, profile_id: str) -> bool:
        row = self._db.query(WorkspaceProfileRecord).filter(WorkspaceProfileRecord.id == profile_id).first()
        if not row:
            return False
        self._db.delete(row)
        self._db.commit()
        return True

    @staticmethod
    def _to_entity(row: WorkspaceProfileRecord) -> WorkspaceProfile:
        try:
            snapshot = json.loads(row.snapshot_json or "{}")
        except json.JSONDecodeError:
            snapshot = {}
        if not isinstance(snapshot, dict):
            snapshot = {}
        return WorkspaceProfile(
            id=row.id,
            name=row.name,
            snapshot=snapshot,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
