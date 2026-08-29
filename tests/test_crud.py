"""Tests unitarios del módulo crud."""
import pytest
from app import crud
from app.models import Conversation, Message


def test_create_conversation(db_session):
    conv = crud.create_conversation(
        db_session,
        title="Test",
        model_id="llama3.2",
        system_instruction_global="Sé breve.",
    )
    assert conv.id
    assert conv.title == "Test"
    assert conv.model_id == "llama3.2"
    assert conv.system_instruction_global == "Sé breve."
    assert conv.created_at is not None
    assert conv.updated_at is not None


def test_get_conversation(db_session):
    conv = crud.create_conversation(db_session, title="A", model_id="m")
    found = crud.get_conversation(db_session, conv.id)
    assert found is not None
    assert found.id == conv.id
    assert found.title == "A"

    assert crud.get_conversation(db_session, "00000000-0000-0000-0000-000000000000") is None


def test_list_conversations(db_session):
    assert crud.list_conversations(db_session) == []
    crud.create_conversation(db_session, title="Primera", model_id="m1")
    crud.create_conversation(db_session, title="Segunda", model_id="m2")
    convs = crud.list_conversations(db_session)
    assert len(convs) == 2
    # Orden por updated_at desc: la última creada primero
    assert convs[0].title == "Segunda"
    assert convs[1].title == "Primera"


def test_update_conversation(db_session):
    conv = crud.create_conversation(db_session, title="Antes", model_id="m1")
    updated = crud.update_conversation(
        db_session, conv.id, title="Después", model_id="m2", system_instruction_global="Inst."
    )
    assert updated is not None
    assert updated.title == "Después"
    assert updated.model_id == "m2"
    assert updated.system_instruction_global == "Inst."

    assert crud.update_conversation(db_session, "00000000-0000-0000-0000-000000000000", title="X") is None


def test_update_conversation_model_params(db_session):
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    assert conv.model_params is None
    params = {"temperature": 0.7, "num_ctx": 4096}
    updated = crud.update_conversation(db_session, conv.id, model_params=params)
    assert updated is not None
    import json
    assert json.loads(updated.model_params) == params
    updated2 = crud.update_conversation(db_session, conv.id, model_params={})
    assert updated2.model_params is None


def test_delete_conversation(db_session):
    conv = crud.create_conversation(db_session, title="Borrar", model_id="m")
    ok = crud.delete_conversation(db_session, conv.id)
    assert ok is True
    assert crud.get_conversation(db_session, conv.id) is None
    # Soft-delete: la fila sigue existiendo
    from app.models import Conversation

    row = db_session.query(Conversation).filter(Conversation.id == conv.id).first()
    assert row is not None
    assert row.deleted_at is not None

    assert crud.delete_conversation(db_session, "00000000-0000-0000-0000-000000000000") is False


def test_get_messages(db_session):
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    assert crud.get_messages(db_session, conv.id) == []

    crud.add_message(db_session, conv.id, "user", "Hola")
    crud.add_message(db_session, conv.id, "assistant", "Hola!")
    msgs = crud.get_messages(db_session, conv.id)
    assert len(msgs) == 2
    assert msgs[0].role == "user" and msgs[0].content == "Hola"
    assert msgs[1].role == "assistant" and msgs[1].content == "Hola!"


def test_add_message_with_instruction_override(db_session):
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    msg = crud.add_message(
        db_session, conv.id, "user", "Pregunta", instruction_override="Responde breve."
    )
    assert msg.role == "user"
    assert msg.content == "Pregunta"
    assert msg.instruction_override == "Responde breve."


def test_touch_conversation(db_session):
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    old_updated = conv.updated_at
    crud.touch_conversation(db_session, conv.id)
    db_session.refresh(conv)
    # updated_at puede ser el mismo en el mismo segundo; al menos no falla
    crud.touch_conversation(db_session, "00000000-0000-0000-0000-000000000000")
    # No debe lanzar


def test_get_message(db_session):
    """get_message devuelve el mensaje por id o None si no existe."""
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    msg = crud.add_message(db_session, conv.id, "user", "Hola")
    found = crud.get_message(db_session, conv.id, msg.id)
    assert found is not None
    assert found.id == msg.id
    assert found.content == "Hola"
    assert crud.get_message(db_session, conv.id, "00000000-0000-0000-0000-000000000000") is None
    assert crud.get_message(db_session, "00000000-0000-0000-0000-000000000000", msg.id) is None


def test_delete_message(db_session):
    """delete_message elimina por id; devuelve True si existía, False si no."""
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    msg = crud.add_message(db_session, conv.id, "user", "Borrar")
    ok = crud.delete_message(db_session, conv.id, msg.id)
    assert ok is True
    assert crud.get_message(db_session, conv.id, msg.id) is None
    assert crud.get_messages(db_session, conv.id) == []

    assert crud.delete_message(db_session, conv.id, "00000000-0000-0000-0000-000000000000") is False
    assert crud.delete_message(db_session, "00000000-0000-0000-0000-000000000000", msg.id) is False


def test_delete_last_message(db_session):
    """delete_last_message elimina el último mensaje; False si no hay mensajes."""
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    assert crud.delete_last_message(db_session, conv.id) is False

    crud.add_message(db_session, conv.id, "user", "Uno")
    crud.add_message(db_session, conv.id, "assistant", "Dos")
    ok = crud.delete_last_message(db_session, conv.id)
    assert ok is True
    msgs = crud.get_messages(db_session, conv.id)
    assert len(msgs) == 1
    assert msgs[0].content == "Uno"

    ok = crud.delete_last_message(db_session, conv.id)
    assert ok is True
    assert crud.get_messages(db_session, conv.id) == []
    assert crud.delete_last_message(db_session, conv.id) is False


def test_add_message_encadena_parent_y_hoja_activa(db_session):
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    u1 = crud.add_message(db_session, conv.id, "user", "Hola")
    a1 = crud.add_message(db_session, conv.id, "assistant", "Hola!")
    db_session.refresh(conv)
    assert u1.parent_id is None
    assert a1.parent_id == u1.id
    assert conv.active_leaf_message_id == a1.id


def test_add_message_fork_crea_hermano_y_cambia_hoja(db_session):
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    u1 = crud.add_message(db_session, conv.id, "user", "A")
    a1 = crud.add_message(db_session, conv.id, "assistant", "Ra")
    u2 = crud.add_message(db_session, conv.id, "user", "B")
    crud.add_message(db_session, conv.id, "assistant", "Rb")
    u3 = crud.add_message(db_session, conv.id, "user", "C", parent_id=a1.id)
    a3 = crud.add_message(db_session, conv.id, "assistant", "Rc")
    db_session.refresh(conv)
    assert u3.parent_id == a1.id
    assert a3.parent_id == u3.id
    assert conv.active_leaf_message_id == a3.id
    path = crud.get_path_to_message(db_session, conv.id, a3.id)
    assert [m.content for m in path] == ["A", "Ra", "C", "Rc"]


def test_delete_message_reparenta_hijos(db_session):
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    u1 = crud.add_message(db_session, conv.id, "user", "A")
    a1 = crud.add_message(db_session, conv.id, "assistant", "Ra")
    u2 = crud.add_message(db_session, conv.id, "user", "B")
    crud.delete_message(db_session, conv.id, a1.id)
    u2 = crud.get_message(db_session, conv.id, u2.id)
    assert u2 is not None
    assert u2.parent_id == u1.id


def test_clear_conversation_messages_limpia_hoja(db_session):
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    crud.add_message(db_session, conv.id, "user", "A")
    crud.clear_conversation_messages(db_session, conv.id)
    db_session.refresh(conv)
    assert conv.active_leaf_message_id is None


def test_clear_conversation_messages(db_session):
    """clear_conversation_messages elimina todos los mensajes y devuelve el count."""
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    assert crud.clear_conversation_messages(db_session, conv.id) == 0
    crud.add_message(db_session, conv.id, "user", "A")
    crud.add_message(db_session, conv.id, "assistant", "B")
    count = crud.clear_conversation_messages(db_session, conv.id)
    assert count == 2
    assert crud.get_messages(db_session, conv.id) == []


def test_update_conversation_inject_instruction_every(db_session):
    """update_conversation puede actualizar inject_instruction_every."""
    conv = crud.create_conversation(db_session, title="C", model_id="m")
    updated = crud.update_conversation(db_session, conv.id, inject_instruction_every=5)
    assert updated is not None
    assert updated.inject_instruction_every == 5
    updated2 = crud.update_conversation(db_session, conv.id, inject_instruction_every=0)
    assert updated2.inject_instruction_every is None


def test_fork_no_copia_mensajes_y_resuelve_historial_del_origen(db_session):
    origin = crud.create_conversation(db_session, title="Origen", model_id="m")
    u1 = crud.add_message(db_session, origin.id, "user", "A")
    a1 = crud.add_message(db_session, origin.id, "assistant", "Ra")
    crud.add_message(db_session, origin.id, "user", "B")
    crud.add_message(db_session, origin.id, "assistant", "Rb")
    child = crud.fork_conversation(db_session, origin.id, a1.id)
    assert child is not None
    assert child.id != origin.id
    assert child.forked_from_conversation_id == origin.id
    assert child.forked_from_message_id == a1.id
    assert crud.get_messages(db_session, child.id) == []
    inherited = crud.get_inherited_prefix(db_session, child)
    assert [m.content for m in inherited] == ["A", "Ra"]
    assert [m.id for m in inherited] == [u1.id, a1.id]
    crud.add_message(db_session, origin.id, "user", "C")
    crud.add_message(db_session, origin.id, "assistant", "Rc")
    inherited_after = crud.get_inherited_prefix(db_session, child)
    assert [m.content for m in inherited_after] == ["A", "Ra"]
    history = crud.get_resolved_history(db_session, child, None)
    assert [m.content for m in history] == ["A", "Ra"]


def test_fork_refleja_edicion_del_origen_en_el_prefijo(db_session):
    origin = crud.create_conversation(db_session, title="Origen", model_id="m")
    crud.add_message(db_session, origin.id, "user", "A")
    a1 = crud.add_message(db_session, origin.id, "assistant", "Ra")
    child = crud.fork_conversation(db_session, origin.id, a1.id)
    crud.update_message_content(db_session, origin.id, a1.id, "Ra editado")
    inherited = crud.get_inherited_prefix(db_session, child)
    assert [m.content for m in inherited] == ["A", "Ra editado"]


def test_fork_anidado_acumula_prefijo_del_origen(db_session):
    origin = crud.create_conversation(db_session, title="Origen", model_id="m")
    crud.add_message(db_session, origin.id, "user", "A")
    a1 = crud.add_message(db_session, origin.id, "assistant", "Ra")
    child = crud.fork_conversation(db_session, origin.id, a1.id)
    u2 = crud.add_message(db_session, child.id, "user", "B")
    a2 = crud.add_message(db_session, child.id, "assistant", "Rb")
    grandchild = crud.fork_conversation(db_session, child.id, a2.id)
    assert grandchild.forked_from_conversation_id == child.id
    inherited = crud.get_inherited_prefix(db_session, grandchild)
    assert [m.content for m in inherited] == ["A", "Ra", "B", "Rb"]
    from_inherited = crud.fork_conversation(db_session, child.id, a1.id)
    assert from_inherited.forked_from_conversation_id == origin.id
    assert [m.content for m in crud.get_inherited_prefix(db_session, from_inherited)] == ["A", "Ra"]
    assert u2.id not in {m.id for m in crud.get_inherited_prefix(db_session, from_inherited)}


def test_fork_ancla_inexistente_devuelve_none(db_session):
    origin = crud.create_conversation(db_session, title="Origen", model_id="m")
    assert crud.fork_conversation(db_session, origin.id, "00000000-0000-0000-0000-000000000000") is None
    assert crud.fork_conversation(db_session, "no-existe", "x") is None
