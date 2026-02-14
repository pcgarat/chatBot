"""Tests para el módulo de capacidades por proveedor (app/providers/capabilities.py)."""
import pytest
from unittest.mock import patch, MagicMock

from app.providers.capabilities import (
    get_provider_capabilities,
    get_model_details,
    SHOW_MODEL,
    UNLOAD_MODEL,
)


@patch("app.providers.capabilities.get_provider")
def test_get_provider_capabilities_ollama_has_show_and_unload(mock_get_provider):
    """Ollama tiene show_model y unload_model_from_memory."""
    mock_provider = MagicMock()
    mock_provider.show_model = lambda x: None
    mock_provider.unload_model_from_memory = lambda x: None
    mock_get_provider.return_value = mock_provider

    caps = get_provider_capabilities("ollama")
    assert SHOW_MODEL in caps
    assert UNLOAD_MODEL in caps
    assert len(caps) == 2


@patch("app.providers.capabilities.get_provider")
def test_get_provider_capabilities_provider_without_show(mock_get_provider):
    """Proveedor sin show_model no incluye esa capacidad."""
    mock_provider = MagicMock(spec=["provider_name", "list_models", "chat", "chat_stream", "validate_connection"])
    del mock_provider.show_model
    mock_get_provider.return_value = mock_provider

    caps = get_provider_capabilities("mancer")
    assert SHOW_MODEL not in caps


@patch("app.providers.capabilities.get_provider")
def test_get_provider_capabilities_invalid_provider(mock_get_provider):
    """Proveedor inexistente devuelve lista vacía."""
    mock_get_provider.side_effect = ValueError("Proveedor 'invalid' no soportado")
    caps = get_provider_capabilities("invalid")
    assert caps == []


@patch("app.providers.capabilities.get_provider")
def test_get_model_details_returns_dict_when_supported(mock_get_provider):
    """get_model_details devuelve el dict de show_model cuando el proveedor lo soporta."""
    mock_provider = MagicMock()
    mock_provider.show_model.return_value = {"details": {"family": "llama"}, "fetched_at": "2025-01-01T00:00:00Z"}
    mock_get_provider.return_value = mock_provider

    result = get_model_details("ollama", "llama3.2")
    assert result == {"details": {"family": "llama"}, "fetched_at": "2025-01-01T00:00:00Z"}
    mock_provider.show_model.assert_called_once_with("llama3.2")


@patch("app.providers.capabilities.get_provider")
def test_get_model_details_returns_none_when_provider_has_no_show(mock_get_provider):
    """get_model_details devuelve None si el proveedor no implementa show_model."""
    mock_provider = MagicMock(spec=["provider_name", "list_models"])
    mock_get_provider.return_value = mock_provider

    result = get_model_details("mancer", "mytholite")
    assert result is None


@patch("app.providers.capabilities.get_provider")
def test_get_model_details_returns_none_on_value_error(mock_get_provider):
    """get_model_details devuelve None si el proveedor no existe."""
    mock_get_provider.side_effect = ValueError("Proveedor no soportado")
    result = get_model_details("unknown", "m1")
    assert result is None
