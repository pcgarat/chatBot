"""UI: reglas del planificador en el panel Imágenes (mismo patrón que el chat)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "app" / "static" / "index.html"
APP_JS = ROOT / "app" / "static" / "js" / "app.js"


def _imagenes_html() -> str:
    html = INDEX.read_text(encoding="utf-8")
    return html.split('id="tab-imagenes"')[1].split('id="tab-preferencias"')[0]


def test_images_panel_has_planner_rule_set_not_textarea():
    images = _imagenes_html()
    assert 'id="images-prompt-system"' not in images
    assert 'id="planner-rules-list"' in images
    assert 'id="planner-rule-library-select"' in images
    assert 'id="btn-add-planner-library-rule"' in images
    assert 'id="btn-add-planner-rule"' in images


def test_planner_rules_are_sibling_accordion_not_nested_in_planner():
    images = _imagenes_html()
    assert 'data-accordion-section="images-planner-rules"' in images
    planner = images.split('data-accordion-section="images-planner"')[1].split(
        'data-accordion-section="images-planner-rules"'
    )[0]
    rules = images.split('data-accordion-section="images-planner-rules"')[1].split(
        'data-accordion-section="images-limits"'
    )[0]
    assert 'id="planner-rules-list"' not in planner
    assert 'id="planner-rules-list"' in rules
    assert 'id="images-planner-rules-heading"' in rules
    assert "accordion-title" in rules
    assert "accordion-caption" in rules
    assert "panel-section-title" not in rules
    assert "panel-hint" not in rules


def test_planner_rules_stay_enabled_with_chat_config():
    images = _imagenes_html()
    planner_ui = images.split('data-accordion-section="images-planner-rules"')[1].split(
        'data-accordion-section="images-limits"'
    )[0]
    assert "data-images-chat-config-control" not in planner_ui


def test_js_loads_planner_rules_with_isolated_scope():
    js = APP_JS.read_text(encoding="utf-8")
    assert "/rules?scope=planner" in js
    assert "/rules?scope=chat" in js
    assert 'scope: "planner"' in js or '"scope": "planner"' in js or "scope: 'planner'" in js


def test_js_hydrates_planner_chips_from_library():
    js = APP_JS.read_text(encoding="utf-8")
    assert "hydratePlannerRulesFromLibrary" in js
    init = js.split("function initImagesPanel")[1].split("initImageGallery")[0]
    assert "loadPlannerLibraryRules" in init


def test_js_concatenates_planner_rules_on_illustrate():
    js = APP_JS.read_text(encoding="utf-8")
    illustrate = js.split("async function maybeIllustrateAssistantMessage")[1].split("async function generateRemainingImages")[0]
    assert "getPlannerRulesTextForSystem" in illustrate or "plannerRules" in illustrate
    assert "images-prompt-system" not in illustrate
