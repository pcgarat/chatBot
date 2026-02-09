from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Conversation, Message


def create_conversation(
    db: Session,
    title: str = "Nueva conversación",
    model_id: str = "llama3.2",
    system_instruction_global: str | None = None,
) -> Conversation:
    conv = Conversation(
        title=title,
        model_id=model_id,
        system_instruction_global=system_instruction_global,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(db: Session, conversation_id: str) -> Conversation | None:
    return db.query(Conversation).filter(Conversation.id == conversation_id).first()


def list_conversations(db: Session) -> list[Conversation]:
    return db.query(Conversation).order_by(Conversation.updated_at.desc()).all()


def update_conversation(
    db: Session,
    conversation_id: str,
    title: str | None = None,
    model_id: str | None = None,
    system_instruction_global: str | None = None,
) -> Conversation | None:
    conv = get_conversation(db, conversation_id)
    if not conv:
        return None
    if title is not None:
        conv.title = title
    if model_id is not None:
        conv.model_id = model_id
    if system_instruction_global is not None:
        conv.system_instruction_global = system_instruction_global
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conv)
    return conv


def delete_conversation(db: Session, conversation_id: str) -> bool:
    conv = get_conversation(db, conversation_id)
    if not conv:
        return False
    db.delete(conv)
    db.commit()
    return True


def get_messages(db: Session, conversation_id: str) -> list[Message]:
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .all()
    )


def add_message(
    db: Session,
    conversation_id: str,
    role: str,
    content: str,
    instruction_override: str | None = None,
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        instruction_override=instruction_override,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def touch_conversation(db: Session, conversation_id: str) -> None:
    conv = get_conversation(db, conversation_id)
    if conv:
        conv.updated_at = datetime.utcnow()
        db.commit()
