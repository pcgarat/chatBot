"""Tests del endpoint GET /api/models."""
import pytest
from unittest.mock import patch


@patch("app.routers.api_models.ollama_client.list_models")
def test_list_models_ok(mock_list_models, client):
    mock_list_models.return_value = ["llama3.2", "mistral:latest"]
    r = client.get("/api/models")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["name"] == "llama3.2"
    assert data[1]["name"] == "mistral:latest"
    mock_list_models.assert_called_once()


@patch("app.routers.api_models.ollama_client.list_models")
def test_list_models_empty(mock_list_models, client):
    mock_list_models.return_value = []
    r = client.get("/api/models")
    assert r.status_code == 200
    assert r.json() == []


@patch("app.routers.api_models.ollama_client.list_models")
def test_list_models_ollama_error(mock_list_models, client):
    mock_list_models.side_effect = ConnectionError("Ollama no disponible")
    r = client.get("/api/models")
    assert r.status_code == 503
    assert "Ollama" in r.json()["detail"]
