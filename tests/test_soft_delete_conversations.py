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


def test_hard_delete_from_trash_removes_row_and_messages(db_session):
    conv = crud.create_conversation(db_session, title="Definitivo", model_id="m")
    msg = crud.add_message(db_session, conv.id, "user", "borrarme")
    crud.delete_conversation(db_session, conv.id)

    assert crud.hard_delete_conversation(db_session, conv.id) is True
    assert (
        db_session.query(Conversation).filter(Conversation.id == conv.id).first() is None
    )
    assert crud.get_messages(db_session, conv.id) == []
    assert msg.id not in {m.id for m in crud.get_messages(db_session, conv.id)}


def test_hard_delete_requires_soft_deleted(db_session):
    conv = crud.create_conversation(db_session, title="Activa", model_id="m")
    assert crud.hard_delete_conversation(db_session, conv.id) is False
    assert crud.get_conversation(db_session, conv.id) is not None


def test_api_permanent_delete_from_trash(client, db_session):
    from unittest.mock import patch

    create = client.post("/api/conversations", json={"title": "Fuera", "model_id": "m"})
    cid = create.json()["id"]
    crud.add_message(db_session, cid, "assistant", "contenido")
    client.delete(f"/api/conversations/{cid}")

    with patch("app.routers.api_conversations.rag.delete_conversation_documents") as mock_rag:
        r = client.delete(f"/api/conversations/{cid}/permanent")
        assert r.status_code == 204
        mock_rag.assert_called_once_with(cid)

    assert client.get("/api/conversations/deleted").json() == []
    assert db_session.query(Conversation).filter(Conversation.id == cid).first() is None


def test_api_permanent_delete_rejects_active_conversation(client):
    create = client.post("/api/conversations", json={"title": "Viva", "model_id": "m"})
    cid = create.json()["id"]
    r = client.delete(f"/api/conversations/{cid}/permanent")
    assert r.status_code == 404
    assert client.get(f"/api/conversations/{cid}").status_code == 200


def test_purge_deleted_conversations_empties_trash(db_session):
    a = crud.create_conversation(db_session, title="a", model_id="m")
    b = crud.create_conversation(db_session, title="b", model_id="m")
    keep = crud.create_conversation(db_session, title="keep", model_id="m")
    crud.delete_conversation(db_session, a.id)
    crud.delete_conversation(db_session, b.id)

    deleted_ids = crud.purge_deleted_conversations(db_session)
    assert len(deleted_ids) == 2
    assert set(deleted_ids) == {a.id, b.id}
    assert crud.list_deleted_conversations(db_session) == []
    assert crud.get_conversation(db_session, keep.id) is not None
    assert db_session.query(Conversation).filter(Conversation.id == a.id).first() is None


def test_api_purge_deleted_conversations(client, db_session):
    from unittest.mock import patch

    ids = []
    for title in ("t1", "t2"):
        create = client.post("/api/conversations", json={"title": title, "model_id": "m"})
        cid = create.json()["id"]
        ids.append(cid)
        client.delete(f"/api/conversations/{cid}")

    with patch("app.routers.api_conversations.rag.delete_conversation_documents") as mock_rag:
        r = client.delete("/api/conversations/deleted")
        assert r.status_code == 200
        body = r.json()
        assert body["deleted"] == 2
        assert set(body["ids"]) == set(ids)
        assert mock_rag.call_count == 2

    assert client.get("/api/conversations/deleted").json() == []
