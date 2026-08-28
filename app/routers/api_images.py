"""API de ilustración de mensajes con Forge Neo."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.db import SessionLocal, get_db
from app.provider_params import build_extra_body
from app.providers import get_provider
from app.routers.api_conversations import (
    _effective_system_instructions,
    _parse_model_params,
)
from app.schemas import (
    ForgeLastGenerationParamsResponse,
    GenerateRemainingRequest,
    IllustratedImageMetaResponse,
    IllustrateRequest,
    MessageContentUpdateResponse,
)
from app.services.image_illustration.content_ops import remove_all_photos, remove_orphan_anchors
from app.services.image_illustration.forge_client import ForgeHttpClient
from app.services.image_illustration.forge_param_overrides import forge_overrides_from_optional
from app.services.image_illustration.last_payload import (
    FileSystemLastPayloadSource,
    LastPayloadError,
)
from app.services.image_illustration.orchestrator import ImageIllustrationOrchestrator
from app.services.image_illustration.scene_planner import LlmScenePlanner
from app.services.image_illustration.storage import (
    delete_illustrated_image,
    media_type_for_illustrated_file,
    resolve_illustrated_path,
    save_illustrated_image,
)
from app.services.rules.compose import concat_instruction_texts

router = APIRouter(prefix="/api", tags=["images"])


def _chat_rules_text(conv, db: Session) -> str:
    """Concatena el contenido de las reglas de la conversación (mismo criterio que el chat)."""
    instructions = _effective_system_instructions(conv, db)
    return " ".join(
        (c or "").strip()
        for c in (r.get("content", "") for r in instructions)
        if (c or "").strip()
    ).strip()


def _forge_overrides_from_body(body: IllustrateRequest | GenerateRemainingRequest):
    """Overrides del panel Imágenes (steps/width/height/seed) si el usuario los envió."""
    return forge_overrides_from_optional(
        steps=body.steps,
        width=body.width,
        height=body.height,
        seed=body.seed,
    )


def _build_payload_source() -> FileSystemLastPayloadSource:
    return FileSystemLastPayloadSource(
        data_path=settings.forge_data_path,
        style_init_dir=settings.forge_style_init_dir,
        forge_base_url=settings.forge_base_url,
        timeout_seconds=min(60.0, settings.forge_timeout_seconds),
    )


def _build_orchestrator(
    body: IllustrateRequest,
    *,
    conv=None,
    db: Session | None = None,
) -> ImageIllustrationOrchestrator:
    if body.use_chat_config:
        if conv is None or db is None:
            raise HTTPException(
                status_code=400,
                detail="use_chat_config requiere conversación cargada",
            )
        provider_name = (conv.provider or "ollama").strip() or "ollama"
        model = (conv.model_id or "").strip()
        if not model:
            raise HTTPException(
                status_code=400,
                detail="La conversación no tiene modelo para use_chat_config",
            )
        system_instructions = concat_instruction_texts(
            _chat_rules_text(conv, db),
            body.prompt_system_instructions,
        )
        model_params = _parse_model_params(getattr(conv, "model_params", None))
        extra_body = build_extra_body(provider_name, model_params) or None
    else:
        provider_name = body.prompt_provider
        model = body.prompt_model.strip()
        system_instructions = concat_instruction_texts(body.prompt_system_instructions)
        extra_body = None

    provider = get_provider(provider_name)
    planner = LlmScenePlanner(
        provider=provider,
        model=model,
        system_instructions=system_instructions,
        extra_body=extra_body,
    )
    payload_source = _build_payload_source()
    forge = ForgeHttpClient(
        base_url=settings.forge_base_url,
        timeout_seconds=settings.forge_timeout_seconds,
    )
    return ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=payload_source,
        forge=forge,
        save_image=save_illustrated_image,
    )


def _build_forge_orchestrator() -> ImageIllustrationOrchestrator:
    """Orquestador solo Forge (sin planificador LLM): regenerate remaining."""

    class _UnusedPlanner:
        def plan(self, text, max_images):
            raise RuntimeError("ScenePlanner no se usa en generate-remaining")

    payload_source = _build_payload_source()
    forge = ForgeHttpClient(
        base_url=settings.forge_base_url,
        timeout_seconds=settings.forge_timeout_seconds,
    )
    return ImageIllustrationOrchestrator(
        planner=_UnusedPlanner(),
        payload_source=payload_source,
        forge=forge,
        save_image=save_illustrated_image,
    )


def _persist_message_content(conversation_id: str, message_id: str, content: str) -> None:
    """Sesión corta: no reutilizar Depends(get_db) dentro del StreamingResponse."""
    db = SessionLocal()
    try:
        crud.update_message_content(db, conversation_id, message_id, content)
    finally:
        db.close()


def _persist_illustrated_image_meta(
    *,
    message_id: str,
    filename: str,
    scene_id: str | None,
    mode: str,
    params: dict,
) -> None:
    db = SessionLocal()
    try:
        crud.save_illustrated_image_meta(
            db,
            message_id=message_id,
            filename=filename,
            scene_id=scene_id,
            mode=mode,
            params=params,
        )
    except Exception:
        pass
    finally:
        db.close()


def _stream_illustration_events(
    *,
    conversation_id: str,
    message_id: str,
    text: str,
    events,
    debug: bool,
    include_prompt_debug: bool = False,
):
    """Persiste content en cada avance y emite NDJSON (sesiones cortas por escritura)."""
    final_content = text
    try:
        for event in events:
            if event.content is not None:
                final_content = event.content
                if event.type in ("placeholder", "image", "error", "done") and final_content != text:
                    try:
                        _persist_message_content(
                            conversation_id, message_id, final_content
                        )
                    except Exception:
                        # El finally reintenta; no tumbar el NDJSON por un lock puntual.
                        pass
            if event.type == "image":
                data = event.data or {}
                filename = data.get("filename")
                params = data.get("params")
                if filename and isinstance(params, dict):
                    _persist_illustrated_image_meta(
                        message_id=message_id,
                        filename=filename,
                        scene_id=event.scene_id,
                        mode=str(data.get("mode") or "txt2img"),
                        params=params,
                    )
            if event.type == "log" and not debug:
                continue
            if event.type == "llm_debug" and not include_prompt_debug:
                continue
            yield json.dumps(event.to_dict(), ensure_ascii=False) + "\n"
    finally:
        if final_content != text:
            try:
                _persist_message_content(conversation_id, message_id, final_content)
            except Exception:
                pass


def _prompts_from_message_meta(db: Session, content: str) -> list[str]:
    """Prompts guardados en BD para imgs del mensaje (complementa data-prompt del HTML)."""
    from app.services.image_illustration.content_ops import extract_illustrated_filenames

    out: list[str] = []
    seen: set[str] = set()
    for name in extract_illustrated_filenames(content):
        row = crud.get_illustrated_image_meta(db, name)
        if not row:
            continue
        try:
            params = json.loads(row.params_json or "{}")
        except json.JSONDecodeError:
            continue
        if not isinstance(params, dict):
            continue
        prompt = str(params.get("prompt") or "").strip()
        if prompt and prompt not in seen:
            seen.add(prompt)
            out.append(prompt)
    return out


@router.post("/conversations/{conversation_id}/messages/{message_id}/illustrate")
def illustrate_message(
    conversation_id: str,
    message_id: str,
    body: IllustrateRequest,
    db: Session = Depends(get_db),
):
    """
    Tras el chat: planifica escenas, genera con Forge (ReplayLastGeneration)
    y emite NDJSON (status|log|placeholder|image|error|done|llm_debug).
    """
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    msg = crud.get_message(db, conversation_id, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if msg.role != "assistant":
        raise HTTPException(status_code=400, detail="Solo se ilustran mensajes assistant")

    text = msg.content or ""
    orch = _build_orchestrator(body, conv=conv, db=db)
    meta_prompts = _prompts_from_message_meta(db, text)

    def event_stream():
        # No capturar `db` del request: Depends(get_db) se cierra al acabar/cortar el stream.
        yield from _stream_illustration_events(
            conversation_id=conversation_id,
            message_id=message_id,
            text=text,
            events=orch.run(
                text,
                max_images=body.images_per_response,
                retries=body.retries,
                prompt=body.prompt,
                include_prompt_debug=body.include_prompt_debug,
                batch_size=body.batch_size,
                existing_prompts=meta_prompts or None,
                forge_overrides=_forge_overrides_from_body(body),
            ),
            debug=body.debug,
            include_prompt_debug=body.include_prompt_debug,
        )

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/illustrations/generate-remaining"
)
def generate_remaining_images(
    conversation_id: str,
    message_id: str,
    body: GenerateRemainingRequest,
    db: Session = Depends(get_db),
):
    """
    Regenera placeholders/errores con prompt recuperable (sin re-planificar LLM).
    Emite el mismo NDJSON que illustrate.
    """
    msg = _require_assistant_message(db, conversation_id, message_id)
    text = msg.content or ""
    orch = _build_forge_orchestrator()

    def event_stream():
        yield from _stream_illustration_events(
            conversation_id=conversation_id,
            message_id=message_id,
            text=text,
            events=orch.run_remaining(
                text,
                retries=body.retries,
                batch_size=body.batch_size,
                forge_overrides=_forge_overrides_from_body(body),
            ),
            debug=body.debug,
        )

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


def _require_assistant_message(db: Session, conversation_id: str, message_id: str):
    conv = crud.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    msg = crud.get_message(db, conversation_id, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if msg.role != "assistant":
        raise HTTPException(status_code=400, detail="Solo se editan ilustraciones de mensajes assistant")
    return msg


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/illustrations/clear-photos",
    response_model=MessageContentUpdateResponse,
)
def clear_message_photos(conversation_id: str, message_id: str, db: Session = Depends(get_db)):
    """Borra para siempre las fotos generadas de la respuesta (ficheros + tags img)."""
    msg = _require_assistant_message(db, conversation_id, message_id)
    new_content, filenames = remove_all_photos(msg.content or "")
    deleted = 0
    for name in filenames:
        if delete_illustrated_image(name):
            deleted += 1
    if filenames:
        crud.delete_illustrated_images_by_filenames(db, filenames)
    updated = crud.update_message_content(db, conversation_id, message_id, new_content)
    return MessageContentUpdateResponse(
        id=updated.id if updated else message_id,
        content=new_content,
        deleted_files=deleted,
    )


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/illustrations/prune-orphans",
    response_model=MessageContentUpdateResponse,
)
def prune_orphan_anchors(conversation_id: str, message_id: str, db: Session = Depends(get_db)):
    """Elimina anclas huérfanas (marcadores, placeholders y errores sin imagen)."""
    msg = _require_assistant_message(db, conversation_id, message_id)
    new_content = remove_orphan_anchors(msg.content or "")
    updated = crud.update_message_content(db, conversation_id, message_id, new_content)
    return MessageContentUpdateResponse(
        id=updated.id if updated else message_id,
        content=new_content,
        deleted_files=0,
    )


@router.get(
    "/illustrated-images/{filename}/meta",
    response_model=IllustratedImageMetaResponse,
)
def get_illustrated_image_meta(filename: str, db: Session = Depends(get_db)):
    """Devuelve prompt y parámetros Forge con los que se generó la imagen."""
    row = crud.get_illustrated_image_meta(db, filename)
    if not row:
        raise HTTPException(status_code=404, detail="Metadatos no encontrados")
    try:
        params = json.loads(row.params_json or "{}")
    except json.JSONDecodeError:
        params = {}
    if not isinstance(params, dict):
        params = {}
    return IllustratedImageMetaResponse(
        filename=row.filename,
        scene_id=row.scene_id,
        mode=row.mode or "txt2img",
        params=params,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


@router.get(
    "/forge/last-generation-params",
    response_model=ForgeLastGenerationParamsResponse,
)
def get_forge_last_generation_params():
    """
    Params del último gen de Forge (steps/width/height/seed) para autorrellenar el panel.
    No falla duro: available=false si Forge/data no están listos.
    """
    if not (settings.forge_data_path or "").strip():
        return ForgeLastGenerationParamsResponse(
            available=False,
            detail="FORGE_DATA_PATH no configurado",
        )
    try:
        source = _build_payload_source()
        data = source.load_panel_params()
    except LastPayloadError as exc:
        return ForgeLastGenerationParamsResponse(available=False, detail=str(exc))
    except Exception as exc:
        return ForgeLastGenerationParamsResponse(available=False, detail=str(exc))
    return ForgeLastGenerationParamsResponse(
        available=True,
        steps=data.get("steps"),
        width=data.get("width"),
        height=data.get("height"),
        seed=data.get("seed"),
        mode=data.get("mode"),
    )


@router.get("/illustrated-images/{filename}")
def get_illustrated_image(filename: str):
    path = resolve_illustrated_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return FileResponse(path, media_type=media_type_for_illustrated_file(path))
