"""Árbol de mensajes: camino activo, hojas y backfill lineal."""
from types import SimpleNamespace

from app.services.conversation_tree import (
    children_grouped,
    latest_leaf_in_subtree,
    linear_parent_ids,
    path_from_messages,
)


def _msg(mid: str, parent_id: str | None = None, content: str = "") -> SimpleNamespace:
    return SimpleNamespace(id=mid, parent_id=parent_id, content=content)


def test_path_from_messages_root_to_leaf():
    msgs = [
        _msg("u1"),
        _msg("a1", "u1"),
        _msg("u2", "a1"),
        _msg("a2", "u2"),
    ]
    path = path_from_messages(msgs, "a2")
    assert [m.id for m in path] == ["u1", "a1", "u2", "a2"]


def test_path_from_messages_excluye_rama_hermana():
    msgs = [
        _msg("u1"),
        _msg("a1", "u1"),
        _msg("u2", "a1", "intento 1"),
        _msg("a2", "u2"),
        _msg("u3", "a1", "intento 2"),
        _msg("a3", "u3"),
    ]
    path = path_from_messages(msgs, "a3")
    assert [m.id for m in path] == ["u1", "a1", "u3", "a3"]
    assert "u2" not in {m.id for m in path}
    assert "a2" not in {m.id for m in path}


def test_path_from_messages_sin_leaf_o_desconocido_vacio():
    msgs = [_msg("u1")]
    assert path_from_messages(msgs, None) == []
    assert path_from_messages(msgs, "no-existe") == []
    assert path_from_messages([], "u1") == []


def test_children_grouped_conserva_orden():
    msgs = [
        _msg("a1", "u1"),
        _msg("u2", "a1"),
        _msg("u3", "a1"),
    ]
    groups = children_grouped(msgs)
    assert [m.id for m in groups["a1"]] == ["u2", "u3"]


def test_latest_leaf_in_subtree_elige_hoja_mas_reciente_de_esa_rama():
    msgs = [
        _msg("u1"),
        _msg("a1", "u1"),
        _msg("u2", "a1"),
        _msg("a2", "u2"),
        _msg("u3", "a1"),
        _msg("a3", "u3"),
        _msg("u4", "a3"),
        _msg("a4", "u4"),
    ]
    leaf = latest_leaf_in_subtree(msgs, "u3")
    assert leaf is not None
    assert leaf.id == "a4"
    other = latest_leaf_in_subtree(msgs, "u2")
    assert other is not None
    assert other.id == "a2"


def test_latest_leaf_in_subtree_nodo_sin_hijos_es_hoja():
    msgs = [_msg("u1"), _msg("a1", "u1")]
    leaf = latest_leaf_in_subtree(msgs, "a1")
    assert leaf is not None
    assert leaf.id == "a1"


def test_linear_parent_ids_encadena_en_orden():
    assert linear_parent_ids(["a", "b", "c"]) == [
        ("a", None),
        ("b", "a"),
        ("c", "b"),
    ]
    assert linear_parent_ids([]) == []
    assert linear_parent_ids(["solo"]) == [("solo", None)]
