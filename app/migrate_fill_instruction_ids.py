"""
Migración: rellena instruction_ids desde system_instructions (legado).
Para cada conversación que tenga system_instructions con ítems con rule_id
y aún no tenga instruction_ids, extrae la lista de rule_id y la guarda en instruction_ids.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING

from app.models import Conversation

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def _parse_system_instructions(raw: str | None) -> list[dict] | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, list) else None
    except (TypeError, ValueError):
        return None


def migrate_all(db: "Session") -> int:
    """
    Para cada conversación: si instruction_ids está vacío y system_instructions tiene ítems con rule_id,
    guarda en instruction_ids la lista de esos rule_id.
    """
    count = 0
    convs = db.query(Conversation).all()
    for conv in convs:
        ids_raw = getattr(conv, "instruction_ids", None)
        if ids_raw:
            try:
                existing = json.loads(ids_raw)
                if isinstance(existing, list) and len(existing) > 0:
                    continue
            except (TypeError, ValueError):
                pass
        parsed = _parse_system_instructions(conv.system_instructions)
        if not parsed:
            continue
        rule_ids = []
        for item in parsed:
            if isinstance(item, dict) and item.get("rule_id"):
                rule_ids.append(str(item["rule_id"]))
        if rule_ids:
            conv.instruction_ids = json.dumps(rule_ids)
            db.commit()
            count += 1
    return count
