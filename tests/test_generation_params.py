"""Tests de metadatos de generación Forge por imagen."""

import json

from app.services.image_illustration.generation_params import build_stored_generation_params
from app.services.image_illustration.models import ForgeMode


def test_build_stored_generation_params_redacts_init_and_adds_model():
    body = {
        "prompt": "lighthouse",
        "steps": 12,
        "width": 768,
        "height": 512,
        "sampler_name": "Euler a",
        "seed": 42,
        "cfg_scale": 7,
        "init_images": ["AAAA" * 80],
        "override_settings": {"sd_model_checkpoint": "flux.safetensors"},
    }
    params = build_stored_generation_params(ForgeMode.IMG2IMG, body)
    assert params["prompt"] == "lighthouse"
    assert params["mode"] == "img2img"
    assert params["model"] == "flux.safetensors"
    assert params["width"] == 768
    assert params["height"] == 512
    assert "omitted" in str(params["init_images"][0]).lower() or "base64" in str(params["init_images"][0]).lower()
    assert "generation_time_ms" not in params


def test_build_stored_generation_params_includes_generation_time():
    params = build_stored_generation_params(
        ForgeMode.TXT2IMG,
        {"prompt": "x", "steps": 1},
        generation_time_ms=1234.56,
    )
    assert params["generation_time_ms"] == 1234.6
