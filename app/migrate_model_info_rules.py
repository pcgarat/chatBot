"""
Migración única: convierte user_info.instructions (list[str]) en reglas de la biblioteca
y actualiza las fichas con instruction_ids. Las instrucciones antiguas se borran del JSON.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from app import model_info
from app.crud import create_rule

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def _load_all():
    """Acceso a datos de model_info para no exponer _load_all."""
    return model_info._load_all()


def migrate_all(db: "Session") -> int:
    """
    Para cada ficha en data/model_info.json que tenga user_info.instructions (list[str])
    y no tenga instruction_ids (o esté vacío), crea una regla en la biblioteca por cada
    string y actualiza la ficha con instruction_ids, borrando instructions.

    Devuelve el número de fichas migradas.
    """
    data = _load_all()
    if not data:
        return 0
    count = 0
    for key, entry in list(data.items()):
        if ":" not in key:
            continue
        provider, model_name = key.split(":", 1)
        user = (entry.get("user_info") or {}).copy()
        instruction_ids = user.get("instruction_ids") or []
        legacy = user.get("instructions") or []
        if instruction_ids or not legacy or not isinstance(legacy, list):
            continue
        rule_ids = []
        for i, s in enumerate(legacy):
            if not isinstance(s, str):
                s = str(s)
            title = "Instrucción %d" % (i + 1)
            rule = create_rule(db, title=title, content=s)
            rule_ids.append(rule.id)
        if rule_ids:
            model_info.update_user_info(
                provider,
                model_name,
                instruction_ids=rule_ids,
                instructions=[],  # Borrar legado
            )
            count += 1
    return count
