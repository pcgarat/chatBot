import asyncio
import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import crud, ollama_client, rag
from app.config import settings
from app.slash_commands import parse_slash_command
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
        inject_instruction_every=body.inject_instruction_every,
    )
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model_id=conv.model_id,
        system_instruction_global=conv.system_instruction_global,
        inject_instruction_every=conv.inject_instruction_every,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[],
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    messages = [MessageInChat(role=m.role, content=m.content, id=m.id) for m in conv.messages]
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model_id=conv.model_id,
        system_instruction_global=conv.system_instruction_global,
        inject_instruction_every=conv.inject_instruction_every,
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
        inject_instruction_every=body.inject_instruction_every,
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    messages = [MessageInChat(role=m.role, content=m.content, id=m.id) for m in conv.messages]
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model_id=conv.model_id,
        system_instruction_global=conv.system_instruction_global,
        inject_instruction_every=conv.inject_instruction_every,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=messages,
    )


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    ok = crud.delete_conversation(db, conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    rag.delete_conversation_documents(conversation_id)
    return None


@router.delete("/conversations/{conversation_id}/messages/last", status_code=204)
def delete_last_message(conversation_id: str, db: Session = Depends(get_db)):
    """Elimina el último mensaje de la conversación (para cancelar envío o deshacer)."""
    ok = crud.delete_last_message(db, conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="No hay mensajes en la conversación")
    return None


@router.post("/conversations/{conversation_id}/messages/{message_id}/save-to-chromadb", status_code=204)
def save_message_to_chromadb(conversation_id: str, message_id: str, db: Session = Depends(get_db)):
    """Guarda un mensaje concreto en ChromaDB (para el icono de guardar bajo cada mensaje)."""
    msg = crud.get_message(db, conversation_id, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    rag.add_message(conversation_id, msg.id, msg.role, msg.content, msg.created_at)
    return None


def _build_ollama_messages(
    conv,
    existing_messages,
    new_content: str,
    instruction_override: str | None,
    system_instruction_global: str | None = None,
    inject_instruction_every: int | None = None,
    user_message_count: int = 0,
    rag_context: str | None = None,
) -> tuple[list, bool]:
    """Construye la lista de mensajes para Ollama.

    El historial no se envía nunca a Ollama (solo es para la UI). Se envía únicamente:
    - Contexto RAG relevante del historial (si rag_context está presente).
    - Instrucciones globales (si aplican: siempre si check desactivado, o cada X mensajes si activado).
    - Instrucción para este mensaje (opcional).
    - El mensaje nuevo del usuario.
    Devuelve (messages, injecting_instruction).
    """
    parts = []
    if rag_context and rag_context.strip():
        parts.append("Contexto relevante del historial:\n\n" + rag_context.strip())
    add_global = True
    if inject_instruction_every is not None and inject_instruction_every > 0:
        add_global = user_message_count % inject_instruction_every == 0
    if add_global:
        if system_instruction_global is not None:
            global_text = (system_instruction_global or "").strip()
        else:
            global_text = (conv.system_instruction_global or "").strip()
        if global_text:
            parts.append(global_text)
    if instruction_override and instruction_override.strip():
        parts.append(instruction_override.strip())
    messages = []
    if parts:
        messages.append({"role": "system", "content": "\n\n".join(parts)})
    messages.append({"role": "user", "content": new_content})
    injecting = add_global and bool(
        (system_instruction_global or conv.system_instruction_global or "").strip()
    )
    return messages, injecting


async def _stream_generator_async(
    conversation_id: str,
    model_id: str,
    ollama_messages: list,
    injecting: bool,
    user_message_id: str | None = None,
    save_to_chromadb: str = "user",
    mcp_contexts: list[str] | None = None,
):
    """Generador async que hace streaming a Ollama vía httpx. Al desconectar el cliente
    (GeneratorExit) se cierra la conexión a Ollama para que deje de generar.
    mcp_contexts: cuando se integre MCP, aquí se usarán para inyectar tools (ej. ['git'])."""
    if user_message_id:
        yield json.dumps({"user_message_id": user_message_id}) + "\n"
    if mcp_contexts:
        yield json.dumps({"mcp_contexts": mcp_contexts}, ensure_ascii=False) + "\n"
    if injecting:
        yield json.dumps({"injecting_instruction": True}) + "\n"

    url = f"{settings.ollama_host.rstrip('/')}/api/chat"
    payload = {"model": model_id, "messages": ollama_messages, "stream": True}
    if settings.verbose:
        import sys
        print("--- enviado a Ollama (el system incluye contexto RAG si hubiera) ---", file=sys.stderr)
        print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
        print("--- fin ---", file=sys.stderr)

    full_content = []
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream(
                "POST",
                url,
                json=payload,
                timeout=httpx.Timeout(None),
            ) as response:
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    msg = data.get("message") or {}
                    content = msg.get("content") or ""
                    if content:
                        full_content.append(content)
                        try:
                            yield json.dumps({"content": content}, ensure_ascii=False) + "\n"
                        except GeneratorExit:
                            await response.aclose()
                            raise
        except GeneratorExit:
            raise
        except Exception as e:
            yield json.dumps({"error": str(e)}) + "\n"
            return

    def _save_assistant():
        from app.db import SessionLocal
        db = SessionLocal()
        try:
            msg = crud.add_message(db, conversation_id, role="assistant", content="".join(full_content))
            crud.touch_conversation(db, conversation_id)
            if save_to_chromadb in ("assistant", "both"):
                rag.add_message(conversation_id, msg.id, "assistant", msg.content, msg.created_at)
            return msg.id
        finally:
            db.close()

    loop = asyncio.get_event_loop()
    assistant_id = await loop.run_in_executor(None, _save_assistant)
    yield json.dumps({"done": True, "id": assistant_id}) + "\n"


@router.post("/conversations/{conversation_id}/messages/stream")
async def send_message_stream(
    conversation_id: str, body: MessageSend, db: Session = Depends(get_db)
):
    """Envía el mensaje y devuelve la respuesta en streaming (NDJSON). Al cancelar
    el cliente se cierra la conexión a Ollama para liberar el modelo.
    Si el mensaje empieza por /git, /files, etc., se usa ese contexto MCP y el texto
    que se envía al modelo es el resto del mensaje (sin el slash command)."""
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    slash = parse_slash_command(body.content)
    user_content = slash.content
    mcp_contexts = slash.mcp_contexts  # Ej. ["git"] cuando el usuario escribió /git ...

    inject_every = body.inject_instruction_every if body.inject_instruction_every and body.inject_instruction_every > 0 else None
    if body.system_instruction_global is not None:
        crud.update_conversation(db, conversation_id, system_instruction_global=body.system_instruction_global)
    crud.update_conversation(db, conversation_id, inject_instruction_every=inject_every)
    existing = crud.get_messages(db, conversation_id)
    user_count = sum(1 for m in existing if m.role == "user")
    rag_context = rag.get_relevant_context(conversation_id, user_content)
    if settings.verbose:
        import sys
        n_ctx = len(rag_context or "")
        if n_ctx:
            print(f"--- RAG: contexto de {n_ctx} chars se inyecta en el system message para Ollama ---", file=sys.stderr)
        else:
            print("--- RAG: sin contexto (no se inyecta nada en el prompt) ---", file=sys.stderr)
        if mcp_contexts:
            print(f"--- Slash: MCP contexts activados para este turno: {mcp_contexts} ---", file=sys.stderr)
    ollama_messages, injecting = _build_ollama_messages(
        conv, existing, user_content, body.instruction_override,
        system_instruction_global=body.system_instruction_global,
        inject_instruction_every=inject_every,
        user_message_count=user_count,
        rag_context=rag_context,
    )
    user_msg = crud.add_message(
        db,
        conversation_id,
        role="user",
        content=user_content,
        instruction_override=body.instruction_override,
    )
    save_to_chromadb = (body.save_to_chromadb or "user").strip().lower()
    if save_to_chromadb not in ("none", "user", "assistant", "both"):
        save_to_chromadb = "user"
    # Insertar en Chroma en segundo plano solo si la opción lo permite
    if save_to_chromadb in ("user", "both"):
        def _add_user_to_rag():
            rag.add_message(conversation_id, user_msg.id, "user", user_content, user_msg.created_at)

        def _on_rag_done(fut):
            try:
                fut.result()
            except Exception as e:
                import sys
                print(f"--- RAG add_message (background) ERROR: {e!r} ---", file=sys.stderr)

        loop = asyncio.get_event_loop()
        fut = loop.run_in_executor(None, _add_user_to_rag)
        fut.add_done_callback(_on_rag_done)

    return StreamingResponse(
        _stream_generator_async(
            conversation_id,
            conv.model_id,
            ollama_messages,
            injecting,
            user_message_id=user_msg.id,
            save_to_chromadb=save_to_chromadb,
            mcp_contexts=mcp_contexts,
        ),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
def send_message(
    conversation_id: str, body: MessageSend, db: Session = Depends(get_db)
):
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    slash = parse_slash_command(body.content)
    user_content = slash.content
    mcp_contexts = slash.mcp_contexts

    inject_every = body.inject_instruction_every if body.inject_instruction_every and body.inject_instruction_every > 0 else None
    if body.system_instruction_global is not None:
        crud.update_conversation(db, conversation_id, system_instruction_global=body.system_instruction_global)
    crud.update_conversation(db, conversation_id, inject_instruction_every=inject_every)

    existing = crud.get_messages(db, conversation_id)
    user_count = sum(1 for m in existing if m.role == "user")
    rag_context = rag.get_relevant_context(conversation_id, user_content)
    if settings.verbose:
        import sys
        n_ctx = len(rag_context or "")
        if n_ctx:
            print(f"--- RAG: contexto de {n_ctx} chars se inyecta en el system message para Ollama ---", file=sys.stderr)
        else:
            print("--- RAG: sin contexto (no se inyecta nada en el prompt) ---", file=sys.stderr)
        if mcp_contexts:
            print(f"--- Slash: MCP contexts activados: {mcp_contexts} ---", file=sys.stderr)
    ollama_messages, _ = _build_ollama_messages(
        conv, existing, user_content, body.instruction_override,
        system_instruction_global=body.system_instruction_global,
        inject_instruction_every=inject_every,
        user_message_count=user_count,
        rag_context=rag_context,
    )

    try:
        assistant_content = ollama_client.chat(conv.model_id, ollama_messages)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error al llamar a Ollama: {e!s}",
        )

    user_msg = crud.add_message(
        db,
        conversation_id,
        role="user",
        content=user_content,
        instruction_override=body.instruction_override,
    )
    save_to_chromadb = (body.save_to_chromadb or "user").strip().lower()
    if save_to_chromadb not in ("none", "user", "assistant", "both"):
        save_to_chromadb = "user"
    if save_to_chromadb in ("user", "both"):
        rag.add_message(conversation_id, user_msg.id, "user", user_content, user_msg.created_at)
    assistant_msg = crud.add_message(db, conversation_id, role="assistant", content=assistant_content)
    crud.touch_conversation(db, conversation_id)
    if save_to_chromadb in ("assistant", "both"):
        rag.add_message(conversation_id, assistant_msg.id, "assistant", assistant_msg.content, assistant_msg.created_at)

    return MessageResponse(role="assistant", content=assistant_msg.content, id=assistant_msg.id)
