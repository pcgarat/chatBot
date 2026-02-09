from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, ollama_client
from app.db import get_db
from app.schemas import (
    ConversationCreate,
    ConversationListItem,
    ConversationOut,
    ConversationUpdate,
    MessageInChat,
    MessageResponse,
    MessageSend,
)

router = APIRouter(prefix="/api", tags=["conversations"])


@router.get("/conversations", response_model=list[ConversationListItem])
def list_conversations(db: Session = Depends(get_db)):
    convs = crud.list_conversations(db)
    return convs


@router.post("/conversations", response_model=ConversationOut)
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    conv = crud.create_conversation(
        db,
        title=body.title,
        model_id=body.model_id,
        system_instruction_global=body.system_instruction_global,
    )
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model_id=conv.model_id,
        system_instruction_global=conv.system_instruction_global,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[],
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    messages = [MessageInChat(role=m.role, content=m.content) for m in conv.messages]
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model_id=conv.model_id,
        system_instruction_global=conv.system_instruction_global,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=messages,
    )


@router.put("/conversations/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: str, body: ConversationUpdate, db: Session = Depends(get_db)
):
    conv = crud.update_conversation(
        db,
        conversation_id,
        title=body.title,
        model_id=body.model_id,
        system_instruction_global=body.system_instruction_global,
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    messages = [MessageInChat(role=m.role, content=m.content) for m in conv.messages]
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model_id=conv.model_id,
        system_instruction_global=conv.system_instruction_global,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=messages,
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    ok = crud.delete_conversation(db, conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return None


def _build_ollama_messages(conv, existing_messages, new_content: str, instruction_override: str | None):
    """Construye la lista de mensajes para Ollama: system (global + override), historial, nuevo user."""
    parts = []
    if conv.system_instruction_global and conv.system_instruction_global.strip():
        parts.append(conv.system_instruction_global.strip())
    if instruction_override and instruction_override.strip():
        parts.append(instruction_override.strip())
    messages = []
    if parts:
        messages.append({"role": "system", "content": "\n\n".join(parts)})
    for m in existing_messages:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": new_content})
    return messages


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
def send_message(
    conversation_id: str, body: MessageSend, db: Session = Depends(get_db)
):
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    existing = crud.get_messages(db, conversation_id)
    ollama_messages = _build_ollama_messages(
        conv, existing, body.content, body.instruction_override
    )

    try:
        assistant_content = ollama_client.chat(conv.model_id, ollama_messages)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error al llamar a Ollama: {e!s}",
        )

    crud.add_message(
        db,
        conversation_id,
        role="user",
        content=body.content,
        instruction_override=body.instruction_override,
    )
    assistant_msg = crud.add_message(db, conversation_id, role="assistant", content=assistant_content)
    crud.touch_conversation(db, conversation_id)

    return MessageResponse(role="assistant", content=assistant_msg.content, id=assistant_msg.id)
