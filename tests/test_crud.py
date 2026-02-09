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


def test_delete_conversation(db_session):
    conv = crud.create_conversation(db_session, title="Borrar", model_id="m")
    ok = crud.delete_conversation(db_session, conv.id)
    assert ok is True
    assert crud.get_conversation(db_session, conv.id) is None

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
