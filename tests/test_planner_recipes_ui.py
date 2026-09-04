"""UI: recetas del planificador de prompts, igual que en Ajustes."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "app" / "static" / "index.html"
APP_JS = ROOT / "app" / "static" / "js" / "app.js"


def _images_html() -> str:
    html = INDEX.read_text(encoding="utf-8")
    return html.split('id="tab-imagenes"')[1].split('id="images-limits-heading"')[0]


def test_planner_panel_has_recipe_controls_tied_to_chat_config():
    images = _images_html()
    model_pos = images.find('id="images-prompt-model"')
    recipes_pos = images.find('id="planner-recipes"')
    rules_pos = images.find('id="planner-rules-list"')
    assert model_pos >= 0
    assert recipes_pos > model_pos
    assert rules_pos > recipes_pos
    presets = images[recipes_pos - 400 : rules_pos]
    assert 'id="planner-presets"' in images
    assert 'id="planner-think"' in images
    assert 'id="planner-recipe-params"' in images
    tag = images.split('id="planner-presets"')[0][-120:] + 'id="planner-presets"' + images.split('id="planner-presets"')[1][:80]
    assert "data-images-chat-config-control" in tag
    assert 'data-control-id="think"' not in images.split('id="planner-presets"')[1].split('id="planner-rules-list"')[0]


def test_js_loads_planner_contract_and_sends_prompt_model_params():
    js = APP_JS.read_text(encoding="utf-8")
    assert "function loadPlannerContract" in js
    assert "function applyPlannerRecipe" in js
    assert "function collectPlannerModelParams" in js
    collect = js.split("function collectImagesSnapshot")[1].split("function fillImagesPanelFromPrefs")[0]
    assert "prompt_model_params" in collect
    illustrate = js.split("async function maybeIllustrateAssistantMessage")[1].split(
        "async function generateRemainingImages"
    )[0]
    assert "prompt_model_params" in illustrate
    at = js.split("async function illustrateAtParagraph")[1].split(
        "async function runIllustrationStream"
    )[0]
    assert "prompt_model_params" in at
    chips = js.split("function fillRecipeChipHost")[1].split("function syncRecipeChipSelection")[0]
    assert "applyFn" in chips or "onApply" in chips
    assert "data-planner-param-id" in js
    assert "planner-presets-chat-hint" in js
