"""UI: recetas del planificador de prompts, igual que en Ajustes."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _planner_html() -> str:
    html = frontend_markup()
    images = html.split('id="tab-imagenes"')[1].split('id="tab-preferencias"')[0]
    return images.split('data-accordion-section="images-planner"')[1].split(
        'data-accordion-section="images-planner-rules"'
    )[0]


def test_planner_panel_has_recipe_controls_tied_to_chat_config():
    planner = _planner_html()
    model_pos = planner.find('id="images-prompt-model"')
    recipes_pos = planner.find('id="planner-recipes"')
    assert model_pos >= 0
    assert recipes_pos > model_pos
    assert 'id="planner-rules-list"' not in planner
    assert 'id="planner-presets"' in planner
    assert 'id="planner-think"' in planner
    assert 'id="planner-recipe-params"' in planner
    tag = (
        planner.split('id="planner-presets"')[0][-120:]
        + 'id="planner-presets"'
        + planner.split('id="planner-presets"')[1][:80]
    )
    assert "data-images-chat-config-control" in tag
    assert 'data-control-id="think"' not in planner.split('id="planner-presets"')[1]


def test_js_loads_planner_contract_and_sends_prompt_model_params():
    js = frontend_source()
    assert "function loadPlannerContract" in js
    assert "function applyPlannerRecipe" in js
    assert "function collectPlannerModelParams" in js
    collect = js.split("function collectImagesSnapshot")[1].split("function fillImagesPanelFromPrefs")[0]
    assert "prompt_model_params" in collect
    assert "plannerOverlayParamDefaults" in js.split("function collectPlannerModelParams")[1].split(
        "function collectImagesSnapshot"
    )[0]
    snapshot = js.split("function snapshotBody")[1].split("export async function runIllustrationStream")[0]
    assert "prompt_model_params" in snapshot
    assert "use_chat_config" in snapshot
    chips = js.split("function fillRecipeChipHost")[1].split("function syncRecipeChipSelection")[0]
    assert "applyFn" in chips or "onApply" in chips
    assert "data-planner-param-id" in js
    assert "planner-presets-chat-hint" in js
