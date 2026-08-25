"""UI: reglas del planificador en el panel Imágenes (mismo patrón que el chat)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "app" / "static" / "index.html"
APP_JS = ROOT / "app" / "static" / "js" / "app.js"


def test_images_panel_has_planner_rule_set_not_textarea():
    html = INDEX.read_text(encoding="utf-8")
    images = html.split('id="tab-imagenes"')[1].split('id="images-limits-heading"')[0]
    assert 'id="images-prompt-system"' not in images
    assert 'id="planner-rules-list"' in images
    assert 'id="planner-rule-library-select"' in images
    assert 'id="btn-add-planner-library-rule"' in images
    assert 'id="btn-add-planner-rule"' in images


def test_planner_rules_stay_enabled_with_chat_config():
    html = INDEX.read_text(encoding="utf-8")
    after_list = html.split('id="planner-rules-list"')[1]
    planner_ui = after_list.split('id="images-limits-heading"')[0]
    assert "data-images-chat-config-control" not in planner_ui


def test_js_loads_planner_rules_with_isolated_scope():
    js = APP_JS.read_text(encoding="utf-8")
    assert "/rules?scope=planner" in js
    assert "/rules?scope=chat" in js
    assert 'scope: "planner"' in js or '"scope": "planner"' in js or "scope: 'planner'" in js


def test_js_concatenates_planner_rules_on_illustrate():
    js = APP_JS.read_text(encoding="utf-8")
    illustrate = js.split("async function maybeIllustrateAssistantMessage")[1].split("async function generateRemainingImages")[0]
    assert "getPlannerRulesTextForSystem" in illustrate or "plannerRules" in illustrate
    assert "images-prompt-system" not in illustrate
