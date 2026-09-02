"""Worker en background que procesa la cola de generación Forge."""

from __future__ import annotations

import logging
import threading
import time

from app import crud
from app.config import settings
from app.db import SessionLocal
from app.services.image_illustration.forge_client import ForgeHttpClient
from app.services.image_illustration.job_processor import process_image_generation_job

logger = logging.getLogger(__name__)

_worker_started = False
_worker_lock = threading.Lock()
_pause_lock = threading.Lock()
_paused = False
_POLL_IDLE_SECONDS = 1.0
_POLL_ERROR_SECONDS = 2.0


def is_image_generation_queue_paused() -> bool:
    with _pause_lock:
        return _paused


def pause_image_generation_queue() -> None:
    with _pause_lock:
        global _paused
        _paused = True
    logger.info("Cola de imágenes pausada")


def resume_image_generation_queue() -> None:
    with _pause_lock:
        global _paused
        _paused = False
    logger.info("Cola de imágenes reanudada")


def start_image_generation_worker() -> None:
    """Arranca un hilo daemon que drena la cola de imágenes."""
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return
        _worker_started = True
    db = SessionLocal()
    try:
        reset = crud.reset_stuck_image_generation_jobs(db)
        if reset:
            logger.info("Reencolados %s trabajos de imagen atascados", reset)
    finally:
        db.close()
    thread = threading.Thread(
        target=_worker_loop,
        name="image-generation-worker",
        daemon=True,
    )
    thread.start()
    logger.info("Worker de cola de imágenes iniciado")


def _worker_loop() -> None:
    forge = ForgeHttpClient(
        base_url=settings.forge_base_url,
        timeout_seconds=settings.forge_timeout_seconds,
    )
    while True:
        if is_image_generation_queue_paused():
            time.sleep(_POLL_IDLE_SECONDS)
            continue
        db = SessionLocal()
        try:
            job = crud.claim_next_image_generation_job(db)
            if not job:
                time.sleep(_POLL_IDLE_SECONDS)
                continue
            process_image_generation_job(db, job, forge=forge)
        except Exception:
            logger.exception("Error en worker de cola de imágenes")
            time.sleep(_POLL_ERROR_SECONDS)
        finally:
            db.close()
