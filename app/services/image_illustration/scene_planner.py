"""Planificador de escenas vía LLM (JSON estructurado)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app.providers.base import LLMProvider
from app.services.image_illustration.coverage import (
    ParagraphInfo,
    bind_scenes_to_paragraphs,
)
from app.services.image_illustration.models import ScenePlan, SceneSpec

_DEFAULT_SYSTEM = """Eres un planificador de ilustraciones para un chat.
Dado el texto de una respuesta del asistente, decide si es un relato narrativo o un roleplay que merezca ilustrarse.
Si NO lo es (pregunta factual, código, charla corta, etc.), responde JSON:
{"illustrate": false, "reason": "...", "scenes": []}

Si SÍ lo es, responde JSON:
{"illustrate": true, "reason": "...", "scenes": [
  {"id": "s1", "prompt": "prompt en inglés para Stable Diffusion, detallado, sin texto de UI",
   "anchor_excerpt": "fragmento EXACTO del relato tras el cual insertar la imagen",
   "paragraph_index": 0}
]}
Reglas:
- No reescribas el relato.
- Devuelve SOLO JSON válido, sin markdown.
- Si el mensaje trae «párrafos asignados», NO elijas ubicación: escribe un prompt visual en inglés para CADA paragraph_index listado (en ese orden). El prompt debe describir la escena de ESE párrafo. anchor_excerpt puede ir vacío; paragraph_index es obligatorio y debe coincidir.
- Si NO hay párrafos asignados: elige hasta max_images escenas, distribuidas, priorizando párrafos sin imagen; anchor_excerpt literal o paragraph_index.
- No concentres varias escenas al inicio ni en el mismo párrafo.
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


def _already_planned_block(already_planned: list[SceneSpec] | None) -> str:
    scenes = already_planned or []
    if not scenes:
        return ""
    lines: list[str] = []
    for s in scenes:
        excerpt = (s.anchor_excerpt or "").strip()
        if excerpt:
            lines.append(f'- id={s.id} anchor_excerpt="{excerpt[:160]}"')
        elif s.paragraph_index is not None:
            lines.append(f"- id={s.id} paragraph_index={s.paragraph_index}")
        else:
            lines.append(f"- id={s.id}")
    return (
        f"Ya hay {len(scenes)} escenas planificadas; NO las repitas ni reutilices las mismas anclas. "
        "Elige solo escenas NUEVAS en otras partes del relato.\n"
        + "\n".join(lines)
        + "\n\n"
    )


def _assigned_paragraphs_block(paragraphs: list[ParagraphInfo]) -> str:
    lines = [
        f"Párrafos asignados ({len(paragraphs)}). "
        "NO elijas ubicación: escribe un prompt visual en inglés para CADA uno. "
        "El prompt debe describir la escena concreta de ese párrafo.",
    ]
    for para in paragraphs:
        preview = para.text.replace("\n", " ").strip()
        if len(preview) > 280:
            preview = preview[:279] + "…"
        lines.append(f'- paragraph_index={para.index}: "{preview}"')
    lines.append(
        "En el JSON, cada scene debe llevar el paragraph_index correspondiente "
        "y un prompt; anchor_excerpt puede ir vacío."
    )
    return "\n".join(lines) + "\n\n"


def filter_duplicate_planned_scenes(
    scenes: list[SceneSpec],
    already_planned: list[SceneSpec] | None,
) -> list[SceneSpec]:
    """Quita escenas cuya ancla o párrafo ya estaba cubierto en lotes previos."""
    prior = already_planned or []
    used_excerpts = {
        (s.anchor_excerpt or "").strip().lower()
        for s in prior
        if (s.anchor_excerpt or "").strip()
    }
    used_paras = {s.paragraph_index for s in prior if s.paragraph_index is not None}
    out: list[SceneSpec] = []
    seen_excerpts: set[str] = set()
    for s in scenes:
        excerpt = (s.anchor_excerpt or "").strip()
        key = excerpt.lower()
        if key and (key in used_excerpts or key in seen_excerpts):
            continue
        # Sin excerpt: el paragraph_index es la única ancla → no repetir párrafo ocupado.
        if not key and s.paragraph_index is not None and s.paragraph_index in used_paras:
            continue
        if key:
            seen_excerpts.add(key)
        out.append(s)
    return out


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

    def plan(
        self,
        text: str,
        max_images: int,
        already_planned: list[SceneSpec] | None = None,
        coverage_block: str | None = None,
        assigned_paragraphs: list[ParagraphInfo] | None = None,
    ) -> ScenePlan:
        self.last_debug = None
        assigned = list(assigned_paragraphs or [])
        limit = len(assigned) if assigned else max_images
        if limit <= 0:
            return ScenePlan(illustrate=False, reason="max_images<=0", scenes=[])
        already_block = _already_planned_block(already_planned)
        coverage = (coverage_block or "").strip()
        coverage_section = f"{coverage}\n" if coverage else ""
        assigned_section = _assigned_paragraphs_block(assigned) if assigned else ""
        user = (
            f"max_images={limit}\n\n"
            f"{assigned_section}"
            f"{coverage_section}"
            f"{already_block}"
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
            plan = plan_from_dict(data, limit)
            if plan.illustrate and plan.scenes and assigned:
                bound = bind_scenes_to_paragraphs(plan.scenes, assigned)
                if not bound:
                    return ScenePlan(
                        illustrate=False,
                        reason=plan.reason or "sin prompts para párrafos asignados",
                        scenes=[],
                    )
                plan = ScenePlan(illustrate=True, reason=plan.reason, scenes=bound)
            elif plan.scenes:
                filtered = filter_duplicate_planned_scenes(plan.scenes, already_planned)
                if not filtered:
                    return ScenePlan(
                        illustrate=False,
                        reason=plan.reason or "escenas duplicadas del lote previo",
                        scenes=[],
                    )
                plan = ScenePlan(illustrate=True, reason=plan.reason, scenes=filtered)
            return plan
        except (ValueError, TypeError, json.JSONDecodeError, ConnectionError, OSError) as exc:
            self.last_debug = {
                "debug_request": debug_request,
                "debug_response": json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2),
            }
            return ScenePlan(illustrate=False, reason=f"planificador falló: {exc}", scenes=[])
