"""Seed de reglas builtin del planificador (guía FLUX)."""
from pathlib import Path

from app.crud import delete_rule, get_rule, update_rule
from app.services.rules.models import SCOPE_PLANNER
from app.services.rules.seed import (
    FLUX_PROMPT_GUIDE_PATH,
    FLUX_PROMPT_GUIDE_RULE_ID,
    FLUX_PROMPT_GUIDE_TITLE,
    ensure_rule_from_file,
    seed_builtin_rules,
)

_SEED = Path(__file__).resolve().parents[1] / "config" / "seed" / "planner_flux_prompts.md"


def test_seed_file_is_planner_contract_not_raw_download():
    text = _SEED.read_text(encoding="utf-8")
    assert "SOLO al string `prompt`" in text
    assert "JSON del planificador" in text
    assert "No preguntes al usuario" in text
    assert "negative prompt" in text.lower()
    assert "No uses formato markdown de respuesta" in text
    assert "preguntar antes de generar" not in text.lower()
    assert "¿Quieres un cartel" not in text
    assert "illustrate" in text
    assert len(text) < 12_000


def test_seed_creates_planner_rule_when_missing(db_session):
    assert get_rule(db_session, FLUX_PROMPT_GUIDE_RULE_ID) is None
    created = seed_builtin_rules(db_session)
    assert created == 1
    rule = get_rule(db_session, FLUX_PROMPT_GUIDE_RULE_ID)
    assert rule is not None
    assert rule.title == FLUX_PROMPT_GUIDE_TITLE
    assert rule.scope == SCOPE_PLANNER
    assert "prosa" in rule.content.lower() or "prompt" in rule.content.lower()
    assert rule.content == FLUX_PROMPT_GUIDE_PATH.read_text(encoding="utf-8").strip()


def test_seed_is_idempotent_and_does_not_overwrite(db_session):
    seed_builtin_rules(db_session)
    update_rule(db_session, FLUX_PROMPT_GUIDE_RULE_ID, content="editado por el usuario")
    created = seed_builtin_rules(db_session)
    assert created == 0
    rule = get_rule(db_session, FLUX_PROMPT_GUIDE_RULE_ID)
    assert rule.content == "editado por el usuario"
    assert rule.title == FLUX_PROMPT_GUIDE_TITLE


def test_seed_recreates_after_delete(db_session):
    seed_builtin_rules(db_session)
    assert delete_rule(db_session, FLUX_PROMPT_GUIDE_RULE_ID) is True
    assert seed_builtin_rules(db_session) == 1
    assert get_rule(db_session, FLUX_PROMPT_GUIDE_RULE_ID) is not None


def test_seed_skips_missing_file(db_session, tmp_path):
    missing = tmp_path / "no-existe.md"
    n = ensure_rule_from_file(
        db_session,
        rule_id="11111111-1111-4111-8111-111111111111",
        title="X",
        path=missing,
        scope=SCOPE_PLANNER,
    )
    assert n == 0
    assert get_rule(db_session, "11111111-1111-4111-8111-111111111111") is None


def test_startup_function_seeds_builtin_rules():
    import inspect

    from app.main import startup

    assert "seed_builtin_rules" in inspect.getsource(startup)


def test_startup_seeds_planner_rule_not_chat(client):
    chat = client.get("/api/rules").json()
    assert all(item["id"] != FLUX_PROMPT_GUIDE_RULE_ID for item in chat)
    planner = client.get("/api/rules", params={"scope": "planner"}).json()
    match = [item for item in planner if item["id"] == FLUX_PROMPT_GUIDE_RULE_ID]
    assert len(match) == 1
    assert match[0]["title"] == FLUX_PROMPT_GUIDE_TITLE
    assert match[0]["scope"] == SCOPE_PLANNER
