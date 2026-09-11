"""Árbol unificado: plano por conversación; un nivel más solo en forks."""
from app import crud
from app.services import message_tree as mt


def _linear_thread(db):
    origin = crud.create_conversation(db, title="Lineal", model_id="m")
    u1 = crud.add_message(db, origin.id, "user", "p1")
    a1 = crud.add_message(db, origin.id, "assistant", "r1")
    u2 = crud.add_message(db, origin.id, "user", "p2")
    a2 = crud.add_message(db, origin.id, "assistant", "r2")
    u3 = crud.add_message(db, origin.id, "user", "p3")
    a3 = crud.add_message(db, origin.id, "assistant", "r3")
    return origin, {"u1": u1, "a1": a1, "u2": u2, "a2": a2, "u3": u3, "a3": a3}


def test_unified_parent_linear_helper(db_session):
    _, msgs = _linear_thread(db_session)
    own = crud.get_messages(db_session, msgs["a1"].conversation_id)
    by_id = {m.id: m for m in own}
    assert mt.unified_parent_assistant_id(by_id, msgs["a1"]) is None
    assert mt.unified_parent_assistant_id(by_id, msgs["a2"]) == msgs["a1"].id
    assert mt.unified_parent_assistant_id(by_id, msgs["a3"]) == msgs["a2"].id


def test_same_conversation_messages_are_flat_roots(db_session):
    _, msgs = _linear_thread(db_session)
    roots = mt.list_root_nodes(db_session, limit=50, offset=0)
    root_ids = {n.id for n in roots.nodes}
    assert root_ids == {msgs["a1"].id, msgs["a2"].id, msgs["a3"].id}
    assert all(n.parent_message_id is None for n in roots.nodes)
    assert all(n.is_fork_edge is False for n in roots.nodes)
    assert all(n.has_children is False for n in roots.nodes)
    assert mt.list_child_nodes(db_session, msgs["a1"].id) == []
    assert mt.list_child_nodes(db_session, msgs["a2"].id) == []


def test_sibling_attempts_are_flat_roots(db_session):
    origin = crud.create_conversation(db_session, title="Intentos", model_id="m")
    crud.add_message(db_session, origin.id, "user", "p1")
    a1 = crud.add_message(db_session, origin.id, "assistant", "r1")
    u2 = crud.add_message(db_session, origin.id, "user", "intento1", parent_id=a1.id)
    a2 = crud.add_message(db_session, origin.id, "assistant", "r-intento1", parent_id=u2.id)
    u3 = crud.add_message(db_session, origin.id, "user", "intento2", parent_id=a1.id)
    a3 = crud.add_message(db_session, origin.id, "assistant", "r-intento2", parent_id=u3.id)

    roots = mt.list_root_nodes(db_session, limit=50, offset=0)
    ids = {n.id for n in roots.nodes}
    assert ids == {a1.id, a2.id, a3.id}
    assert mt.list_child_nodes(db_session, a1.id) == []


def test_fork_opens_one_level_with_all_fork_assistants(db_session):
    origin = crud.create_conversation(db_session, title="Origen", model_id="m")
    crud.add_message(db_session, origin.id, "user", "p1")
    a1 = crud.add_message(db_session, origin.id, "assistant", "r1")
    child = crud.fork_conversation(db_session, origin.id, a1.id)
    assert child is not None
    crud.add_message(db_session, child.id, "user", "fork-q1")
    fork_a1 = crud.add_message(db_session, child.id, "assistant", "fork-r1")
    crud.add_message(db_session, child.id, "user", "fork-q2")
    fork_a2 = crud.add_message(db_session, child.id, "assistant", "fork-r2")

    kids = mt.list_child_nodes(db_session, a1.id)
    assert [n.id for n in kids] == [fork_a1.id, fork_a2.id]
    assert all(n.is_fork_edge is True for n in kids)
    assert all(n.parent_message_id == a1.id for n in kids)
    assert all(n.conversation_id == child.id for n in kids)

    roots = mt.list_root_nodes(db_session, limit=50, offset=0)
    root_ids = {n.id for n in roots.nodes}
    assert a1.id in root_ids
    assert fork_a1.id not in root_ids
    assert fork_a2.id not in root_ids

    a1_node = next(n for n in roots.nodes if n.id == a1.id)
    assert a1_node.has_children is True


def test_fork_without_assistant_omitted(db_session):
    origin = crud.create_conversation(db_session, title="Origen", model_id="m")
    crud.add_message(db_session, origin.id, "user", "p1")
    a1 = crud.add_message(db_session, origin.id, "assistant", "r1")
    child = crud.fork_conversation(db_session, origin.id, a1.id)
    assert child is not None
    assert mt.list_child_nodes(db_session, a1.id) == []
    roots = mt.list_root_nodes(db_session, limit=10, offset=0)
    assert next(n for n in roots.nodes if n.id == a1.id).has_children is False


def test_nested_fork_under_fork_message(db_session):
    origin = crud.create_conversation(db_session, title="Origen", model_id="m")
    crud.add_message(db_session, origin.id, "user", "p1")
    a1 = crud.add_message(db_session, origin.id, "assistant", "r1")
    child = crud.fork_conversation(db_session, origin.id, a1.id)
    crud.add_message(db_session, child.id, "user", "fq")
    fork_a = crud.add_message(db_session, child.id, "assistant", "fr")
    grand = crud.fork_conversation(db_session, child.id, fork_a.id)
    crud.add_message(db_session, grand.id, "user", "gq")
    grand_a = crud.add_message(db_session, grand.id, "assistant", "gr")

    kids = mt.list_child_nodes(db_session, a1.id)
    assert [n.id for n in kids] == [fork_a.id]
    assert kids[0].has_children is True
    nested = mt.list_child_nodes(db_session, fork_a.id)
    assert [n.id for n in nested] == [grand_a.id]
    assert nested[0].is_fork_edge is True


def test_roots_exclude_trashed_and_prompt_generator(db_session):
    live = crud.create_conversation(db_session, title="Viva", model_id="m")
    crud.add_message(db_session, live.id, "user", "q")
    live_a = crud.add_message(db_session, live.id, "assistant", "live-r")

    trashed = crud.create_conversation(db_session, title="Papelera", model_id="m")
    crud.add_message(db_session, trashed.id, "user", "q")
    trash_a = crud.add_message(db_session, trashed.id, "assistant", "trash-r")
    crud.delete_conversation(db_session, trashed.id)

    pg = crud.create_conversation(
        db_session, title="txt2img", model_id="m", kind="prompt_generator", seed_prompt_generator_template=False
    )
    crud.add_message(db_session, pg.id, "assistant", "pg-template")

    roots = mt.list_root_nodes(db_session, limit=50, offset=0)
    ids = [n.id for n in roots.nodes]
    assert live_a.id in ids
    assert trash_a.id not in ids
    assert not any(n.content_preview == "pg-template" for n in roots.nodes)


def test_preview_max_80(db_session):
    origin = crud.create_conversation(db_session, title="Preview", model_id="m")
    long = "x" * 120
    crud.add_message(db_session, origin.id, "user", "q")
    a1 = crud.add_message(db_session, origin.id, "assistant", long)
    roots = mt.list_root_nodes(db_session, limit=10, offset=0)
    node = next(n for n in roots.nodes if n.id == a1.id)
    assert len(node.content_preview) <= 80
