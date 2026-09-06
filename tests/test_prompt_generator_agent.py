"""Tests de system prompt y parse del agente prompt generator."""

import pytest

from app.services.prompt_generator.parse import AgentTurnParsed, parse_agent_response
from app.services.prompt_generator.system import INITIAL_ASSISTANT_TEMPLATE, build_system_prompt


def test_initial_template_asks_language():
    text = INITIAL_ASSISTANT_TEMPLATE
    assert "idioma" in text.lower()
    assert len(text.strip()) > 20


def test_system_prompt_includes_flux_sections_and_json_contract():
    system = build_system_prompt()
    assert "image_type_subject" in system
    assert "assistant_text" in system
    assert "brief_patch" in system
    assert "phase" in system
    assert "prompt" in system
    assert "pregunta" in system.lower() or "pregunt" in system.lower()
    assert "no preguntes" not in system.lower()


def test_parse_agent_response_plain_json():
    raw = """{
      "assistant_text": "¿Qué sujeto quieres?",
      "brief_patch": {"prompt_language": "en"},
      "phase": "interview",
      "prompt": null
    }"""
    parsed = parse_agent_response(raw)
    assert parsed.assistant_text == "¿Qué sujeto quieres?"
    assert parsed.brief_patch == {"prompt_language": "en"}
    assert parsed.phase == "interview"
    assert parsed.prompt is None


def test_parse_agent_response_fenced_json():
    raw = """Aquí va:
```json
{"assistant_text": "Listo", "brief_patch": {}, "phase": "prompt", "prompt": "A cat on a roof."}
```
"""
    parsed = parse_agent_response(raw)
    assert parsed.phase == "prompt"
    assert parsed.prompt == "A cat on a roof."


def test_parse_phase_prompt_requires_non_empty_prompt():
    raw = '{"assistant_text": "x", "brief_patch": {}, "phase": "prompt", "prompt": "  "}'
    with pytest.raises(ValueError, match="prompt"):
        parse_agent_response(raw)


def test_parse_invalid_phase_rejected():
    raw = '{"assistant_text": "x", "brief_patch": {}, "phase": "done", "prompt": null}'
    with pytest.raises(ValueError, match="phase"):
        parse_agent_response(raw)


def test_parse_missing_assistant_text_rejected():
    raw = '{"brief_patch": {}, "phase": "interview", "prompt": null}'
    with pytest.raises(ValueError, match="assistant_text"):
        parse_agent_response(raw)


def test_parse_brief_patch_must_be_object():
    raw = '{"assistant_text": "x", "brief_patch": [], "phase": "interview", "prompt": null}'
    with pytest.raises(ValueError, match="brief_patch"):
        parse_agent_response(raw)


def test_agent_turn_parsed_dataclass_fields():
    parsed = AgentTurnParsed(
        assistant_text="hola",
        brief_patch={"lighting": "soft"},
        phase="interview",
        prompt=None,
    )
    assert parsed.phase == "interview"
