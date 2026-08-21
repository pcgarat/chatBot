"""Puerto del repositorio de perfiles de workspace."""

from __future__ import annotations

from typing import Protocol

from app.services.workspace_profiles.models import WorkspaceProfile


class WorkspaceProfileRepository(Protocol):
    def list_all(self) -> list[WorkspaceProfile]:
        ...

    def get(self, profile_id: str) -> WorkspaceProfile | None:
        ...

    def find_by_name_ci(self, name: str) -> WorkspaceProfile | None:
        ...

    def add(self, name: str, snapshot: dict) -> WorkspaceProfile:
        ...

    def update(
        self,
        profile_id: str,
        *,
        name: str | None = None,
        snapshot: dict | None = None,
    ) -> WorkspaceProfile | None:
        ...

    def delete(self, profile_id: str) -> bool:
        ...
