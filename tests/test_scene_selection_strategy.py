"""Tests del patrón Strategy de selección de escenas."""

from app.services.image_illustration.coverage import analyze_coverage
from app.services.image_illustration.models import (
    ForgeMode,
    LastGenerationPayload,
    ScenePlan,
    SceneSpec,
)
from app.services.image_illustration.orchestrator import ImageIllustrationOrchestrator
from app.services.image_illustration.scene_selection import (
    DEFAULT_SCENE_SELECTION_STRATEGY,
    DistributedSceneSelectionStrategy,
    LlmEroticStorySceneSelectionStrategy,
    SceneSelectionStrategyId,
    list_scene_selection_strategies,
    normalize_scene_selection_strategy_id,
    resolve_scene_selection_strategy,
)
from tests.test_image_orchestrator import FakeForge, FakePayloadSource, FakePlanner


def test_normalize_unknown_falls_back_to_distributed():
    assert normalize_scene_selection_strategy_id(None) == DEFAULT_SCENE_SELECTION_STRATEGY
    assert normalize_scene_selection_strategy_id("nope") == "distributed"
    assert (
        normalize_scene_selection_strategy_id("LLM_EROTIC_STORY")
        == SceneSelectionStrategyId.LLM_EROTIC_STORY.value
    )
    assert (
        normalize_scene_selection_strategy_id("llm_pornographic_peaks")
        == SceneSelectionStrategyId.LLM_PORNOGRAPHIC_PEAKS.value
    )


def test_registry_lists_both_strategies():
    catalog = list_scene_selection_strategies()
    ids = [item["id"] for item in catalog]
    assert ids == [
        SceneSelectionStrategyId.DISTRIBUTED.value,
        SceneSelectionStrategyId.LLM_EROTIC_STORY.value,
        SceneSelectionStrategyId.LLM_PORNOGRAPHIC_PEAKS.value,
    ]
    assert all(item["label"] and item["description"] for item in catalog)


def test_distributed_strategy_assigns_midpoint_paragraphs():
    text = "\n\n".join([f"Párrafo {i}." for i in range(6)])
    cov = analyze_coverage(text)
    batch = DistributedSceneSelectionStrategy().prepare_batch(cov, 2)
    assert batch.binds_to_assigned is True
    assert batch.max_scenes == 2
    assert [p.index for p in batch.assigned_paragraphs] == [2, 4] or len(
        batch.assigned_paragraphs
    ) == 2
    assert batch.selection_policy == ""
    assert batch.selection_instructions == ""


def test_llm_erotic_strategy_does_not_preassign():
    text = "\n\n".join([f"Párrafo erótico {i}." for i in range(4)])
    cov = analyze_coverage(text)
    batch = LlmEroticStorySceneSelectionStrategy().prepare_batch(cov, 3)
    assert batch.binds_to_assigned is False
    assert batch.assigned_paragraphs == []
    assert batch.max_scenes == 3
    assert "erótic" in batch.selection_policy.lower()
    assert "historia" in batch.selection_policy.lower()
    assert "MANDA" in batch.selection_policy


def test_llm_pornographic_peaks_strategy_targets_explicit_moments():
    from app.services.image_illustration.scene_selection import (
        LlmPornographicPeaksSceneSelectionStrategy,
    )

    text = "\n\n".join([f"Párrafo {i}." for i in range(4)])
    cov = analyze_coverage(text)
    batch = LlmPornographicPeaksSceneSelectionStrategy().prepare_batch(cov, 2)
    assert batch.strategy_id == "llm_pornographic_peaks"
    assert batch.binds_to_assigned is False
    assert batch.assigned_paragraphs == []
    assert batch.max_scenes == 2
    assert "pornográf" in batch.selection_policy.lower()
    assert "explícit" in batch.selection_policy.lower()
    assert "ANULA el reparto uniforme" in batch.selection_policy
    assert "concentrar" in batch.selection_policy.lower()


def test_orchestrator_pornographic_strategy_forwards_instructions():
    text = "\n\n".join(
        [
            "Se desnudaron sin rodeos.",
            "El acto fue gráfico y salvaje.",
            "Gemidos y fluidos por toda la cama.",
            "Al final se separaron sin hablar.",
        ]
    )
    plan = ScenePlan(
        illustrate=True,
        reason="picos explícitos",
        scenes=[
            SceneSpec(id="s1", prompt="explicit sex act", paragraph_index=1),
            SceneSpec(id="s2", prompt="graphic climax fluids", paragraph_index=2),
        ],
    )
    planner = FakePlanner(plan)
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(
            LastGenerationPayload(mode=ForgeMode.TXT2IMG, body={"prompt": "x"})
        ),
        forge=FakeForge(b"png"),
        save_image=lambda sid, data: f"{sid}.png",
    )
    events = list(
        orch.run(
            text,
            max_images=2,
            retries=0,
            scene_selection_strategy="llm_pornographic_peaks",
        )
    )
    assert planner.last_assigned_paragraphs in (None, [])
    assert planner.last_selection_policy
    assert "pornográf" in planner.last_selection_policy.lower()
    assert any(
        e.type == "log"
        and e.data.get("scene_selection_strategy") == "llm_pornographic_peaks"
        for e in events
        if e.type == "log"
    )

def test_orchestrator_llm_strategy_forwards_instructions_without_assigned():
    text = "\n\n".join(
        [
            "Se miraron con deseo.",
            "La ropa cayó al suelo.",
            "El clímax los dejó temblando.",
            "Después se abrazaron en silencio.",
        ]
    )
    plan = ScenePlan(
        illustrate=True,
        reason="relato erótico",
        scenes=[
            SceneSpec(id="s1", prompt="intimate embrace", paragraph_index=1),
            SceneSpec(id="s2", prompt="climax moment", paragraph_index=2),
        ],
    )
    planner = FakePlanner(plan)
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(
            LastGenerationPayload(mode=ForgeMode.TXT2IMG, body={"prompt": "x"})
        ),
        forge=FakeForge(b"png"),
        save_image=lambda sid, data: f"{sid}.png",
    )
    events = list(
        orch.run(
            text,
            max_images=2,
            retries=0,
            scene_selection_strategy="llm_erotic_story",
        )
    )
    assert planner.last_assigned_paragraphs in (None, [])
    assert planner.last_selection_policy
    assert "erótic" in planner.last_selection_policy.lower()
    assert any(
        e.type == "log" and e.data.get("scene_selection_strategy") == "llm_erotic_story"
        for e in events
        if e.type == "log"
    )


def test_orchestrator_distributed_still_assigns_paragraphs():
    text = "\n\n".join([f"Párrafo {i} del relato." for i in range(5)])
    plan = ScenePlan(
        illustrate=True,
        reason="ok",
        scenes=[
            SceneSpec(id="s1", prompt="scene a", paragraph_index=2),
        ],
    )
    planner = FakePlanner(plan)
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(
            LastGenerationPayload(mode=ForgeMode.TXT2IMG, body={"prompt": "x"})
        ),
        forge=FakeForge(b"png"),
        save_image=lambda sid, data: f"{sid}.png",
    )
    list(
        orch.run(
            text,
            max_images=1,
            retries=0,
            scene_selection_strategy="distributed",
        )
    )
    assert planner.last_assigned_paragraphs
    assert planner.last_selection_policy in (None, "")
    assert resolve_scene_selection_strategy("distributed").id == "distributed"
