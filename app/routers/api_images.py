"""API de ilustración de mensajes con Forge Neo."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app import crud
from app.config import settings
from app.db import get_db
from app.provider_params import build_extra_body
from app.providers import get_provider
from app.routers.api_conversations import (
    _effective_system_instructions,
    _parse_model_params,
)
from app.schemas import IllustrateRequest
from app.services.image_illustration.forge_client import ForgeHttpClient
from app.services.image_illustration.last_payload import FileSystemLastPayloadSource
from app.services.image_illustration.orchestrator import ImageIllustrationOrchestrator
from app.services.image_illustration.scene_planner import LlmScenePlanner
from app.services.image_illustration.storage import resolve_illustrated_path, save_illustrated_image

router = APIRouter(prefix="/api", tags=["images"])


def _chat_rules_text(conv, db: Session) -> str:
    """Concatena el contenido de las reglas de la conversación (mismo criterio que el chat)."""
    instructions = _effective_system_instructions(conv, db)
    return " ".join(
        (c or "").strip()
        for c in (r.get("content", "") for r in instructions)
        if (c or "").strip()
    ).strip()


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
        system_instructions = _chat_rules_text(conv, db)
        model_params = _parse_model_params(getattr(conv, "model_params", None))
        extra_body = build_extra_body(provider_name, model_params) or None
    else:
        provider_name = body.prompt_provider
        model = body.prompt_model.strip()
        system_instructions = body.prompt_system_instructions
        extra_body = None

    provider = get_provider(provider_name)
    planner = LlmScenePlanner(
        provider=provider,
        model=model,
        system_instructions=system_instructions,
        extra_body=extra_body,
    )
    payload_source = FileSystemLastPayloadSource(
        data_path=settings.forge_data_path,
        style_init_dir=settings.forge_style_init_dir,
        forge_base_url=settings.forge_base_url,
        timeout_seconds=min(60.0, settings.forge_timeout_seconds),
    )
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


@router.post("/conversations/{conversation_id}/messages/{message_id}/illustrate")
def illustrate_message(
    conversation_id: str,
    message_id: str,
    body: IllustrateRequest,
    db: Session = Depends(get_db),
):
    """
    Tras el chat: planifica escenas, genera con Forge (ReplayLastGeneration)
    y emite NDJSON (log|placeholder|image|error|done).
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

    def event_stream():
        final_content = text
        try:
            for event in orch.run(
                text,
                max_images=body.images_per_response,
                retries=body.retries,
                prompt=body.prompt,
                include_prompt_debug=body.include_prompt_debug,
            ):
                if event.content is not None:
                    final_content = event.content
                    # Persistir en cada avance para no perder imgs si el cliente cierra el stream.
                    if event.type in ("placeholder", "image", "error", "done") and final_content != text:
                        crud.update_message_content(
                            db, conversation_id, message_id, final_content
                        )
                if event.type == "log" and not body.debug:
                    continue
                if event.type == "llm_debug" and not body.include_prompt_debug:
                    continue
                yield json.dumps(event.to_dict(), ensure_ascii=False) + "\n"
        finally:
            if final_content != text:
                try:
                    crud.update_message_content(db, conversation_id, message_id, final_content)
                except Exception:
                    from app.db import SessionLocal

                    persist = SessionLocal()
                    try:
                        crud.update_message_content(
                            persist, conversation_id, message_id, final_content
                        )
                    finally:
                        persist.close()

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@router.get("/illustrated-images/{filename}")
def get_illustrated_image(filename: str):
    path = resolve_illustrated_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    media = "image/png"
    suf = path.suffix.lower()
    if suf in {".jpg", ".jpeg"}:
        media = "image/jpeg"
    elif suf == ".webp":
        media = "image/webp"
    return FileResponse(path, media_type=media)
