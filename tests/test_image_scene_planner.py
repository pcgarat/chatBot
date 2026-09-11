"""Tests del ScenePlanner."""

import json

from app.services.image_illustration.scene_planner import (
    LlmScenePlanner,
    extract_json_object,
    plan_from_dict,
)
from app.services.image_illustration.models import SceneSpec


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


def test_compose_planner_system_prompt_puts_selection_policy_after_extras():
    from app.services.image_illustration.scene_planner import compose_planner_system_prompt

    out = compose_planner_system_prompt(
        "BASE",
        "Estilo editorial suave",
        "Modo: picos pornográficos.\nPrioriza máxima carga explícita.",
    )
    assert out.index("Instrucciones adicionales") < out.index("Política de selección")
    assert out.index("Estilo editorial suave") < out.index("picos pornográficos")
    assert out.endswith("Prioriza máxima carga explícita.")


def test_planner_system_prompt_is_location_neutral_without_hardcoded_distribution():
    from app.services.image_illustration.scene_planner import load_planner_system_prompt

    text = load_planner_system_prompt()
    assert "Política de selección de escenas" in text
    assert "puntos medios entre imágenes" not in text
    assert "escenas repartidas a lo largo" not in text
    assert "No concentres varias escenas" not in text


def test_planner_injects_selection_policy_into_system_not_user():
    provider = FakeProvider(
        json.dumps(
            {
                "illustrate": True,
                "reason": "picos",
                "scenes": [
                    {"id": "s1", "prompt": "explicit act", "paragraph_index": 1},
                ],
            }
        )
    )
    planner = LlmScenePlanner(
        provider,
        model="m1",
        system_prompt="SYS BASE",
        system_instructions="Guía FLUX editorial",
    )
    plan = planner.plan(
        "Relato explícito.",
        max_images=1,
        selection_policy="Modo: picos pornográficos.\nANULA el reparto uniforme.",
    )
    assert plan.illustrate is True
    system = provider.calls[0]["messages"][0]["content"]
    user = provider.calls[0]["messages"][1]["content"]
    assert "Política de selección de escenas" in system
    assert "ANULA el reparto uniforme" in system
    assert "Guía FLUX editorial" in system
    assert system.index("Instrucciones adicionales") < system.index("Política de selección")
    assert "ANULA el reparto uniforme" not in user
    assert "picos pornográficos" not in user


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


def test_planner_logs_request_and_response_to_stderr_when_verbose(monkeypatch, capsys):
    monkeypatch.setattr(
        "app.services.image_illustration.scene_planner.settings.verbose",
        True,
    )
    raw = json.dumps(
        {
            "illustrate": True,
            "reason": "relato",
            "scenes": [{"id": "s1", "prompt": "a lighthouse", "anchor_excerpt": "faro"}],
        }
    )
    planner = LlmScenePlanner(FakeProvider(raw), model="m1", system_prompt="SYS")
    planner.plan("Había un faro.", max_images=1)
    err = capsys.readouterr().err
    assert "ScenePlanner request" in err
    assert '"model": "m1"' in err or '"model":"m1"' in err
    assert "Había un faro." in err
    assert "ScenePlanner response" in err
    assert "a lighthouse" in err
    assert "fin ScenePlanner" in err


def test_planner_skips_stderr_log_when_not_verbose(monkeypatch, capsys):
    monkeypatch.setattr(
        "app.services.image_illustration.scene_planner.settings.verbose",
        False,
    )
    raw = json.dumps({"illustrate": False, "reason": "código", "scenes": []})
    LlmScenePlanner(FakeProvider(raw), model="m1", system_prompt="SYS").plan(
        "def foo(): pass", max_images=1
    )
    err = capsys.readouterr().err
    assert "ScenePlanner" not in err


def test_planner_logs_stderr_on_error_when_verbose(monkeypatch, capsys):
    monkeypatch.setattr(
        "app.services.image_illustration.scene_planner.settings.verbose",
        True,
    )
    planner = LlmScenePlanner(FakeProvider("esto no es json"), model="m1", system_prompt="SYS")
    plan = planner.plan("Érase una vez...", max_images=1)
    assert plan.illustrate is False
    err = capsys.readouterr().err
    assert "ScenePlanner request" in err
    assert "ScenePlanner response" in err
    assert "esto no es json" in err or "error" in err.lower()


def test_planner_includes_already_planned_in_user_message():
    provider = FakeProvider(
        json.dumps({"illustrate": False, "reason": "nada más", "scenes": []})
    )
    planner = LlmScenePlanner(provider, model="m1", system_prompt="SYS")
    prior = [
        SceneSpec(id="s1", prompt="old", anchor_excerpt="Había un faro."),
    ]
    planner.plan("Había un faro. Luego el mar.", max_images=2, already_planned=prior)
    user = provider.calls[0]["messages"][1]["content"]
    assert "max_images=2" in user
    assert "Ya hay 1 ubicaciones" in user or "Ya hay 1" in user
    assert "Había un faro." in user


def test_filter_duplicate_planned_scenes():
    from app.services.image_illustration.scene_planner import filter_duplicate_planned_scenes

    prior = [SceneSpec(id="s1", prompt="a", anchor_excerpt="Faro")]
    new = [
        SceneSpec(id="s2", prompt="b", anchor_excerpt="Faro"),
        SceneSpec(id="s3", prompt="c", anchor_excerpt="Mar"),
    ]
    filtered = filter_duplicate_planned_scenes(new, prior)
    assert [s.id for s in filtered] == ["s3"]


def test_planner_writes_prompts_for_assigned_paragraphs():
    from app.services.image_illustration.coverage import ParagraphInfo

    provider = FakeProvider(
        json.dumps(
            {
                "illustrate": True,
                "reason": "relato",
                "scenes": [
                    {"id": "s1", "prompt": "calm sea at dusk", "paragraph_index": 1},
                    {"id": "s2", "prompt": "sunrise over beach", "paragraph_index": 2},
                ],
            }
        )
    )
    planner = LlmScenePlanner(provider, model="m1", system_prompt="SYS")
    assigned = [
        ParagraphInfo(index=1, text="El mar seguía en calma.", illustration_count=0),
        ParagraphInfo(index=2, text="Al final llegó el alba.", illustration_count=0),
    ]
    plan = planner.plan(
        "Había un faro.\n\nEl mar seguía en calma.\n\nAl final llegó el alba.",
        max_images=2,
        assigned_paragraphs=assigned,
    )
    assert plan.illustrate is True
    assert len(plan.scenes) == 2
    assert plan.scenes[0].prompt == "calm sea at dusk"
    assert plan.scenes[0].paragraph_index == 1
    assert "calma" in plan.scenes[0].anchor_excerpt
    assert plan.scenes[1].prompt == "sunrise over beach"
    assert plan.scenes[1].paragraph_index == 2
    user = provider.calls[0]["messages"][1]["content"]
    assert "Párrafos asignados" in user
    assert "paragraph_index=1" in user


def test_planner_pinned_forces_illustrate_and_continuity():
    from app.services.image_illustration.coverage import ParagraphInfo

    provider = FakeProvider(
        json.dumps(
            {
                "illustrate": False,
                "reason": "no es relato",
                "scenes": [
                    {"id": "s1", "prompt": "same coat, new pose at the door", "paragraph_index": 1}
                ],
            }
        )
    )
    planner = LlmScenePlanner(provider, model="m1", system_prompt="SYS")
    assigned = [
        ParagraphInfo(index=1, text="Abrió la puerta con el mismo abrigo.", illustration_count=1),
    ]
    plan = planner.plan(
        "Había un faro.\n\nAbrió la puerta con el mismo abrigo.",
        max_images=3,
        assigned_paragraphs=assigned,
        existing_prompts=["woman in red coat by the lighthouse"],
        pinned=True,
        focus_excerpt="el mismo abrigo",
    )
    assert plan.illustrate is True
    assert len(plan.scenes) == 1
    assert plan.scenes[0].paragraph_index == 1
    assert "door" in plan.scenes[0].prompt
    user = provider.calls[0]["messages"][1]["content"]
    assert "Ubicación fijada" in user
    assert "paragraph_index=1" in user
    assert "el mismo abrigo" in user
    assert "AL LADO" in user
    assert "canon de identidad" in user
    assert "NO reutilices las mismas anclas" not in user
    assert "max_images=1" in user


def test_planner_consistency_on_asks_for_identity_canon():
    from app.services.image_illustration.coverage import ParagraphInfo

    provider = FakeProvider(
        json.dumps(
            {
                "illustrate": True,
                "reason": "relato",
                "scenes": [
                    {"id": "s1", "prompt": "same woman at the table", "paragraph_index": 0},
                    {"id": "s2", "prompt": "same woman at the door", "paragraph_index": 1},
                ],
            }
        )
    )
    planner = LlmScenePlanner(provider, model="m1", system_prompt="SYS")
    assigned = [
        ParagraphInfo(index=0, text="Se sentó.", illustration_count=0),
        ParagraphInfo(index=1, text="Abrió la puerta.", illustration_count=0),
    ]
    planner.plan(
        "Se sentó.\n\nAbrió la puerta.",
        max_images=2,
        assigned_paragraphs=assigned,
        existing_prompts=["25 year old woman, auburn hair, cream dress"],
        visual_consistency=True,
    )
    user = provider.calls[0]["messages"][1]["content"]
    assert "Consistencia visual: ON" in user
    assert "ficha de identidad" in user
    assert "25 year old woman, auburn hair, cream dress" in user
    assert "canon de identidad" in user
    assert "NO generes imágenes similares" not in user


def test_planner_consistency_off_asks_for_diversity():
    provider = FakeProvider(
        json.dumps({"illustrate": False, "reason": "nada", "scenes": []})
    )
    planner = LlmScenePlanner(provider, model="m1", system_prompt="SYS")
    planner.plan(
        "Había un faro.",
        max_images=1,
        existing_prompts=["woman in red coat"],
        visual_consistency=False,
    )
    user = provider.calls[0]["messages"][1]["content"]
    assert "Consistencia visual: OFF" in user
    assert "woman in red coat" in user
    assert "similares" in user.lower() or "similar" in user.lower()


def test_planner_system_prompt_mentions_visual_consistency_policy():
    from app.services.image_illustration.scene_planner import load_planner_system_prompt

    text = load_planner_system_prompt()
    assert "consistencia visual: ON" in text
    assert "consistencia visual está OFF" in text


def test_planner_pinned_without_prompt_stays_false():
    from app.services.image_illustration.coverage import ParagraphInfo

    provider = FakeProvider(
        json.dumps({"illustrate": False, "reason": "nada visual", "scenes": []})
    )
    planner = LlmScenePlanner(provider, model="m1", system_prompt="SYS")
    assigned = [ParagraphInfo(index=0, text="Hola.", illustration_count=0)]
    plan = planner.plan("Hola.", max_images=1, assigned_paragraphs=assigned, pinned=True)
    assert plan.illustrate is False
    assert "ubicación fijada" in plan.reason or "nada visual" in plan.reason
