"""Tests del endpoint de ilustración."""

import json
from unittest.mock import MagicMock, patch

import pytest

from app.services.image_illustration.models import IllustrationEvent


def _ndjson_lines(response):
    text = response.content.decode("utf-8")
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def test_illustrate_404_conversation(client):
    res = client.post(
        "/api/conversations/no-existe/messages/m1/illustrate",
        json={"prompt_model": "llama3.2", "images_per_response": 1},
    )
    assert res.status_code == 404


def test_illustrate_stream_skips_when_planner_says_no(client, db_session):
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "2+2=4")

    events_iter = iter(
        [
            IllustrationEvent(type="log", message="plan"),
            IllustrationEvent(type="done", message="sin ilustración", content="2+2=4"),
        ]
    )

    class FakeOrch:
        def run(self, *a, **k):
            yield from events_iter

    with patch("app.routers.api_images._build_orchestrator", return_value=FakeOrch()):
        res = client.post(
            f"/api/conversations/{conv.id}/messages/{msg.id}/illustrate",
            json={
                "prompt_model": "llama3.2",
                "prompt_provider": "ollama",
                "images_per_response": 2,
                "retries": 0,
                "debug": False,
            },
        )
    assert res.status_code == 200
    lines = _ndjson_lines(res)
    assert lines[-1]["type"] == "done"
    assert not any(l["type"] == "log" for l in lines)  # debug off


def test_illustrate_always_forwards_status_events(client, db_session):
    """type=status no depende de debug (barra de estado)."""
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "texto")

    class FakeOrch:
        def run(self, *a, **k):
            yield IllustrationEvent(
                type="status",
                message="Planificando escenas",
                data={"code": "images.planning"},
            )
            yield IllustrationEvent(type="log", message="oculto sin debug")
            yield IllustrationEvent(type="done", message="ok", content="texto")

    with patch("app.routers.api_images._build_orchestrator", return_value=FakeOrch()):
        res = client.post(
            f"/api/conversations/{conv.id}/messages/{msg.id}/illustrate",
            json={
                "prompt_model": "llama3.2",
                "prompt_provider": "ollama",
                "images_per_response": 1,
                "debug": False,
            },
        )
    assert res.status_code == 200
    lines = _ndjson_lines(res)
    assert any(l["type"] == "status" and l["data"]["code"] == "images.planning" for l in lines)
    assert not any(l["type"] == "log" for l in lines)


def test_illustrate_emits_logs_when_debug(client, db_session):
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "Había un bosque.")

    class FakeOrch:
        def run(self, *a, **k):
            yield IllustrationEvent(type="log", message="hola debug")
            yield IllustrationEvent(
                type="done",
                content='Había un bosque.\n<img src="/api/illustrated-images/x.png" class="chat-illustration" />',
            )

    with patch("app.routers.api_images._build_orchestrator", return_value=FakeOrch()):
        res = client.post(
            f"/api/conversations/{conv.id}/messages/{msg.id}/illustrate",
            json={
                "prompt_model": "m",
                "images_per_response": 1,
                "debug": True,
            },
        )
    lines = _ndjson_lines(res)
    assert any(l["type"] == "log" for l in lines)
    refreshed = crud.get_message(db_session, conv.id, msg.id)
    assert "chat-illustration" in refreshed.content


def test_get_illustrated_image_404(client):
    res = client.get("/api/illustrated-images/no-such.png")
    assert res.status_code == 404


def test_get_illustrated_image_ok(client, tmp_path, monkeypatch):
    from app.services.image_illustration import storage

    monkeypatch.setattr(storage, "DEFAULT_DIR", tmp_path)
    name = storage.save_illustrated_image("s1", b"\x89PNG\r\n\x1a\n")
    res = client.get(f"/api/illustrated-images/{name}")
    assert res.status_code == 200
    assert res.content.startswith(b"\x89PNG")


def test_illustrate_forwards_panel_prompt_to_orchestrator(client, db_session):
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", "Había un faro.")
    captured: dict = {}

    class FakeOrch:
        def run(self, text, *, max_images, retries, prompt="", include_prompt_debug=False, batch_size=10):
            captured["prompt"] = prompt
            captured["max_images"] = max_images
            captured["batch_size"] = batch_size
            yield IllustrationEvent(type="done", message="ok", content=text)

    with patch("app.routers.api_images._build_orchestrator", return_value=FakeOrch()):
        res = client.post(
            f"/api/conversations/{conv.id}/messages/{msg.id}/illustrate",
            json={
                "prompt_model": "llama3.2",
                "prompt_provider": "ollama",
                "images_per_response": 1,
                "batch_size": 7,
                "retries": 0,
                "prompt": "oil painting, detailed",
            },
        )
    assert res.status_code == 200
    assert captured["prompt"] == "oil painting, detailed"
    assert captured["batch_size"] == 7
    assert _ndjson_lines(res)[-1]["type"] == "done"


def test_build_orchestrator_passes_prompt_system_instructions():
    from app.routers.api_images import _build_orchestrator
    from app.schemas import IllustrateRequest

    captured: dict = {}

    with (
        patch("app.routers.api_images.get_provider", return_value=MagicMock()),
        patch("app.routers.api_images.LlmScenePlanner") as mock_planner,
        patch("app.routers.api_images.FileSystemLastPayloadSource"),
        patch("app.routers.api_images.ForgeHttpClient"),
    ):
        mock_planner.side_effect = lambda **kwargs: captured.update(kwargs) or MagicMock()
        body = IllustrateRequest(
            prompt_model="llama3.2",
            prompt_system_instructions="Prefiere iluminación nocturna",
        )
        _build_orchestrator(body)
    assert captured.get("system_instructions") == "Prefiere iluminación nocturna"


def test_build_orchestrator_use_chat_config_takes_conv_model_rules_and_params(db_session):
    from app import crud
    from app.routers.api_images import _build_orchestrator
    from app.schemas import IllustrateRequest

    rule = crud.create_rule(db_session, title="Estilo", content="Narración en segunda persona")
    conv = crud.create_conversation(
        db_session,
        title="t",
        model_id="abliterated-model",
        provider="abliteration",
        instruction_ids=[rule.id],
    )
    crud.update_conversation(
        db_session,
        conv.id,
        model_params={"temperature": 0.3, "top_p": 0.9},
    )
    conv = crud.get_conversation(db_session, conv.id)
    captured: dict = {}
    provider_calls: list = []

    with (
        patch("app.routers.api_images.get_provider") as mock_get,
        patch("app.routers.api_images.LlmScenePlanner") as mock_planner,
        patch("app.routers.api_images.FileSystemLastPayloadSource"),
        patch("app.routers.api_images.ForgeHttpClient"),
        patch(
            "app.routers.api_images.build_extra_body",
            return_value={"options": {"temperature": 0.3}},
        ) as mock_extra,
    ):
        mock_get.side_effect = lambda name: provider_calls.append(name) or MagicMock()
        mock_planner.side_effect = lambda **kwargs: captured.update(kwargs) or MagicMock()
        body = IllustrateRequest(
            use_chat_config=True,
            prompt_model="ignored-model",
            prompt_provider="ollama",
            prompt_system_instructions="panel instructions ignored",
        )
        _build_orchestrator(body, conv=conv, db=db_session)

    assert provider_calls == ["abliteration"]
    assert captured.get("model") == "abliterated-model"
    assert "Narración en segunda persona" in (captured.get("system_instructions") or "")
    assert "panel instructions ignored" not in (captured.get("system_instructions") or "")
    assert captured.get("extra_body") == {"options": {"temperature": 0.3}}
    mock_extra.assert_called_once()
    assert mock_extra.call_args[0][0] == "abliteration"


def test_illustrate_request_requires_prompt_model_unless_use_chat_config():
    from pydantic import ValidationError

    from app.schemas import IllustrateRequest

    with pytest.raises(ValidationError):
        IllustrateRequest(prompt_model="", use_chat_config=False)
    ok = IllustrateRequest(prompt_model="", use_chat_config=True)
    assert ok.use_chat_config is True


def test_illustrate_request_allows_more_than_20_images_per_response():
    from app.schemas import IllustrateRequest

    req = IllustrateRequest(prompt_model="m", images_per_response=50)
    assert req.images_per_response == 50


def test_illustrate_request_batch_size_defaults_to_10():
    from app.schemas import GenerateRemainingRequest, IllustrateRequest

    assert IllustrateRequest(prompt_model="m").batch_size == 10
    assert GenerateRemainingRequest().batch_size == 10


def test_clear_photos_deletes_files_and_updates_content(client, db_session, tmp_path, monkeypatch):
    from app import crud
    from app.services.image_illustration import storage

    monkeypatch.setattr(storage, "DEFAULT_DIR", tmp_path / "illustrated")
    name = storage.save_illustrated_image("s1", b"\x89PNG\r\n\x1a\n")
    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    content = (
        f'Había un faro.\n<img src="/api/illustrated-images/{name}" class="chat-illustration" />\n'
        "⟦img:s2⟧"
    )
    msg = crud.add_message(db_session, conv.id, "assistant", content)
    res = client.post(
        f"/api/conversations/{conv.id}/messages/{msg.id}/illustrations/clear-photos"
    )
    assert res.status_code == 200
    body = res.json()
    assert body["deleted_files"] == 1
    assert "<img" not in body["content"]
    assert "⟦img:s2⟧" in body["content"]
    assert "faro" in body["content"]
    assert not (tmp_path / "illustrated" / name).is_file()
    refreshed = crud.get_message(db_session, conv.id, msg.id)
    assert refreshed is not None
    assert refreshed.content == body["content"]


def test_prune_orphans_keeps_photos(client, db_session):
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    content = (
        'A\n<img src="/api/illustrated-images/keep.png" class="chat-illustration" />\n'
        "⟦img:s1⟧\n"
        '<span class="chat-illustration-error" data-scene="s2">fail</span>\nB'
    )
    msg = crud.add_message(db_session, conv.id, "assistant", content)
    res = client.post(
        f"/api/conversations/{conv.id}/messages/{msg.id}/illustrations/prune-orphans"
    )
    assert res.status_code == 200
    body = res.json()
    assert "keep.png" in body["content"]
    assert "⟦img:" not in body["content"]
    assert "chat-illustration-error" not in body["content"]
    assert "A" in body["content"] and "B" in body["content"]


def test_clear_photos_rejects_user_message(client, db_session):
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "user", "hola")
    res = client.post(
        f"/api/conversations/{conv.id}/messages/{msg.id}/illustrations/clear-photos"
    )
    assert res.status_code == 400


def test_generate_remaining_stream_regenerates_pending(client, db_session):
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    content = (
        'A\n<img src="/api/illustrated-images/keep.png" class="chat-illustration" />\n'
        '<span class="chat-illustration-placeholder" data-scene="s1" data-prompt="storm">'
        "Generando imagen…\n\nstorm</span>\nB"
    )
    msg = crud.add_message(db_session, conv.id, "assistant", content)

    class FakeOrch:
        def run_remaining(self, text, *, retries, batch_size=10):
            assert retries == 0
            assert batch_size == 5
            assert "data-prompt" in text
            new_content = (
                'A\n<img src="/api/illustrated-images/keep.png" class="chat-illustration" />\n'
                '<img src="/api/illustrated-images/s1.png" alt="escena s1" class="chat-illustration" />\nB'
            )
            yield IllustrationEvent(type="log", message="restantes")
            yield IllustrationEvent(
                type="image",
                scene_id="s1",
                content=new_content,
                data={"filename": "s1.png", "params": {"prompt": "storm"}, "mode": "txt2img"},
            )
            yield IllustrationEvent(type="done", message="restantes completadas", content=new_content)

    with patch("app.routers.api_images._build_forge_orchestrator", return_value=FakeOrch()):
        res = client.post(
            f"/api/conversations/{conv.id}/messages/{msg.id}/illustrations/generate-remaining",
            json={"retries": 0, "batch_size": 5, "debug": True},
        )
    assert res.status_code == 200
    lines = _ndjson_lines(res)
    assert lines[-1]["type"] == "done"
    assert any(l["type"] == "image" for l in lines)
    assert any(l["type"] == "log" for l in lines)
    refreshed = crud.get_message(db_session, conv.id, msg.id)
    assert refreshed is not None
    assert "s1.png" in (refreshed.content or "")
    assert "keep.png" in (refreshed.content or "")


def test_generate_remaining_rejects_user_message(client, db_session):
    from app import crud

    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "user", "hola")
    res = client.post(
        f"/api/conversations/{conv.id}/messages/{msg.id}/illustrations/generate-remaining",
        json={"retries": 0},
    )
    assert res.status_code == 400


def test_illustrated_image_meta_roundtrip(client, db_session, tmp_path, monkeypatch):
    from app import crud
    from app.services.image_illustration import storage

    monkeypatch.setattr(storage, "DEFAULT_DIR", tmp_path / "illustrated")
    name = storage.save_illustrated_image("s1", b"\x89PNG\r\n\x1a\n")
    conv = crud.create_conversation(db_session, title="t", model_id="m", provider="ollama")
    msg = crud.add_message(db_session, conv.id, "assistant", f'<img src="/api/illustrated-images/{name}" class="chat-illustration" />')
    crud.save_illustrated_image_meta(
        db_session,
        message_id=msg.id,
        filename=name,
        scene_id="s1",
        mode="txt2img",
        params={
            "prompt": "storm lighthouse",
            "steps": 8,
            "width": 768,
            "height": 512,
            "model": "flux.safetensors",
            "sampler_name": "Euler a",
            "seed": 99,
        },
    )
    res = client.get(f"/api/illustrated-images/{name}/meta")
    assert res.status_code == 200
    body = res.json()
    assert body["filename"] == name
    assert body["scene_id"] == "s1"
    assert body["params"]["prompt"] == "storm lighthouse"
    assert body["params"]["width"] == 768
    assert body["params"]["model"] == "flux.safetensors"

    clear = client.post(
        f"/api/conversations/{conv.id}/messages/{msg.id}/illustrations/clear-photos"
    )
    assert clear.status_code == 200
    assert client.get(f"/api/illustrated-images/{name}/meta").status_code == 404
