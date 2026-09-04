"""Tests de GET /api/messages (índice global de respuestas assistant)."""
from unittest.mock import MagicMock, patch

from app.models import Conversation, Message


def _send_turn(client, mock_get_provider, title: str, user_content: str, assistant_content: str) -> str:
    mock_get_provider.return_value = MagicMock()
    mock_get_provider.return_value.chat.return_value = assistant_content
    cid = client.post(
        "/api/conversations",
        json={"title": title, "model_id": "llama3.2"},
    ).json()["id"]
    r = client.post(
        f"/api/conversations/{cid}/messages",
        json={"content": user_content},
    )
    assert r.status_code == 200
    return cid


def test_list_messages_empty(client):
    r = client.get("/api/messages")
    assert r.status_code == 200
    assert r.json() == []


@patch("app.routers.api_conversations.get_provider")
def test_list_messages_only_assistant_newest_first(mock_get_provider, client):
    _send_turn(client, mock_get_provider, "Primera", "hola", "respuesta-1")
    cid_b = _send_turn(client, mock_get_provider, "Segunda", "otra", "respuesta-2")

    r = client.get("/api/messages")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 2
    assert [it["content_preview"] for it in items] == ["respuesta-2", "respuesta-1"]
    assert items[0]["conversation_title"] == "Segunda"
    assert items[0]["conversation_id"] == cid_b
    assert items[0]["parent_id"]
    conv = client.get(f"/api/conversations/{cid_b}").json()
    user = next(m for m in conv["messages"] if m["role"] == "user")
    assistant = next(m for m in conv["messages"] if m["role"] == "assistant")
    assert items[0]["id"] == assistant["id"]
    assert items[0]["parent_id"] == user["id"]
    assert "created_at" in items[0]


@patch("app.routers.api_conversations.get_provider")
def test_list_messages_omits_trashed_conversations(mock_get_provider, client):
    cid = _send_turn(client, mock_get_provider, "A borrar", "hola", "sigue viva")
    _send_turn(client, mock_get_provider, "Activa", "hola", "respuesta activa")
    assert client.delete(f"/api/conversations/{cid}").status_code == 204

    items = client.get("/api/messages").json()
    previews = [it["content_preview"] for it in items]
    assert "respuesta activa" in previews
    assert "sigue viva" not in previews


@patch("app.routers.api_conversations.get_provider")
def test_list_messages_preview_is_first_line_max_80(mock_get_provider, client):
    long_line = "x" * 120
    body = f"{long_line}\nsegunda linea"
    _send_turn(client, mock_get_provider, "Larga", "prompt", body)

    items = client.get("/api/messages").json()
    assert len(items) == 1
    assert items[0]["content_preview"] == "x" * 80
    assert "segunda" not in items[0]["content_preview"]


def test_list_messages_preview_strips_illustration_html(client, db_session):
    conv = Conversation(title="Con fotos", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    user = Message(conversation_id=conv.id, role="user", content="ilustra")
    db_session.add(user)
    db_session.commit()
    assistant = Message(
        conversation_id=conv.id,
        parent_id=user.id,
        role="assistant",
        content=(
            'Había un faro.\n'
            '<img src="/api/illustrated-images/aaa_s1.jpg" class="chat-illustration" />\n'
            "El mar."
        ),
    )
    db_session.add(assistant)
    db_session.commit()

    items = client.get("/api/messages").json()
    assert len(items) == 1
    assert items[0]["content_preview"] == "Había un faro."
    assert "<img" not in items[0]["content_preview"]


@patch("app.routers.api_conversations.get_provider")
def test_list_messages_respects_limit_and_clamps_above_200(mock_get_provider, client):
    for i in range(3):
        _send_turn(client, mock_get_provider, f"C{i}", "hola", f"r{i}")

    limited = client.get("/api/messages", params={"limit": 1})
    assert limited.status_code == 200
    assert len(limited.json()) == 1
    assert limited.json()[0]["content_preview"] == "r2"

    clamped = client.get("/api/messages", params={"limit": 999})
    assert clamped.status_code == 200
    assert len(clamped.json()) == 3
