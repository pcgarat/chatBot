"""Cobertura de ilustraciones por párrafo y redistribución a huecos."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.image_illustration.anchors import _ILLUSTRATION_ARTIFACT_RE as ILLUSTRATION_ARTIFACT_RE
from app.services.image_illustration.models import SceneSpec

_ILLUS_TOKEN = "⟦ILLUS⟧"


@dataclass(frozen=True)
class ParagraphInfo:
    """Párrafo del relato limpio y cuántas ilustraciones tiene detrás."""

    index: int
    text: str
    illustration_count: int


@dataclass(frozen=True)
class CoverageMap:
    """Mapa de cobertura de imágenes a lo largo del relato."""

    paragraphs: list[ParagraphInfo]

    @property
    def uncovered_indices(self) -> list[int]:
        return [p.index for p in self.paragraphs if p.illustration_count == 0]

    def occupied_indices(self) -> set[int]:
        return {p.index for p in self.paragraphs if p.illustration_count > 0}


def analyze_coverage(content: str) -> CoverageMap:
    """
    Detecta, por párrafo del relato, cuántas imágenes/anclas hay asociadas.
    Las ilustraciones entre párrafos se atribuyen al párrafo anterior.
    """
    marked = ILLUSTRATION_ARTIFACT_RE.sub(_ILLUS_TOKEN, content or "")
    raw_paras = re.split(r"\n\s*\n", marked)
    paragraphs: list[ParagraphInfo] = []
    idx = 0
    for raw in raw_paras:
        count = raw.count(_ILLUS_TOKEN)
        text = raw.replace(_ILLUS_TOKEN, "")
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if not text:
            if count and paragraphs:
                prev = paragraphs[-1]
                paragraphs[-1] = ParagraphInfo(
                    prev.index, prev.text, prev.illustration_count + count
                )
            continue
        paragraphs.append(ParagraphInfo(index=idx, text=text, illustration_count=count))
        idx += 1
    return CoverageMap(paragraphs=paragraphs)


def occupied_scenes_from_coverage(coverage: CoverageMap) -> list[SceneSpec]:
    """Pseudo-escenas para que el planificador/filtro evite párrafos ya ilustrados."""
    out: list[SceneSpec] = []
    for para in coverage.paragraphs:
        if para.illustration_count <= 0:
            continue
        out.append(
            SceneSpec(
                id=f"existing-p{para.index}",
                prompt="",
                anchor_excerpt=tail_excerpt(para.text),
                paragraph_index=para.index,
            )
        )
    return out


def bind_scenes_to_paragraphs(
    scenes: list[SceneSpec],
    paragraphs: list[ParagraphInfo],
) -> list[SceneSpec]:
    """
    Fija cada prompt a un párrafo asignado: paragraph_index + anchor_excerpt del párrafo.
    Empareja por paragraph_index cuando viene del LLM; si no, por orden.
    """
    if not paragraphs:
        return []
    usable = [s for s in scenes if (s.prompt or "").strip()]
    by_idx: dict[int, SceneSpec] = {}
    for scene in usable:
        if scene.paragraph_index is not None and scene.paragraph_index not in by_idx:
            by_idx[scene.paragraph_index] = scene
    used_ids = {id(s) for s in by_idx.values()}
    remaining = [s for s in usable if id(s) not in used_ids]
    ri = 0
    out: list[SceneSpec] = []
    for para in paragraphs:
        scene = by_idx.get(para.index)
        if scene is None:
            if ri >= len(remaining):
                continue
            scene = remaining[ri]
            ri += 1
        out.append(
            SceneSpec(
                id=scene.id,
                prompt=scene.prompt.strip(),
                anchor_excerpt=tail_excerpt(para.text),
                paragraph_index=para.index,
            )
        )
    return out


def suggest_distributed_targets(
    coverage: CoverageMap,
    count: int,
    *,
    also_avoid: set[int] | None = None,
) -> list[int]:
    """
    Elige hasta `count` índices de párrafo repartidos por el relato.
    Prioriza sin imagen; si no hay huecos, usa los menos cubiertos.
    Nunca reutiliza índices en `also_avoid` (p. ej. ya usados en este lote/run).
    """
    avoid = set(also_avoid or ())
    uncovered = [
        p.index
        for p in coverage.paragraphs
        if p.illustration_count == 0 and p.index not in avoid
    ]
    pool = list(uncovered)
    if len(pool) < count:
        rest = sorted(
            (
                p
                for p in coverage.paragraphs
                if p.index not in avoid and p.index not in pool
            ),
            key=lambda p: (p.illustration_count, p.index),
        )
        for p in rest:
            pool.append(p.index)
            if len(pool) >= max(count, 1):
                break
    if not pool:
        return []
    return _evenly_pick(pool, count)


def resolve_paragraph_index(scene: SceneSpec, coverage: CoverageMap) -> int | None:
    """Párrafo donde caería la escena según paragraph_index o anchor_excerpt."""
    if not coverage.paragraphs:
        return None
    if scene.paragraph_index is not None:
        if 0 <= scene.paragraph_index < len(coverage.paragraphs):
            return scene.paragraph_index
    excerpt = (scene.anchor_excerpt or "").strip()
    if excerpt:
        for para in coverage.paragraphs:
            if excerpt in para.text:
                return para.index
    return None


def align_scenes_to_coverage(
    scenes: list[SceneSpec],
    coverage: CoverageMap,
    *,
    reserved_paragraphs: set[int] | None = None,
) -> list[SceneSpec]:
    """
    Conserva la elección del LLM si cae en un hueco único; si no,
    reasigna a párrafos sin imagen repartidos por el relato.
    Mantiene el prompt visual; actualiza ancla y paragraph_index.
    """
    if not scenes or not coverage.paragraphs:
        return list(scenes)

    reserved = set(reserved_paragraphs or ())
    occupied = coverage.occupied_indices() | reserved
    targets = suggest_distributed_targets(
        coverage, len(scenes), also_avoid=reserved
    )

    kept: list[SceneSpec | None] = [None] * len(scenes)
    used: set[int] = set()
    reassign_idxs: list[int] = []

    for i, scene in enumerate(scenes):
        pidx = resolve_paragraph_index(scene, coverage)
        if (
            pidx is not None
            and pidx not in occupied
            and pidx not in used
        ):
            kept[i] = _scene_on_paragraph(scene, coverage, pidx)
            used.add(pidx)
        else:
            reassign_idxs.append(i)

    free = [t for t in targets if t not in used and t not in occupied]
    for p in coverage.paragraphs:
        if p.index not in occupied and p.index not in used and p.index not in free:
            free.append(p.index)

    fi = 0
    for i in reassign_idxs:
        if fi < len(free):
            pidx = free[fi]
            fi += 1
            used.add(pidx)
            kept[i] = _scene_on_paragraph(scenes[i], coverage, pidx)
        else:
            kept[i] = scenes[i]

    return [s for s in kept if s is not None]


def format_coverage_block(
    coverage: CoverageMap,
    *,
    suggested: list[int] | None = None,
    max_preview: int = 72,
) -> str:
    """Texto para el prompt del planificador: cobertura y huecos sugeridos."""
    if not coverage.paragraphs:
        return ""
    lines = [
        f"El relato tiene {len(coverage.paragraphs)} párrafos. "
        "Distribuye las escenas a lo largo del relato; prioriza párrafos SIN imagen.",
    ]
    for para in coverage.paragraphs:
        flag = (
            f"{para.illustration_count} imagen(es)"
            if para.illustration_count
            else "sin imagen"
        )
        preview = para.text.replace("\n", " ").strip()
        if len(preview) > max_preview:
            preview = preview[: max_preview - 1] + "…"
        lines.append(f'- [{para.index}] ({flag}): "{preview}"')
    if suggested:
        lines.append(
            "Párrafos sugeridos para este lote (reparte aquí salvo mejor criterio): "
            + ", ".join(str(i) for i in suggested)
        )
        lines.append(
            "Usa paragraph_index de un hueco y anchor_excerpt literal del final de ese párrafo."
        )
    return "\n".join(lines) + "\n\n"


def tail_excerpt(paragraph: str, max_len: int = 100) -> str:
    """Fragmento final del párrafo usable como anchor_excerpt literal."""
    text = (paragraph or "").strip()
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    chunk = text[-max_len:]
    space = chunk.find(" ")
    if 0 <= space < 20:
        chunk = chunk[space + 1 :]
    return chunk.strip()


def _scene_on_paragraph(
    scene: SceneSpec, coverage: CoverageMap, paragraph_index: int
) -> SceneSpec:
    para = coverage.paragraphs[paragraph_index]
    return SceneSpec(
        id=scene.id,
        prompt=scene.prompt,
        anchor_excerpt=tail_excerpt(para.text),
        paragraph_index=paragraph_index,
    )


def _evenly_pick(items: list[int], count: int) -> list[int]:
    if count <= 0 or not items:
        return []
    if count >= len(items):
        return list(items)
    picks: list[int] = []
    seen: set[int] = set()
    n = len(items)
    for i in range(count):
        pos = int((i + 0.5) * n / count)
        pos = min(n - 1, max(0, pos))
        value = items[pos]
        if value in seen:
            for offset in range(1, n):
                for candidate in (pos - offset, pos + offset):
                    if 0 <= candidate < n and items[candidate] not in seen:
                        value = items[candidate]
                        break
                if value not in seen:
                    break
        if value not in seen:
            seen.add(value)
            picks.append(value)
    return picks
