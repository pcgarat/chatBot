"""Cobertura de ilustraciones por párrafo y redistribución a huecos."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.image_illustration.anchors import _ILLUSTRATION_ARTIFACT_RE as ILLUSTRATION_ARTIFACT_RE
from app.services.image_illustration.models import SceneSpec


@dataclass(frozen=True)
class ParagraphInfo:
    """Párrafo del relato limpio y cuántas ilustraciones tiene detrás."""

    index: int
    text: str
    illustration_count: int
    # Offset en el content original tras el párrafo y su cluster de imágenes.
    insert_offset: int = 0


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
    Cada párrafo expone insert_offset para colocar nuevas anclas detrás de su cluster.
    """
    content = content or ""
    if not content:
        return CoverageMap(paragraphs=[])

    parts = re.split(r"(\n\s*\n)", content)
    paragraphs: list[ParagraphInfo] = []
    idx = 0
    pos = 0
    i = 0
    while i < len(parts):
        block = parts[i]
        block_start = pos
        block_end = pos + len(block)
        imgs = list(ILLUSTRATION_ARTIFACT_RE.finditer(block))
        count = len(imgs)
        text_only = ILLUSTRATION_ARTIFACT_RE.sub("", block)
        text_only = re.sub(r"\n{3,}", "\n\n", text_only).strip()

        if not text_only:
            if count and paragraphs:
                prev = paragraphs[-1]
                paragraphs[-1] = ParagraphInfo(
                    index=prev.index,
                    text=prev.text,
                    illustration_count=prev.illustration_count + count,
                    insert_offset=block_end,
                )
            pos = block_end
            if i + 1 < len(parts):
                pos += len(parts[i + 1])
                i += 2
            else:
                i += 1
            continue

        insert_offset = block_start + imgs[-1].end() if imgs else block_end
        # Si el bloque termina en imgs + espacio, preferir el final del bloque.
        if imgs and ILLUSTRATION_ARTIFACT_RE.sub("", block[imgs[-1].end() :]).strip() == "":
            insert_offset = block_end

        paragraphs.append(
            ParagraphInfo(
                index=idx,
                text=text_only,
                illustration_count=count,
                insert_offset=insert_offset,
            )
        )
        idx += 1
        pos = block_end
        if i + 1 < len(parts):
            pos += len(parts[i + 1])
            i += 2
        else:
            i += 1

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
    Elige hasta `count` párrafos en los puntos medios de los huecos más grandes
    entre imágenes ya existentes (y los bordes del relato).

    No elige «el vacío más cercano»: subdivide el hueco mayor entre la imagen
    anterior y la siguiente. `also_avoid` se trata como ocupado (p. ej. este run).
    """
    n = len(coverage.paragraphs)
    if n == 0 or count <= 0:
        return []

    avoid = set(also_avoid or ())
    fences = sorted(
        {-1, n}
        | set(coverage.occupied_indices())
        | {i for i in avoid if 0 <= i < n}
    )
    placed: list[int] = []

    for _ in range(count):
        best_choice: int | None = None
        best_score: tuple[int, float, int] | None = None
        for i in range(len(fences) - 1):
            left, right = fences[i], fences[i + 1]
            candidates = [
                p
                for p in range(left + 1, right)
                if p not in avoid and p not in placed
            ]
            if not candidates:
                continue
            mid = (left + right) / 2.0
            choice = min(candidates, key=lambda p: (abs(p - mid), p))
            # Mayor hueco; a igualdad, más cerca del centro; luego índice menor.
            score = (right - left, -abs(choice - mid), -choice)
            if best_score is None or score > best_score:
                best_score = score
                best_choice = choice

        if best_choice is None:
            rest = sorted(
                (
                    p
                    for p in coverage.paragraphs
                    if p.index not in avoid and p.index not in placed
                ),
                key=lambda p: (p.illustration_count, p.index),
            )
            if not rest:
                break
            best_choice = rest[0].index

        placed.append(best_choice)
        fences = sorted(set(fences) | {best_choice})

    return sorted(placed)


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
        "Las nuevas escenas se colocan en el punto medio de los huecos más grandes "
        "entre imágenes ya existentes (no en el vacío más cercano).",
    ]
    for para in coverage.paragraphs:
        flag = (
            f"{para.illustration_count} imagen(es)"
            if para.illustration_count
            else "sin imagen"
        )
        preview = para.text.replace("\n", " ")
        if len(preview) > max_preview:
            preview = preview[: max_preview - 1] + "…"
        lines.append(f"[{para.index}] ({flag}) {preview}")
    if suggested:
        lines.append(
            "Párrafos sugeridos (punto medio de huecos entre imágenes): "
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


def insert_offset_for_scene(content: str, scene: SceneSpec) -> int:
    """
    Posición de inserción alineada con el mapa de cobertura.
    Prioriza paragraph_index; el excerpt solo desambigua si no hay índice.
    """
    text = content or ""
    coverage = analyze_coverage(text)
    if not coverage.paragraphs:
        excerpt = (scene.anchor_excerpt or "").strip()
        if excerpt:
            pos = text.find(excerpt)
            if pos >= 0:
                return pos + len(excerpt)
        return len(text)

    pidx = scene.paragraph_index
    if pidx is not None and 0 <= pidx < len(coverage.paragraphs):
        return coverage.paragraphs[pidx].insert_offset

    excerpt = (scene.anchor_excerpt or "").strip()
    if excerpt:
        matches = [p for p in coverage.paragraphs if excerpt in p.text]
        if len(matches) == 1:
            return matches[0].insert_offset
        if len(matches) > 1:
            # Preferir hueco si el excerpt es ambiguo.
            for p in matches:
                if p.illustration_count == 0:
                    return p.insert_offset
            return matches[-1].insert_offset
        pos = text.find(excerpt)
        if pos >= 0:
            return pos + len(excerpt)
    return len(text)


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
