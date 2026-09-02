"""Procesa un trabajo encolado de generación Forge."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from sqlalchemy.orm import Session

from app import crud
from app.models import ImageGenerationJob
from app.services.image_illustration.forge_client import ForgeHttpClient
from app.services.image_illustration.generation_params import build_stored_generation_params
from app.services.image_illustration.models import ForgeMode
from app.services.image_illustration.orchestrator import (
    _error_placeholder,
    _img_tag,
    _replace_scene_slot,
)
from app.services.image_illustration.storage import save_illustrated_image

logger = logging.getLogger(__name__)


def _url_for_saved(filename: str) -> str:
    return f"/api/illustrated-images/{filename}"


def process_image_generation_job(
    db: Session,
    job: ImageGenerationJob,
    *,
    forge: ForgeHttpClient,
) -> None:
    """Genera la imagen, actualiza el mensaje y persiste metadatos."""
    if not crud.get_image_generation_job(db, job.id):
        return

    msg = crud.get_message(db, job.conversation_id, job.message_id)
    if not msg:
        crud.fail_image_generation_job(
            db,
            job.id,
            error_message="Mensaje no encontrado",
        )
        return

    try:
        body = json.loads(job.forge_body_json or "{}")
    except (TypeError, json.JSONDecodeError) as exc:
        crud.fail_image_generation_job(
            db,
            job.id,
            error_message=f"Body Forge inválido: {exc}",
        )
        return

    mode = ForgeMode(job.forge_mode or "txt2img")
    forge_prompt = job.forge_prompt or body.get("prompt") or ""
    content = msg.content or ""

    try:
        t0 = time.perf_counter()
        image_bytes = forge.generate(mode, body)
        generation_time_ms = (time.perf_counter() - t0) * 1000.0
        filename = save_illustrated_image(job.scene_id, image_bytes)
        url = _url_for_saved(filename)
        content = _replace_scene_slot(
            content,
            job.scene_id,
            _img_tag(url, job.scene_id, filename, forge_prompt),
        )
        if not crud.get_image_generation_job(db, job.id):
            return
        crud.update_message_content(db, job.conversation_id, job.message_id, content)
        stored_params = build_stored_generation_params(
            mode,
            body,
            generation_time_ms=generation_time_ms,
        )
        rules = _load_rules(job)
        crud.save_illustrated_image_meta(
            db,
            message_id=job.message_id,
            filename=filename,
            scene_id=job.scene_id,
            mode=mode.value,
            params=_merge_prompt_llm(stored_params, job, rules),
            prompt_model=job.prompt_model,
            prompt_provider=job.prompt_provider,
            use_chat_config=rules.get("use_chat_config"),
        )
        crud.complete_image_generation_job(
            db,
            job.id,
            result_filename=filename,
        )
    except Exception as exc:
        err = str(exc)
        logger.warning("Fallo job %s escena %s: %s", job.id, job.scene_id, err)
        retry = job.retries_remaining > 0
        if retry:
            if crud.get_image_generation_job(db, job.id):
                crud.fail_image_generation_job(db, job.id, error_message=err, retry=True)
            return
        if not crud.get_image_generation_job(db, job.id):
            return
        content = _replace_scene_slot(
            content,
            job.scene_id,
            _error_placeholder(job.scene_id, err, forge_prompt),
        )
        crud.update_message_content(db, job.conversation_id, job.message_id, content)
        crud.fail_image_generation_job(db, job.id, error_message=err, retry=False)


def _load_rules(job: ImageGenerationJob) -> dict[str, Any]:
    try:
        return json.loads(job.rules_json or "{}")
    except (TypeError, json.JSONDecodeError):
        return {}


def _merge_prompt_llm(
    params: dict[str, Any],
    job: ImageGenerationJob,
    rules: dict[str, Any],
) -> dict[str, Any]:
    merged = dict(params)
    if job.prompt_model:
        merged["prompt_llm_model"] = job.prompt_model
    if job.prompt_provider:
        merged["prompt_llm_provider"] = job.prompt_provider
    if "use_chat_config" in rules:
        merged["use_chat_config"] = rules.get("use_chat_config")
    return merged
