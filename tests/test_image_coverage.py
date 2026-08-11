"""Tests de cobertura y redistribución de anclas."""

from app.services.image_illustration.coverage import (
    align_scenes_to_coverage,
    analyze_coverage,
    format_coverage_block,
    occupied_scenes_from_coverage,
    suggest_distributed_targets,
    tail_excerpt,
)
from app.services.image_illustration.models import SceneSpec


def test_analyze_coverage_counts_images_per_paragraph():
    text = (
        "Había un faro.\n"
        '<img src="/api/illustrated-images/a.png" class="chat-illustration" />\n\n'
        "La tormenta rugía.\n\n"
        "Al amanecer volvió la calma."
    )
    cov = analyze_coverage(text)
    assert len(cov.paragraphs) == 3
    assert cov.paragraphs[0].illustration_count == 1
    assert cov.paragraphs[1].illustration_count == 0
    assert cov.paragraphs[2].illustration_count == 0
    assert cov.uncovered_indices == [1, 2]
    assert cov.occupied_indices() == {0}


def test_analyze_coverage_attaches_orphan_image_to_previous_paragraph():
    text = (
        "Párrafo uno.\n\n"
        '<img src="/api/illustrated-images/a.png" class="chat-illustration" />\n\n'
        "Párrafo dos."
    )
    cov = analyze_coverage(text)
    assert len(cov.paragraphs) == 2
    assert cov.paragraphs[0].illustration_count == 1
    assert cov.paragraphs[1].illustration_count == 0


def test_suggest_distributed_targets_prefers_uncovered_and_spreads():
    text = "\n\n".join([f"Párrafo {i}." for i in range(6)])
    cov = analyze_coverage(text)
    targets = suggest_distributed_targets(cov, 3)
    assert len(targets) == 3
    assert len(set(targets)) == 3
    # Con todo vacío, se reparte por el arco (aprox. inicio/medio/final).
    assert targets[0] < targets[1] < targets[2]


def test_suggest_skips_occupied_paragraphs():
    text = (
        "A.\n"
        '<img src="/api/illustrated-images/a.png" class="chat-illustration" />\n\n'
        "B.\n\n"
        "C.\n\n"
        "D."
    )
    cov = analyze_coverage(text)
    targets = suggest_distributed_targets(cov, 2)
    assert 0 not in targets
    assert all(t in cov.uncovered_indices for t in targets)


def test_align_moves_scenes_off_occupied_paragraphs():
    text = (
        "Inicio del faro.\n"
        '<img src="/api/illustrated-images/old.png" class="chat-illustration" />\n\n'
        "Mitad del relato.\n\n"
        "Final en la playa."
    )
    cov = analyze_coverage(text)
    scenes = [
        SceneSpec(id="s1", prompt="lighthouse", anchor_excerpt="Inicio del faro."),
        SceneSpec(id="s2", prompt="storm", anchor_excerpt="Inicio del faro."),
    ]
    aligned = align_scenes_to_coverage(scenes, cov)
    idxs = [s.paragraph_index for s in aligned]
    assert 0 not in idxs
    assert len(set(idxs)) == 2
    assert all(s.anchor_excerpt for s in aligned)
    assert aligned[0].prompt == "lighthouse"


def test_align_keeps_scene_already_on_a_gap():
    text = "Uno.\n\nDos.\n\nTres."
    cov = analyze_coverage(text)
    scenes = [SceneSpec(id="s1", prompt="p1", paragraph_index=1, anchor_excerpt="Dos.")]
    aligned = align_scenes_to_coverage(scenes, cov)
    assert aligned[0].paragraph_index == 1


def test_format_coverage_block_lists_gaps_and_suggestions():
    text = "A.\n\nB."
    cov = analyze_coverage(text)
    block = format_coverage_block(cov, suggested=[0, 1])
    assert "sin imagen" in block
    assert "[0]" in block and "[1]" in block
    assert "sugeridos" in block.lower() or "Párrafos sugeridos" in block


def test_occupied_scenes_from_coverage():
    text = (
        "Ocupado.\n"
        '<img src="/api/illustrated-images/a.png" class="chat-illustration" />\n\n'
        "Libre."
    )
    cov = analyze_coverage(text)
    occupied = occupied_scenes_from_coverage(cov)
    assert len(occupied) == 1
    assert occupied[0].paragraph_index == 0
    assert "Ocupado" in occupied[0].anchor_excerpt


def test_bind_scenes_to_paragraphs_by_index_and_order():
    from app.services.image_illustration.coverage import (
        ParagraphInfo,
        bind_scenes_to_paragraphs,
    )

    paras = [
        ParagraphInfo(index=1, text="Mitad del mar.", illustration_count=0),
        ParagraphInfo(index=3, text="Final en la playa.", illustration_count=0),
    ]
    scenes = [
        SceneSpec(id="s1", prompt="sea waves", paragraph_index=1),
        SceneSpec(id="s2", prompt="beach sunrise"),  # sin index → por orden
    ]
    bound = bind_scenes_to_paragraphs(scenes, paras)
    assert len(bound) == 2
    assert bound[0].paragraph_index == 1
    assert bound[0].prompt == "sea waves"
    assert "mar" in bound[0].anchor_excerpt.lower() or "Mitad" in bound[0].anchor_excerpt
    assert bound[1].paragraph_index == 3
    assert bound[1].prompt == "beach sunrise"
    assert "playa" in bound[1].anchor_excerpt.lower() or "Final" in bound[1].anchor_excerpt
