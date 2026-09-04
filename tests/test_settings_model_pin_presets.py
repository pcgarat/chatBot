"""Ajustes: modelo fijo; Presets y Contexto en acordeón."""
from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "app.js"
STYLE_CSS = Path(__file__).resolve().parents[1] / "app" / "static" / "css" / "style.css"


def _ajustes_html() -> str:
    html = INDEX_HTML.read_text(encoding="utf-8")
    return html.split('id="tab-parametros"')[1].split('id="tab-imagenes"')[0]


def test_modelo_pin_only_has_provider_and_model():
    ajustes = _ajustes_html()
    assert 'id="settings-model-pin"' in ajustes
    pin = ajustes.split('id="settings-model-pin"')[1].split("sidebar-accordion-params")[0]
    assert 'id="provider-select"' in pin
    assert 'id="model-select-input"' in pin
    assert 'id="history-turns-input"' not in pin
    assert 'id="param-num-ctx"' not in pin
    assert 'id="param-truncation"' not in pin
    assert "accordion-section" not in pin
    assert 'data-accordion-section="params-modelo"' not in ajustes
    assert 'id="accordion-params-modelo"' not in ajustes
    assert 'id="settings-model-pin-body"' not in ajustes


def test_presets_then_contexto_accordion_order():
    ajustes = _ajustes_html()
    pin_pos = ajustes.find('id="settings-model-pin"')
    presets_pos = ajustes.find('data-accordion-section="params-presets"')
    contexto_pos = ajustes.find('data-accordion-section="params-contexto"')
    instruccion_pos = ajustes.find('data-accordion-section="params-instruccion"')
    assert pin_pos >= 0
    assert presets_pos > pin_pos
    assert contexto_pos > presets_pos
    assert instruccion_pos > contexto_pos
    presets = ajustes[presets_pos:contexto_pos]
    assert "Presets" in presets
    assert 'id="settings-recipes"' in presets
    assert 'id="settings-think"' in presets
    assert 'id="settings-recipe-params"' in presets
    assert 'data-control-id="think"' not in presets
    contexto = ajustes[contexto_pos:instruccion_pos]
    assert "Contexto" in contexto
    assert 'id="history-turns-input"' in contexto
    assert 'id="param-num-ctx"' in contexto
    assert 'id="param-truncation"' in contexto


def test_pin_and_presets_layout_css():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".settings-model-pin" in css
    assert ".settings-model-pin-body" not in css
    pin_block = css.split(".settings-model-pin {")[1].split("}")[0]
    assert "overflow: visible" in pin_block
    assert ".settings-recipe-param" in css
    assert ".composer-recipe-chip.is-active" in css


def test_js_renders_presets_from_same_recipes_as_composer():
    js = APP_JS.read_text(encoding="utf-8")
    assert "function fillRecipeChipHost" in js
    assert "function rebuildRecipeParamInspector" in js
    assert "function syncSettingsPresetsMirrors" in js
    assert 'getElementById("settings-recipes")' in js
    assert 'getElementById("settings-think")' in js
    assert "settings-recipe-params" in js
    assert "data-recipe-param-id" in js
