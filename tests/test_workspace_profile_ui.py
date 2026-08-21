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
    assert 'id="workspace-profile-select"' in html
    assert 'id="btn-workspace-profile-save"' in html
    assert 'data-action="save-as"' in html
    assert 'id="workspace-profile-name-modal"' in html


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
