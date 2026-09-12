"""API de presets de reglas del planificador."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import CurrentUser
from app.db import get_db
from app.schemas import (
    PlannerRulePresetCreate,
    PlannerRulePresetOut,
    PlannerRulePresetUpdate,
)
from app.services.planner_rule_presets.service import (
    PlannerRulePresetService,
    PresetNameConflict,
)
from app.services.planner_rule_presets.storage import SqlAlchemyPlannerRulePresetRepository
from app.services.workspace_profiles.snapshot import SnapshotValidationError

router = APIRouter(prefix="/api/planner-rule-presets", tags=["planner-rule-presets"])


def get_preset_service(
    user: CurrentUser, db: Session = Depends(get_db)
) -> PlannerRulePresetService:
    return PlannerRulePresetService(
        SqlAlchemyPlannerRulePresetRepository(db, user_id=user.id)
    )


def _to_out(preset) -> PlannerRulePresetOut:
    return PlannerRulePresetOut(
        id=preset.id,
        name=preset.name,
        snapshot=preset.snapshot,
        created_at=preset.created_at,
        updated_at=preset.updated_at,
    )


@router.get("", response_model=list[PlannerRulePresetOut])
def list_presets(service: PlannerRulePresetService = Depends(get_preset_service)):
    return [_to_out(p) for p in service.list_presets()]


@router.get("/{preset_id}", response_model=PlannerRulePresetOut)
def get_preset(preset_id: str, service: PlannerRulePresetService = Depends(get_preset_service)):
    preset = service.get_preset(preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset no encontrado")
    return _to_out(preset)


@router.post("", response_model=PlannerRulePresetOut, status_code=201)
def create_preset(
    body: PlannerRulePresetCreate,
    service: PlannerRulePresetService = Depends(get_preset_service),
):
    try:
        snapshot = body.snapshot.model_dump()
        preset = service.create_preset(body.name, snapshot)
    except SnapshotValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PresetNameConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _to_out(preset)


@router.put("/{preset_id}", response_model=PlannerRulePresetOut)
def update_preset(
    preset_id: str,
    body: PlannerRulePresetUpdate,
    service: PlannerRulePresetService = Depends(get_preset_service),
):
    try:
        snapshot = body.snapshot.model_dump() if body.snapshot is not None else None
        preset = service.update_preset(preset_id, name=body.name, snapshot=snapshot)
    except SnapshotValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PresetNameConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not preset:
        raise HTTPException(status_code=404, detail="Preset no encontrado")
    return _to_out(preset)


@router.delete("/{preset_id}", status_code=204)
def delete_preset(preset_id: str, service: PlannerRulePresetService = Depends(get_preset_service)):
    if not service.delete_preset(preset_id):
        raise HTTPException(status_code=404, detail="Preset no encontrado")
    return None
