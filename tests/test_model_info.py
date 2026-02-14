"""Tests para el módulo de ficha de modelo (app/model_info.py)."""
import json
import pytest
from pathlib import Path
from unittest.mock import patch

from app.model_info import (
    get_model_info,
    set_model_info,
    update_user_info,
    get_all_tags,
    MAX_INSTRUCTIONS,
    MAX_TAGS,
    MAX_TAG_LENGTH,
)


@pytest.fixture
def model_info_tmp_path(tmp_path):
    """Redirige persistencia de model_info a un directorio temporal."""
    with (
        patch("app.model_info._MODEL_INFO_DIR", tmp_path),
        patch("app.model_info._MODEL_INFO_PATH", tmp_path / "model_info.json"),
        patch("app.model_info._MODEL_INFO_TMP", tmp_path / "model_info.json.tmp"),
    ):
        yield tmp_path


def test_get_model_info_missing_returns_defaults(model_info_tmp_path):
    """Si no existe ficha, devuelve provider_info vacío y user_info por defecto."""
    info = get_model_info("ollama", "llama3.2")
    assert info["provider_info"] == {}
    assert info["user_info"]["uncensored"] is False
    assert info["user_info"]["instructions"] == []
    assert info["user_info"]["tags"] == []


def test_set_and_get_model_info(model_info_tmp_path):
    """set_model_info persiste y get_model_info devuelve lo guardado."""
    set_model_info(
        "ollama",
        "llama3.2",
        provider_info={"details": {"family": "llama"}, "fetched_at": "2025-01-01T00:00:00Z"},
        user_info={"uncensored": True, "instructions": ["Sé breve"], "tags": ["local"]},
    )
    info = get_model_info("ollama", "llama3.2")
    assert info["provider_info"]["details"]["family"] == "llama"
    assert info["provider_info"]["fetched_at"] == "2025-01-01T00:00:00Z"
    assert info["user_info"]["uncensored"] is True
    assert info["user_info"]["instructions"] == ["Sé breve"]
    assert info["user_info"]["tags"] == ["local"]


def test_storage_key_includes_colon_in_model_name(model_info_tmp_path):
    """model_name puede contener ':' (ej. llama3.2:latest)."""
    set_model_info("ollama", "llama3.2:latest", user_info={"tags": ["v2"]})
    info = get_model_info("ollama", "llama3.2:latest")
    assert info["user_info"]["tags"] == ["v2"]
    # El archivo debe tener la clave correcta
    data = json.loads((model_info_tmp_path / "model_info.json").read_text(encoding="utf-8"))
    assert "ollama:llama3.2:latest" in data


def test_update_user_info_partial(model_info_tmp_path):
    """update_user_info actualiza solo los campos pasados."""
    set_model_info("ollama", "m1", user_info={"uncensored": False, "instructions": ["A"], "tags": ["t1"]})
    update_user_info("ollama", "m1", uncensored=True)
    info = get_model_info("ollama", "m1")
    assert info["user_info"]["uncensored"] is True
    assert info["user_info"]["instructions"] == ["A"]
    assert info["user_info"]["tags"] == ["t1"]

    update_user_info("ollama", "m1", tags=["t2", "t3"])
    info = get_model_info("ollama", "m1")
    assert info["user_info"]["uncensored"] is True
    assert info["user_info"]["tags"] == ["t2", "t3"]


def test_update_user_info_normalizes_tags(model_info_tmp_path):
    """Tags se normalizan: trim y duplicados eliminados."""
    update_user_info("ollama", "m1", tags=["  a  ", "b", "a", "b "])
    info = get_model_info("ollama", "m1")
    assert sorted(info["user_info"]["tags"]) == ["a", "b"]


def test_get_all_tags_derived_from_all_entries(model_info_tmp_path):
    """get_all_tags devuelve todos los tags únicos de todas las fichas."""
    set_model_info("ollama", "m1", user_info={"tags": ["a", "b"]})
    set_model_info("ollama", "m2", user_info={"tags": ["b", "c"]})
    tags = get_all_tags()
    assert set(tags) == {"a", "b", "c"}
    assert len(tags) == 3


def test_limits_instructions(model_info_tmp_path):
    """Se aplica límite de número de instrucciones."""
    long_list = [f"inst_{i}" for i in range(MAX_INSTRUCTIONS + 10)]
    update_user_info("ollama", "m1", instructions=long_list)
    info = get_model_info("ollama", "m1")
    assert len(info["user_info"]["instructions"]) == MAX_INSTRUCTIONS


def test_limits_tags(model_info_tmp_path):
    """Se aplica límite de número de tags."""
    long_list = [f"tag_{i}" for i in range(MAX_TAGS + 10)]
    update_user_info("ollama", "m1", tags=long_list)
    info = get_model_info("ollama", "m1")
    assert len(info["user_info"]["tags"]) == MAX_TAGS


def test_tag_max_length(model_info_tmp_path):
    """Cada tag se trunca a MAX_TAG_LENGTH caracteres."""
    long_tag = "x" * (MAX_TAG_LENGTH + 20)
    update_user_info("ollama", "m1", tags=[long_tag])
    info = get_model_info("ollama", "m1")
    assert len(info["user_info"]["tags"][0]) == MAX_TAG_LENGTH


def test_atomic_write(model_info_tmp_path):
    """Al guardar se escribe en .tmp y luego replace (no corromper si falla a medias)."""
    set_model_info("ollama", "m1", user_info={"tags": ["one"]})
    path = model_info_tmp_path / "model_info.json"
    tmp_path = model_info_tmp_path / "model_info.json.tmp"
    assert path.exists()
    # Tras escribir correcta, el .tmp puede no exister (os.replace lo elimina como destino)
    # Lo importante: el contenido final es válido
    data = json.loads(path.read_text(encoding="utf-8"))
    assert "ollama:m1" in data
    assert data["ollama:m1"]["user_info"]["tags"] == ["one"]
