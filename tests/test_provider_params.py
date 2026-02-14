"""Tests para app.provider_params: get_presets, set_nested, build_extra_body."""
import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.provider_params import get_presets, set_nested, build_extra_body, get_params_config


def _clear_presets_cache(provider_name: str | None = None):
    """Limpia la caché de presets para que get_presets vuelva a leer del disco."""
    import app.provider_params as pp
    if provider_name is not None:
        pp._presets_cache.pop(provider_name, None)
    else:
        pp._presets_cache.clear()


# ----- get_presets -----


def test_get_presets_archivo_inexistente():
    """Si config/{provider}.json no existe, devuelve {}."""
    _clear_presets_cache("provider_inexistente_xyz")
    result = get_presets("provider_inexistente_xyz")
    assert result == {}


def test_get_presets_json_invalido(tmp_path):
    """Si el JSON del archivo es inválido, devuelve {}."""
    provider = "test_invalid_json"
    _clear_presets_cache(provider)
    (tmp_path / f"{provider}.json").write_text("[ invalid json", encoding="utf-8")
    parent_mock = MagicMock()
    parent_mock.__truediv__ = lambda self, other: tmp_path if other == "config" else (tmp_path / other)
    with patch("app.provider_params.Path") as MockPath:
        MockPath.return_value.resolve.return_value.parent.parent = parent_mock
        result = get_presets(provider)
    assert result == {}


def test_get_presets_data_no_dict(tmp_path):
    """Si el JSON no es un objeto (ej. lista), devuelve {}."""
    provider = "test_not_dict"
    _clear_presets_cache(provider)
    (tmp_path / f"{provider}.json").write_text('["a", "b"]', encoding="utf-8")
    parent_mock = MagicMock()
    parent_mock.__truediv__ = lambda self, other: tmp_path if other == "config" else (tmp_path / other)
    with patch("app.provider_params.Path") as MockPath:
        MockPath.return_value.resolve.return_value.parent.parent = parent_mock
        result = get_presets(provider)
    assert result == {}


# ----- set_nested -----


def test_set_nested_crea_niveles():
    """set_nested crea dicts intermedios y asigna el valor."""
    d = {}
    set_nested(d, "options.temperature", 0.7)
    assert d == {"options": {"temperature": 0.7}}


def test_set_nested_sobre_estructura_existente():
    """set_nested no pisa claves existentes en otros niveles."""
    d = {"options": {"top_p": 0.9}}
    set_nested(d, "options.temperature", 0.8)
    assert d["options"]["temperature"] == 0.8
    assert d["options"]["top_p"] == 0.9


def test_set_nested_clave_unica():
    """Ruta de una sola clave escribe en la raíz del dict."""
    d = {}
    set_nested(d, "key", "value")
    assert d == {"key": "value"}


# ----- build_extra_body -----


@patch("app.provider_params.get_params_config")
def test_build_extra_body_string_list(mock_get_params):
    """string_list convierte string con newlines en lista de strings."""
    mock_get_params.return_value = {
        "stop_sequences": {"api_key": "options.stop", "type": "string_list"},
    }
    result = build_extra_body("ollama", {"stop_sequences": "a\nb\n  c  "})
    assert result == {"options": {"stop": ["a", "b", "c"]}}


@patch("app.provider_params.get_params_config")
def test_build_extra_body_int(mock_get_params):
    """Parámetro tipo int se convierte a entero."""
    mock_get_params.return_value = {
        "max_tokens": {"api_key": "options.num_predict", "type": "int"},
    }
    result = build_extra_body("ollama", {"max_tokens": "256"})
    assert result == {"options": {"num_predict": 256}}


@patch("app.provider_params.get_params_config")
def test_build_extra_body_float(mock_get_params):
    """Parámetro tipo float se convierte a float."""
    mock_get_params.return_value = {
        "temperature": {"api_key": "options.temperature", "type": "float"},
    }
    result = build_extra_body("ollama", {"temperature": "0.9"})
    assert result == {"options": {"temperature": 0.9}}


@patch("app.provider_params.get_params_config")
def test_build_extra_body_options_vacio_no_se_envia(mock_get_params):
    """Si el único contenido sería options vacío, no se incluye options."""
    mock_get_params.return_value = {
        "stop_sequences": {"api_key": "options.stop", "type": "string_list"},
    }
    # Lista vacía no se envía (string_list vacío se salta)
    result = build_extra_body("ollama", {"stop_sequences": ""})
    assert result == {}
    assert "options" not in result


def test_build_extra_body_none_o_vacio_devuelve_vacio():
    """model_params None o {} devuelve {}."""
    assert build_extra_body("ollama", None) == {}
    assert build_extra_body("ollama", {}) == {}


@patch("app.provider_params.get_params_config")
def test_build_extra_body_proveedor_sin_specs(mock_get_params):
    """Si el proveedor no tiene params config, devuelve {}."""
    mock_get_params.return_value = {}
    result = build_extra_body("unknown", {"temperature": 0.5})
    assert result == {}
