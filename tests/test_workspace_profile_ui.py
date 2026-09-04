"""La barra de perfil vive en la columna de configuración, no en el chat."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "app" / "static" / "index.html"
APP_JS = ROOT / "app" / "static" / "js" / "app.js"
STYLE_CSS = ROOT / "app" / "static" / "css" / "style.css"


def _button_chunk(html: str, button_id: str) -> str:
    start = html.find(f'id="{button_id}"')
    assert start >= 0, f"falta {button_id}"
    open_start = html.rfind("<button", 0, start)
    assert open_start >= 0
    end = html.find("</button>", start)
    assert end > start
    return html[open_start : end + len("</button>")]


def _visible_text(chunk: str) -> str:
    without_svg = re.sub(r"<svg[\s\S]*?</svg>", "", chunk, flags=re.I)
    without_tags = re.sub(r"<[^>]+>", "", without_svg)
    return without_tags.strip()


def test_profile_bar_is_at_top_of_right_column():
    html = INDEX.read_text(encoding="utf-8")
    right = html.split('aria-label="Reglas y ajustes"')[1]
    profile_pos = right.find("workspace-profile-bar")
    tabs_pos = right.find("sidebar-side-layout")
    assert profile_pos >= 0
    assert tabs_pos > profile_pos
    assert 'id="workspace-profile-name-modal"' in html


def test_profile_bar_is_select_plus_icon_actions():
    html = INDEX.read_text(encoding="utf-8")
    assert 'id="workspace-profile-select"' in html
    assert 'id="workspace-profile-list"' not in html
    assert 'id="workspace-profile-empty"' not in html

    apply_btn = _button_chunk(html, "btn-workspace-profile-apply")
    save_btn = _button_chunk(html, "btn-workspace-profile-save")
    save_as_btn = _button_chunk(html, "btn-workspace-profile-save-as")
    delete_btn = _button_chunk(html, "btn-workspace-profile-delete")

    assert 'title="aplicar perfil"' in apply_btn
    assert 'aria-label="aplicar perfil"' in apply_btn
    assert 'title="guardar"' in save_btn
    assert 'aria-label="guardar"' in save_btn
    assert 'title="guardar como"' in save_as_btn
    assert 'aria-label="guardar como"' in save_as_btn
    assert 'title="eliminar perfil"' in delete_btn

    for chunk in (apply_btn, save_btn, save_as_btn, delete_btn):
        assert "<svg" in chunk
        assert _visible_text(chunk) == ""

    select_idx = html.find('id="workspace-profile-select"')
    apply_idx = html.find('id="btn-workspace-profile-apply"')
    save_idx = html.find('id="btn-workspace-profile-save"')
    save_as_idx = html.find('id="btn-workspace-profile-save-as"')
    delete_idx = html.find('id="btn-workspace-profile-delete"')
    assert select_idx < apply_idx < save_idx < save_as_idx < delete_idx

    js = APP_JS.read_text(encoding="utf-8")
    assert "function renderWorkspaceProfileSelect" in js
    assert "function applySelectedWorkspaceProfile" in js


def test_js_surfaces_profile_list_load_errors():
    js = APP_JS.read_text(encoding="utf-8")
    assert "No se pudieron cargar los perfiles" in js
    assert "catch (_)" not in js.split("async function refreshWorkspaceProfiles")[1].split(
        "function promptWorkspaceProfileName"
    )[0]


def test_js_collects_all_panel_params_not_just_diffs():
    js = APP_JS.read_text(encoding="utf-8")
    assert "function collectAllModelParams" in js
    collect_fn = js.split("function collectWorkspaceSnapshot")[1].split(
        "async function persistWorkspaceToConversation"
    )[0]
    assert "collectAllModelParams()" in collect_fn
    assert "buildModelParamsRaw()" not in collect_fn


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
    assert ".workspace-profile-icon-btn" in css
    assert ".workspace-profile-select" in css
