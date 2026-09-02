"""Operaciones de cancelación y borrado en la cola de imágenes."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app import crud
from app.models import ImageGenerationJob
from app.services.image_illustration.orchestrator import _replace_scene_slot


def remove_scene_slot_from_content(content: str, scene_id: str) -> str:
    """Elimina placeholder, error o marcador de una escena cancelada."""
    return _replace_scene_slot(content or "", scene_id, "")


def delete_image_generation_jobs(db: Session, job_ids: list[str]) -> tuple[int, list[str]]:
    """
    Borra trabajos de la cola. Si no están completados, quita el hueco del mensaje.
    Devuelve (número borrado, ids efectivamente eliminados).
    """
    cleaned = [str(i).strip() for i in job_ids if str(i).strip()]
    if not cleaned:
        return 0, []

    jobs = (
        db.query(ImageGenerationJob)
        .filter(ImageGenerationJob.id.in_(cleaned))
        .all()
    )
    if not jobs:
        return 0, []

    pending_content: dict[tuple[str, str], str] = {}
    for job in jobs:
        if job.status == "completed":
            continue
        key = (job.conversation_id, job.message_id)
        if key not in pending_content:
            msg = crud.get_message(db, job.conversation_id, job.message_id)
            pending_content[key] = (msg.content or "") if msg else ""
        pending_content[key] = remove_scene_slot_from_content(
            pending_content[key],
            job.scene_id,
        )

    for (conversation_id, message_id), content in pending_content.items():
        msg = crud.get_message(db, conversation_id, message_id)
        if msg and (msg.content or "") != content:
            crud.update_message_content(db, conversation_id, message_id, content)

    deleted_ids = [job.id for job in jobs]
    db.query(ImageGenerationJob).filter(ImageGenerationJob.id.in_(deleted_ids)).delete(
        synchronize_session=False
    )
    db.commit()
    return len(deleted_ids), deleted_ids
