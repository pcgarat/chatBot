"""API de perfiles de workspace (rig completo: modelo, reglas, params, imágenes)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import WorkspaceProfileCreate, WorkspaceProfileOut, WorkspaceProfileUpdate
from app.services.workspace_profiles.service import (
    ProfileNameConflict,
    WorkspaceProfileService,
)
from app.services.workspace_profiles.snapshot import SnapshotValidationError
from app.services.workspace_profiles.storage import SqlAlchemyWorkspaceProfileRepository

router = APIRouter(prefix="/api/workspace-profiles", tags=["workspace-profiles"])


def get_profile_service(db: Session = Depends(get_db)) -> WorkspaceProfileService:
    return WorkspaceProfileService(SqlAlchemyWorkspaceProfileRepository(db))


def _to_out(profile) -> WorkspaceProfileOut:
    return WorkspaceProfileOut(
        id=profile.id,
        name=profile.name,
        snapshot=profile.snapshot,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("", response_model=list[WorkspaceProfileOut])
def list_profiles(service: WorkspaceProfileService = Depends(get_profile_service)):
    return [_to_out(p) for p in service.list_profiles()]


@router.get("/{profile_id}", response_model=WorkspaceProfileOut)
def get_profile(profile_id: str, service: WorkspaceProfileService = Depends(get_profile_service)):
    profile = service.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return _to_out(profile)


@router.post("", response_model=WorkspaceProfileOut, status_code=201)
def create_profile(
    body: WorkspaceProfileCreate,
    service: WorkspaceProfileService = Depends(get_profile_service),
):
    try:
        snapshot = body.snapshot.model_dump()
        profile = service.create_profile(body.name, snapshot)
    except SnapshotValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ProfileNameConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _to_out(profile)


@router.put("/{profile_id}", response_model=WorkspaceProfileOut)
def update_profile(
    profile_id: str,
    body: WorkspaceProfileUpdate,
    service: WorkspaceProfileService = Depends(get_profile_service),
):
    try:
        snapshot = body.snapshot.model_dump() if body.snapshot is not None else None
        profile = service.update_profile(profile_id, name=body.name, snapshot=snapshot)
    except SnapshotValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ProfileNameConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return _to_out(profile)


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: str, service: WorkspaceProfileService = Depends(get_profile_service)):
    if not service.delete_profile(profile_id):
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return None
