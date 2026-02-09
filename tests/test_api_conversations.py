"""Tests de los endpoints de conversaciones y mensajes."""
import pytest
from unittest.mock import patch


def test_create_conversation(client):
    r = client.post(
        "/api/conversations",
        json={
            "title": "Mi chat",
            "model_id": "llama3.2",
            "system_instruction_global": "Responde breve.",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Mi chat"
    assert data["model_id"] == "llama3.2"
    assert data["system_instruction_global"] == "Responde breve."
    assert "id" in data
    assert data["messages"] == []


def test_create_conversation_defaults(client):
    r = client.post("/api/conversations", json={})
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Nueva conversación"
    assert data["model_id"] == "llama3.2"
    assert data["system_instruction_global"] is None


def test_list_conversations_empty(client):
    r = client.get("/api/conversations")
    assert r.status_code == 200
    assert r.json() == []


def test_list_conversations_after_create(client):
    client.post("/api/conversations", json={"title": "A", "model_id": "m1"})
    client.post("/api/conversations", json={"title": "B", "model_id": "m2"})
    r = client.get("/api/conversations")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    titles = [c["title"] for c in data]
    assert "A" in titles and "B" in titles


def test_get_conversation_404(client):
    r = client.get("/api/conversations/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert "no encontrada" in r.json()["detail"].lower()


def test_get_conversation_ok(client):
    create = client.post("/api/conversations", json={"title": "Test", "model_id": "m"})
    cid = create.json()["id"]
    r = client.get(f"/api/conversations/{cid}")
    assert r.status_code == 200
    assert r.json()["title"] == "Test"
    assert r.json()["messages"] == []


def test_update_conversation_ok(client):
    create = client.post("/api/conversations", json={"title": "Antes", "model_id": "m1"})
    cid = create.json()["id"]
    r = client.put(
        f"/api/conversations/{cid}",
        json={"title": "Después", "model_id": "m2", "system_instruction_global": "Sé breve."},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Después"
    assert data["model_id"] == "m2"
    assert data["system_instruction_global"] == "Sé breve."


def test_update_conversation_404(client):
    r = client.put(
        "/api/conversations/00000000-0000-0000-0000-000000000000",
        json={"title": "X"},
    )
    assert r.status_code == 404


def test_delete_conversation_ok(client):
    create = client.post("/api/conversations", json={"title": "Borrar", "model_id": "m"})
    cid = create.json()["id"]
    r = client.delete(f"/api/conversations/{cid}")
    assert r.status_code == 204
    get_r = client.get(f"/api/conversations/{cid}")
    assert get_r.status_code == 404


def test_delete_conversation_404(client):
    r = client.delete("/api/conversations/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


@patch("app.routers.api_conversations.ollama_client.chat")
def test_send_message_ok(mock_chat, client):
    mock_chat.return_value = "Hola, soy el asistente."
    create = client.post("/api/conversations", json={"title": "Chat", "model_id": "llama3.2"})
    cid = create.json()["id"]

    r = client.post(
        f"/api/conversations/{cid}/messages",
        json={"content": "Hola", "instruction_override": None},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["role"] == "assistant"
    assert data["content"] == "Hola, soy el asistente."
    mock_chat.assert_called_once()
    call_messages = mock_chat.call_args[0][1]
    assert call_messages[-1]["role"] == "user"
    assert call_messages[-1]["content"] == "Hola"

    # Historial: la conversación tiene 2 mensajes (user + assistant)
    get_conv = client.get(f"/api/conversations/{cid}")
    assert len(get_conv.json()["messages"]) == 2
    assert get_conv.json()["messages"][0]["content"] == "Hola"
    assert get_conv.json()["messages"][1]["content"] == "Hola, soy el asistente."


@patch("app.routers.api_conversations.ollama_client.chat")
def test_send_message_with_instruction_override(mock_chat, client):
    mock_chat.return_value = "Respuesta breve."
    create = client.post(
        "/api/conversations",
        json={"title": "Chat", "model_id": "m", "system_instruction_global": "Global."},
    )
    cid = create.json()["id"]

    r = client.post(
        f"/api/conversations/{cid}/messages",
        json={"content": "Dime algo", "instruction_override": "Responde en una frase."},
    )
    assert r.status_code == 200
    call_messages = mock_chat.call_args[0][1]
    # Debe haber un mensaje system con global + override
    assert call_messages[0]["role"] == "system"
    assert "Global." in call_messages[0]["content"]
    assert "Responde en una frase." in call_messages[0]["content"]
    # El mensaje del usuario no debe contener la instrucción visible
    assert call_messages[-1]["content"] == "Dime algo"


def test_send_message_404(client):
    r = client.post(
        "/api/conversations/00000000-0000-0000-0000-000000000000/messages",
        json={"content": "Hola"},
    )
    assert r.status_code == 404


def test_send_message_content_required(client):
    create = client.post("/api/conversations", json={"title": "C", "model_id": "m"})
    cid = create.json()["id"]
    r = client.post(f"/api/conversations/{cid}/messages", json={"content": ""})
    assert r.status_code == 422


@patch("app.routers.api_conversations.ollama_client.chat")
def test_send_message_ollama_error(mock_chat, client):
    mock_chat.side_effect = RuntimeError("Ollama error")
    create = client.post("/api/conversations", json={"title": "C", "model_id": "m"})
    cid = create.json()["id"]
    r = client.post(f"/api/conversations/{cid}/messages", json={"content": "Hola"})
    assert r.status_code == 502
    assert "Ollama" in r.json()["detail"]
