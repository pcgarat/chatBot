"""Tests de resolución de settings ReActor (.env + panel)."""

from app.services.image_illustration.reactor_settings import (
    parse_int_list,
    reactor_env_defaults,
)


def test_parse_int_list_comma_separated():
    assert parse_int_list("0,1", default=[0]) == [0, 1]
    assert parse_int_list("", default=[0]) == [0]
    assert parse_int_list([2], default=[0]) == [2]


def test_reactor_env_defaults_contains_api_keys():
    defaults = reactor_env_defaults()
    panel = defaults.to_panel_dict()
    assert "model" in panel
    assert "upscaler" in panel
    assert "codeformer_weight" in panel
    assert defaults.to_api_dict()["save_to_file"] == 0
