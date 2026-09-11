"""Planificador de escenas vía LLM (JSON estructurado)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

from app.config import settings
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
- Si el mensaje trae «ubicación fijada», illustrate DEBE ser true y UNA sola escena. No rechaces por no-relato. NO elijas otro sitio: paragraph_index = el indicado. El excerpt o el párrafo es el momento a ilustrar. Continuidad: mismos personajes, ropa, escenario, iluminación y estilo que el relato (y que los prompts ya usados). Varía solo acción, pose, encuadre e instante. Si ya hay imagen en ese párrafo, esta va AL LADO (otro instante, no un duplicado).
- Si el mensaje trae «párrafos asignados» (sin ubicación fijada), NO elijas ubicación: escribe un prompt visual en inglés para CADA paragraph_index listado (en ese orden). El prompt debe describir la escena de ESE párrafo. anchor_excerpt puede ir vacío; paragraph_index es obligatorio y debe coincidir.
- Si NO hay párrafos asignados: elige hasta max_images escenas repartidas a lo largo del relato (puntos medios entre imágenes existentes); anchor_excerpt literal o paragraph_index.
- No concentres varias escenas al inicio ni en el mismo párrafo (salvo ubicación fijada).
- Si el mensaje trae «consistencia visual: ON»: TODAS las escenas de este JSON (y respecto a prompts ya usados) DEBEN copiar los mismos tokens de identidad: edad, cuerpo, pelo, etnia, ropa. No parafrasees. Varía solo acción, pose, encuadre e instante. Escenario e iluminación se mantienen si es la misma escena narrativa; si el relato cambia de sitio o de ropa, gana el texto.
- Si el mensaje lista prompts ya usados y consistencia visual está OFF (y NO hay ubicación fijada), NO generes escenas visualmente similares (mismo sujeto, pose, vestuario, encuadre o momento). Cada prompt nuevo debe aportar una escena distinta del relato.
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


def log_planner_exchange(debug_request: str, debug_response: str) -> None:
    """Si VERBOSE=1, vuelca a stderr request y respuesta raw del ScenePlanner."""
    if not settings.verbose:
        return
    print("--- ScenePlanner request ---", file=sys.stderr, flush=True)
    print(debug_request, file=sys.stderr, flush=True)
    print("--- ScenePlanner response ---", file=sys.stderr, flush=True)
    print(debug_response, file=sys.stderr, flush=True)
    print("--- fin ScenePlanner ---", file=sys.stderr, flush=True)


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


_PROMPT_CLIP_DIVERSITY = 220
_PROMPT_CLIP_CONSISTENCY = 900


def _clip_prompt(prompt: str, limit: int) -> str:
    text = (prompt or "").strip()
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)] + "…"


def _visual_policy_block(*, visual_consistency: bool, scene_count: int) -> str:
    """Instrucción de política: canon de identidad vs variedad de look."""
    if visual_consistency:
        lines = [
            "Consistencia visual: ON.",
            "Canon (bloqueado): personajes, edad, cuerpo, pelo, etnia y ropa. "
            "Copia los mismos tokens en TODAS las escenas de este JSON; no los parafrasees.",
            "Libre: pose, acción, instante y encuadre. No dupliques el mismo plano.",
            "Si el relato cambia de ropa o de lugar, gana el texto.",
        ]
        if scene_count > 1:
            lines.append(
                "Este lote pide varias escenas: la ficha de identidad debe ser idéntica en cada prompt."
            )
        return "\n".join(lines) + "\n\n"
    return (
        "Consistencia visual: OFF.\n"
        "Prioriza variedad de escena; no clones la misma toma.\n\n"
    )


def _existing_prompts_lines(
    prompts: list[str],
    *,
    visual_consistency: bool,
) -> list[str]:
    if not prompts:
        return []
    limit = _PROMPT_CLIP_CONSISTENCY if visual_consistency else _PROMPT_CLIP_DIVERSITY
    if visual_consistency:
        header = (
            "Prompts visuales YA usados. Son el canon de identidad. "
            "Reutiliza edad, cuerpo, pelo, ropa y (si es el mismo sitio) escenario/luz. "
            "Cambia momento, pose y encuadre:"
        )
    else:
        header = (
            "Prompts visuales YA usados. NO generes imágenes similares "
            "(mismo sujeto, pose, encuadre, vestuario o escena casi igual). "
            "Varía momento narrativo, composición y detalles:"
        )
    lines = [header]
    for p in prompts:
        lines.append(f'- "{_clip_prompt(p, limit)}"')
    return lines


def _already_planned_block(
    already_planned: list[SceneSpec] | None,
    *,
    existing_prompts: list[str] | None = None,
    visual_consistency: bool = True,
) -> str:
    scenes = already_planned or []
    prompts = [p.strip() for p in (existing_prompts or []) if (p or "").strip()]
    for s in scenes:
        p = (s.prompt or "").strip()
        if p and p not in prompts:
            prompts.append(p)
    if not scenes and not prompts:
        return ""

    lines: list[str] = []
    if scenes:
        lines.append(
            f"Ya hay {len(scenes)} ubicaciones con ilustración; "
            "NO reutilices las mismas anclas ni el mismo párrafo."
        )
        for s in scenes:
            excerpt = (s.anchor_excerpt or "").strip()
            if excerpt:
                lines.append(f'- id={s.id} anchor_excerpt="{excerpt[:160]}"')
            elif s.paragraph_index is not None:
                lines.append(f"- id={s.id} paragraph_index={s.paragraph_index}")
            else:
                lines.append(f"- id={s.id}")
    lines.extend(
        _existing_prompts_lines(prompts, visual_consistency=visual_consistency)
    )
    return "\n".join(lines) + "\n\n"


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


def _pinned_location_block(
    paragraphs: list[ParagraphInfo],
    *,
    focus_excerpt: str | None = None,
    existing_prompts: list[str] | None = None,
    visual_consistency: bool = True,
) -> str:
    """Instrucciones cuando el usuario elige el párrafo (y opcionalmente un excerpt)."""
    para = paragraphs[0] if paragraphs else None
    idx = para.index if para is not None else 0
    preview = (para.text if para else "").replace("\n", " ").strip()
    if len(preview) > 280:
        preview = preview[:279] + "…"
    excerpt = (focus_excerpt or "").strip()
    lines = [
        "Ubicación fijada por el usuario.",
        "illustrate DEBE ser true. UNA sola escena. NO rechaces el texto. "
        "NO elijas otro párrafo.",
        f"paragraph_index={idx} (obligatorio).",
        f'Párrafo: "{preview}"' if preview else f"Párrafo {idx}.",
    ]
    if visual_consistency:
        lines.extend(
            [
                "Continuidad visual con TODO el relato: mismos personajes, ropa, "
                "escenario, iluminación y estilo. El foco es este momento; varía "
                "acción, pose y encuadre.",
                "Si este párrafo ya tiene imagen(es), esta va AL LADO: mismo entorno, "
                "otro instante o ángulo, no un duplicado.",
            ]
        )
    else:
        lines.extend(
            [
                "Ilustra este momento. Varía pose y encuadre respecto a imágenes previas.",
                "Si este párrafo ya tiene imagen(es), esta va AL LADO: otro instante "
                "o ángulo, no un duplicado.",
            ]
        )
    if excerpt:
        clipped = excerpt if len(excerpt) <= 240 else excerpt[:239] + "…"
        lines.append(f'Foco (texto seleccionado): "{clipped}"')
    prompts = [p.strip() for p in (existing_prompts or []) if (p or "").strip()]
    if prompts:
        lines.extend(
            _existing_prompts_lines(prompts, visual_consistency=visual_consistency)
        )
    lines.append(
        "En el JSON: illustrate=true, una scene con ese paragraph_index y un prompt."
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
        existing_prompts: list[str] | None = None,
        pinned: bool = False,
        focus_excerpt: str | None = None,
        visual_consistency: bool = True,
        selection_instructions: str | None = None,
    ) -> ScenePlan:
        self.last_debug = None
        assigned = list(assigned_paragraphs or [])
        limit = 1 if pinned else (len(assigned) if assigned else max_images)
        if limit <= 0:
            return ScenePlan(illustrate=False, reason="max_images<=0", scenes=[])
        policy_block = _visual_policy_block(
            visual_consistency=visual_consistency, scene_count=limit
        )
        if pinned:
            already_block = ""
            assigned_section = _pinned_location_block(
                assigned,
                focus_excerpt=focus_excerpt,
                existing_prompts=existing_prompts,
                visual_consistency=visual_consistency,
            )
            strategy_section = ""
        else:
            already_block = _already_planned_block(
                already_planned,
                existing_prompts=existing_prompts,
                visual_consistency=visual_consistency,
            )
            assigned_section = _assigned_paragraphs_block(assigned) if assigned else ""
            strategy_extra = (selection_instructions or "").strip()
            strategy_section = f"{strategy_extra}\n\n" if strategy_extra else ""
        coverage = (coverage_block or "").strip()
        coverage_section = "" if pinned else (f"{coverage}\n" if coverage else "")
        user = (
            f"max_images={limit}\n\n"
            f"{policy_block}"
            f"{strategy_section}"
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
        logged = False
        try:
            raw = self.provider.chat(self.model, messages, extra_body=self.extra_body)
            debug_response = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False)
            self.last_debug = {
                "debug_request": debug_request,
                "debug_response": debug_response,
            }
            log_planner_exchange(debug_request, debug_response)
            logged = True
            data = extract_json_object(raw)
            plan = plan_from_dict(data, limit)
            if pinned:
                scenes = plan.scenes or []
                if not scenes:
                    forced = plan_from_dict({**data, "illustrate": True}, limit)
                    scenes = forced.scenes or []
                if assigned:
                    bound = bind_scenes_to_paragraphs(scenes, assigned)
                    if bound:
                        return ScenePlan(
                            illustrate=True,
                            reason=plan.reason or "ubicación fijada",
                            scenes=bound[:1],
                        )
                if scenes and (scenes[0].prompt or "").strip():
                    return ScenePlan(
                        illustrate=True,
                        reason=plan.reason or "ubicación fijada",
                        scenes=scenes[:1],
                    )
                return ScenePlan(
                    illustrate=False,
                    reason=plan.reason or "sin prompt para la ubicación fijada",
                    scenes=[],
                )
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
            error_response = json.dumps({"error": str(exc)}, ensure_ascii=False, indent=2)
            if not logged:
                log_planner_exchange(debug_request, error_response)
            self.last_debug = {
                "debug_request": debug_request,
                "debug_response": error_response,
            }
            return ScenePlan(illustrate=False, reason=f"planificador falló: {exc}", scenes=[])
