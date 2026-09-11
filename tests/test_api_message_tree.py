"""Tests HTTP de GET /api/message-tree/roots y .../children."""
from app import crud


def test_message_tree_roots_empty(client):
    r = client.get("/api/message-tree/roots")
    assert r.status_code == 200
    body = r.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["limit"] == 50
    assert body["offset"] == 0


def test_message_tree_same_conversation_flat_no_intra_children(client, db_session):
    origin = crud.create_conversation(db_session, title="Lineal", model_id="m")
    crud.add_message(db_session, origin.id, "user", "p1")
    a1 = crud.add_message(db_session, origin.id, "assistant", "r1")
    crud.add_message(db_session, origin.id, "user", "p2")
    a2 = crud.add_message(db_session, origin.id, "assistant", "r2")

    roots = client.get("/api/message-tree/roots").json()
    assert roots["total"] == 2
    ids = {it["id"] for it in roots["items"]}
    assert ids == {a1.id, a2.id}
    assert all(it["has_children"] is False for it in roots["items"])
    assert all(it["parent_message_id"] is None for it in roots["items"])

    kids = client.get(f"/api/message-tree/{a1.id}/children").json()
    assert kids == []


def test_message_tree_fork_child_is_fork_edge(client, db_session):
    origin = crud.create_conversation(db_session, title="Origen", model_id="m")
    crud.add_message(db_session, origin.id, "user", "p1")
    a1 = crud.add_message(db_session, origin.id, "assistant", "r1")
    child = crud.fork_conversation(db_session, origin.id, a1.id)
    crud.add_message(db_session, child.id, "user", "fq")
    fork_a = crud.add_message(db_session, child.id, "assistant", "fr")
    crud.add_message(db_session, child.id, "user", "fq2")
    fork_a2 = crud.add_message(db_session, child.id, "assistant", "fr2")

    kids = client.get(f"/api/message-tree/{a1.id}/children").json()
    assert [k["id"] for k in kids] == [fork_a.id, fork_a2.id]
    assert all(k["is_fork_edge"] is True for k in kids)
    assert all(k["conversation_id"] == child.id for k in kids)

    roots = client.get("/api/message-tree/roots").json()
    assert next(it for it in roots["items"] if it["id"] == a1.id)["has_children"] is True


def test_message_tree_children_404(client):
    r = client.get("/api/message-tree/no-existe/children")
    assert r.status_code == 404


def test_message_tree_roots_pagination(client, db_session):
    for i in range(3):
        c = crud.create_conversation(db_session, title=f"C{i}", model_id="m")
        crud.add_message(db_session, c.id, "user", "q")
        crud.add_message(db_session, c.id, "assistant", f"r{i}")

    page = client.get("/api/message-tree/roots", params={"limit": 2, "offset": 0}).json()
    assert page["total"] == 3
    assert len(page["items"]) == 2
    assert page["limit"] == 2

    page2 = client.get("/api/message-tree/roots", params={"limit": 2, "offset": 2}).json()
    assert len(page2["items"]) == 1


def test_message_tree_limit_over_max_is_422(client):
    r = client.get("/api/message-tree/roots", params={"limit": 101})
    assert r.status_code == 422
