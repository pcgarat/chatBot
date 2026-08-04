import json
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Conversation, IllustratedImage, Message, Rule

# Sentinel para "no actualizar inject_instruction_every" en update_conversation
_INJECT_UNSET = object()
# Sentinel para "no actualizar instruction_override" (omitido en el body); None = borrar
INSTRUCTION_OVERRIDE_UNSET = object()


# ----- Rules (biblioteca) -----
def create_rule(db: Session, title: str = "", content: str = "") -> Rule:
    rule = Rule(title=title, content=content)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def get_rule(db: Session, rule_id: str) -> Rule | None:
    return db.query(Rule).filter(Rule.id == rule_id).first()


def list_rules(db: Session) -> list[Rule]:
    return db.query(Rule).order_by(Rule.updated_at.desc()).all()


def update_rule(db: Session, rule_id: str, title: str | None = None, content: str | None = None) -> Rule | None:
    rule = get_rule(db, rule_id)
    if not rule:
        return None
    if title is not None:
        rule.title = title
    if content is not None:
        rule.content = content
    rule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rule)
    return rule


def delete_rule(db: Session, rule_id: str) -> bool:
    rule = get_rule(db, rule_id)
    if not rule:
        return False
    db.delete(rule)
    db.commit()
    return True


def create_conversation(
    db: Session,
    title: str = "Nueva conversación",
    model_id: str = "llama3.2",
    provider: str = "ollama",
    system_instruction_global: str | None = None,
    instruction_ids: list | None = None,
    inject_instruction_every: int | None = None,
    history_turns: int | None = 5,
) -> Conversation:
    conv = Conversation(
        title=title,
        model_id=model_id,
        provider=provider,
        system_instruction_global=system_instruction_global,
        instruction_ids=json.dumps(instruction_ids) if instruction_ids is not None else None,
        inject_instruction_every=inject_instruction_every if inject_instruction_every and inject_instruction_every > 0 else None,
        history_turns=history_turns if history_turns and history_turns > 0 else 5,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(db: Session, conversation_id: str) -> Conversation | None:
    return db.query(Conversation).filter(Conversation.id == conversation_id).first()


def list_conversations(db: Session) -> list[Conversation]:
    return (
        db.query(Conversation)
        .order_by(func.coalesce(Conversation.last_message_at, Conversation.updated_at).desc())
        .all()
    )


def update_conversation(
    db: Session,
    conversation_id: str,
    title: str | None = None,
    model_id: str | None = None,
    provider: str | None = None,
    system_instruction_global: str | None = None,
    instruction_ids: list | None = None,
    inject_instruction_every: int | None = _INJECT_UNSET,
    model_params: dict | None = None,
    history_turns: int | None = None,
    instruction_override: str | None = INSTRUCTION_OVERRIDE_UNSET,
) -> Conversation | None:
    conv = get_conversation(db, conversation_id)
    if not conv:
        return None
    updated_at_before = conv.updated_at
    if title is not None:
        conv.title = title
    if model_id is not None:
        conv.model_id = model_id
    if provider is not None:
        conv.provider = provider
    if system_instruction_global is not None:
        conv.system_instruction_global = system_instruction_global
    if instruction_ids is not None:
        conv.instruction_ids = json.dumps(instruction_ids) if instruction_ids else None
    if inject_instruction_every is not _INJECT_UNSET:
        conv.inject_instruction_every = inject_instruction_every if (inject_instruction_every and inject_instruction_every > 0) else None
    if model_params is not None:
        conv.model_params = json.dumps(model_params) if model_params else None
    if history_turns is not None:
        conv.history_turns = history_turns if history_turns >= 0 else None
    if instruction_override is not INSTRUCTION_OVERRIDE_UNSET:
        conv.instruction_override = instruction_override.strip() if instruction_override and instruction_override.strip() else None
    # No actualizar updated_at si solo cambió instruction_override (al hacer click en otra conversación no debe reordenar la lista)
    affects_order = any([
        title is not None, model_id is not None, provider is not None,
        system_instruction_global is not None, instruction_ids is not None,
        inject_instruction_every is not _INJECT_UNSET, model_params is not None, history_turns is not None,
    ])
    if affects_order:
        conv.updated_at = datetime.utcnow()
    else:
        conv.updated_at = updated_at_before
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


def get_message(db: Session, conversation_id: str, message_id: str) -> Message | None:
    """Obtiene un mensaje por id dentro de una conversación."""
    return (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.id == message_id,
        )
        .first()
    )


def update_message_content(db: Session, conversation_id: str, message_id: str, content: str) -> Message | None:
    """Actualiza el content de un mensaje (p. ej. tras ilustrar)."""
    msg = get_message(db, conversation_id, message_id)
    if not msg:
        return None
    msg.content = content
    db.commit()
    db.refresh(msg)
    return msg


def add_message(
    db: Session,
    conversation_id: str,
    role: str,
    content: str,
    instruction_override: str | None = None,
    debug_request_json: str | None = None,
    debug_response_raw: str | None = None,
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        instruction_override=instruction_override,
        debug_request_json=debug_request_json,
        debug_response_raw=debug_response_raw,
    )
    db.add(msg)
    db.flush()
    conv = get_conversation(db, conversation_id)
    if conv:
        conv.last_message_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)
    return msg


def touch_conversation(db: Session, conversation_id: str) -> None:
    conv = get_conversation(db, conversation_id)
    if conv:
        conv.updated_at = datetime.utcnow()
        db.commit()


def delete_message(db: Session, conversation_id: str, message_id: str) -> bool:
    """Elimina un mensaje por id dentro de la conversación. Devuelve True si existía y se eliminó."""
    msg = get_message(db, conversation_id, message_id)
    if not msg:
        return False
    db.delete(msg)
    db.commit()
    return True


def delete_last_message(db: Session, conversation_id: str) -> bool:
    """Elimina el último mensaje de la conversación (el más reciente). Devuelve True si se eliminó uno."""
    msgs = get_messages(db, conversation_id)
    if not msgs:
        return False
    last = msgs[-1]
    db.delete(last)
    db.commit()
    return True


def delete_message(db: Session, conversation_id: str, message_id: str) -> bool:
    """Elimina un mensaje por id. Devuelve True si existía y se eliminó."""
    msg = get_message(db, conversation_id, message_id)
    if not msg:
        return False
    db.delete(msg)
    db.commit()
    return True


def clear_conversation_messages(db: Session, conversation_id: str) -> int:
    """Elimina todos los mensajes de una conversación. Devuelve el número de mensajes eliminados."""
    count = db.query(Message).filter(Message.conversation_id == conversation_id).delete()
    db.commit()
    return count


def save_illustrated_image_meta(
    db: Session,
    *,
    message_id: str,
    filename: str,
    scene_id: str | None,
    mode: str,
    params: dict,
) -> IllustratedImage:
    """Upsert por filename: guarda params de generación Forge para una imagen."""
    row = (
        db.query(IllustratedImage)
        .filter(IllustratedImage.filename == filename)
        .first()
    )
    payload = json.dumps(params or {}, ensure_ascii=False, default=str)
    if row:
        row.message_id = message_id
        row.scene_id = scene_id
        row.mode = mode or row.mode
        row.params_json = payload
    else:
        row = IllustratedImage(
            message_id=message_id,
            filename=filename,
            scene_id=scene_id,
            mode=mode or "txt2img",
            params_json=payload,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_illustrated_image_meta(db: Session, filename: str) -> IllustratedImage | None:
    if not filename:
        return None
    return (
        db.query(IllustratedImage)
        .filter(IllustratedImage.filename == filename)
        .first()
    )


def delete_illustrated_images_by_filenames(db: Session, filenames: list[str]) -> int:
    if not filenames:
        return 0
    count = (
        db.query(IllustratedImage)
        .filter(IllustratedImage.filename.in_(filenames))
        .delete(synchronize_session=False)
    )
    db.commit()
    return count
