"""Tests del job processor con post-proceso ReActor."""

import json
from unittest.mock import MagicMock

from app import crud
from app.services.image_illustration.job_processor import process_image_generation_job
from app.services.image_illustration.models import ForgeMode


def test_job_processor_applies_reactor_before_save(db_session, monkeypatch, tmp_path):
    source = tmp_path / "face.jpg"
    source.write_bytes(b"face")
    monkeypatch.setattr(
        "app.services.image_illustration.reactor_settings.settings.forge_reactor_source_image",
        str(source),
    )

    conv = crud.create_conversation(db_session, title="ReActor", model_id="m", provider="ollama")
    msg = crud.add_message(
        db_session,
        conv.id,
        "assistant",
        '<span class="chat-illustration-placeholder" data-scene="s1">Generando…</span>',
    )
    job = crud.create_image_generation_job(
        db_session,
        conversation_id=conv.id,
        message_id=msg.id,
        scene_id="s1",
        forge_prompt="scene",
        forge_mode=ForgeMode.TXT2IMG.value,
        forge_body={"prompt": "scene", "steps": 8},
        rules={
            "reactor_enabled": True,
            "reactor": {"enabled": True},
        },
    )

    forge = MagicMock()
    forge.generate.return_value = b"raw-generated"
    forge.reactor_swap.return_value = b"final-with-face"

    saved: list[tuple[str, bytes]] = []

    def capture_save(scene_id, data):
        saved.append((scene_id, data))
        return f"{scene_id}.png"

    monkeypatch.setattr(
        "app.services.image_illustration.job_processor.save_illustrated_image",
        capture_save,
    )

    process_image_generation_job(db_session, job, forge=forge)

    assert saved == [("s1", b"final-with-face")]
    forge.generate.assert_called_once()
    forge.reactor_swap.assert_called_once()
    swap_kwargs = forge.reactor_swap.call_args.kwargs
    assert swap_kwargs["source_image"] == b"face"
    assert swap_kwargs["target_image"] == b"raw-generated"

    db_session.refresh(job)
    assert job.status == "completed"
    assert job.result_filename == "s1.png"

    updated = crud.get_message(db_session, conv.id, msg.id)
    assert "/api/illustrated-images/s1.png" in (updated.content or "")

    meta = crud.get_illustrated_image_meta(db_session, "s1.png")
    assert meta is not None
    params = json.loads(meta.params_json or "{}")
    assert params.get("reactor_applied") is True
