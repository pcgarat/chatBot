"""Tests del dominio PromptBrief (prompt generator)."""

import pytest

from app.services.prompt_generator.brief import PromptBrief, detect_force, empty_brief


def test_empty_brief_all_slots_none():
    brief = empty_brief()
    assert brief.prompt_language is None
    assert brief.image_type_subject is None
    assert brief.action_pose_expression is None
    assert brief.environment is None
    assert brief.composition_framing_angle is None
    assert brief.lighting is None
    assert brief.visual_style is None
    assert brief.materials_color_atmosphere is None
    assert brief.visible_text is None
    assert brief.force_generate is False
    assert brief.latest_prompt is None


def test_brief_to_dict_and_from_dict_roundtrip():
    brief = PromptBrief(
        prompt_language="en",
        image_type_subject="cinematic portrait of a woman",
        lighting="soft golden hour from the right",
        force_generate=False,
        latest_prompt=None,
    )
    data = brief.to_dict()
    restored = PromptBrief.from_dict(data)
    assert restored.prompt_language == "en"
    assert restored.image_type_subject == "cinematic portrait of a woman"
    assert restored.lighting == "soft golden hour from the right"
    assert restored.environment is None


def test_from_dict_ignores_unknown_keys():
    brief = PromptBrief.from_dict({"prompt_language": "es", "extra": 1})
    assert brief.prompt_language == "es"


def test_merge_overwrites_only_non_null_patch_values():
    base = PromptBrief(prompt_language="en", environment="rainy street")
    merged = base.merge(
        {
            "environment": "neon alley",
            "lighting": "magenta and cyan neon",
            "prompt_language": None,
        }
    )
    assert merged.prompt_language == "en"
    assert merged.environment == "neon alley"
    assert merged.lighting == "magenta and cyan neon"


def test_merge_can_clear_slot_with_empty_string():
    base = PromptBrief(visible_text="OPEN")
    merged = base.merge({"visible_text": ""})
    assert merged.visible_text == ""


@pytest.mark.parametrize(
    "text",
    [
        "genera ya",
        "Genera ya!",
        "por favor genera ya el prompt",
        "genéralo ya",
        "generate now",
        "GENERATE NOW",
    ],
)
def test_detect_force_true(text):
    assert detect_force(text) is True


@pytest.mark.parametrize(
    "text",
    [
        "",
        "quiero una foto de un gato",
        "el estilo es cinematográfico",
        "generaciones de prompts",
    ],
)
def test_detect_force_false(text):
    assert detect_force(text) is False
