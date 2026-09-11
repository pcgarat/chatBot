"""Estrategias de selección de escenas (Strategy).

El orquestador no decide *cómo* repartir las ilustraciones: delega en una
estrategia registrada. Añadir un modo nuevo = nueva clase + registro.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol

from app.services.image_illustration.coverage import (
    CoverageMap,
    ParagraphInfo,
    suggest_distributed_targets,
)


class SceneSelectionStrategyId(str, Enum):
    DISTRIBUTED = "distributed"
    LLM_EROTIC_STORY = "llm_erotic_story"


DEFAULT_SCENE_SELECTION_STRATEGY = SceneSelectionStrategyId.DISTRIBUTED.value


@dataclass(frozen=True)
class SceneSelectionBatch:
    """Plan de un lote: párrafos preasignados y/o instrucciones al LLM."""

    strategy_id: str
    max_scenes: int
    assigned_paragraphs: list[ParagraphInfo] = field(default_factory=list)
    selection_instructions: str = ""
    binds_to_assigned: bool = True


class SceneSelectionStrategy(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def label(self) -> str: ...

    @property
    def description(self) -> str: ...

    def prepare_batch(
        self,
        coverage: CoverageMap,
        count: int,
        *,
        also_avoid: set[int] | None = None,
    ) -> SceneSelectionBatch: ...


_LLM_EROTIC_STORY_INSTRUCTIONS = """\
Estrategia de selección: narrativa erótica (LLM).
Elige hasta max_images momentos del relato que, en secuencia, cuenten la historia con las imágenes.
Prioriza pasajes de alto contenido sexual o erótico cuando existan (deseo, intimidad, acto, clímax, aftercare).
Si un tramo no tiene carga erótica suficiente, elige el beat narrativo más visual que avance la trama.
Reparte las escenas a lo largo del arco (no todas al inicio ni en el mismo párrafo).
Evita párrafos ya ilustrados (ver ubicaciones existentes).
Cada scene debe llevar paragraph_index del párrafo elegido y un prompt en inglés explícito, sensual/erótico y anclado a ese momento.
"""


class DistributedSceneSelectionStrategy:
    """Código elige párrafos (huecos / puntos medios); el LLM solo escribe prompts."""

    @property
    def id(self) -> str:
        return SceneSelectionStrategyId.DISTRIBUTED.value

    @property
    def label(self) -> str:
        return "Distribuida (huecos)"

    @property
    def description(self) -> str:
        return "Reparte imágenes en los huecos más grandes entre anclas existentes."

    def prepare_batch(
        self,
        coverage: CoverageMap,
        count: int,
        *,
        also_avoid: set[int] | None = None,
    ) -> SceneSelectionBatch:
        if not coverage.paragraphs or count <= 0:
            return SceneSelectionBatch(
                strategy_id=self.id,
                max_scenes=0,
                assigned_paragraphs=[],
                binds_to_assigned=True,
            )
        indices = suggest_distributed_targets(
            coverage, count, also_avoid=also_avoid
        )
        assigned = [
            coverage.paragraphs[i]
            for i in indices
            if 0 <= i < len(coverage.paragraphs)
        ]
        return SceneSelectionBatch(
            strategy_id=self.id,
            max_scenes=len(assigned),
            assigned_paragraphs=assigned,
            selection_instructions="",
            binds_to_assigned=True,
        )


class LlmEroticStorySceneSelectionStrategy:
    """El LLM elige momentos eróticos que narren la historia con imágenes."""

    @property
    def id(self) -> str:
        return SceneSelectionStrategyId.LLM_EROTIC_STORY.value

    @property
    def label(self) -> str:
        return "Narrativa erótica (LLM)"

    @property
    def description(self) -> str:
        return (
            "El planificador elige momentos de alto contenido erótico "
            "para contar la historia con las imágenes."
        )

    def prepare_batch(
        self,
        coverage: CoverageMap,
        count: int,
        *,
        also_avoid: set[int] | None = None,
    ) -> SceneSelectionBatch:
        del also_avoid  # el LLM evita ocupados vía already_planned / cobertura
        if not coverage.paragraphs or count <= 0:
            return SceneSelectionBatch(
                strategy_id=self.id,
                max_scenes=0,
                assigned_paragraphs=[],
                selection_instructions=_LLM_EROTIC_STORY_INSTRUCTIONS,
                binds_to_assigned=False,
            )
        return SceneSelectionBatch(
            strategy_id=self.id,
            max_scenes=count,
            assigned_paragraphs=[],
            selection_instructions=_LLM_EROTIC_STORY_INSTRUCTIONS,
            binds_to_assigned=False,
        )


_REGISTRY: dict[str, SceneSelectionStrategy] = {
    SceneSelectionStrategyId.DISTRIBUTED.value: DistributedSceneSelectionStrategy(),
    SceneSelectionStrategyId.LLM_EROTIC_STORY.value: LlmEroticStorySceneSelectionStrategy(),
}


def normalize_scene_selection_strategy_id(value: str | None) -> str:
    raw = (value or "").strip().lower()
    if raw in _REGISTRY:
        return raw
    return DEFAULT_SCENE_SELECTION_STRATEGY


def resolve_scene_selection_strategy(
    strategy_id: str | None,
) -> SceneSelectionStrategy:
    key = normalize_scene_selection_strategy_id(strategy_id)
    return _REGISTRY[key]


def list_scene_selection_strategies() -> list[dict[str, str]]:
    """Catálogo estable para UI / API (orden de registro)."""
    return [
        {
            "id": s.id,
            "label": s.label,
            "description": s.description,
        }
        for s in _REGISTRY.values()
    ]
