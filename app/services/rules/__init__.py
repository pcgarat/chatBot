"""Biblioteca de reglas parametrizada por ámbito (chat | planner)."""

from app.services.rules.compose import concat_instruction_texts
from app.services.rules.models import RULE_SCOPES, SCOPE_CHAT, SCOPE_PLANNER

__all__ = [
    "RULE_SCOPES",
    "SCOPE_CHAT",
    "SCOPE_PLANNER",
    "concat_instruction_texts",
]
