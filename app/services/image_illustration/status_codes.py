"""Códigos estables de estado para la barra de estado (UI)."""

from __future__ import annotations

from app.services.image_illustration.models import IllustrationEvent

# Códigos emitidos por el orquestador (type=status). La UI traduce a etiquetas.
IMAGES_STARTING = "images.starting"
IMAGES_PLANNING = "images.planning"
IMAGES_PLAN_READY = "images.plan_ready"
IMAGES_SKIPPED = "images.skipped"
IMAGES_INSERTING_ANCHORS = "images.inserting_anchors"
IMAGES_LOADING_FORGE = "images.loading_forge_payload"
IMAGES_SUBMITTING_PROMPT = "images.submitting_prompt"
IMAGES_QUEUING = "images.queuing"
IMAGES_AWAITING_GENERATION = "images.awaiting_generation"
IMAGES_IMAGE_READY = "images.image_ready"
IMAGES_IMAGE_FAILED = "images.image_failed"
IMAGES_RETRYING = "images.retrying"
IMAGES_DONE = "images.done"
IMAGES_ERROR = "images.error"


def status_event(
    code: str,
    message: str = "",
    *,
    scene_id: str | None = None,
    index: int | None = None,
    total: int | None = None,
    **extra,
) -> IllustrationEvent:
    """Evento NDJSON type=status con código estable para la barra inferior."""
    data: dict = {"code": code}
    if index is not None:
        data["index"] = index
    if total is not None:
        data["total"] = total
    data.update(extra)
    return IllustrationEvent(
        type="status",
        message=message,
        scene_id=scene_id,
        data=data,
    )
