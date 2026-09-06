"""Tests de GET /api/messages (índice global de respuestas assistant)."""
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from app.models import Conversation, IllustratedImage, Message


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


def _page(client, **params):
    r = client.get("/api/messages", params=params or None)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, dict)
    assert isinstance(body["items"], list)
    assert "total" in body
    assert "limit" in body
    assert "offset" in body
    return body


def test_list_messages_empty(client):
    body = _page(client)
    assert body["items"] == []
    assert body["total"] == 0
    assert body["offset"] == 0
    assert body["search_in"] is None


@patch("app.routers.api_conversations.get_provider")
def test_list_messages_only_assistant_newest_first(mock_get_provider, client):
    _send_turn(client, mock_get_provider, "Primera", "hola", "respuesta-1")
    cid_b = _send_turn(client, mock_get_provider, "Segunda", "otra", "respuesta-2")

    body = _page(client)
    items = body["items"]
    assert body["total"] == 2
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

    items = _page(client)["items"]
    previews = [it["content_preview"] for it in items]
    assert "respuesta activa" in previews
    assert "sigue viva" not in previews


@patch("app.routers.api_conversations.get_provider")
def test_list_messages_preview_is_first_line_max_80(mock_get_provider, client):
    long_line = "x" * 120
    body_text = f"{long_line}\nsegunda linea"
    _send_turn(client, mock_get_provider, "Larga", "prompt", body_text)

    items = _page(client)["items"]
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

    items = _page(client)["items"]
    assert len(items) == 1
    assert items[0]["content_preview"] == "Había un faro."
    assert "<img" not in items[0]["content_preview"]


def test_list_messages_omits_prompt_generator_conversations(client, db_session):
    chat = Conversation(title="Relato", model_id="llama3.2", kind=Conversation.KIND_CHAT)
    generator = Conversation(
        title="txt2img",
        model_id="llama3.2",
        kind=Conversation.KIND_PROMPT_GENERATOR,
    )
    db_session.add_all([chat, generator])
    db_session.commit()
    story = Message(conversation_id=chat.id, role="assistant", content="Había un faro.")
    prompt = Message(
        conversation_id=generator.id,
        role="assistant",
        content="Prompt final generado con enfoque en la coreografía.",
    )
    db_session.add_all([story, prompt])
    db_session.commit()

    body = _page(client)
    previews = [it["content_preview"] for it in body["items"]]
    assert "Había un faro." in previews
    assert "Prompt final generado con enfoque en la coreografía." not in previews
    assert body["total"] == 1


def test_list_messages_collapses_identical_text_with_different_images(client, db_session):
    now = datetime.utcnow()
    conv = Conversation(title="Dup", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    older = Message(
        conversation_id=conv.id,
        role="assistant",
        content=(
            'Había un faro.\n'
            '<img src="/api/illustrated-images/old.jpg" class="chat-illustration" />\n'
            "El mar."
        ),
        created_at=now - timedelta(hours=2),
    )
    newer = Message(
        conversation_id=conv.id,
        role="assistant",
        content=(
            'Había un faro.\n'
            '<img src="/api/illustrated-images/new.jpg" class="chat-illustration" />\n'
            "El mar."
        ),
        created_at=now,
    )
    db_session.add_all([older, newer])
    db_session.commit()

    body = _page(client)
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["id"] == newer.id
    assert body["items"][0]["content_preview"] == "Había un faro."


def test_list_messages_keeps_distinct_bodies_with_same_first_line(client, db_session):
    conv = Conversation(title="Misma apertura", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    db_session.add_all(
        [
            Message(conversation_id=conv.id, role="assistant", content="Había un faro.\nVersión A"),
            Message(conversation_id=conv.id, role="assistant", content="Había un faro.\nVersión B"),
        ]
    )
    db_session.commit()

    body = _page(client)
    assert body["total"] == 2
    previews = [it["content_preview"] for it in body["items"]]
    assert previews == ["Había un faro.", "Había un faro."]


def test_list_messages_pagination_slices_unique_set(client, db_session):
    conv = Conversation(title="Páginas", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    now = datetime.utcnow()
    for i in range(5):
        db_session.add(
            Message(
                conversation_id=conv.id,
                role="assistant",
                content=f"unica-{i}",
                created_at=now + timedelta(minutes=i),
            )
        )
    db_session.commit()

    first = _page(client, limit=2, offset=0)
    assert first["total"] == 5
    assert first["limit"] == 2
    assert first["offset"] == 0
    assert [it["content_preview"] for it in first["items"]] == ["unica-4", "unica-3"]

    second = _page(client, limit=2, offset=2)
    assert second["total"] == 5
    assert [it["content_preview"] for it in second["items"]] == ["unica-2", "unica-1"]
    assert {it["id"] for it in first["items"]}.isdisjoint({it["id"] for it in second["items"]})


def test_list_messages_default_page_does_not_dump_everything(client, db_session):
    conv = Conversation(title="Muchas", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    for i in range(60):
        db_session.add(
            Message(conversation_id=conv.id, role="assistant", content=f"respuesta-{i:03d}")
        )
    db_session.commit()

    body = _page(client)
    assert body["total"] == 60
    assert body["limit"] == 50
    assert len(body["items"]) == 50

    rest = _page(client, limit=50, offset=50)
    assert len(rest["items"]) == 10
    ids = [it["id"] for it in body["items"] + rest["items"]]
    assert len(ids) == len(set(ids)) == 60


def test_list_messages_limit_over_max_is_422(client):
    r = client.get("/api/messages", params={"limit": 101})
    assert r.status_code == 422


def test_list_messages_search_title_does_not_include_body_only_hits(client, db_session):
    conv = Conversation(title="Buscar título", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    title_hit = Message(
        conversation_id=conv.id,
        role="assistant",
        content="El unicornio azul.\nNada más.",
    )
    body_hit = Message(
        conversation_id=conv.id,
        role="assistant",
        content="El faro antiguo.\nHabía un unicornio escondido.",
    )
    db_session.add_all([title_hit, body_hit])
    db_session.commit()

    body = _page(client, q="unicornio")
    assert body["search_in"] == "title"
    assert body["total"] == 1
    assert body["items"][0]["id"] == title_hit.id


def test_list_messages_search_falls_back_to_body_when_title_misses(client, db_session):
    conv = Conversation(title="Buscar cuerpo", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content="El faro antiguo.\nHabía un dragón rojo en la cala.",
    )
    db_session.add(msg)
    db_session.commit()

    body = _page(client, q="dragón")
    assert body["search_in"] == "content"
    assert body["total"] == 1
    assert body["items"][0]["id"] == msg.id


def test_list_messages_search_is_case_insensitive(client, db_session):
    conv = Conversation(title="Case", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    db_session.add(
        Message(conversation_id=conv.id, role="assistant", content="El Faro Norte.\nTexto")
    )
    db_session.commit()

    body = _page(client, q="faro")
    assert body["search_in"] == "title"
    assert body["total"] == 1


def test_list_messages_search_blank_is_unfiltered(client, db_session):
    conv = Conversation(title="Blank q", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    db_session.add(Message(conversation_id=conv.id, role="assistant", content="uno"))
    db_session.commit()

    body = _page(client, q="   ")
    assert body["search_in"] is None
    assert body["total"] == 1


@patch("app.routers.api_conversations.get_provider")
def test_list_messages_respects_optional_limit(mock_get_provider, client):
    for i in range(3):
        _send_turn(client, mock_get_provider, f"C{i}", "hola", f"r{i}")

    limited = _page(client, limit=1)
    assert len(limited["items"]) == 1
    assert limited["items"][0]["content_preview"] == "r2"
    assert limited["total"] == 3

    unbounded = _page(client)
    assert len(unbounded["items"]) == 3
    assert unbounded["total"] == 3


def test_list_messages_returns_more_than_former_200_cap(client, db_session):
    conv = Conversation(title="Muchas", model_id="llama3.2")
    db_session.add(conv)
    db_session.commit()
    for i in range(201):
        db_session.add(
            Message(conversation_id=conv.id, role="assistant", content=f"respuesta-{i:03d}")
        )
    db_session.commit()

    first = _page(client, limit=100, offset=0)
    second = _page(client, limit=100, offset=100)
    third = _page(client, limit=100, offset=200)
    items = first["items"] + second["items"] + third["items"]
    assert first["total"] == 201
    assert len(items) == 201
    ids = [it["id"] for it in items]
    assert len(ids) == len(set(ids))


def test_list_messages_fork_lists_inherited_reply_only_once(client, db_session):
    from app import crud

    origin = crud.create_conversation(db_session, title="Origen", model_id="m")
    crud.add_message(db_session, origin.id, "user", "pregunta origen")
    origin_reply = crud.add_message(db_session, origin.id, "assistant", "respuesta-origen")
    child = crud.fork_conversation(db_session, origin.id, origin_reply.id)
    assert child is not None
    crud.add_message(db_session, child.id, "user", "pregunta fork")
    fork_reply = crud.add_message(db_session, child.id, "assistant", "respuesta-fork")

    items = _page(client)["items"]
    previews = [it["content_preview"] for it in items]
    assert previews.count("respuesta-origen") == 1
    assert previews.count("respuesta-fork") == 1
    ids = [it["id"] for it in items]
    assert len(ids) == len(set(ids))
    assert origin_reply.id in ids
    assert fork_reply.id in ids
    origin_item = next(it for it in items if it["id"] == origin_reply.id)
    assert origin_item["conversation_id"] == origin.id


def test_list_messages_sort_image_promotes_old_message_with_new_image(client, db_session):
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

    by_message = _page(client, sort="message")["items"]
    assert [it["content_preview"] for it in by_message] == [
        "sin-imagen",
        "mensaje-reciente",
        "mensaje-antiguo",
    ]
    assert by_message[2]["latest_image_at"] is None

    by_image = _page(client, sort="image")["items"]
    assert [it["content_preview"] for it in by_image] == [
        "mensaje-antiguo",
        "mensaje-reciente",
        "sin-imagen",
    ]
    assert by_image[0]["latest_image_at"]
    assert by_image[1]["latest_image_at"]
    assert by_image[2]["latest_image_at"] is None


def test_list_messages_sort_image_uses_newest_image_per_message(client, db_session):
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

    items = _page(client, sort="image")["items"]
    assert [it["content_preview"] for it in items] == ["con-varias-fotos", "con-foto-media"]


def test_list_messages_invalid_sort_is_422(client):
    r = client.get("/api/messages", params={"sort": "created_at"})
    assert r.status_code == 422
