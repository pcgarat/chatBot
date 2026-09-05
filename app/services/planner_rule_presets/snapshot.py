"""Normaliza el snapshot de un preset de reglas. Rechaza cromo de UI."""

from __future__ import annotations

from app.services.workspace_profiles.snapshot import normalize_planner_instructions


def normalize_rule_preset_snapshot(raw: object) -> dict:
    """Devuelve `{rules: [...]}` canónico listo para persistir."""
    if isinstance(raw, list):
        rules = normalize_planner_instructions(raw)
    elif isinstance(raw, dict):
        rules = normalize_planner_instructions(raw.get("rules"))
    else:
        rules = []
    return {"rules": rules}
