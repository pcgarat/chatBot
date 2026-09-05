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


def test_list_messages_sort_image_promotes_old_message_with_new_image(client, db_session):
    from datetime import datetime, timedelta

    from app.models import IllustratedImage

    now = datetime.utcnow()
    conv = Conversation(title="Sort imagen", model_id="llama3.2", created_at=now - timedelta(days=3))
    db_session.add(conv)
    db_session.commit()
    old_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content="mensaje-antiguo",
        created_at=now - timedelta(days=2),
    )
    new_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content="mensaje-reciente",
        created_at=now - timedelta(hours=2),
    )
    no_img = Message(
        conversation_id=conv.id,
        role="assistant",
        content="sin-imagen",
        created_at=now - timedelta(minutes=10),
    )
    db_session.add_all([old_msg, new_msg, no_img])
    db_session.commit()
    db_session.add(
        IllustratedImage(
            message_id=old_msg.id,
            filename="old_msg_new_image.jpg",
            mode="txt2img",
            params_json="{}",
            created_at=now,
        )
    )
    db_session.add(
        IllustratedImage(
            message_id=new_msg.id,
            filename="new_msg_older_image.jpg",
            mode="txt2img",
            params_json="{}",
            created_at=now - timedelta(hours=6),
        )
    )
    db_session.commit()

    by_message = client.get("/api/messages", params={"sort": "message"}).json()
    assert [it["content_preview"] for it in by_message] == [
        "sin-imagen",
        "mensaje-reciente",
        "mensaje-antiguo",
    ]
    assert by_message[2]["latest_image_at"] is None

    by_image = client.get("/api/messages", params={"sort": "image"}).json()
    assert [it["content_preview"] for it in by_image] == [
        "mensaje-antiguo",
        "mensaje-reciente",
        "sin-imagen",
    ]
    assert by_image[0]["latest_image_at"]
    assert by_image[1]["latest_image_at"]
    assert by_image[2]["latest_image_at"] is None


def test_list_messages_sort_image_uses_newest_image_per_message(client, db_session):
    from datetime import datetime, timedelta

    from app.models import IllustratedImage

    now = datetime.utcnow()
    conv = Conversation(title="Max imagen", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    older = Message(
        conversation_id=conv.id,
        role="assistant",
        content="con-varias-fotos",
        created_at=now - timedelta(days=1),
    )
    newer = Message(
        conversation_id=conv.id,
        role="assistant",
        content="con-foto-media",
        created_at=now - timedelta(hours=1),
    )
    db_session.add_all([older, newer])
    db_session.commit()
    db_session.add_all(
        [
            IllustratedImage(
                message_id=older.id,
                filename="older_first.jpg",
                mode="txt2img",
                params_json="{}",
                created_at=now - timedelta(hours=8),
            ),
            IllustratedImage(
                message_id=older.id,
                filename="older_latest.jpg",
                mode="txt2img",
                params_json="{}",
                created_at=now,
            ),
            IllustratedImage(
                message_id=newer.id,
                filename="newer_only.jpg",
                mode="txt2img",
                params_json="{}",
                created_at=now - timedelta(hours=3),
            ),
        ]
    )
    db_session.commit()

    items = client.get("/api/messages", params={"sort": "image"}).json()
    assert [it["content_preview"] for it in items] == ["con-varias-fotos", "con-foto-media"]


def test_list_messages_invalid_sort_is_422(client):
    r = client.get("/api/messages", params={"sort": "created_at"})
    assert r.status_code == 422
