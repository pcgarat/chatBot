"""Tests unitarios del cliente Ollama (con mocks del Client)."""
import pytest
from unittest.mock import MagicMock, patch


@patch("app.ollama_client.get_ollama_client")
def test_list_models(mock_get_client):
    mock_client = MagicMock()
    mock_client.list.return_value = {
        "models": [
            {"name": "llama3.2"},
            {"name": "mistral:latest"},
        ]
    }
    mock_get_client.return_value = mock_client

    from app import ollama_client
    result = ollama_client.list_models()
    assert result == ["llama3.2", "mistral:latest"]
    mock_client.list.assert_called_once()


@patch("app.ollama_client.get_ollama_client")
def test_list_models_empty(mock_get_client):
    mock_client = MagicMock()
    mock_client.list.return_value = {"models": []}
    mock_get_client.return_value = mock_client

    from app import ollama_client
    result = ollama_client.list_models()
    assert result == []


@patch("app.ollama_client.get_ollama_client")
def test_chat(mock_get_client):
    mock_client = MagicMock()
    mock_client.chat.return_value = {
        "message": {"role": "assistant", "content": "Hola desde el modelo."},
    }
    mock_get_client.return_value = mock_client

    from app import ollama_client
    result = ollama_client.chat("llama3.2", [{"role": "user", "content": "Hola"}])
    assert result == "Hola desde el modelo."
    mock_client.chat.assert_called_once_with(
        model="llama3.2",
        messages=[{"role": "user", "content": "Hola"}],
    )


@patch("app.ollama_client.get_ollama_client")
def test_chat_empty_response(mock_get_client):
    mock_client = MagicMock()
    mock_client.chat.return_value = {"message": {}}
    mock_get_client.return_value = mock_client

    from app import ollama_client
    result = ollama_client.chat("m", [])
    assert result == ""
