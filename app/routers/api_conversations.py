import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import crud, rag
from app.config import settings
from app.provider_params import build_extra_body
from app.providers import get_provider
from app.slash_commands import parse_slash_command
from app.db import get_db
from app.crud import create_rule as crud_create_rule
from app.crud import get_rule as crud_get_rule
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


def _parse_model_params(raw: str | None) -> dict | None:
    """Convierte model_params de la BD (JSON string) a dict para la API."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except (TypeError, ValueError):
        return None


def _parse_system_instructions(raw: str | None) -> list[dict] | None:
    """
    Convierte system_instructions de la BD (JSON) a list de dicts con rule_id?, title?, content?.
    Formato antiguo (lista de strings) se normaliza a reglas con título "Regla 1", etc. sin rule_id.
    """
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if not isinstance(data, list):
            return None
        out = []
        for i, item in enumerate(data):
            if isinstance(item, str):
                out.append({"title": f"Regla {i + 1}", "content": item})
            elif isinstance(item, dict):
                row = {}
                if item.get("rule_id"):
                    row["rule_id"] = str(item["rule_id"])
                row["title"] = str(item.get("title", "")) if item.get("title") else (f"Regla {i + 1}" if "content" not in item else "")
                row["content"] = str(item.get("content", ""))
                if "title" in item or "content" in item or row.get("rule_id"):
                    out.append(row)
            else:
                continue
        return out if out else None
    except (TypeError, ValueError):
        return None


def _resolve_system_instructions(parsed: list[dict] | None, db) -> list[dict]:
    """
    Resuelve rule_id contra la biblioteca; devuelve list de { rule_id?, title, content } para la API.
    """
    if not parsed:
        return []
    out = []
    for item in parsed:
        rule_id = item.get("rule_id")
        if rule_id:
            rule = crud_get_rule(db, rule_id)
            if rule:
                out.append({"rule_id": rule_id, "title": rule.title, "content": rule.content})
            else:
                out.append({
                    "rule_id": rule_id,
                    "title": item.get("title") or "Regla eliminada",
                    "content": item.get("content", ""),
                })
        else:
            out.append({
                "title": item.get("title") or "",
                "content": item.get("content", ""),
            })
    return out


def _parse_instruction_ids(raw: str | None) -> list[str] | None:
    """Parsea instruction_ids de la BD (JSON array de strings)."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if not isinstance(data, list):
            return None
        return [str(x) for x in data if x]
    except (TypeError, ValueError):
        return None


def _resolve_instruction_ids(ids: list[str], db) -> list[dict]:
    """Resuelve lista de rule_id contra la biblioteca; devuelve list de { rule_id, title, content }. Las reglas eliminadas no se incluyen."""
    out = []
    for rule_id in ids:
        rule = crud_get_rule(db, rule_id)
        if rule:
            out.append({"rule_id": rule.id, "title": rule.title, "content": rule.content})
    return out


def _instructions_to_ids(rules: list | None, db) -> list[str] | None:
    """
    Convierte body.system_instructions (list[RuleItem]) en lista de rule_id.
    Si un ítem no tiene rule_id, crea la regla en la biblioteca y usa su id.
    Devuelve None si rules is None (no actualizar); [] para vaciar.
    """
    if rules is None:
        return None
    if not rules:
        return []
    ids = []
    for r in rules:
        d = r.model_dump() if hasattr(r, "model_dump") else dict(r)
        rule_id = d.get("rule_id")
        if rule_id:
            ids.append(str(rule_id))
        else:
            title = (d.get("title") or "").strip() or "Regla"
            content = d.get("content") or ""
            rule = crud_create_rule(db, title=title, content=content)
            ids.append(rule.id)
    return ids


def _effective_system_instructions(conv, db) -> list[dict]:
    """
    Devuelve la lista de reglas de la conversación como list de { title, content } para el mensaje system.
    Usa instruction_ids (resuelto desde rules) o legacy system_instructions. Fallback a system_instruction_global.
    """
    ids = _parse_instruction_ids(getattr(conv, "instruction_ids", None))
    if ids:
        out = []
        for rule_id in ids:
            rule = crud_get_rule(db, rule_id)
            if rule:
                out.append({"title": rule.title, "content": rule.content})
        return out
    parsed = _parse_system_instructions(getattr(conv, "system_instructions", None))
    if not parsed:
        global_text = (conv.system_instruction_global or "").strip()
        return [{"title": "Instrucción global", "content": global_text}] if global_text else []
    out = []
    for item in parsed:
        rule_id = item.get("rule_id")
        if rule_id:
            rule = crud_get_rule(db, rule_id)
            if rule:
                out.append({"title": rule.title, "content": rule.content})
        else:
            content = (item.get("content") or "").strip()
            if content:
                out.append({"title": item.get("title") or "", "content": item["content"]})
    return out


def _normalize_stream_metadata_usage(metadata: dict | None) -> dict:
    """
    Asegura que stream_metadata incluya "usage" normalizado para el frontend.
    Los proveedores pueden enviar usage en metadata o prompt_tokens/completion_tokens
    (o Ollama: prompt_eval_count/eval_count). Siempre emitimos usage con el mismo esquema.
    """
    if not metadata:
        return {}
    out = dict(metadata)
    if isinstance(out.get("usage"), dict):
        return out
    pt = out.get("prompt_tokens") or out.get("prompt_eval_count")
    ct = out.get("completion_tokens") or out.get("eval_count")
    if pt is not None or ct is not None:
        out["usage"] = {
            "prompt_tokens": int(pt) if pt is not None else 0,
            "completion_tokens": int(ct) if ct is not None else 0,
        }
    return out


@router.get("/conversations", response_model=list[ConversationListItem])
def list_conversations(db: Session = Depends(get_db)):
    convs = crud.list_conversations(db)
    return convs


def _get_resolved_instructions(conv, db) -> list[dict]:
    """Devuelve system_instructions resueltas: desde instruction_ids (prioridad) o desde system_instructions legado."""
    ids = _parse_instruction_ids(getattr(conv, "instruction_ids", None))
    if ids:
        return _resolve_instruction_ids(ids, db)
    parsed = _parse_system_instructions(getattr(conv, "system_instructions", None))
    if parsed is None:
        return []
    return _resolve_system_instructions(parsed, db)


@router.post("/conversations", response_model=ConversationOut)
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    instruction_ids = _instructions_to_ids(body.system_instructions, db) if body.system_instructions is not None else None
    conv = crud.create_conversation(
        db,
        title=body.title,
        model_id=body.model_id,
        provider=body.provider,
        system_instruction_global=body.system_instruction_global,
        instruction_ids=instruction_ids,
        inject_instruction_every=body.inject_instruction_every,
    )
    resolved = _get_resolved_instructions(conv, db)
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model_id=conv.model_id,
        provider=conv.provider,
        system_instruction_global=conv.system_instruction_global,
        system_instructions=resolved,
        inject_instruction_every=conv.inject_instruction_every,
        model_params=_parse_model_params(getattr(conv, "model_params", None)),
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[],
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    messages = [
        MessageInChat(
            role=m.role,
            content=m.content,
            id=m.id,
            debug_request=m.debug_request_json if m.role == "assistant" else None,
            debug_response=m.debug_response_raw if m.role == "assistant" else None,
        )
        for m in conv.messages
    ]
    resolved = _get_resolved_instructions(conv, db)
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model_id=conv.model_id,
        provider=conv.provider,
        system_instruction_global=conv.system_instruction_global,
        system_instructions=resolved,
        inject_instruction_every=conv.inject_instruction_every,
        model_params=_parse_model_params(getattr(conv, "model_params", None)),
        history_turns=getattr(conv, "history_turns", None),
        instruction_override=getattr(conv, "instruction_override", None),
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=messages,
    )


@router.put("/conversations/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: str, body: ConversationUpdate, db: Session = Depends(get_db)
):
    instruction_ids = _instructions_to_ids(body.system_instructions, db) if body.system_instructions is not None else None
    conv = crud.update_conversation(
        db,
        conversation_id,
        title=body.title,
        model_id=body.model_id,
        provider=body.provider,
        system_instruction_global=body.system_instruction_global,
        instruction_ids=instruction_ids,
        inject_instruction_every=body.inject_instruction_every,
        model_params=body.model_params,
        history_turns=body.history_turns,
        instruction_override=body.instruction_override,
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    messages = [
        MessageInChat(
            role=m.role,
            content=m.content,
            id=m.id,
            debug_request=m.debug_request_json if m.role == "assistant" else None,
            debug_response=m.debug_response_raw if m.role == "assistant" else None,
        )
        for m in conv.messages
    ]
    resolved = _get_resolved_instructions(conv, db)
    return ConversationOut(
        id=conv.id,
        title=conv.title,
        model_id=conv.model_id,
        provider=conv.provider,
        system_instruction_global=conv.system_instruction_global,
        system_instructions=resolved,
        inject_instruction_every=conv.inject_instruction_every,
        model_params=_parse_model_params(getattr(conv, "model_params", None)),
        history_turns=getattr(conv, "history_turns", None),
        instruction_override=getattr(conv, "instruction_override", None),
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


@router.delete("/conversations/{conversation_id}/messages", status_code=204)
def clear_conversation_messages(conversation_id: str, db: Session = Depends(get_db)):
    """Elimina todos los mensajes de una conversación (limpia el historial)."""
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    crud.clear_conversation_messages(db, conversation_id)
    rag.delete_conversation_documents(conversation_id)
    return None


@router.delete("/conversations/{conversation_id}/messages/{message_id}", status_code=204)
def delete_message(conversation_id: str, message_id: str, db: Session = Depends(get_db)):
    """Elimina un mensaje del historial de la conversación."""
    ok = crud.delete_message(db, conversation_id, message_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    rag.delete_message_document(conversation_id, message_id)
    return None


@router.post("/conversations/{conversation_id}/messages/{message_id}/save-to-chromadb", status_code=204)
def save_message_to_chromadb(conversation_id: str, message_id: str, db: Session = Depends(get_db)):
    """Guarda un mensaje concreto en ChromaDB (para el icono de guardar bajo cada mensaje)."""
    msg = crud.get_message(db, conversation_id, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    rag.add_message(conversation_id, msg.id, msg.role, msg.content, msg.created_at)
    return None


def _build_llm_messages(
    conv,
    existing_messages,
    new_content: str,
    instruction_override: str | None,
    db,
    system_instruction_global: str | None = None,
    rag_context: str | None = None,
) -> tuple[list, bool]:
    """Construye la lista de mensajes para el LLM (Ollama, Mancer, etc.).

    Orden:
    1. Rol system: contexto RAG (si hay) + reglas del panel (instrucciones globales)
    2. Últimos N pares (user + assistant) del historial, de más antiguo a más nuevo
    3. Rol user: prompt actual del usuario
    4. Rol user (opcional): instrucción solo para este mensaje (instruction_override), en último lugar

    Devuelve (messages, injecting_instruction).
    """
    parts = []
    if rag_context and rag_context.strip():
        parts.append("Contexto relevante del historial:\n\n" + rag_context.strip())
    if system_instruction_global is not None:
        global_text = (system_instruction_global or "").strip()
    else:
        instructions = _effective_system_instructions(conv, db)
        global_text = " ".join(
            (c or "").strip() for c in (r.get("content", "") for r in instructions)
            if (c or "").strip()
        ).strip() if instructions else ""
    if global_text:
        parts.append(global_text)

    messages = []
    if parts:
        messages.append({"role": "system", "content": "\n\n".join(parts)})

    # Historial: últimos N pares (user + assistant), de más antiguo a más nuevo. Por defecto 5; 0 = sin historial.
    raw_turns = getattr(conv, "history_turns", None)
    try:
        max_turns = int(raw_turns) if raw_turns is not None else 5
    except (TypeError, ValueError):
        max_turns = 5
    if max_turns < 0:
        max_turns = 5
    if max_turns > 0 and existing_messages:
        max_messages = max_turns * 2  # cada turno = 1 user + 1 assistant
        history = existing_messages[-max_messages:]
        for m in history:
            messages.append({"role": m.role, "content": m.content})

    messages.append({"role": "user", "content": new_content})
    if instruction_override and instruction_override.strip():
        messages.append({"role": "user", "content": instruction_override.strip()})
    injecting = bool(global_text)
    return messages, injecting


def _emit(line: str, meta_lines: list[str], is_content_chunk: bool = False):
    """Helper para emitir línea. Solo acumula en meta_lines si no es un chunk de contenido."""
    if not is_content_chunk:
        meta_lines.append(line)
    return line


async def _stream_generator_async(
    conversation_id: str,
    model_id: str,
    provider_name: str,
    llm_messages: list,
    user_message_id: str | None = None,
    save_to_chromadb: str = "user",
    mcp_contexts: list[str] | None = None,
    extra_body: dict | None = None,
):
    """Generador async que hace streaming al LLM via provider.chat_stream().

    Al desconectar el cliente (GeneratorExit) se cierra la conexión al proveedor
    para que deje de generar.
    mcp_contexts: cuando se integre MCP, aquí se usarán para inyectar tools (ej. ['git']).
    extra_body: parámetros de generación (temperature, etc.) a fusionar en el payload.
    """
    meta_lines: list[str] = []  # Solo metadata (sin los chunks de content)
    payload = {"model": model_id, "messages": llm_messages, "stream": True}
    if extra_body:
        payload.update(extra_body)
    debug_request_json = json.dumps(payload, ensure_ascii=False, indent=2)

    # Emitir debug_request primero (para que el frontend lo muestre si el checkbox está activo)
    yield _emit(json.dumps({"debug_request": debug_request_json}, ensure_ascii=False) + "\n", meta_lines)
    if user_message_id:
        yield _emit(json.dumps({"user_message_id": user_message_id}) + "\n", meta_lines)
    if mcp_contexts:
        yield _emit(json.dumps({"mcp_contexts": mcp_contexts}, ensure_ascii=False) + "\n", meta_lines)

    if settings.verbose:
        import sys
        print(f"--- enviado a {provider_name} (el system incluye contexto RAG si hubiera) ---", file=sys.stderr)
        print(debug_request_json, file=sys.stderr)
        print("--- fin ---", file=sys.stderr)

    full_content = []

    try:
        provider = get_provider(provider_name)
    except ValueError as e:
        err_line = json.dumps({"error": str(e)}) + "\n"
        yield _emit(err_line, meta_lines)
        # Guardar mensaje de error
        def _save_provider_error():
            from app.db import SessionLocal
            db = SessionLocal()
            try:
                msg = crud.add_message(
                    db, conversation_id, role="assistant",
                    content=f"[Error: Proveedor '{provider_name}' no disponible]",
                    debug_request_json=debug_request_json,
                    debug_response_raw="\n".join(meta_lines),
                )
                crud.touch_conversation(db, conversation_id)
                return msg.id
            finally:
                db.close()
        loop = asyncio.get_event_loop()
        assistant_id = await loop.run_in_executor(None, _save_provider_error)
        yield _emit(json.dumps({"done": True, "id": assistant_id}) + "\n", meta_lines)
        return

    try:
        async for chunk in provider.chat_stream(model_id, llm_messages, extra_body=extra_body):
            if chunk.type == "content":
                full_content.append(chunk.content)
                try:
                    out = json.dumps({"content": chunk.content}, ensure_ascii=False) + "\n"
                    yield _emit(out, meta_lines, is_content_chunk=True)
                except GeneratorExit:
                    raise
            elif chunk.type == "error":
                err_data = {"error": chunk.error}
                if chunk.metadata:
                    err_data.update(chunk.metadata)
                err_line = json.dumps(err_data) + "\n"
                yield _emit(err_line, meta_lines)
                # Si es error fatal, guardar y terminar
                if chunk.metadata.get("status_code"):
                    debug_response_raw = "\n".join(meta_lines)
                    def _save_http_error():
                        from app.db import SessionLocal
                        db = SessionLocal()
                        try:
                            err_content = f"[Error: {chunk.error}]"
                            msg = crud.add_message(
                                db, conversation_id, role="assistant", content=err_content,
                                debug_request_json=debug_request_json,
                                debug_response_raw=debug_response_raw,
                            )
                            crud.touch_conversation(db, conversation_id)
                            return msg.id
                        finally:
                            db.close()
                    loop = asyncio.get_event_loop()
                    assistant_id = await loop.run_in_executor(None, _save_http_error)
                    yield _emit(json.dumps({"done": True, "id": assistant_id}) + "\n", meta_lines)
                    return
            elif chunk.type == "done":
                # Metadata normalizada: siempre incluir "usage" si el proveedor envió tokens
                if chunk.metadata:
                    normalized = _normalize_stream_metadata_usage(chunk.metadata)
                    meta_line = json.dumps({"stream_metadata": normalized}) + "\n"
                    yield _emit(meta_line, meta_lines)
                break
            elif chunk.type == "metadata":
                meta_line = json.dumps({"metadata": chunk.metadata}) + "\n"
                yield _emit(meta_line, meta_lines)

    except GeneratorExit:
        raise
    except Exception as e:
        err_line = json.dumps({"error": str(e), "exception_type": type(e).__name__}) + "\n"
        yield _emit(err_line, meta_lines)
        debug_response_raw = "\n".join(meta_lines)
        # Guardar assistant con error
        def _save_assistant_error():
            from app.db import SessionLocal
            db = SessionLocal()
            try:
                err_content = f"[Error de conexión/stream: {e!s}]"
                msg = crud.add_message(
                    db, conversation_id, role="assistant", content=err_content,
                    debug_request_json=debug_request_json,
                    debug_response_raw=debug_response_raw,
                )
                crud.touch_conversation(db, conversation_id)
                return msg.id
            finally:
                db.close()
        loop = asyncio.get_event_loop()
        assistant_id = await loop.run_in_executor(None, _save_assistant_error)
        yield _emit(json.dumps({"done": True, "id": assistant_id}) + "\n", meta_lines)
        return

    def _save_assistant():
        from app.db import SessionLocal
        db = SessionLocal()
        try:
            debug_response_raw = "\n".join(meta_lines)
            msg = crud.add_message(
                db,
                conversation_id,
                role="assistant",
                content="".join(full_content),
                debug_request_json=debug_request_json,
                debug_response_raw=debug_response_raw,
            )
            crud.touch_conversation(db, conversation_id)
            if save_to_chromadb in ("assistant", "both"):
                rag.add_message(conversation_id, msg.id, "assistant", msg.content, msg.created_at)
            return msg.id
        finally:
            db.close()

    loop = asyncio.get_event_loop()
    assistant_id = await loop.run_in_executor(None, _save_assistant)
    yield _emit(json.dumps({"done": True, "id": assistant_id}) + "\n", meta_lines)


@router.post("/conversations/{conversation_id}/messages/stream")
async def send_message_stream(
    conversation_id: str, body: MessageSend, db: Session = Depends(get_db)
):
    """Envía el mensaje y devuelve la respuesta en streaming (NDJSON). Al cancelar
    el cliente se cierra la conexión al LLM para liberar el modelo.
    Si el mensaje empieza por /git, /files, etc., se usa ese contexto MCP y el texto
    que se envía al modelo es el resto del mensaje (sin el slash command)."""
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    slash = parse_slash_command(body.content)
    user_content = slash.content
    mcp_contexts = slash.mcp_contexts  # Ej. ["git"] cuando el usuario escribió /git ...

    if body.system_instruction_global is not None:
        crud.update_conversation(db, conversation_id, system_instruction_global=body.system_instruction_global)
    existing = crud.get_messages(db, conversation_id)
    rag_context = rag.get_relevant_context(conversation_id, user_content)
    if settings.verbose:
        import sys
        n_ctx = len(rag_context or "")
        if n_ctx:
            print(f"--- RAG: contexto de {n_ctx} chars se inyecta en el system message para {conv.provider} ---", file=sys.stderr)
        else:
            print("--- RAG: sin contexto (no se inyecta nada en el prompt) ---", file=sys.stderr)
        if mcp_contexts:
            print(f"--- Slash: MCP contexts activados para este turno: {mcp_contexts} ---", file=sys.stderr)
    llm_messages, injecting = _build_llm_messages(
        conv, existing, user_content, body.instruction_override, db,
        system_instruction_global=body.system_instruction_global,
        rag_context=rag_context,
    )
    user_msg = crud.add_message(
        db,
        conversation_id,
        role="user",
        content=user_content,
        instruction_override=body.instruction_override,
    )
    crud.update_conversation(db, conversation_id, instruction_override=body.instruction_override)
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

    extra_body = build_extra_body(conv.provider, body.model_params)
    return StreamingResponse(
        _stream_generator_async(
            conversation_id,
            conv.model_id,
            conv.provider,
            llm_messages,
            user_message_id=user_msg.id,
            save_to_chromadb=save_to_chromadb,
            mcp_contexts=mcp_contexts,
            extra_body=extra_body,
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

    if body.system_instruction_global is not None:
        crud.update_conversation(db, conversation_id, system_instruction_global=body.system_instruction_global)

    existing = crud.get_messages(db, conversation_id)
    rag_context = rag.get_relevant_context(conversation_id, user_content)
    if settings.verbose:
        import sys
        n_ctx = len(rag_context or "")
        if n_ctx:
            print(f"--- RAG: contexto de {n_ctx} chars se inyecta en el system message para {conv.provider} ---", file=sys.stderr)
        else:
            print("--- RAG: sin contexto (no se inyecta nada en el prompt) ---", file=sys.stderr)
        if mcp_contexts:
            print(f"--- Slash: MCP contexts activados: {mcp_contexts} ---", file=sys.stderr)
    llm_messages, _ = _build_llm_messages(
        conv, existing, user_content, body.instruction_override, db,
        system_instruction_global=body.system_instruction_global,
        rag_context=rag_context,
    )

    extra_body = build_extra_body(conv.provider, body.model_params)
    try:
        provider = get_provider(conv.provider)
        assistant_content = provider.chat(conv.model_id, llm_messages, extra_body=extra_body)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Proveedor no válido: {e!s}",
        )
    except ConnectionError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error al llamar a {conv.provider}: {e!s}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error al llamar a {conv.provider}: {e!s}",
        )

    user_msg = crud.add_message(
        db,
        conversation_id,
        role="user",
        content=user_content,
        instruction_override=body.instruction_override,
    )
    crud.update_conversation(db, conversation_id, instruction_override=body.instruction_override)
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
