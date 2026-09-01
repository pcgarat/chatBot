"""Reglas builtin de la biblioteca (idempotentes, no pisan ediciones)."""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Rule
from app.services.rules.models import SCOPE_PLANNER

logger = logging.getLogger(__name__)

FLUX_PROMPT_GUIDE_RULE_ID = "a8f3c2e1-4b5d-4e6a-9c1f-7d2e8b0a4f31"
FLUX_PROMPT_GUIDE_TITLE = "Guía prompts FLUX"
KREA2_POV_GUIDE_RULE_ID = "2263d058-31a1-4249-81c2-bad16367b43b"
KREA2_POV_GUIDE_TITLE = "Guía Krea 2 POV"

_SEED_DIR = Path(__file__).resolve().parents[3] / "config" / "seed"
FLUX_PROMPT_GUIDE_PATH = _SEED_DIR / "planner_flux_prompts.md"
KREA2_POV_GUIDE_PATH = _SEED_DIR / "planner_krea2_pov_prompts.md"

_BUILTIN_PLANNER_RULES = (
    (FLUX_PROMPT_GUIDE_RULE_ID, FLUX_PROMPT_GUIDE_TITLE, FLUX_PROMPT_GUIDE_PATH),
    (KREA2_POV_GUIDE_RULE_ID, KREA2_POV_GUIDE_TITLE, KREA2_POV_GUIDE_PATH),
)


def seed_builtin_rules(db: Session) -> int:
    """Crea reglas builtin que aún no existen. No actualiza contenido ya presente."""
    created = 0
    for rule_id, title, path in _BUILTIN_PLANNER_RULES:
        created += ensure_rule_from_file(
            db,
            rule_id=rule_id,
            title=title,
            path=path,
            scope=SCOPE_PLANNER,
        )
    return created


def ensure_rule_from_file(
    db: Session,
    *,
    rule_id: str,
    title: str,
    path: Path,
    scope: str,
) -> int:
    """Inserta una regla si falta el id. 1 si creó, 0 si ya estaba o no hay fichero."""
    existing = db.query(Rule).filter(Rule.id == rule_id).first()
    if existing is not None:
        return 0
    if not path.is_file():
        logger.warning("Seed de regla omitido: no existe %s", path)
        return 0
    content = path.read_text(encoding="utf-8").strip()
    if not content:
        logger.warning("Seed de regla omitido: fichero vacío %s", path)
        return 0
    db.add(Rule(id=rule_id, title=title, content=content, scope=scope))
    db.commit()
    return 1
