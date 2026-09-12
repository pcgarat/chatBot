"""Helpers de ownership para APIs multi-usuario."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.models import Conversation, Rule
from app.models_user import User
from app.services.rules.seed import FLUX_PROMPT_GUIDE_RULE_ID, KREA2_POV_GUIDE_RULE_ID

_BUILTIN_RULE_IDS = frozenset({FLUX_PROMPT_GUIDE_RULE_ID, KREA2_POV_GUIDE_RULE_ID})


def owns_or_admin_legacy(user: User, owner_id: str | None) -> bool:
    if owner_id == user.id:
        return True
    # Datos previos a multi-usuario (user_id NULL): solo admin.
    return owner_id is None and bool(user.is_admin)


def require_owned_conversation(
    db: Session,
    conversation_id: str,
    user: User,
    *,
    include_deleted: bool = False,
) -> Conversation:
    conv = crud.get_conversation(
        db,
        conversation_id,
        include_deleted=include_deleted,
    )
    if not conv or not owns_or_admin_legacy(user, conv.user_id):
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return conv


def require_accessible_rule(db: Session, rule_id: str, user: User) -> Rule:
    rule = crud.get_rule(db, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    if rule.user_id is None:
        return rule  # catálogo compartido o legado
    if rule.user_id != user.id:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return rule


def require_owned_rule(db: Session, rule_id: str, user: User) -> Rule:
    """Privadas del usuario; builtins de solo lectura; legado NULL editable por admin."""
    rule = require_accessible_rule(db, rule_id, user)
    if rule.id in _BUILTIN_RULE_IDS:
        raise HTTPException(status_code=403, detail="Las reglas del catálogo no se pueden modificar")
    if rule.user_id is None:
        if not user.is_admin:
            raise HTTPException(status_code=403, detail="Las reglas del catálogo no se pueden modificar")
        return rule
    if rule.user_id != user.id:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return rule
