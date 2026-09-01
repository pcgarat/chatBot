import json
import re
from datetime import datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import Conversation, IllustratedImage, Message, Rule
from app.services.conversation_tree import path_from_messages
from app.services.rules.models import RULE_SCOPES, SCOPE_CHAT

# Sentinel para "no actualizar inject_instruction_every" en update_conversation
_INJECT_UNSET = object()
# Sentinel para "no actualizar instruction_override" (omitido en el body); None = borrar
INSTRUCTION_OVERRIDE_UNSET = object()


# ----- Rules (biblioteca) -----
def create_rule(db: Session, title: str = "", content: str = "", scope: str = SCOPE_CHAT) -> Rule:
    if scope not in RULE_SCOPES:
        raise ValueError(f"scope inválido: {scope}")
    rule = Rule(title=title, content=content, scope=scope)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def get_rule(db: Session, rule_id: str) -> Rule | None:
    return db.query(Rule).filter(Rule.id == rule_id).first()


def list_rules(db: Session, scope: str = SCOPE_CHAT) -> list[Rule]:
    return db.query(Rule).filter(Rule.scope == scope).order_by(Rule.updated_at.desc()).all()


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
    forked_from_conversation_id: str | None = None,
    forked_from_message_id: str | None = None,
) -> Conversation:
    conv = Conversation(
        title=title,
        model_id=model_id,
        provider=provider,
        system_instruction_global=system_instruction_global,
        instruction_ids=json.dumps(instruction_ids) if instruction_ids is not None else None,
        inject_instruction_every=inject_instruction_every if inject_instruction_every and inject_instruction_every > 0 else None,
        history_turns=history_turns if history_turns and history_turns > 0 else 5,
        forked_from_conversation_id=forked_from_conversation_id,
        forked_from_message_id=forked_from_message_id,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(
    db: Session, conversation_id: str, *, include_deleted: bool = False
) -> Conversation | None:
    q = db.query(Conversation).filter(Conversation.id == conversation_id)
    if not include_deleted:
        q = q.filter(Conversation.deleted_at.is_(None))
    return q.first()


def list_conversations(db: Session) -> list[Conversation]:
    return (
        db.query(Conversation)
        .filter(Conversation.deleted_at.is_(None))
        .order_by(func.coalesce(Conversation.last_message_at, Conversation.updated_at).desc())
        .all()
    )


def list_deleted_conversations(db: Session) -> list[Conversation]:
    """Conversaciones en papelera (soft-deleted), más recientes primero."""
    return (
        db.query(Conversation)
        .filter(Conversation.deleted_at.isnot(None))
        .order_by(Conversation.deleted_at.desc())
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
    active_leaf_message_id: str | None = None,
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
    if active_leaf_message_id is not None:
        leaf = get_message(db, conversation_id, active_leaf_message_id)
        if not leaf:
            return None
        conv.active_leaf_message_id = active_leaf_message_id
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
    """Soft-delete: marca deleted_at. Los mensajes y metadatos se conservan."""
    conv = get_conversation(db, conversation_id)
    if not conv:
        return False
    conv.deleted_at = datetime.utcnow()
    db.commit()
    return True


def restore_conversation(db: Session, conversation_id: str) -> Conversation | None:
    """Saca una conversación de la papelera."""
    conv = get_conversation(db, conversation_id, include_deleted=True)
    if not conv or conv.deleted_at is None:
        return None
    conv.deleted_at = None
    db.commit()
    db.refresh(conv)
    return conv


def get_messages(db: Session, conversation_id: str) -> list[Message]:
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .all()
    )


def get_path_to_message(db: Session, conversation_id: str, message_id: str | None) -> list[Message]:
    """Camino raíz → message_id (inclusive) dentro de la conversación."""
    return path_from_messages(get_messages(db, conversation_id), message_id)


def get_inherited_prefix(db: Session, conv: Conversation, _seen: set[str] | None = None) -> list[Message]:
    """Mensajes del origen hasta el ancla (recursivo si el origen también es variante)."""
    origin_id = getattr(conv, "forked_from_conversation_id", None)
    anchor_id = getattr(conv, "forked_from_message_id", None)
    if not origin_id or not anchor_id:
        return []
    seen = set(_seen or ())
    if origin_id in seen or len(seen) > 32:
        return []
    seen.add(origin_id)
    origin = get_conversation(db, origin_id, include_deleted=True)
    if not origin:
        return []
    return get_resolved_history(db, origin, anchor_id, _seen=seen)


def get_resolved_history(
    db: Session,
    conv: Conversation,
    parent_id: str | None,
    _seen: set[str] | None = None,
) -> list[Message]:
    """Prefijo heredado + camino propio hasta parent_id (o la hoja activa si parent_id es None)."""
    prefix = get_inherited_prefix(db, conv, _seen=_seen)
    own = get_messages(db, conv.id)
    target = parent_id if parent_id is not None else getattr(conv, "active_leaf_message_id", None)
    if target:
        own_path = path_from_messages(own, target)
        if own_path:
            return prefix + own_path
        for i, msg in enumerate(prefix):
            if msg.id == target:
                return prefix[: i + 1]
        return prefix
    return prefix


def get_visible_message(db: Session, view_conversation_id: str, message_id: str) -> Message | None:
    """Mensaje propio o del prefijo heredado; None si no es visible en esa vista."""
    view = get_conversation(db, view_conversation_id)
    if not view:
        return None
    return _visible_message_in(db, view, message_id)


def _visible_message_in(db: Session, view: Conversation, message_id: str) -> Message | None:
    own = get_message(db, view.id, message_id)
    if own:
        return own
    for msg in get_inherited_prefix(db, view):
        if msg.id == message_id:
            return msg
    return None


def resolve_fork_anchor(db: Session, view_conv: Conversation, message_id: str) -> tuple[str, str] | None:
    """(conversation_id dueña del mensaje, message_id) para colgar el historial."""
    msg = _visible_message_in(db, view_conv, message_id)
    if not msg:
        return None
    return msg.conversation_id, message_id


def fork_conversation(db: Session, view_conversation_id: str, message_id: str) -> Conversation | None:
    """Conversación nueva, sin copiar mensajes; el historial se resuelve desde el ancla."""
    view = get_conversation(db, view_conversation_id)
    if not view:
        return None
    anchor = resolve_fork_anchor(db, view, message_id)
    if not anchor:
        return None
    owner_id, anchor_id = anchor
    instruction_ids = None
    if view.instruction_ids:
        try:
            parsed = json.loads(view.instruction_ids)
            if isinstance(parsed, list):
                instruction_ids = [str(x) for x in parsed if x]
        except (TypeError, ValueError):
            instruction_ids = None
    child = create_conversation(
        db,
        title=view.title or "Nueva conversación",
        model_id=view.model_id,
        provider=view.provider or "ollama",
        system_instruction_global=view.system_instruction_global,
        instruction_ids=instruction_ids,
        history_turns=view.history_turns if view.history_turns is not None else 5,
        forked_from_conversation_id=owner_id,
        forked_from_message_id=anchor_id,
    )
    child.model_params = view.model_params
    child.instruction_override = view.instruction_override
    child.last_message_at = datetime.utcnow()
    db.commit()
    db.refresh(child)
    return child


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
    parent_id: str | None = None,
) -> Message:
    conv = get_conversation(db, conversation_id)
    resolved_parent = parent_id if parent_id is not None else (
        getattr(conv, "active_leaf_message_id", None) if conv else None
    )
    if resolved_parent and not get_message(db, conversation_id, resolved_parent):
        resolved_parent = None
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        instruction_override=instruction_override,
        debug_request_json=debug_request_json,
        debug_response_raw=debug_response_raw,
        parent_id=resolved_parent,
    )
    db.add(msg)
    db.flush()
    if conv:
        conv.last_message_at = datetime.utcnow()
        conv.active_leaf_message_id = msg.id
    db.commit()
    db.refresh(msg)
    return msg


def touch_conversation(db: Session, conversation_id: str) -> None:
    conv = get_conversation(db, conversation_id)
    if conv:
        conv.updated_at = datetime.utcnow()
        db.commit()


def delete_message(db: Session, conversation_id: str, message_id: str) -> bool:
    """Elimina un mensaje y reparenta sus hijos al padre del borrado."""
    msg = get_message(db, conversation_id, message_id)
    if not msg:
        return False
    conv = get_conversation(db, conversation_id)
    parent_id = msg.parent_id
    children = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id, Message.parent_id == message_id)
        .all()
    )
    for child in children:
        child.parent_id = parent_id
    if conv and getattr(conv, "active_leaf_message_id", None) == message_id:
        conv.active_leaf_message_id = parent_id
    db.delete(msg)
    db.commit()
    return True


def delete_last_message(db: Session, conversation_id: str) -> bool:
    """Elimina la hoja activa (el mensaje actual del intento). False si no hay mensajes."""
    conv = get_conversation(db, conversation_id)
    leaf_id = getattr(conv, "active_leaf_message_id", None) if conv else None
    if leaf_id:
        return delete_message(db, conversation_id, leaf_id)
    msgs = get_messages(db, conversation_id)
    if not msgs:
        return False
    return delete_message(db, conversation_id, msgs[-1].id)


def clear_conversation_messages(db: Session, conversation_id: str) -> int:
    """Elimina todos los mensajes de una conversación. Devuelve el número de mensajes eliminados."""
    conv = get_conversation(db, conversation_id)
    count = db.query(Message).filter(Message.conversation_id == conversation_id).delete()
    if conv:
        conv.active_leaf_message_id = None
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
    prompt_model: str | None = None,
    prompt_provider: str | None = None,
    use_chat_config: bool | None = None,
) -> IllustratedImage:
    """Upsert por filename: params Forge + LLM del planificador (columnas y params_json)."""
    model = (prompt_model or "").strip() or None
    provider = (prompt_provider or "").strip() or None
    stored = dict(params or {})
    if model:
        stored["prompt_llm_model"] = model
    if provider:
        stored["prompt_llm_provider"] = provider
    if use_chat_config is not None:
        stored["use_chat_config"] = bool(use_chat_config)
    row = (
        db.query(IllustratedImage)
        .filter(IllustratedImage.filename == filename)
        .first()
    )
    payload = json.dumps(stored, ensure_ascii=False, default=str)
    if row:
        row.message_id = message_id
        row.scene_id = scene_id
        row.mode = mode or row.mode
        row.params_json = payload
        row.prompt_model = model
        row.prompt_provider = provider
    else:
        row = IllustratedImage(
            message_id=message_id,
            filename=filename,
            scene_id=scene_id,
            mode=mode or "txt2img",
            params_json=payload,
            prompt_model=model,
            prompt_provider=provider,
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


def get_latest_prompt_llm_for_message(
    db: Session, message_id: str
) -> tuple[str | None, str | None]:
    """Provider y modelo LLM del prompt más reciente del mensaje, si existen."""
    if not message_id:
        return None, None
    row = (
        db.query(IllustratedImage)
        .filter(IllustratedImage.message_id == message_id)
        .filter(IllustratedImage.prompt_model.isnot(None))
        .filter(IllustratedImage.prompt_model != "")
        .order_by(IllustratedImage.created_at.desc())
        .first()
    )
    if not row:
        return None, None
    return row.prompt_provider, row.prompt_model


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _illustrated_gallery_base_query(db: Session):
    return (
        db.query(IllustratedImage, Message, Conversation)
        .join(Message, IllustratedImage.message_id == Message.id)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.deleted_at.is_(None))
    )


def _apply_illustrated_gallery_filters(
    q,
    *,
    prompt_provider: str | None,
    prompt_model: str | None,
    forge_model: str | None,
    steps: int | None,
    width: int | None,
    height: int | None,
    mode: str | None,
    prompt_q: str | None,
    conversation_id: str | None = None,
    message_id: str | None = None,
):
    if message_id:
        q = q.filter(IllustratedImage.message_id == message_id)
    if conversation_id:
        q = q.filter(Message.conversation_id == conversation_id)
    if prompt_provider is not None:
        if prompt_provider == "":
            q = q.filter(
                or_(
                    IllustratedImage.prompt_provider.is_(None),
                    IllustratedImage.prompt_provider == "",
                )
            )
        else:
            q = q.filter(IllustratedImage.prompt_provider == prompt_provider)
    if prompt_model is not None:
        if prompt_model == "":
            q = q.filter(
                or_(
                    IllustratedImage.prompt_model.is_(None),
                    IllustratedImage.prompt_model == "",
                )
            )
        else:
            q = q.filter(IllustratedImage.prompt_model == prompt_model)
    if forge_model:
        q = q.filter(
            func.json_extract(IllustratedImage.params_json, "$.model") == forge_model
        )
    if steps is not None:
        q = q.filter(
            func.json_extract(IllustratedImage.params_json, "$.steps") == steps
        )
    if width is not None:
        q = q.filter(
            func.json_extract(IllustratedImage.params_json, "$.width") == width
        )
    if height is not None:
        q = q.filter(
            func.json_extract(IllustratedImage.params_json, "$.height") == height
        )
    if mode:
        q = q.filter(IllustratedImage.mode == mode)
    if prompt_q:
        like = f"%{_escape_like(prompt_q.strip())}%"
        q = q.filter(
            func.json_extract(IllustratedImage.params_json, "$.prompt").like(
                like, escape="\\"
            )
        )
    return q


def list_illustrated_images(
    db: Session,
    *,
    prompt_provider: str | None = None,
    prompt_model: str | None = None,
    forge_model: str | None = None,
    steps: int | None = None,
    width: int | None = None,
    height: int | None = None,
    mode: str | None = None,
    prompt_q: str | None = None,
    conversation_id: str | None = None,
    message_id: str | None = None,
    limit: int = 24,
    offset: int = 0,
) -> tuple[list[tuple[IllustratedImage, Message, Conversation]], int]:
    """Galería: imágenes de conversaciones activas, más recientes primero."""
    q = _apply_illustrated_gallery_filters(
        _illustrated_gallery_base_query(db),
        prompt_provider=prompt_provider,
        prompt_model=prompt_model,
        forge_model=forge_model,
        steps=steps,
        width=width,
        height=height,
        mode=mode,
        prompt_q=prompt_q,
        conversation_id=conversation_id,
        message_id=message_id,
    )
    total = q.count()
    rows = (
        q.order_by(IllustratedImage.created_at.desc(), IllustratedImage.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return rows, total


def illustrated_image_facets(
    db: Session,
    *,
    conversation_id: str | None = None,
    message_id: str | None = None,
) -> dict:
    """Valores distintos para los filtros cerrados de la galería."""
    q = (
        db.query(IllustratedImage)
        .join(Message, IllustratedImage.message_id == Message.id)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .filter(Conversation.deleted_at.is_(None))
    )
    q = _apply_illustrated_gallery_filters(
        q,
        prompt_provider=None,
        prompt_model=None,
        forge_model=None,
        steps=None,
        width=None,
        height=None,
        mode=None,
        prompt_q=None,
        conversation_id=conversation_id,
        message_id=message_id,
    )
    rows = q.all()
    providers: set[str] = set()
    models: set[str] = set()
    forge_models: set[str] = set()
    steps_vals: set[int] = set()
    sizes: set[str] = set()
    modes: set[str] = set()
    missing_llm = False
    for row in rows:
        if (row.prompt_provider or "").strip():
            providers.add(row.prompt_provider.strip())
        if (row.prompt_model or "").strip():
            models.add(row.prompt_model.strip())
        else:
            missing_llm = True
        if (row.mode or "").strip():
            modes.add(row.mode.strip())
        try:
            params = json.loads(row.params_json or "{}")
        except json.JSONDecodeError:
            params = {}
        if not isinstance(params, dict):
            continue
        forge = str(params.get("model") or "").strip()
        if forge:
            forge_models.add(forge)
        if params.get("steps") is not None:
            try:
                steps_vals.add(int(params["steps"]))
            except (TypeError, ValueError):
                pass
        w, h = params.get("width"), params.get("height")
        if w is not None and h is not None:
            try:
                sizes.add(f"{int(w)}x{int(h)}")
            except (TypeError, ValueError):
                pass
    return {
        "prompt_providers": sorted(providers),
        "prompt_models": sorted(models),
        "forge_models": sorted(forge_models),
        "steps": sorted(steps_vals),
        "sizes": sorted(sizes, key=lambda s: [int(p) for p in s.split("x")]),
        "modes": sorted(modes),
        "has_missing_prompt_llm": missing_llm,
    }


def _message_excerpt(content: str, limit: int = 88) -> str:
    text = re.sub(r"<[^>]+>", " ", content or "")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        return text[: limit - 1] + "…"
    return text


def list_illustrated_message_summaries(db: Session, conversation_id: str) -> list[dict]:
    """Mensajes de una conversación activa que tienen al menos una imagen."""
    conv = get_conversation(db, conversation_id)
    if not conv:
        return []
    counts = (
        db.query(IllustratedImage.message_id, func.count(IllustratedImage.id))
        .join(Message, IllustratedImage.message_id == Message.id)
        .filter(Message.conversation_id == conversation_id)
        .group_by(IllustratedImage.message_id)
        .all()
    )
    if not counts:
        return []
    by_id = {mid: n for mid, n in counts}
    messages = (
        db.query(Message)
        .filter(Message.id.in_(list(by_id.keys())))
        .order_by(Message.created_at.asc())
        .all()
    )
    return [
        {
            "message_id": msg.id,
            "role": msg.role,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
            "excerpt": _message_excerpt(msg.content or ""),
            "image_count": int(by_id.get(msg.id) or 0),
        }
        for msg in messages
    ]


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
