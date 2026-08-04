"""Planificador de escenas vía LLM (JSON estructurado)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app.providers.base import LLMProvider
from app.services.image_illustration.models import ScenePlan, SceneSpec

_DEFAULT_SYSTEM = """Eres un planificador de ilustraciones para un chat.
Dado el texto de una respuesta del asistente, decide si es un relato narrativo o un roleplay que merezca ilustrarse.
Si NO lo es (pregunta factual, código, charla corta, etc.), responde JSON:
{"illustrate": false, "reason": "...", "scenes": []}

Si SÍ lo es, elige hasta max_images escenas visuales y responde JSON:
{"illustrate": true, "reason": "...", "scenes": [
  {"id": "s1", "prompt": "prompt en inglés para Stable Diffusion, detallado, sin texto de UI",
   "anchor_excerpt": "fragmento EXACTO del relato tras el cual insertar la imagen",
   "paragraph_index": 0}
]}
Reglas:
- No reescribas el relato.
- anchor_excerpt debe aparecer literalmente en el texto (o déjalo vacío y usa paragraph_index).
- Devuelve SOLO JSON válido, sin markdown.
"""


def load_planner_system_prompt(config_path: Path | None = None) -> str:
    if config_path and config_path.is_file():
        return config_path.read_text(encoding="utf-8")
    default = Path(__file__).resolve().parents[3] / "config" / "image_scene_planner_system.txt"
    if default.is_file():
        return default.read_text(encoding="utf-8")
    return _DEFAULT_SYSTEM


def compose_planner_system_prompt(base: str, extra_instructions: str | None = None) -> str:
    """Une el system base del planificador con instrucciones adicionales del panel."""
    core = (base or "").rstrip()
    extra = (extra_instructions or "").strip()
    if not extra:
        return core
    if not core:
        return extra
    return f"{core}\n\n--- Instrucciones adicionales ---\n{extra}"


def extract_json_object(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if not text:
        raise ValueError("Respuesta vacía del planificador")
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return json.loads(fence.group(1))
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return json.loads(text[start : end + 1])
    raise ValueError("No se pudo parsear JSON del planificador")


def plan_from_dict(data: dict[str, Any], max_images: int) -> ScenePlan:
    illustrate = bool(data.get("illustrate"))
    reason = str(data.get("reason") or "")
    scenes_raw = data.get("scenes") or []
    scenes: list[SceneSpec] = []
    if illustrate and isinstance(scenes_raw, list):
        for i, item in enumerate(scenes_raw[: max(0, max_images)]):
            if not isinstance(item, dict):
                continue
            sid = str(item.get("id") or f"s{i + 1}")
            prompt = str(item.get("prompt") or "").strip()
            if not prompt:
                continue
            pidx = item.get("paragraph_index")
            paragraph_index = int(pidx) if pidx is not None and str(pidx).lstrip("-").isdigit() else None
            scenes.append(
                SceneSpec(
                    id=sid,
                    prompt=prompt,
                    anchor_excerpt=str(item.get("anchor_excerpt") or ""),
                    paragraph_index=paragraph_index,
                )
            )
    if illustrate and not scenes:
        return ScenePlan(illustrate=False, reason=reason or "sin escenas válidas", scenes=[])
    return ScenePlan(illustrate=illustrate and bool(scenes), reason=reason, scenes=scenes)


class LlmScenePlanner:
    def __init__(
        self,
        provider: LLMProvider,
        model: str,
        system_prompt: str | None = None,
        system_instructions: str | None = None,
        extra_body: dict[str, Any] | None = None,
    ):
        self.provider = provider
        self.model = model
        base = system_prompt if system_prompt is not None else load_planner_system_prompt()
        self.system_prompt = compose_planner_system_prompt(base, system_instructions)
        self.extra_body = extra_body
        self.last_debug: dict[str, str] | None = None

    def plan(self, text: str, max_images: int) -> ScenePlan:
        self.last_debug = None
        if max_images <= 0:
            return ScenePlan(illustrate=False, reason="max_images<=0", scenes=[])
        user = (
            f"max_images={max_images}\n\n"
            f"--- TEXTO DEL ASISTENTE ---\n{text}\n--- FIN ---"
        )
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user},
        ]
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
        }
        if self.extra_body:
            payload.update(self.extra_body)
        debug_request = json.dumps(payload, ensure_ascii=False, indent=2)
        try:
            raw = self.provider.chat(self.model, messages, extra_body=self.extra_body)
            self.last_debug = {
                "debug_request": debug_request,
                "debug_response": raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False),
            }
            data = extract_json_object(raw)
            return plan_from_dict(data, max_images)
        except (ValueError, TypeError, json.JSONDecodeError, ConnectionError, OSError) as exc:
            self.last_debug = {
                "debug_request": debug_request,
                "debug_response": json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2),
            }
            return ScenePlan(illustrate=False, reason=f"planificador falló: {exc}", scenes=[])
