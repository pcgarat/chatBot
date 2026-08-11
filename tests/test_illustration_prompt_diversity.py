"""Extracción de prompts de ilustraciones ya presentes en el content."""

from app.services.image_illustration.content_ops import extract_existing_illustration_prompts
from app.services.image_illustration.scene_planner import _already_planned_block
from app.services.image_illustration.models import SceneSpec


def test_extract_existing_illustration_prompts_from_img_and_placeholder():
    text = (
        "A.\n"
        '<img src="/api/illustrated-images/a.png" class="chat-illustration" '
        'data-prompt="cinematic lighthouse at dusk" />\n\n'
        '<span class="chat-illustration-placeholder" data-scene="s2" '
        'data-prompt="stormy sea waves">Generando…</span>\n\n'
        "B."
    )
    prompts = extract_existing_illustration_prompts(text)
    assert "cinematic lighthouse at dusk" in prompts
    assert "stormy sea waves" in prompts


def test_already_planned_block_includes_prompts_and_diversity_rule():
    block = _already_planned_block(
        [
            SceneSpec(id="s1", prompt="red dress in kitchen", paragraph_index=0),
            SceneSpec(id="existing-p2", prompt="", paragraph_index=2, anchor_excerpt="Final."),
        ],
        existing_prompts=["cinematic lighthouse at dusk"],
    )
    assert "red dress in kitchen" in block
    assert "cinematic lighthouse at dusk" in block
    assert "similares" in block.lower() or "similar" in block.lower()
