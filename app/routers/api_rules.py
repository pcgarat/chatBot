"""API CRUD para la biblioteca de reglas.

Una sola entidad Rule (tabla rules) con scope: chat | planner.
GET /rules?scope=chat (default) lista la biblioteca del panel Reglas.
GET /rules?scope=planner lista la del planificador de imágenes.
Las conversaciones guardan instruction_ids hacia reglas scope=chat.
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import create_rule as crud_create_rule
from app.crud import delete_rule as crud_delete_rule
from app.crud import get_rule as crud_get_rule
from app.crud import list_rules as crud_list_rules
from app.crud import update_rule as crud_update_rule
from app.db import get_db
from app.schemas import RuleCreate, RuleOut, RuleUpdate
from app.services.rules.models import SCOPE_CHAT

router = APIRouter(prefix="/api", tags=["rules"])


@router.get("/rules", response_model=list[RuleOut])
def list_rules(
    scope: Literal["chat", "planner"] = SCOPE_CHAT,
    db: Session = Depends(get_db),
):
    """Lista las reglas de un ámbito. Default: chat (biblioteca del panel Reglas)."""
    return crud_list_rules(db, scope=scope)


@router.get("/rules/{rule_id}", response_model=RuleOut)
def get_rule(rule_id: str, db: Session = Depends(get_db)):
    """Obtiene una regla por id."""
    rule = crud_get_rule(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return rule


@router.post("/rules", response_model=RuleOut, status_code=201)
def create_rule(body: RuleCreate, db: Session = Depends(get_db)):
    """Crea una regla en la biblioteca."""
    rule = crud_create_rule(db, title=body.title, content=body.content, scope=body.scope)
    return rule


@router.put("/rules/{rule_id}", response_model=RuleOut)
def update_rule(rule_id: str, body: RuleUpdate, db: Session = Depends(get_db)):
    """Actualiza una regla (solo los campos enviados)."""
    rule = crud_update_rule(
        db, rule_id,
        title=body.title,
        content=body.content,
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    """Elimina una regla de la biblioteca."""
    if not crud_delete_rule(db, rule_id):
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return None
