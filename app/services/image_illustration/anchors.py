"""Inserción de marcadores de imagen sin reescribir el relato."""

from __future__ import annotations

import re

from app.services.image_illustration.models import ScenePlan, SceneSpec

MARKER_TEMPLATE = "⟦img:{id}⟧"

_ILLUSTRATION_ARTIFACT_RE = re.compile(
    r'<img\b[^>]*class="[^"]*chat-illustration[^"]*"[^>]*/?>'
    r'|<span\b[^>]*class="[^"]*chat-illustration-(?:error|placeholder)[^"]*"[^>]*>[\s\S]*?</span>'
    r"|⟦img:[^⟧]+⟧",
    re.IGNORECASE,
)

_TRANSIENT_ARTIFACT_RE = re.compile(
    r'<span\b[^>]*class="[^"]*chat-illustration-placeholder[^"]*"[^>]*>[\s\S]*?</span>'
    r"|⟦img:[^⟧]+⟧",
    re.IGNORECASE,
)

_USED_SCENE_ID_RE = re.compile(
    r'data-scene="([^"]+)"'
    r'|⟦img:([^⟧]+)⟧'
    r'|alt="escena\s+([^"]+)"',
    re.IGNORECASE,
)


def marker_for(scene_id: str) -> str:
    return MARKER_TEMPLATE.format(id=scene_id)


def strip_illustration_artifacts(text: str) -> str:
    """Quita imgs/errores/marcadores previos (texto limpio para el planificador)."""
    cleaned = _ILLUSTRATION_ARTIFACT_RE.sub("", text or "")
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def strip_transient_illustration_artifacts(text: str) -> str:
    """Quita placeholders y marcadores; conserva imágenes y errores ya insertados."""
    cleaned = _TRANSIENT_ARTIFACT_RE.sub("", text or "")
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def collect_used_scene_ids(text: str) -> set[str]:
    used: set[str] = set()
    for match in _USED_SCENE_ID_RE.finditer(text or ""):
        for group in match.groups():
            if group:
                used.add(group.strip())
    return used


def allocate_unique_scene_ids(used: set[str], count: int) -> list[str]:
    """Devuelve `count` ids sN que no estén en `used`."""
    out: list[str] = []
    occupied = set(used)
    i = 1
    while len(out) < max(0, count):
        sid = f"s{i}"
        if sid not in occupied:
            out.append(sid)
            occupied.add(sid)
        i += 1
    return out


def remap_scene_ids(scenes: list[SceneSpec], new_ids: list[str]) -> list[SceneSpec]:
    remapped: list[SceneSpec] = []
    for i, scene in enumerate(scenes):
        sid = new_ids[i] if i < len(new_ids) else scene.id
        remapped.append(
            SceneSpec(
                id=sid,
                prompt=scene.prompt,
                anchor_excerpt=scene.anchor_excerpt,
                paragraph_index=scene.paragraph_index,
            )
        )
    return remapped


def with_unique_scene_ids(plan: ScenePlan, content: str) -> ScenePlan:
    """Asigna ids únicos respecto al content (para acumular ilustraciones)."""
    if not plan.scenes:
        return plan
    used = collect_used_scene_ids(content)
    new_ids = allocate_unique_scene_ids(used, len(plan.scenes))
    return ScenePlan(
        illustrate=plan.illustrate,
        reason=plan.reason,
        scenes=remap_scene_ids(plan.scenes, new_ids),
    )


def insert_scene_markers(text: str, scenes: list[SceneSpec]) -> str:
    """
    Inserta marcadores tras cada ancla. No modifica el texto del relato:
    solo concatena el marcador en la posición elegida.
    Prioridad: anchor_excerpt (primera ocurrencia) → paragraph_index → final.
    """
    if not scenes:
        return text
    result = text
    # Insertar de atrás hacia adelante para no invalidar offsets
    placements: list[tuple[int, str]] = []
    for scene in scenes:
        mark = marker_for(scene.id)
        idx = _resolve_insert_index(result, scene)
        placements.append((idx, mark))
    placements.sort(key=lambda t: t[0], reverse=True)
    for idx, mark in placements:
        # Evitar duplicar si ya está
        if mark in result:
            continue
        result = result[:idx] + f"\n{mark}\n" + result[idx:]
    return result


def _resolve_insert_index(text: str, scene: SceneSpec) -> int:
    excerpt = (scene.anchor_excerpt or "").strip()
    if excerpt:
        pos = text.find(excerpt)
        if pos >= 0:
            return pos + len(excerpt)
    if scene.paragraph_index is not None:
        paragraphs = text.split("\n\n")
        if 0 <= scene.paragraph_index < len(paragraphs):
            # índice al final del párrafo N dentro del texto original
            # reconstruir offset
            offset = 0
            for i, para in enumerate(paragraphs):
                end = offset + len(para)
                if i == scene.paragraph_index:
                    return end
                offset = end + 2  # \n\n
    return len(text)


def replace_marker_with(content: str, scene_id: str, replacement: str) -> str:
    mark = marker_for(scene_id)
    return content.replace(mark, replacement)
