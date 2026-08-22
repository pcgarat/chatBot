"""La barra de perfil vive en la columna de configuración, no en el chat."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "app" / "static" / "index.html"
APP_JS = ROOT / "app" / "static" / "js" / "app.js"
STYLE_CSS = ROOT / "app" / "static" / "css" / "style.css"


def test_profile_bar_is_at_top_of_right_column():
    html = INDEX.read_text(encoding="utf-8")
    right = html.split('aria-label="Reglas y ajustes"')[1]
    profile_pos = right.find("workspace-profile-bar")
    accordion_pos = right.find("sidebar-main-accordion")
    assert profile_pos >= 0
    assert accordion_pos > profile_pos
    assert 'id="workspace-profile-name-modal"' in html


def test_profile_bar_has_visible_save_and_open_controls():
    """Guardar y abrir no pueden ser solo iconos: hay que ver el nombre y pulsarlo."""
    html = INDEX.read_text(encoding="utf-8")
    save_idx = html.find('id="btn-workspace-profile-save"')
    assert save_idx >= 0
    save_chunk = html[save_idx : save_idx + 280]
    assert "Guardar" in save_chunk
    assert "<svg" not in save_chunk.split("</button>")[0] or "Guardar" in save_chunk.split("</button>")[0]
    assert 'id="workspace-profile-list"' in html
    assert 'id="workspace-profile-empty"' in html
    assert 'id="btn-workspace-profile-save-as"' in html
    js = APP_JS.read_text(encoding="utf-8")
    assert "function renderWorkspaceProfileList" in js
    assert 'data-action="load"' in js


def test_js_surfaces_profile_list_load_errors():
    js = APP_JS.read_text(encoding="utf-8")
    assert "No se pudieron cargar los perfiles" in js
    assert "catch (_)" not in js.split("async function refreshWorkspaceProfiles")[1].split("function promptWorkspaceProfileName")[0]


def test_js_collects_and_applies_workspace_snapshot():
    js = APP_JS.read_text(encoding="utf-8")
    assert "function collectWorkspaceSnapshot" in js
    assert "function applyWorkspaceSnapshot" in js
    assert "function saveWorkspaceProfile" in js
    assert "/workspace-profiles" in js
    assert "collectImagesSnapshot()" in js
    assert "params_excluded" in js
    assert "system_instructions" in js


def test_css_profile_bar_is_identity_strip():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".workspace-profile-bar" in css
    assert "color-mix(in srgb, var(--accent)" in css.split(".workspace-profile-bar")[1].split("}")[0]
