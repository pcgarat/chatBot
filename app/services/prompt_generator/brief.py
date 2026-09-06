"""Brief tipado FLUX para el flujo prompt generator."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, fields
from typing import Any, Optional

SLOT_KEYS = (
    "prompt_language",
    "image_type_subject",
    "action_pose_expression",
    "environment",
    "composition_framing_angle",
    "lighting",
    "visual_style",
    "materials_color_atmosphere",
    "visible_text",
)

_FORCE_PATTERNS = (
    re.compile(r"\bgenera\s+ya\b", re.IGNORECASE),
    re.compile(r"\bgen[eé]ralo\s+ya\b", re.IGNORECASE),
    re.compile(r"\bgenerate\s+now\b", re.IGNORECASE),
)


@dataclass
class PromptBrief:
    prompt_language: Optional[str] = None
    image_type_subject: Optional[str] = None
    action_pose_expression: Optional[str] = None
    environment: Optional[str] = None
    composition_framing_angle: Optional[str] = None
    lighting: Optional[str] = None
    visual_style: Optional[str] = None
    materials_color_atmosphere: Optional[str] = None
    visible_text: Optional[str] = None
    force_generate: bool = False
    latest_prompt: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Optional[dict[str, Any]]) -> "PromptBrief":
        if not data:
            return empty_brief()
        known = {f.name for f in fields(cls)}
        kwargs: dict[str, Any] = {}
        for key, value in data.items():
            if key not in known:
                continue
            if key == "force_generate":
                kwargs[key] = bool(value)
            elif value is None:
                kwargs[key] = None
            else:
                kwargs[key] = value if isinstance(value, str) else str(value)
        return cls(**kwargs)

    def merge(self, patch: dict[str, Any]) -> "PromptBrief":
        """Aplica patch: ignora claves desconocidas; None no sobrescribe; "" sí limpia."""
        current = self.to_dict()
        for key, value in (patch or {}).items():
            if key not in current:
                continue
            if value is None:
                continue
            if key == "force_generate":
                current[key] = bool(value)
            elif isinstance(value, str):
                current[key] = value
            else:
                current[key] = str(value)
        return PromptBrief.from_dict(current)


def empty_brief() -> PromptBrief:
    return PromptBrief()


def detect_force(text: str) -> bool:
    """True si el usuario pide generar el prompt ya."""
    raw = (text or "").strip()
    if not raw:
        return False
    return any(p.search(raw) for p in _FORCE_PATTERNS)
