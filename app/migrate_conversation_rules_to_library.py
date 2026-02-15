"""
Migración: reglas inline en system_instructions (sin rule_id) se crean en la tabla rules
y las conversaciones se actualizan para referenciarlas por rule_id.

Así todas las reglas de todas las conversaciones quedan en la biblioteca (tabla rules)
y el selector "Elegir regla" puede mostrar todas.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING

from app.crud import create_rule
from app.models import Conversation

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def _parse_system_instructions(raw: str | None) -> list[dict] | None:
    """Parsea el JSON de system_instructions a lista de dicts."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else None
    except (TypeError, ValueError):
        return None


def migrate_all(db: "Session") -> int:
    """
    Para cada conversación con system_instructions:
    - Por cada ítem que no tenga rule_id (regla inline), crea una regla en la biblioteca
      y sustituye el ítem por {rule_id, title, content}.
    - Actualiza la conversación con el nuevo JSON.

    Devuelve el número de conversaciones migradas.
    """
    count = 0
    convs = db.query(Conversation).filter(Conversation.system_instructions.isnot(None)).all()
    for conv in convs:
        parsed = _parse_system_instructions(conv.system_instructions)
        if not parsed:
            continue
        updated = False
        new_list = []
        for item in parsed:
            if isinstance(item, dict) and item.get("rule_id"):
                new_list.append(item)
                continue
            if isinstance(item, str):
                title = "Regla"
                content = item
            elif isinstance(item, dict):
                title = (item.get("title") or "").strip() or "Regla"
                content = item.get("content") or ""
            else:
                continue
            rule = create_rule(db, title=title, content=content)
            new_list.append({"rule_id": rule.id, "title": rule.title, "content": rule.content})
            updated = True
        if updated:
            conv.system_instructions = json.dumps(new_list)
            db.commit()
            count += 1
    return count
