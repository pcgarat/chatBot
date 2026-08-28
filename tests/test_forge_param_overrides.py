"""Tests de overrides del panel Imágenes sobre el body Forge."""

from app.services.image_illustration.forge_param_overrides import (
    forge_overrides_from_optional,
    panel_params_from_fields,
)
from app.services.image_illustration.models import ForgeMode, ForgeParamOverrides, LastGenerationPayload


def test_forge_overrides_from_optional_empty_returns_none():
    assert forge_overrides_from_optional() is None
    assert forge_overrides_from_optional(steps=None, seed=None) is None


def test_forge_overrides_from_optional_partial():
    ov = forge_overrides_from_optional(steps=20, seed=-1)
    assert ov is not None
    assert ov.as_dict() == {"steps": 20, "seed": -1}


def test_panel_params_from_fields_ignores_invalid():
    assert panel_params_from_fields(
        {"steps": 8, "width": "1024", "height": None, "seed": "x", "prompt": "a"}
    ) == {"steps": 8, "width": 1024}


def test_body_with_prompt_applies_overrides_without_touching_other_fields():
    payload = LastGenerationPayload(
        mode=ForgeMode.TXT2IMG,
        body={
            "prompt": "old",
            "steps": 8,
            "width": 512,
            "height": 768,
            "seed": 1,
            "cfg_scale": 7,
        },
        recovered_fields=["steps", "width", "height", "seed"],
    )
    body = payload.body_with_prompt(
        "nueva escena",
        overrides=ForgeParamOverrides(steps=30, width=1024, seed=-1),
    )
    assert body["prompt"] == "nueva escena"
    assert body["steps"] == 30
    assert body["width"] == 1024
    assert body["height"] == 768
    assert body["seed"] == -1
    assert body["cfg_scale"] == 7


def test_body_with_prompt_without_overrides_keeps_replay():
    payload = LastGenerationPayload(
        mode=ForgeMode.TXT2IMG,
        body={"prompt": "old", "steps": 8, "seed": 99},
    )
    body = payload.body_with_prompt("x")
    assert body == {"prompt": "x", "steps": 8, "seed": 99}
