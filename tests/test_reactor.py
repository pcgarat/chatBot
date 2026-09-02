"""Tests del post-proceso ReActor sobre imágenes Forge."""

from unittest.mock import MagicMock

import pytest

from app.services.image_illustration.forge_client import ForgeClientError
from app.services.image_illustration.reactor import (
    ReactorConfigurationError,
    apply_reactor_if_configured,
    is_reactor_enabled,
    load_source_image,
)
from app.services.image_illustration.reactor_settings import (
    merge_reactor_panel,
    reactor_env_defaults,
    resolve_reactor_plan,
)


def test_is_reactor_enabled_from_rules():
    assert not is_reactor_enabled({})
    assert not is_reactor_enabled({"reactor": {"enabled": False}})
    assert is_reactor_enabled({"reactor_enabled": True})
    assert is_reactor_enabled({"reactor": {"enabled": True}})


def test_resolve_reactor_plan_disabled():
    assert resolve_reactor_plan({"reactor": {"enabled": False}}) is None


def test_resolve_reactor_plan_source_image(monkeypatch, tmp_path):
    source = tmp_path / "face.jpg"
    source.write_bytes(b"face")
    monkeypatch.setattr(
        "app.services.image_illustration.reactor_settings.settings.forge_reactor_source_image",
        str(source),
    )
    plan = resolve_reactor_plan({"reactor": {"enabled": True}})
    assert plan is not None
    assert plan.source_image_path == str(source)
    assert plan.gender_passes == ()


def test_resolve_reactor_plan_female_facemodel():
    plan = resolve_reactor_plan(
        {
            "reactor": {
                "enabled": True,
                "female_enabled": True,
                "female_face_model": "elena.safetensors",
            }
        }
    )
    assert plan is not None
    assert len(plan.gender_passes) == 1
    assert plan.gender_passes[0].gender_target == 1
    assert plan.gender_passes[0].face_model == "elena.safetensors"


def test_resolve_reactor_plan_both_genders():
    plan = resolve_reactor_plan(
        {
            "reactor": {
                "enabled": True,
                "female_enabled": True,
                "female_face_model": "elena.safetensors",
                "male_enabled": True,
                "male_face_model": "john.safetensors",
            }
        }
    )
    assert plan is not None
    assert len(plan.gender_passes) == 2


def test_merge_reactor_panel_keeps_env_when_empty():
    base = reactor_env_defaults()
    merged = merge_reactor_panel(base, {"scale": 2.0})
    assert merged.scale == 2.0
    assert merged.model == base.model


def test_load_source_image_reads_bytes(tmp_path):
    path = tmp_path / "face.png"
    path.write_bytes(b"png-data")
    assert load_source_image(str(path)) == b"png-data"


def test_apply_reactor_if_configured_skips_when_disabled():
    forge = MagicMock()
    target = b"generated"
    out, meta = apply_reactor_if_configured(forge, target, {"reactor": {"enabled": False}})
    assert out == target
    assert meta == {}
    forge.reactor_swap.assert_not_called()


def test_apply_reactor_if_configured_source_image(monkeypatch, tmp_path):
    source = tmp_path / "face.jpg"
    source.write_bytes(b"face")
    monkeypatch.setattr(
        "app.services.image_illustration.reactor_settings.settings.forge_reactor_source_image",
        str(source),
    )
    forge = MagicMock()
    forge.reactor_swap.return_value = b"swapped-final"
    out, meta = apply_reactor_if_configured(
        forge,
        b"generated",
        {"reactor": {"enabled": True}},
    )
    assert out == b"swapped-final"
    assert meta["reactor_applied"] is True
    forge.reactor_swap.assert_called_once()
    call = forge.reactor_swap.call_args.kwargs
    assert call["source_image"] == b"face"
    assert call["target_image"] == b"generated"
    assert call["params"]["select_source"] == 0


def test_apply_reactor_if_configured_female_then_male():
    forge = MagicMock()
    forge.reactor_swap.side_effect = [b"after-female", b"after-male"]
    out, meta = apply_reactor_if_configured(
        forge,
        b"generated",
        {
            "reactor": {
                "enabled": True,
                "female_enabled": True,
                "female_face_model": "elena.safetensors",
                "male_enabled": True,
                "male_face_model": "john.safetensors",
            }
        },
    )
    assert out == b"after-male"
    assert forge.reactor_swap.call_count == 2
    assert len(meta["reactor_gender_passes"]) == 2
    first_params = forge.reactor_swap.call_args_list[0].kwargs["params"]
    assert first_params["gender_target"] == 1
    assert first_params["face_model"] == "elena.safetensors"
    assert first_params["select_source"] == 1


def test_apply_reactor_if_configured_enabled_without_config_raises(monkeypatch):
    monkeypatch.setattr(
        "app.services.image_illustration.reactor_settings.settings.forge_reactor_source_image",
        "",
    )
    forge = MagicMock()
    with pytest.raises(ReactorConfigurationError):
        apply_reactor_if_configured(forge, b"gen", {"reactor": {"enabled": True}})


def test_apply_reactor_if_configured_wraps_forge_errors(monkeypatch, tmp_path):
    source = tmp_path / "face.jpg"
    source.write_bytes(b"face")
    monkeypatch.setattr(
        "app.services.image_illustration.reactor_settings.settings.forge_reactor_source_image",
        str(source),
    )
    forge = MagicMock()
    forge.reactor_swap.side_effect = ForgeClientError("HTTP 500")
    with pytest.raises(ForgeClientError, match="ReActor:"):
        apply_reactor_if_configured(forge, b"gen", {"reactor": {"enabled": True}})
