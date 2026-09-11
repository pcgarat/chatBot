"""Cola persistente de generación Forge."""

import json
from unittest.mock import MagicMock, patch

import pytest

from app import crud
from app.services.image_illustration.models import (
    ForgeMode,
    IllustrationEvent,
    LastGenerationPayload,
    ScenePlan,
    SceneSpec,
)
from app.services.image_illustration.orchestrator import ImageIllustrationOrchestrator
from app.services.image_illustration.run_context import IllustrationRunContext


def test_create_and_list_image_generation_jobs(db_session):
    conv = crud.create_conversation(db_session, title="Cola", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "Primera frase del mensaje. Segunda.")

    job = crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s1",
        forge_prompt="a lighthouse",
        forge_mode="txt2img",
        forge_body={"prompt": "a lighthouse", "steps": 20},
        rules={"panel_prompt": "extra"},
        prompt_model="llama3.2",
        prompt_provider="ollama",
        batch_id="batch-1",
        retries_remaining=2,
    )

    assert job.status == "pending"
    items, total = crud.list_image_generation_jobs(db_session)
    assert total == 1
    assert items[0]["id"] == job.id
    assert items[0]["message_excerpt"] == "Primera frase del mensaje"
    assert items[0]["conversation_title"] == "Cola"
    assert items[0]["prompt_model"] == "llama3.2"

    pending, _ = crud.list_image_generation_jobs(db_session, statuses=["pending"])
    assert len(pending) == 1
    completed, _ = crud.list_image_generation_jobs(db_session, statuses=["completed"])
    assert len(completed) == 0


def test_claim_and_complete_job(db_session):
    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "Hola.")
    crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s1",
        forge_prompt="test",
        forge_mode="txt2img",
        forge_body={"prompt": "test"},
    )

    claimed = crud.claim_next_image_generation_job(db_session)
    assert claimed is not None
    assert claimed.status == "generating"

    crud.complete_image_generation_job(
        db_session,
        claimed.id,
        result_filename="abc_s1.png",
    )
    items, _ = crud.list_image_generation_jobs(db_session, statuses=["completed"])
    assert items[0]["result_filename"] == "abc_s1.png"
    assert items[0]["created_at"]
    assert items[0]["completed_at"]


def test_fail_job_retries_then_marks_failed(db_session):
    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "Hola.")
    job = crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s1",
        forge_prompt="test",
        forge_mode="txt2img",
        forge_body={"prompt": "test"},
        retries_remaining=1,
    )
    crud.claim_next_image_generation_job(db_session)
    crud.fail_image_generation_job(db_session, job.id, error_message="timeout", retry=True)
    row = crud.list_image_generation_jobs(db_session, statuses=["pending"])[0][0]
    assert row["status"] == "pending"

    crud.claim_next_image_generation_job(db_session)
    crud.fail_image_generation_job(db_session, job.id, error_message="timeout final", retry=False)
    failed = crud.list_image_generation_jobs(db_session, statuses=["failed"])[0][0]
    assert failed["status"] == "failed"
    assert "timeout final" in failed["error_message"]


def test_reset_stuck_jobs(db_session):
    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "Hola.")
    job = crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s1",
        forge_prompt="test",
        forge_mode="txt2img",
        forge_body={"prompt": "test"},
    )
    crud.claim_next_image_generation_job(db_session)
    reset = crud.reset_stuck_image_generation_jobs(db_session)
    assert reset == 1
    items, _ = crud.list_image_generation_jobs(db_session, statuses=["pending"])
    assert items[0]["id"] == job.id


def test_orchestrator_enqueues_when_run_context(clientless_db=None):
    payload = LastGenerationPayload(
        mode=ForgeMode.TXT2IMG,
        body={"prompt": "base", "steps": 20},
    )
    enqueued: list[dict] = []

    def enqueue_fn(**kwargs):
        enqueued.append(kwargs)
        return f"job-{len(enqueued)}"

    orch = ImageIllustrationOrchestrator(
        planner=MagicMock(
            plan=MagicMock(
                return_value=ScenePlan(
                    illustrate=True,
                    scenes=[SceneSpec(id="s1", prompt="a cat")],
                )
            )
        ),
        payload_source=MagicMock(load=MagicMock(return_value=payload)),
        forge=MagicMock(),
        save_image=lambda sid, data: f"{sid}.png",
    )
    ctx = IllustrationRunContext(
        conversation_id="c1",
        message_id="m1",
        prompt_model="llama",
        prompt_provider="ollama",
        batch_id="b1",
        retries=1,
        rules={"prompt_system_instructions": "rule text"},
        enqueue_fn=enqueue_fn,
    )
    events = list(
        orch.run_at(
            "Texto del párrafo.",
            paragraph_index=0,
            retries=1,
            run_context=ctx,
        )
    )
    types = [e.type for e in events]
    assert "queued" in types
    assert "image" not in types
    assert len(enqueued) == 1
    assert enqueued[0]["scene_id"] == "s1"
    assert enqueued[0]["conversation_id"] == "c1"


def test_list_image_generation_queue_api(client, db_session):
    conv = crud.create_conversation(db_session, title="API Cola", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "Un faro en la costa.")
    crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s1",
        forge_prompt="lighthouse",
        forge_mode="txt2img",
        forge_body={"prompt": "lighthouse"},
        prompt_model="llama3.2",
        prompt_provider="ollama",
    )

    res = client.get("/api/image-generation-queue")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["conversation_title"] == "API Cola"
    assert "faro" in data["items"][0]["message_excerpt"].lower()
    assert data["items"][0]["created_at"]
    assert data["items"][0]["completed_at"] is None
    assert data["items"][0]["result_filename"] is None
    assert "batch_progress" in data
    assert isinstance(data["batch_progress"], list)

    res_filtered = client.get("/api/image-generation-queue?status=pending")
    assert res_filtered.status_code == 200
    assert len(res_filtered.json()["items"]) == 1


def test_summarize_active_image_generation_batches(db_session):
    conv = crud.create_conversation(db_session, title="Batches", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "Escenas.")

    def _job(batch_id: str, scene_id: str, *, complete: bool = False):
        job = crud.create_image_generation_job(
            db_session,
            conversation_id=conv.id,
            message_id=msg.id,
            scene_id=scene_id,
            forge_prompt="p",
            forge_mode="txt2img",
            forge_body={"prompt": "p"},
            batch_id=batch_id,
        )
        if complete:
            crud.complete_image_generation_job(
                db_session, job.id, result_filename=f"{scene_id}.png"
            )
        return job

    for i in range(16):
        _job("batch-16", f"s16-{i}", complete=i < 3)
    for i in range(10):
        _job("batch-10", f"s10-{i}")

    progress = crud.summarize_active_image_generation_batches(db_session)
    assert [(p["batch_id"], p["completed"], p["total"]) for p in progress] == [
        ("batch-16", 3, 16),
        ("batch-10", 0, 10),
    ]


def test_list_image_generation_queue_includes_batch_progress(client, db_session):
    conv = crud.create_conversation(db_session, title="API Batches", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "Dos lotes.")
    for i in range(4):
        job = crud.create_image_generation_job(
            db_session,
            conversation_id=conv.id,
            message_id=msg.id,
            scene_id=f"a{i}",
            forge_prompt="a",
            forge_mode="txt2img",
            forge_body={"prompt": "a"},
            batch_id="batch-a",
        )
        if i < 1:
            crud.complete_image_generation_job(db_session, job.id, result_filename=f"a{i}.png")
    for i in range(2):
        crud.create_image_generation_job(
            db_session,
            conversation_id=conv.id,
            message_id=msg.id,
            scene_id=f"b{i}",
            forge_prompt="b",
            forge_mode="txt2img",
            forge_body={"prompt": "b"},
            batch_id="batch-b",
        )

    data = client.get("/api/image-generation-queue").json()
    by_id = {row["batch_id"]: row for row in data["batch_progress"]}
    assert by_id["batch-a"]["completed"] == 1
    assert by_id["batch-a"]["total"] == 4
    assert by_id["batch-b"]["completed"] == 0
    assert by_id["batch-b"]["total"] == 2


def test_pause_resume_image_generation_queue_api(client):
    res_pause = client.post("/api/image-generation-queue/pause")
    assert res_pause.status_code == 200
    assert res_pause.json()["paused"] is True

    res_list = client.get("/api/image-generation-queue")
    assert res_list.json()["paused"] is True

    res_resume = client.post("/api/image-generation-queue/resume")
    assert res_resume.status_code == 200
    assert res_resume.json()["paused"] is False

    assert client.get("/api/image-generation-queue").json()["paused"] is False


def test_worker_pause_state():
    from app.services.image_illustration.worker import (
        is_image_generation_queue_paused,
        pause_image_generation_queue,
        resume_image_generation_queue,
    )

    resume_image_generation_queue()
    assert not is_image_generation_queue_paused()
    pause_image_generation_queue()
    assert is_image_generation_queue_paused()
    resume_image_generation_queue()
    assert not is_image_generation_queue_paused()


def test_delete_image_generation_queue_api(client, db_session):
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    placeholder = (
        '<span class="chat-illustration-placeholder" data-scene="s1" '
        'data-prompt="storm">Generando…</span>'
    )
    msg = crud.add_message(db_session, conv.id, "assistant", f"Hola.\n{placeholder}\nFin.")
    job = crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s1",
        forge_prompt="storm",
        forge_mode="txt2img",
        forge_body={"prompt": "storm"},
    )
    job_id = job.id

    res = client.post(
        "/api/image-generation-queue/delete",
        json={"ids": [job_id]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["deleted"] == 1
    assert body["ids"] == [job_id]

    refreshed = crud.get_message(db_session, conv.id, msg.id)
    assert "chat-illustration-placeholder" not in (refreshed.content or "")

    listing = client.get("/api/image-generation-queue")
    assert listing.json()["total"] == 0


def test_delete_image_generation_queue_api_404(client):
    res = client.post(
        "/api/image-generation-queue/delete",
        json={"ids": ["no-existe"]},
    )
    assert res.status_code == 404


def test_delete_image_generation_jobs_keeps_completed_message(client, db_session):
    from app import crud
    from app.services.image_illustration.queue_ops import delete_image_generation_jobs

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    img = '<img src="/api/illustrated-images/x.png" class="chat-illustration" data-filename="x.png" />'
    msg = crud.add_message(db_session, conv.id, "assistant", img)
    job = crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s1",
        forge_prompt="done",
        forge_mode="txt2img",
        forge_body={"prompt": "done"},
    )
    crud.complete_image_generation_job(db_session, job.id, result_filename="x.png")
    job_id = job.id

    deleted, ids = delete_image_generation_jobs(db_session, [job_id])
    assert deleted == 1
    assert ids == [job_id]
    refreshed = crud.get_message(db_session, conv.id, msg.id)
    assert "x.png" in (refreshed.content or "")


def _placeholder(scene: str) -> str:
    return (
        f'<span class="chat-illustration-placeholder" data-scene="{scene}" '
        f'data-prompt="{scene}">Generando…</span>'
    )


def test_cancel_active_image_generation_queue_api(client, db_session):
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(
        db_session,
        conv.id,
        "assistant",
        f"Hola.\n{_placeholder('s1')}\n{_placeholder('s2')}\n{_placeholder('s3')}\nFin.",
    )
    pending = crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s1",
        forge_prompt="p",
        forge_mode="txt2img",
        forge_body={"prompt": "p"},
    )
    generating = crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s2",
        forge_prompt="g",
        forge_mode="txt2img",
        forge_body={"prompt": "g"},
    )
    generating.status = "generating"
    db_session.commit()
    completed = crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s3",
        forge_prompt="c",
        forge_mode="txt2img",
        forge_body={"prompt": "c"},
    )
    crud.complete_image_generation_job(db_session, completed.id, result_filename="c.png")
    pending_id = pending.id
    generating_id = generating.id
    completed_id = completed.id

    res = client.post("/api/image-generation-queue/cancel-active")
    assert res.status_code == 200
    body = res.json()
    assert body["deleted"] == 2
    assert set(body["ids"]) == {pending_id, generating_id}

    listing = client.get("/api/image-generation-queue")
    items = listing.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == completed_id
    assert items[0]["status"] == "completed"

    refreshed = crud.get_message(db_session, conv.id, msg.id)
    assert 'data-scene="s1"' not in (refreshed.content or "")
    assert 'data-scene="s2"' not in (refreshed.content or "")
    assert 'data-scene="s3"' in (refreshed.content or "")


def test_cancel_active_image_generation_queue_empty(client):
    res = client.post("/api/image-generation-queue/cancel-active")
    assert res.status_code == 200
    assert res.json()["deleted"] == 0
    assert res.json()["ids"] == []
