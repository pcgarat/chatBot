"""API turn del prompt generator."""

from unittest.mock import patch

from app.services.prompt_generator.system import INITIAL_ASSISTANT_TEMPLATE


def _create_pg(client):
    r = client.post("/api/conversations", json={"kind": "prompt_generator", "model_id": "m"})
    assert r.status_code == 200
    return r.json()


def _mock_provider(fake_chat):
    return type("P", (), {"chat": staticmethod(fake_chat)})()


def test_turn_on_chat_conversation_returns_400(client):
    create = client.post("/api/conversations", json={"title": "X", "model_id": "m"})
    cid = create.json()["id"]
    r = client.post(f"/api/conversations/{cid}/prompt-generator/turn", json={"message": "hola"})
    assert r.status_code == 400


def test_turn_updates_brief_and_saves_messages(client):
    data = _create_pg(client)
    cid = data["id"]

    def fake_chat(model, messages, extra_body=None):
        return (
            '{"assistant_text":"¿Qué sujeto?","brief_patch":{"prompt_language":"en"},'
            '"phase":"interview","prompt":null}'
        )

    with patch(
        "app.services.prompt_generator.turn.get_provider",
        return_value=_mock_provider(fake_chat),
    ):
        r = client.post(
            f"/api/conversations/{cid}/prompt-generator/turn",
            json={"message": "inglés"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["phase"] == "interview"
    assert body["assistant_text"] == "¿Qué sujeto?"
    assert body["brief"]["prompt_language"] == "en"
    assert body["prompt"] is None
    assert body["user_message"]["content"] == "inglés"
    assert body["assistant_message"]["content"] == "¿Qué sujeto?"

    got = client.get(f"/api/conversations/{cid}").json()
    assert got["prompt_brief"]["prompt_language"] == "en"
    assert len(got["messages"]) == 3
    assert got["messages"][0]["content"] == INITIAL_ASSISTANT_TEMPLATE


def test_turn_force_produces_prompt(client):
    data = _create_pg(client)
    cid = data["id"]

    def fake_chat(model, messages, extra_body=None):
        return (
            '{"assistant_text":"Aquí tienes el prompt.","brief_patch":{},'
            '"phase":"prompt","prompt":"A cinematic portrait of a cat."}'
        )

    with patch(
        "app.services.prompt_generator.turn.get_provider",
        return_value=_mock_provider(fake_chat),
    ):
        r = client.post(
            f"/api/conversations/{cid}/prompt-generator/turn",
            json={"force": True},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["phase"] == "prompt"
    assert "cat" in body["prompt"]
    assert body["brief"]["latest_prompt"] == body["prompt"]
    assert "txt2img-prompt" in body["assistant_message"]["content"]


def test_turn_detects_genera_ya_in_message(client):
    data = _create_pg(client)
    cid = data["id"]
    seen = {}

    def fake_chat(model, messages, extra_body=None):
        seen["user"] = messages[-1]["content"]
        return (
            '{"assistant_text":"Ok.","brief_patch":{},'
            '"phase":"prompt","prompt":"A red apple on a table."}'
        )

    with patch(
        "app.services.prompt_generator.turn.get_provider",
        return_value=_mock_provider(fake_chat),
    ):
        r = client.post(
            f"/api/conversations/{cid}/prompt-generator/turn",
            json={"message": "genera ya"},
        )
    assert r.status_code == 200
    assert r.json()["phase"] == "prompt"
    assert "FORZAR" in seen["user"] or "force" in seen["user"].lower()


def test_turn_does_not_include_user_chat_rules_in_system(client):
    data = _create_pg(client)
    cid = data["id"]
    client.put(
        f"/api/conversations/{cid}",
        json={"system_instruction_global": "SIEMPRE habla como pirata"},
    )
    captured = {}

    def fake_chat(model, messages, extra_body=None):
        captured["system"] = messages[0]["content"]
        return (
            '{"assistant_text":"ok","brief_patch":{},"phase":"interview","prompt":null}'
        )

    with patch(
        "app.services.prompt_generator.turn.get_provider",
        return_value=_mock_provider(fake_chat),
    ):
        client.post(
            f"/api/conversations/{cid}/prompt-generator/turn",
            json={"message": "hola"},
        )
    assert "pirata" not in captured["system"].lower()
    assert "brief" in captured["system"].lower() or "prompt_language" in captured["system"]
