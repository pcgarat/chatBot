"""Estrategias de selección de escenas (Strategy).

El orquestador no decide *cómo* repartir las ilustraciones: delega en una
estrategia registrada. Añadir un modo nuevo = nueva clase + registro.

Las estrategias LLM aportan una *política de selección* que el planificador
inyecta en el system (prioridad sobre reparto uniforme).
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
    LLM_PORNOGRAPHIC_PEAKS = "llm_pornographic_peaks"


DEFAULT_SCENE_SELECTION_STRATEGY = SceneSelectionStrategyId.DISTRIBUTED.value


@dataclass(frozen=True)
class SceneSelectionBatch:
    """Plan de un lote: párrafos preasignados y/o política de selección al LLM."""

    strategy_id: str
    max_scenes: int
    assigned_paragraphs: list[ParagraphInfo] = field(default_factory=list)
    selection_policy: str = ""
    binds_to_assigned: bool = True

    @property
    def selection_instructions(self) -> str:
        """Alias legacy para callers que aún leen selection_instructions."""
        return self.selection_policy


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


_LLM_EROTIC_STORY_POLICY = """\
Modo: narrativa erótica.
Esta política MANDA sobre la ubicación de las escenas (no uses puntos medios geométricos).
Elige hasta max_images momentos que, en secuencia, cuenten la historia con las imágenes.
Prioriza pasajes de alto contenido sexual o erótico cuando existan (deseo, intimidad, acto, clímax, aftercare).
Si un tramo no tiene carga erótica suficiente, elige el beat narrativo más visual que avance la trama.
Reparte a lo largo del arco narrativo (no todas al inicio). Un momento por párrafo salvo que el relato lo pida; evita párrafos ya ilustrados.
Cada scene debe llevar paragraph_index del párrafo elegido y un prompt en inglés explícito, sensual/erótico y anclado a ese momento.
"""

_LLM_PORNOGRAPHIC_PEAKS_POLICY = """\
Modo: picos pornográficos.
Esta política MANDA sobre la ubicación de las escenas y ANULA el reparto uniforme.
Elige hasta max_images los momentos MÁS pornográficos y explícitos del relato (acto sexual gráfico, anatomía, fluidos, penetración, oral, etc.).
No priorices romanticismo, tensión suave ni aftercare: prioriza la máxima carga pornográfica.
Puedes concentrar varias escenas en párrafos cercanos o del mismo tramo si son los picos más fuertes; evita solo duplicar el mismo instante ya ilustrado.
Cada scene debe llevar paragraph_index del párrafo elegido y un prompt en inglés muy explícito, pornográfico y anclado a ese momento (sin eufemismos).
Si no hay contenido explícito suficiente, elige lo más cercano al máximo nivel sexual disponible y dilo en reason.
"""


def _llm_free_selection_batch(
    *,
    strategy_id: str,
    coverage: CoverageMap,
    count: int,
    policy: str,
) -> SceneSelectionBatch:
    """Lote sin párrafos preasignados: el LLM elige ubicación según la política."""
    if not coverage.paragraphs or count <= 0:
        return SceneSelectionBatch(
            strategy_id=strategy_id,
            max_scenes=0,
            assigned_paragraphs=[],
            selection_policy=policy,
            binds_to_assigned=False,
        )
    return SceneSelectionBatch(
        strategy_id=strategy_id,
        max_scenes=count,
        assigned_paragraphs=[],
        selection_policy=policy,
        binds_to_assigned=False,
    )


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
            selection_policy="",
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
        del also_avoid
        return _llm_free_selection_batch(
            strategy_id=self.id,
            coverage=coverage,
            count=count,
            policy=_LLM_EROTIC_STORY_POLICY,
        )


class LlmPornographicPeaksSceneSelectionStrategy:
    """El LLM elige solo los momentos más pornográficos y explícitos."""

    @property
    def id(self) -> str:
        return SceneSelectionStrategyId.LLM_PORNOGRAPHIC_PEAKS.value

    @property
    def label(self) -> str:
        return "Picos pornográficos (LLM)"

    @property
    def description(self) -> str:
        return (
            "El planificador elige los momentos más pornográficos "
            "y explícitos del relato."
        )

    def prepare_batch(
        self,
        coverage: CoverageMap,
        count: int,
        *,
        also_avoid: set[int] | None = None,
    ) -> SceneSelectionBatch:
        del also_avoid
        return _llm_free_selection_batch(
            strategy_id=self.id,
            coverage=coverage,
            count=count,
            policy=_LLM_PORNOGRAPHIC_PEAKS_POLICY,
        )


_REGISTRY: dict[str, SceneSelectionStrategy] = {
    SceneSelectionStrategyId.DISTRIBUTED.value: DistributedSceneSelectionStrategy(),
    SceneSelectionStrategyId.LLM_EROTIC_STORY.value: LlmEroticStorySceneSelectionStrategy(),
    SceneSelectionStrategyId.LLM_PORNOGRAPHIC_PEAKS.value: (
        LlmPornographicPeaksSceneSelectionStrategy()
    ),
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
