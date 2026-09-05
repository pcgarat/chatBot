"""Entidad de preset de reglas del planificador."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class PlannerRulePreset:
    """Conjunto nombrado de reglas del planificador."""

    id: str
    name: str
    snapshot: dict
    created_at: datetime
    updated_at: datetime
