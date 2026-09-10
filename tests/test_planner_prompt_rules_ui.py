"""UI: reglas del planificador en el panel Imágenes (mismo patrón que el chat)."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _imagenes_html() -> str:
    html = frontend_markup()
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
    js = frontend_source()
    assert "/rules?scope=planner" in js
    assert "/rules?scope=chat" in js
    assert 'scope: "planner"' in js or '"scope": "planner"' in js or "scope: 'planner'" in js


def test_js_hydrates_planner_chips_from_library():
    js = frontend_source()
    assert "hydratePlannerRulesFromLibrary" in js
    init = js.split("function initImagesPanel")[1].split("initImageGallery")[0]
    assert "loadPlannerLibraryRules" in init


def test_js_conversation_switch_does_not_apply_planner_rules():
    js = frontend_source()
    setter = js.split("async function setCurrentConversation")[1].split(
        "let saveRulesDebounceTimer"
    )[0]
    assert "applyImagesSnapshot(conv.images)" in setter
    conv_apply = setter.split("applyImagesSnapshot(conv.images)")[0][-80:]
    assert "includePlannerRules: true" not in conv_apply + "applyImagesSnapshot(conv.images)"

    apply_fn = js.split("async function applyImagesSnapshot")[1].split(
        "const GALLERY_PAGE_SIZE"
    )[0]
    assert "includePlannerRules" in apply_fn
    assert "prompt_system_instructions" in apply_fn

    workspace = js.split("async function applyWorkspaceSnapshot")[1].split(
        "function getSelectedWorkspaceProfileId"
    )[0]
    assert "includePlannerRules: true" in workspace


def test_js_does_not_persist_planner_rules_on_conversation():
    js = frontend_source()
    persist = js.split("function persistImagesToConversation")[1].split(
        "let saveImagesToConvTimer"
    )[0]
    assert "imagesSnapshotForConversation()" in persist
    helper = js.split("function imagesSnapshotForConversation")[1].split(
        "function fillImagesPanelFromPrefs"
    )[0]
    assert "delete snap.prompt_system_instructions" in helper


def test_js_concatenates_planner_rules_on_illustrate():
    js = frontend_source()
    illustrate = js.split("async function maybeIllustrateAssistantMessage")[1].split("async function generateRemainingImages")[0]
    assert "getPlannerRulesTextForSystem" in illustrate or "plannerRules" in illustrate
    assert "images-prompt-system" not in illustrate


def test_planner_rules_panel_has_preset_bar():
    images = _imagenes_html()
    rules = images.split('data-accordion-section="images-planner-rules"')[1].split(
        'data-accordion-section="images-limits"'
    )[0]
    assert 'id="planner-rule-preset-select"' in rules
    assert 'id="btn-planner-rule-preset-apply"' in rules
    assert 'id="btn-planner-rule-preset-save"' in rules
    assert 'id="btn-planner-rule-preset-save-as"' in rules
    assert 'id="btn-planner-rule-preset-delete"' in rules
    select_idx = rules.find('id="planner-rule-preset-select"')
    list_idx = rules.find('id="planner-rules-list"')
    assert select_idx >= 0
    assert list_idx > select_idx


def test_js_planner_rule_presets_crud_and_apply():
    js = frontend_source()
    assert "function collectPlannerRulePresetSnapshot" in js
    assert "function applyPlannerRulePresetSnapshot" in js
    assert "/planner-rule-presets" in js
    collect = js.split("function collectPlannerRulePresetSnapshot")[1].split(
        "function applyPlannerRulePresetSnapshot"
    )[0]
    assert "serializeRuleItems(plannerRules)" in collect
    apply_fn = js.split("function applyPlannerRulePresetSnapshot")[1].split(
        "function getSelectedPlannerRulePresetId"
    )[0]
    assert "normalizePlannerRulesFromPrefs" in apply_fn
    assert "persistImagesPanel()" in apply_fn
    refresh = js.split("async function refreshPlannerRulePresets")[1].split(
        "async function savePlannerRulePreset"
    )[0]
    assert "No se pudieron cargar los presets de reglas" in refresh

