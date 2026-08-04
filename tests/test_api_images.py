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
        def run(self, text, *, max_images, retries, prompt="", include_prompt_debug=False):
            captured["prompt"] = prompt
            captured["max_images"] = max_images
            yield IllustrationEvent(type="done", message="ok", content=text)

    with patch("app.routers.api_images._build_orchestrator", return_value=FakeOrch()):
        res = client.post(
            f"/api/conversations/{conv.id}/messages/{msg.id}/illustrate",
            json={
                "prompt_model": "llama3.2",
                "prompt_provider": "ollama",
                "images_per_response": 1,
                "retries": 0,
                "prompt": "oil painting, detailed",
            },
        )
    assert res.status_code == 200
    assert captured["prompt"] == "oil painting, detailed"
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
