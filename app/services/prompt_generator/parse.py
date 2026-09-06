"""Parseo de la respuesta estructurada del agente prompt generator."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Optional

from app.services.image_illustration.scene_planner import extract_json_object

Phase = Literal["interview", "prompt"]


@dataclass(frozen=True)
class AgentTurnParsed:
    assistant_text: str
    brief_patch: dict[str, Any]
    phase: Phase
    prompt: Optional[str]


def parse_agent_response(raw: str) -> AgentTurnParsed:
    data = extract_json_object(raw)
    if not isinstance(data, dict):
        raise ValueError("La respuesta del agente no es un objeto JSON")

    assistant_text = data.get("assistant_text")
    if not isinstance(assistant_text, str) or not assistant_text.strip():
        raise ValueError("assistant_text es obligatorio y no puede estar vacío")

    brief_patch = data.get("brief_patch", {})
    if brief_patch is None:
        brief_patch = {}
    if not isinstance(brief_patch, dict):
        raise ValueError("brief_patch debe ser un objeto")

    phase = data.get("phase")
    if phase not in ("interview", "prompt"):
        raise ValueError("phase debe ser 'interview' o 'prompt'")

    prompt_raw = data.get("prompt")
    prompt: Optional[str]
    if prompt_raw is None:
        prompt = None
    elif isinstance(prompt_raw, str):
        prompt = prompt_raw.strip() or None
    else:
        prompt = str(prompt_raw).strip() or None

    if phase == "prompt" and not prompt:
        raise ValueError("phase=prompt requiere un prompt no vacío")

    return AgentTurnParsed(
        assistant_text=assistant_text.strip(),
        brief_patch=brief_patch,
        phase=phase,
        prompt=prompt,
    )
