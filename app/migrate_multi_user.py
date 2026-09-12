"""Bootstrap multi-usuario: admin + asignación de datos legacy."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.auth import ensure_admin_user
from app.models import Conversation, PlannerRulePresetRecord, Rule, WorkspaceProfileRecord
from app.services.rules.seed import FLUX_PROMPT_GUIDE_RULE_ID, KREA2_POV_GUIDE_RULE_ID

_BUILTIN_RULE_IDS = {FLUX_PROMPT_GUIDE_RULE_ID, KREA2_POV_GUIDE_RULE_ID}


def bootstrap_multi_user(db: Session) -> str:
    """
    Asegura el usuario admin y asigna a ese usuario todo lo que aún no tenga owner.
    Las reglas builtin quedan con user_id NULL (catálogo compartido).
    Devuelve el id del admin.
    """
    admin = ensure_admin_user(db)
    admin_id = admin.id

    db.query(Conversation).filter(Conversation.user_id.is_(None)).update(
        {Conversation.user_id: admin_id},
        synchronize_session=False,
    )
    db.query(Rule).filter(
        Rule.user_id.is_(None),
        ~Rule.id.in_(_BUILTIN_RULE_IDS),
    ).update({Rule.user_id: admin_id}, synchronize_session=False)
    db.query(WorkspaceProfileRecord).filter(WorkspaceProfileRecord.user_id.is_(None)).update(
        {WorkspaceProfileRecord.user_id: admin_id},
        synchronize_session=False,
    )
    db.query(PlannerRulePresetRecord).filter(PlannerRulePresetRecord.user_id.is_(None)).update(
        {PlannerRulePresetRecord.user_id: admin_id},
        synchronize_session=False,
    )
    db.commit()
    return admin_id
