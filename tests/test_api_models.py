"""Tests del endpoint GET /api/models y /api/providers."""
import pytest
from unittest.mock import patch, MagicMock

from app.providers.base import ProviderModelInfo


@patch("app.routers.api_models.get_provider")
def test_list_models_ok(mock_get_provider, client):
    mock_provider = MagicMock()
    mock_provider.list_models.return_value = [
        ProviderModelInfo(name="llama3.2", provider="ollama"),
        ProviderModelInfo(name="mistral:latest", provider="ollama"),
    ]
    mock_get_provider.return_value = mock_provider
    r = client.get("/api/models")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["name"] == "llama3.2"
    assert data[1]["name"] == "mistral:latest"
    mock_provider.list_models.assert_called_once()


@patch("app.routers.api_models.get_provider")
def test_list_models_empty(mock_get_provider, client):
    mock_provider = MagicMock()
    mock_provider.list_models.return_value = []
    mock_get_provider.return_value = mock_provider
    r = client.get("/api/models")
    assert r.status_code == 200
    assert r.json() == []


@patch("app.routers.api_models.get_provider")
def test_list_models_provider_error(mock_get_provider, client):
    mock_provider = MagicMock()
    mock_provider.list_models.side_effect = ConnectionError("Provider no disponible")
    mock_get_provider.return_value = mock_provider
    r = client.get("/api/models")
    assert r.status_code == 503
    assert "proveedor" in r.json()["detail"].lower()


def test_get_provider_params_ollama(client):
    """GET /api/providers/ollama/params devuelve los parámetros definidos en config."""
    r = client.get("/api/providers/ollama/params")
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "ollama"
    assert "params" in data
    params = data["params"]
    assert "temperature" in params
    assert params["temperature"].get("api_key") == "options.temperature"
    assert params["temperature"].get("default") == 0.8
    assert "max_tokens" in params
    assert params["max_tokens"].get("api_key") == "options.num_predict"


def test_get_provider_params_unknown(client):
    """GET /api/providers/unknown/params devuelve params vacío."""
    r = client.get("/api/providers/unknown_provider_xyz/params")
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "unknown_provider_xyz"
    assert data["params"] == {}


def test_get_provider_presets_ollama(client):
    """GET /api/providers/ollama/presets devuelve presets desde config/ollama.json."""
    r = client.get("/api/providers/ollama/presets")
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "ollama"
    assert "presets" in data
    presets = data["presets"]
    assert isinstance(presets, dict)
    # config/ollama.json tiene entradas por nombre de modelo
    if presets:
        name = next(iter(presets))
        entry = presets[name]
        assert isinstance(entry, dict)
        assert "temperature" in entry or "max_tokens" in entry


def test_get_provider_presets_unknown(client):
    """GET /api/providers/unknown/presets devuelve presets vacío si no hay archivo."""
    r = client.get("/api/providers/unknown_provider_xyz/presets")
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "unknown_provider_xyz"
    assert data["presets"] == {}


@patch("app.routers.api_models.ProviderFactory.list_available_providers")
def test_list_providers(mock_list_providers, client):
    mock_list_providers.return_value = ["ollama", "mancer"]
    r = client.get("/api/providers")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["name"] == "ollama"
    assert data[1]["name"] == "mancer"


@patch("app.routers.api_models.get_provider")
def test_list_provider_models(mock_get_provider, client):
    mock_provider = MagicMock()
    mock_provider.list_models.return_value = [
        ProviderModelInfo(name="mytholite", provider="mancer", context_length=8192),
    ]
    mock_get_provider.return_value = mock_provider
    r = client.get("/api/providers/mancer/models")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["name"] == "mytholite"
    assert data[0]["provider"] == "mancer"
    assert data[0]["context_length"] == 8192


@patch("app.routers.api_models.get_provider")
def test_list_provider_models_invalid_provider(mock_get_provider, client):
    mock_get_provider.side_effect = ValueError("Proveedor 'invalid' no soportado")
    r = client.get("/api/providers/invalid/models")
    assert r.status_code == 400
    assert "no soportado" in r.json()["detail"]
