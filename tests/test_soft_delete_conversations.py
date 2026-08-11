"""Soft-delete de conversaciones: ocultar sin destruir; restaurar posible."""
from datetime import datetime

from app import crud
from app.models import Conversation


def test_soft_delete_hides_from_list_and_get_but_keeps_row(db_session):
    conv = crud.create_conversation(db_session, title="A borrar", model_id="m")
    msg = crud.add_message(db_session, conv.id, "assistant", "contenido valioso")

    assert crud.delete_conversation(db_session, conv.id) is True
    assert crud.get_conversation(db_session, conv.id) is None
    assert all(c.id != conv.id for c in crud.list_conversations(db_session))

    row = (
        db_session.query(Conversation)
        .filter(Conversation.id == conv.id)
        .first()
    )
    assert row is not None
    assert row.deleted_at is not None
    assert isinstance(row.deleted_at, datetime)

    kept = crud.get_messages(db_session, conv.id)
    assert len(kept) == 1
    assert kept[0].id == msg.id
    assert kept[0].content == "contenido valioso"


def test_restore_conversation_brings_it_back(db_session):
    conv = crud.create_conversation(db_session, title="Restaurable", model_id="m")
    crud.add_message(db_session, conv.id, "user", "hola")
    crud.delete_conversation(db_session, conv.id)

    restored = crud.restore_conversation(db_session, conv.id)
    assert restored is not None
    assert restored.deleted_at is None
    assert crud.get_conversation(db_session, conv.id) is not None
    assert any(c.id == conv.id for c in crud.list_conversations(db_session))
    assert len(crud.get_messages(db_session, conv.id)) == 1


def test_list_deleted_conversations(db_session):
    a = crud.create_conversation(db_session, title="viva", model_id="m")
    b = crud.create_conversation(db_session, title="muerta", model_id="m")
    crud.delete_conversation(db_session, b.id)

    deleted = crud.list_deleted_conversations(db_session)
    assert [c.id for c in deleted] == [b.id]
    assert a.id not in [c.id for c in deleted]


def test_api_soft_delete_does_not_wipe_rag(client, db_session):
    from unittest.mock import patch

    create = client.post("/api/conversations", json={"title": "RAG safe", "model_id": "m"})
    cid = create.json()["id"]
    crud.add_message(db_session, cid, "assistant", "conservar")

    with patch("app.routers.api_conversations.rag.delete_conversation_documents") as mock_rag:
        r = client.delete(f"/api/conversations/{cid}")
        assert r.status_code == 204
        mock_rag.assert_not_called()

    assert client.get(f"/api/conversations/{cid}").status_code == 404
    listed = client.get("/api/conversations").json()
    assert all(c["id"] != cid for c in listed)

    row = db_session.query(Conversation).filter(Conversation.id == cid).first()
    assert row is not None and row.deleted_at is not None
    db_session.expire_all()
    assert len(crud.get_messages(db_session, cid)) == 1


def test_api_restore_conversation(client, db_session):
    create = client.post("/api/conversations", json={"title": "Volver", "model_id": "m"})
    cid = create.json()["id"]
    client.delete(f"/api/conversations/{cid}")

    r = client.post(f"/api/conversations/{cid}/restore")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == cid
    assert body["title"] == "Volver"
    assert client.get(f"/api/conversations/{cid}").status_code == 200


def test_api_list_deleted_conversations(client):
    create = client.post("/api/conversations", json={"title": "En papelera", "model_id": "m"})
    cid = create.json()["id"]
    client.delete(f"/api/conversations/{cid}")

    r = client.get("/api/conversations/deleted")
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert cid in ids
