"""Tests del orquestador de ilustración."""

from app.services.image_illustration.models import (
    ForgeMode,
    LastGenerationPayload,
    ScenePlan,
    SceneSpec,
)
from app.services.image_illustration.orchestrator import (
    ImageIllustrationOrchestrator,
    compose_forge_prompt,
)


class FakePlanner:
    def __init__(self, scene_plan: ScenePlan):
        self._scene_plan = scene_plan
        self.last_text = None
        self.last_already_planned = None
        self.last_coverage_block = None
        self.last_assigned_paragraphs = None

    def plan(
        self,
        text,
        max_images,
        already_planned=None,
        coverage_block=None,
        assigned_paragraphs=None,
    ):
        self.last_text = text
        self.last_already_planned = already_planned
        self.last_coverage_block = coverage_block
        self.last_assigned_paragraphs = assigned_paragraphs
        return self._scene_plan


class SequencingPlanner:
    """Devuelve un plan distinto por llamada (para lotes)."""

    def __init__(self, plans: list[ScenePlan]):
        self._plans = list(plans)
        self.calls: list[dict] = []

    def plan(
        self,
        text,
        max_images,
        already_planned=None,
        coverage_block=None,
        assigned_paragraphs=None,
    ):
        self.calls.append(
            {
                "max_images": max_images,
                "already": list(already_planned or []),
                "text": text,
                "coverage_block": coverage_block,
                "assigned": list(assigned_paragraphs or []),
            }
        )
        if not self._plans:
            return ScenePlan(illustrate=False, reason="sin más planes", scenes=[])
        return self._plans.pop(0)


class FakePayloadSource:
    def __init__(self, payload: LastGenerationPayload):
        self._payload = payload

    def load(self):
        return self._payload


class FakeForge:
    def __init__(self, results: dict[str, bytes | Exception]):
        self.results = results
        self.calls = []

    def generate(self, mode, body):
        self.calls.append({"mode": mode, "prompt": body.get("prompt")})
        prompt = body.get("prompt")
        val = self.results.get(prompt)
        if isinstance(val, Exception):
            raise val
        if val is None:
            raise RuntimeError("unexpected")
        return val


def _payload():
    return LastGenerationPayload(
        mode=ForgeMode.TXT2IMG,
        body={"steps": 8, "prompt": "old"},
        recovered_fields=["steps"],
    )


def test_compose_forge_prompt_empty_extra_returns_scene_only():
    assert compose_forge_prompt("a lighthouse in storm") == "a lighthouse in storm"
    assert compose_forge_prompt("a lighthouse", "") == "a lighthouse"
    assert compose_forge_prompt("a lighthouse", "   ") == "a lighthouse"


def test_compose_forge_prompt_concatenates_with_period():
    assert (
        compose_forge_prompt("a lighthouse in storm", "oil painting, detailed")
        == "a lighthouse in storm. oil painting, detailed"
    )


def test_compose_forge_prompt_avoids_double_period():
    assert (
        compose_forge_prompt("a lighthouse in storm.", "cinematic lighting")
        == "a lighthouse in storm. cinematic lighting"
    )


def test_compose_forge_prompt_extra_only_when_scene_empty():
    assert compose_forge_prompt("", "masterpiece") == "masterpiece"
    assert compose_forge_prompt("  ", "masterpiece") == "masterpiece"


def test_orchestrator_emits_llm_debug_per_scene_when_requested():
    scenes = [
        SceneSpec(id="s1", prompt="p1", anchor_excerpt="A."),
        SceneSpec(id="s2", prompt="p2", anchor_excerpt="B."),
    ]
    planner = FakePlanner(ScenePlan(illustrate=True, reason="r", scenes=scenes))
    planner.last_debug = {
        "debug_request": '{"model": "m", "messages": []}',
        "debug_response": '{"illustrate": true, "scenes": [...]}',
    }
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"p1": b"1", "p2": b"2"}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run("A.\n\nB.", max_images=2, retries=0, include_prompt_debug=True))
    debugs = [e for e in events if e.type == "llm_debug"]
    assert len(debugs) == 2
    assert debugs[0].scene_id == "s1"
    assert debugs[0].data["debug_request"].startswith("{")
    assert "p1" in (debugs[0].message or "")
    assert debugs[1].scene_id == "s2"


def test_orchestrator_skips_llm_debug_by_default():
    scenes = [SceneSpec(id="s1", prompt="p1", anchor_excerpt="A.")]
    planner = FakePlanner(ScenePlan(illustrate=True, reason="r", scenes=scenes))
    planner.last_debug = {
        "debug_request": "{}",
        "debug_response": "{}",
    }
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"p1": b"1"}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run("A.", max_images=1, retries=0))
    assert not any(e.type == "llm_debug" for e in events)


def test_orchestrator_placeholder_shows_composed_prompt_until_image():
    """Mientras genera, el content lleva un recuadro con el prompt enviado a Forge."""
    scenes = [SceneSpec(id="s1", prompt="lighthouse in storm", anchor_excerpt="A.")]
    orch = ImageIllustrationOrchestrator(
        planner=FakePlanner(ScenePlan(illustrate=True, reason="r", scenes=scenes)),
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"lighthouse in storm. oil painting": b"img"}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run("A.", max_images=1, retries=0, prompt="oil painting"))
    ph = next(e for e in events if e.type == "placeholder")
    assert ph.content is not None
    assert 'class="chat-illustration-placeholder"' in ph.content
    assert 'data-scene="s1"' in ph.content
    assert "lighthouse in storm. oil painting" in ph.content
    assert "⟦img:s1⟧" not in ph.content
    done = events[-1]
    assert done.type == "done"
    assert "chat-illustration-placeholder" not in (done.content or "")
    assert 'class="chat-illustration"' in (done.content or "")


def test_orchestrator_skips_when_not_illustrate():
    orch = ImageIllustrationOrchestrator(
        planner=FakePlanner(ScenePlan(illustrate=False, reason="no")),
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run("hola", max_images=2, retries=1))
    assert events[-1].type == "done"
    assert events[-1].content == "hola"
    assert not any(e.type == "image" for e in events)
    statuses = [e for e in events if e.type == "status"]
    codes = [e.data.get("code") for e in statuses]
    assert "images.starting" in codes
    assert "images.planning" in codes
    assert "images.skipped" in codes


def test_orchestrator_emits_status_pipeline_for_generation():
    scenes = [
        SceneSpec(id="s1", prompt="p1", anchor_excerpt="A."),
        SceneSpec(id="s2", prompt="p2", anchor_excerpt="B."),
    ]
    orch = ImageIllustrationOrchestrator(
        planner=FakePlanner(ScenePlan(illustrate=True, reason="r", scenes=scenes)),
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"p1": b"1", "p2": b"2"}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run("A.\n\nB.", max_images=2, retries=0))
    codes = [e.data.get("code") for e in events if e.type == "status"]
    assert codes[0] == "images.starting"
    assert "images.planning" in codes
    assert "images.inserting_anchors" in codes
    assert "images.loading_forge_payload" in codes
    assert codes.count("images.submitting_prompt") == 2
    assert codes.count("images.awaiting_generation") == 2
    assert codes.count("images.image_ready") == 2
    assert codes[-1] == "images.done"
    images = [e for e in events if e.type == "image"]
    assert len(images) == 2
    assert images[0].data.get("filename") == "s1.png"
    assert images[0].data.get("params", {}).get("prompt") == "p1"
    assert "generation_time_ms" in (images[0].data.get("params") or {})
    assert (images[0].data.get("params") or {})["generation_time_ms"] >= 0
    assert 'data-filename="s1.png"' in (images[0].content or "")


def test_orchestrator_retries_only_after_full_first_pass():
    scenes = [
        SceneSpec(id="s1", prompt="p1", anchor_excerpt="A."),
        SceneSpec(id="s2", prompt="p2", anchor_excerpt="B."),
    ]
    text = "A.\n\nB."
    prompts_seen: list[str] = []

    class OrderedForge:
        def generate(self, mode, body):
            prompt = body.get("prompt")
            prompts_seen.append(prompt)
            if prompt == "p2":
                return b"img2"
            # p1 fails on first attempt only
            if prompts_seen.count("p1") == 1:
                raise RuntimeError("fail1")
            return b"img1"

    orch = ImageIllustrationOrchestrator(
        planner=FakePlanner(ScenePlan(illustrate=True, reason="r", scenes=scenes)),
        payload_source=FakePayloadSource(_payload()),
        forge=OrderedForge(),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run(text, max_images=2, retries=2))
    first_retry = next(
        i for i, e in enumerate(events) if e.type == "log" and "Reintento" in e.message
    )
    prompts_before = [
        e.data["prompt"]
        for e in events[:first_retry]
        if e.type == "log" and e.data.get("prompt")
    ]
    assert "p1" in prompts_before and "p2" in prompts_before
    assert events[-1].type == "done"
    assert "chat-illustration" in (events[-1].content or "")


def test_orchestrator_partial_failure_keeps_success():
    scenes = [
        SceneSpec(id="s1", prompt="ok", anchor_excerpt="Uno."),
        SceneSpec(id="s2", prompt="bad", anchor_excerpt="Dos."),
    ]
    text = "Uno.\n\nDos."
    orch = ImageIllustrationOrchestrator(
        planner=FakePlanner(ScenePlan(illustrate=True, reason="r", scenes=scenes)),
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"ok": b"yes", "bad": RuntimeError("nope")}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run(text, max_images=2, retries=0))
    done = events[-1]
    assert done.type == "done"
    assert "chat-illustration" in (done.content or "")
    assert "Imagen fallida" in (done.content or "")


def test_orchestrator_keeps_previous_images_when_reillustrate():
    """Re-ilustrar añade imágenes nuevas sin borrar las ya insertadas."""
    planner = FakePlanner(
        ScenePlan(
            illustrate=True,
            reason="r",
            scenes=[SceneSpec(id="s1", prompt="new", anchor_excerpt="Había un faro.")],
        )
    )
    text = (
        "Había un faro.\n"
        '<img src="/api/illustrated-images/old.png" alt="escena s1" class="chat-illustration" />\n'
        "Fin."
    )
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"new": b"img"}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run(text, max_images=1, retries=0))
    assert planner.last_text is not None
    assert "chat-illustration" not in planner.last_text
    assert "Había un faro." in planner.last_text
    done = events[-1]
    assert done.type == "done"
    assert (done.content or "").count("chat-illustration") == 2
    assert "old.png" in (done.content or "")
    assert 'alt="escena s2"' in (done.content or "")


def test_orchestrator_strips_previous_illustrations_before_plan():
    planner = FakePlanner(
        ScenePlan(
            illustrate=True,
            reason="r",
            scenes=[SceneSpec(id="s1", prompt="new", anchor_excerpt="Había un faro.")],
        )
    )
    text = (
        "Había un faro.\n"
        '<img src="/api/illustrated-images/old.png" class="chat-illustration" />\n'
        "Fin."
    )
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"new": b"img"}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run(text, max_images=1, retries=0))
    assert planner.last_text is not None
    assert "chat-illustration" not in planner.last_text
    done = events[-1]
    assert done.type == "done"
    assert "old.png" in (done.content or "")
    assert (done.content or "").count("chat-illustration") >= 2


def test_orchestrator_assigns_gaps_then_binds_prompts():
    """Huecos primero; el prompt del LLM se ancla al párrafo asignado, no al favorito del modelo."""
    planner = FakePlanner(
        ScenePlan(
            illustrate=True,
            reason="r",
            scenes=[
                SceneSpec(id="s1", prompt="sea prompt", anchor_excerpt="Había un faro."),
            ],
        )
    )
    text = (
        "Había un faro.\n"
        '<img src="/api/illustrated-images/old.png" alt="escena s1" class="chat-illustration" />\n\n'
        "El mar seguía en calma.\n\n"
        "Al final llegó el alba."
    )
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"sea prompt": b"img"}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run(text, max_images=1, retries=0))
    assert planner.last_assigned_paragraphs is not None
    assert all(p.index != 0 for p in planner.last_assigned_paragraphs)
    done = events[-1]
    content = done.content or ""
    assert "old.png" in content
    assert 'alt="escena s2"' in content
    # Ancla en hueco (mar o alba), no otra vez tras el faro ocupado.
    new_pos = content.index('alt="escena s2"')
    assert new_pos > content.index("old.png")


def test_run_remaining_regenerates_placeholder_and_error_keeps_existing_image():
    text = (
        "Había un faro.\n"
        '<img src="/api/illustrated-images/old.png" alt="escena s0" class="chat-illustration" />\n'
        '<span class="chat-illustration-placeholder" data-scene="s1" data-prompt="storm">'
        "Generando imagen…\n\nstorm</span>\n"
        '<span class="chat-illustration-error" data-scene="s2" data-prompt="ship">'
        "[Imagen fallida: nope]</span>\n"
        "⟦img:s3⟧\n"
        "Fin."
    )
    forge = FakeForge({"storm": b"1", "ship": b"2"})
    orch = ImageIllustrationOrchestrator(
        planner=FakePlanner(ScenePlan(illustrate=False, reason="unused")),
        payload_source=FakePayloadSource(_payload()),
        forge=forge,
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run_remaining(text, retries=0))
    done = events[-1]
    assert done.type == "done"
    assert done.message == "restantes completadas"
    content = done.content or ""
    assert "old.png" in content
    assert 'alt="escena s1"' in content
    assert 'alt="escena s2"' in content
    assert "⟦img:s3⟧" in content  # sin prompt: se omite
    assert [c["prompt"] for c in forge.calls] == ["storm", "ship"]


def test_run_remaining_skips_when_no_regenerable_prompts():
    text = "Solo texto\n⟦img:s1⟧\n"
    orch = ImageIllustrationOrchestrator(
        planner=FakePlanner(ScenePlan(illustrate=False, reason="unused")),
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run_remaining(text, retries=0))
    done = events[-1]
    assert done.type == "done"
    assert done.message == "sin pendientes regenerables"
    assert "⟦img:s1⟧" in (done.content or "")


def test_run_remaining_preserves_prompt_on_new_error():
    text = (
        '<span class="chat-illustration-error" data-scene="s1" data-prompt="lighthouse">'
        "[Imagen fallida: old]</span>"
    )
    orch = ImageIllustrationOrchestrator(
        planner=FakePlanner(ScenePlan(illustrate=False, reason="unused")),
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"lighthouse": RuntimeError("boom")}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run_remaining(text, retries=0))
    done = events[-1]
    assert done.type == "done"
    assert 'data-prompt="lighthouse"' in (done.content or "")
    assert "boom" in (done.content or "")


def test_orchestrator_plans_and_generates_in_batches():
    """max_images > batch_size → varios planes LLM y generaciones por lote."""
    planner = SequencingPlanner(
        [
            ScenePlan(
                illustrate=True,
                reason="r1",
                scenes=[
                    SceneSpec(id="s1", prompt="a", anchor_excerpt="Uno."),
                    SceneSpec(id="s2", prompt="b", anchor_excerpt="Dos."),
                ],
            ),
            ScenePlan(
                illustrate=True,
                reason="r2",
                scenes=[SceneSpec(id="s1", prompt="c", anchor_excerpt="Tres.")],
            ),
        ]
    )
    forge = FakeForge({"a": b"1", "b": b"2", "c": b"3"})
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(_payload()),
        forge=forge,
        save_image=lambda sid, b: f"{sid}.png",
    )
    text = "Uno.\n\nDos.\n\nTres."
    events = list(orch.run(text, max_images=5, retries=0, batch_size=2))
    assert len(planner.calls) == 2
    assert planner.calls[0]["max_images"] == 2
    assert planner.calls[1]["max_images"] == 1  # solo queda un hueco
    assert len(planner.calls[0]["already"]) == 0
    assert len(planner.calls[1]["already"]) == 2
    assert [c["prompt"] for c in forge.calls] == ["a", "b", "c"]
    done = events[-1]
    assert done.type == "done"
    assert (done.content or "").count("chat-illustration") == 3
    assert any("Lote 1:" in (e.message or "") for e in events if e.type == "log")
    assert any("Lote 2:" in (e.message or "") for e in events if e.type == "log")


def test_orchestrator_stops_when_batch_not_full():
    """Si no quedan huecos (o el LLM no cubre los asignados), no pide otro lote."""
    planner = SequencingPlanner(
        [
            ScenePlan(
                illustrate=True,
                reason="r",
                scenes=[SceneSpec(id="s1", prompt="only", anchor_excerpt="Solo.")],
            ),
            ScenePlan(
                illustrate=True,
                reason="should-not-run",
                scenes=[SceneSpec(id="s2", prompt="extra", anchor_excerpt="Extra.")],
            ),
        ]
    )
    orch = ImageIllustrationOrchestrator(
        planner=planner,
        payload_source=FakePayloadSource(_payload()),
        forge=FakeForge({"only": b"1"}),
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run("Solo.", max_images=10, retries=0, batch_size=3))
    assert len(planner.calls) == 1
    done = events[-1]
    assert (done.content or "").count("chat-illustration") == 1


def test_run_remaining_generates_in_batches():
    text = (
        '<span class="chat-illustration-placeholder" data-scene="s1" data-prompt="a">'
        "Generando imagen…\n\na</span>\n"
        '<span class="chat-illustration-placeholder" data-scene="s2" data-prompt="b">'
        "Generando imagen…\n\nb</span>\n"
        '<span class="chat-illustration-placeholder" data-scene="s3" data-prompt="c">'
        "Generando imagen…\n\nc</span>"
    )
    forge = FakeForge({"a": b"1", "b": b"2", "c": b"3"})
    orch = ImageIllustrationOrchestrator(
        planner=FakePlanner(ScenePlan(illustrate=False, reason="unused")),
        payload_source=FakePayloadSource(_payload()),
        forge=forge,
        save_image=lambda sid, b: f"{sid}.png",
    )
    events = list(orch.run_remaining(text, retries=0, batch_size=2))
    batch_logs = [e.message for e in events if e.type == "log" and "restantes lote" in (e.message or "")]
    assert len(batch_logs) == 2
    assert [c["prompt"] for c in forge.calls] == ["a", "b", "c"]
    done = events[-1]
    assert (done.content or "").count("chat-illustration") == 3
