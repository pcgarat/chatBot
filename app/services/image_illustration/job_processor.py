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
from app.services.image_illustration.reactor import apply_reactor_if_configured
from app.services.image_illustration.orchestrator import (
    _error_placeholder,
    _img_tag,
    _replace_scene_slot,
)
from app.services.image_illustration.storage import (
    delete_illustrated_image,
    save_illustrated_image,
)

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

    job_id = job.id
    conversation_id = job.conversation_id
    message_id = job.message_id
    scene_id = job.scene_id
    retries_remaining = job.retries_remaining
    prompt_model = job.prompt_model
    prompt_provider = job.prompt_provider
    mode = ForgeMode(job.forge_mode or "txt2img")
    forge_prompt = job.forge_prompt or body.get("prompt") or ""
    content = msg.content or ""
    rules = _load_rules(job)

    try:
        t0 = time.perf_counter()
        image_bytes = forge.generate(mode, body)
        generation_time_ms = (time.perf_counter() - t0) * 1000.0
        image_bytes, reactor_meta = apply_reactor_if_configured(
            forge,
            image_bytes,
            rules,
        )
        filename = save_illustrated_image(scene_id, image_bytes)
        finished = crud.complete_image_generation_job_if_generating(
            db,
            job_id,
            result_filename=filename,
        )
        if not finished:
            delete_illustrated_image(filename)
            logger.info("Job %s cancelado; se descarta %s", job_id, filename)
            return
        url = _url_for_saved(filename)
        content = _replace_scene_slot(
            content,
            scene_id,
            _img_tag(url, scene_id, filename, forge_prompt),
        )
        crud.update_message_content(db, conversation_id, message_id, content)
        stored_params = build_stored_generation_params(
            mode,
            body,
            generation_time_ms=generation_time_ms,
        )
        stored_params.update(reactor_meta)
        if job.batch_id:
            stored_params["batch_id"] = job.batch_id
        crud.save_illustrated_image_meta(
            db,
            message_id=message_id,
            filename=filename,
            scene_id=scene_id,
            mode=mode.value,
            params=_merge_prompt_llm(stored_params, prompt_model, prompt_provider, rules),
            prompt_model=prompt_model,
            prompt_provider=prompt_provider,
            use_chat_config=rules.get("use_chat_config"),
        )
    except Exception as exc:
        err = str(exc)
        logger.warning("Fallo job %s escena %s: %s", job_id, scene_id, err)
        retry = retries_remaining > 0
        if retry:
            if crud.image_generation_job_exists(db, job_id):
                crud.fail_image_generation_job(db, job_id, error_message=err, retry=True)
            return
        if not crud.image_generation_job_exists(db, job_id):
            return
        content = _replace_scene_slot(
            content,
            scene_id,
            _error_placeholder(scene_id, err, forge_prompt),
        )
        crud.update_message_content(db, conversation_id, message_id, content)
        crud.fail_image_generation_job(db, job_id, error_message=err, retry=False)


def _load_rules(job: ImageGenerationJob) -> dict[str, Any]:
    try:
        return json.loads(job.rules_json or "{}")
    except (TypeError, json.JSONDecodeError):
        return {}


def _merge_prompt_llm(
    params: dict[str, Any],
    prompt_model: str | None,
    prompt_provider: str | None,
    rules: dict[str, Any],
) -> dict[str, Any]:
    merged = dict(params)
    if prompt_model:
        merged["prompt_llm_model"] = prompt_model
    if prompt_provider:
        merged["prompt_llm_provider"] = prompt_provider
    if "use_chat_config" in rules:
        merged["use_chat_config"] = rules.get("use_chat_config")
    return merged
