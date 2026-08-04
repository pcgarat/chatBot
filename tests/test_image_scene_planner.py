"""Tests del ScenePlanner."""

import json

from app.services.image_illustration.scene_planner import (
    LlmScenePlanner,
    extract_json_object,
    plan_from_dict,
)


class FakeProvider:
    provider_name = "fake"

    def __init__(self, response: str):
        self.response = response
        self.calls = []

    def list_models(self):
        return []

    def chat(self, model, messages, extra_body=None):
        self.calls.append({"model": model, "messages": messages, "extra_body": extra_body})
        return self.response

    async def chat_stream(self, model, messages, extra_body=None):
        yield None


def test_extract_json_from_fence():
    raw = '```json\n{"illustrate": false, "reason": "x", "scenes": []}\n```'
    assert extract_json_object(raw)["illustrate"] is False


def test_plan_from_dict_respects_max_images():
    data = {
        "illustrate": True,
        "reason": "relato",
        "scenes": [
            {"id": "s1", "prompt": "a", "anchor_excerpt": "x"},
            {"id": "s2", "prompt": "b", "anchor_excerpt": "y"},
            {"id": "s3", "prompt": "c", "anchor_excerpt": "z"},
        ],
    }
    plan = plan_from_dict(data, max_images=2)
    assert plan.illustrate is True
    assert len(plan.scenes) == 2


def test_plan_illustrate_false():
    provider = FakeProvider(json.dumps({"illustrate": False, "reason": "código", "scenes": []}))
    planner = LlmScenePlanner(provider, model="m1")
    plan = planner.plan("def foo(): pass", max_images=3)
    assert plan.illustrate is False
    assert provider.calls


def test_plan_malformed_json_returns_no_illustrate():
    provider = FakeProvider("esto no es json")
    planner = LlmScenePlanner(provider, model="m1")
    plan = planner.plan("Érase una vez...", max_images=2)
    assert plan.illustrate is False
    assert "falló" in plan.reason or "planificador" in plan.reason


def test_compose_planner_system_prompt_empty_extra_keeps_base():
    from app.services.image_illustration.scene_planner import compose_planner_system_prompt

    base = "BASE RULES"
    assert compose_planner_system_prompt(base, "") == base
    assert compose_planner_system_prompt(base, "   ") == base


def test_compose_planner_system_prompt_appends_extra():
    from app.services.image_illustration.scene_planner import compose_planner_system_prompt

    out = compose_planner_system_prompt("BASE", "Prefiere tonos nocturnos")
    assert out.startswith("BASE")
    assert "Prefiere tonos nocturnos" in out
    assert "Instrucciones adicionales" in out


def test_planner_stores_last_debug_request_and_response():
    provider = FakeProvider(
        json.dumps(
            {
                "illustrate": True,
                "reason": "relato",
                "scenes": [{"id": "s1", "prompt": "a lighthouse", "anchor_excerpt": "faro"}],
            }
        )
    )
    planner = LlmScenePlanner(provider, model="m1", system_prompt="SYS")
    plan = planner.plan("Había un faro.", max_images=1)
    assert plan.illustrate is True
    assert planner.last_debug is not None
    req = json.loads(planner.last_debug["debug_request"])
    assert req["model"] == "m1"
    assert req["stream"] is False
    assert req["messages"][0]["role"] == "system"
    assert "faro" in planner.last_debug["debug_response"] or "lighthouse" in planner.last_debug[
        "debug_response"
    ]
