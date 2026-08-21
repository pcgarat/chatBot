"""Casos de uso: listar, crear, actualizar y borrar perfiles."""

from __future__ import annotations

from app.services.workspace_profiles.models import WorkspaceProfile
from app.services.workspace_profiles.ports import WorkspaceProfileRepository
from app.services.workspace_profiles.snapshot import (
    SnapshotValidationError,
    normalize_profile_name,
    normalize_snapshot,
)


class ProfileNameConflict(ValueError):
    """Ya existe un perfil con ese nombre."""


class WorkspaceProfileService:
    def __init__(self, repo: WorkspaceProfileRepository):
        self._repo = repo

    def list_profiles(self) -> list[WorkspaceProfile]:
        return self._repo.list_all()

    def get_profile(self, profile_id: str) -> WorkspaceProfile | None:
        return self._repo.get(profile_id)

    def create_profile(self, name: str, snapshot: dict) -> WorkspaceProfile:
        clean_name = normalize_profile_name(name)
        body = normalize_snapshot(snapshot)
        existing = self._repo.find_by_name_ci(clean_name)
        if existing:
            raise ProfileNameConflict(f"Ya existe un perfil llamado «{existing.name}»")
        return self._repo.add(clean_name, body)

    def update_profile(
        self,
        profile_id: str,
        *,
        name: str | None = None,
        snapshot: dict | None = None,
    ) -> WorkspaceProfile | None:
        current = self._repo.get(profile_id)
        if not current:
            return None
        new_name = normalize_profile_name(name) if name is not None else None
        new_snapshot = normalize_snapshot(snapshot) if snapshot is not None else None
        if new_name is not None:
            clash = self._repo.find_by_name_ci(new_name)
            if clash and clash.id != profile_id:
                raise ProfileNameConflict(f"Ya existe un perfil llamado «{clash.name}»")
        return self._repo.update(profile_id, name=new_name, snapshot=new_snapshot)

    def delete_profile(self, profile_id: str) -> bool:
        return self._repo.delete(profile_id)


__all__ = [
    "WorkspaceProfileService",
    "ProfileNameConflict",
    "SnapshotValidationError",
]
