"""UI: los ajustes de imágenes persisten como el resto del rig (conversación + recarga)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "static" / "js" / "app.js"
INDEX_HTML = ROOT / "app" / "static" / "index.html"


def _js() -> str:
    return APP_JS.read_text(encoding="utf-8")


def test_js_persists_images_on_conversation_with_other_workspace_fields():
    js = _js()
    persist = js.split("async function persistWorkspaceToConversation")[1].split(
        "async function applyWorkspaceSnapshot"
    )[0]
    assert "images:" in persist or "images :" in persist
    assert "collectImagesSnapshot()" in persist or "snap.images" in persist


def test_js_restores_images_when_opening_conversation():
    js = _js()
    setter = js.split("async function setCurrentConversation")[1].split(
        "let saveRulesDebounceTimer"
    )[0]
    assert "conv.images" in setter
    assert "applyImagesSnapshot" in setter


def test_js_init_images_panel_does_not_persist_before_selects_hydrate():
    """
    Si persistImagesPanel corre antes de rellenar provider/modelo,
    pisa localStorage con strings vacíos y tras recargar el navegador
    se pierden los ajustes.
    """
    js = _js()
    init = js.split("function initImagesPanel")[1].split("initImageGallery")[0]
    ensure_pos = init.find("ensureImagesPromptSelects")
    persist_pos = init.rfind("persistImagesPanel")
    assert ensure_pos >= 0, "initImagesPanel debe hidratar los selects"
    assert persist_pos >= 0, "initImagesPanel acaba persistiendo el panel"
    assert ensure_pos < persist_pos
    assert "await ensureImagesPromptSelects()" in init


def test_js_saves_images_panel_to_conversation():
    js = _js()
    assert "function persistImagesToConversation" in js
    persist_conv = js.split("function persistImagesToConversation")[1].split(
        "function persistImagesPanel"
    )[0]
    assert "images:" in persist_conv or "images :" in persist_conv
    persist_panel = js.split("function persistImagesPanel")[1].split(
        "async function fetchForgeLastGenerationParams"
    )[0]
    assert "debouncedPersistImagesToConversation" in persist_panel


def test_js_new_conversation_copies_current_images():
    js = _js()
    create = js.split("async function newConversation")[1].split(
        "function applyAutoTitleUi"
    )[0]
    assert "collectImagesSnapshot()" in create
    assert "images:" in create


def test_js_collects_reactor_settings_object():
    js = _js()
    collect = js.split("function collectImagesSnapshot")[1].split("function fillImagesPanelFromPrefs")[0]
    assert "readReactorPanelSettings()" in collect
    assert "reactor:" in collect


def test_js_has_reactor_gender_controls():
    js = _js()
    assert "images-reactor-female-enabled" in js
    assert "images-reactor-male-enabled" in js
    assert "syncReactorGenderInputs" in js
    assert "fetchForgeReactorDefaults" in js


def test_index_html_has_reactor_controls():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert 'id="images-reactor-enabled"' in html
    assert 'id="images-reactor-female-face-model"' in html
    assert 'id="images-reactor-male-face-model"' in html
    assert 'id="images-reactor-codeformer-weight"' in html
