"""La barra de perfil vive en la columna de configuración, no en el chat."""
from tests.frontend_source import frontend_markup, frontend_source

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLE_CSS = ROOT / "frontend" / "src" / "styles" / "style.css"


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
    html = frontend_markup()
    right = html.split('id="column-right"')[1]
    profile_pos = right.find("workspace-profile-bar")
    tabs_pos = right.find("sidebar-side-layout")
    assert profile_pos >= 0
    assert tabs_pos > profile_pos
    assert 'id="workspace-profile-name-modal"' in html


def test_profile_bar_is_select_plus_icon_actions():
    html = frontend_markup()
    assert 'id="workspace-profile-select"' in html
    assert 'id="workspace-profile-list"' not in html
    assert 'id="workspace-profile-empty"' not in html

    apply_btn = _button_chunk(html, "btn-workspace-profile-apply")
    save_btn = _button_chunk(html, "btn-workspace-profile-save")
    save_as_btn = _button_chunk(html, "btn-workspace-profile-save-as")
    delete_btn = _button_chunk(html, "btn-workspace-profile-delete")

    assert 'title="Aplicar perfil"' in apply_btn
    assert 'aria-label="Aplicar perfil"' in apply_btn
    assert 'title="Guardar"' in save_btn
    assert 'aria-label="Guardar"' in save_btn
    assert 'title="Guardar como"' in save_as_btn
    assert 'aria-label="Guardar como"' in save_as_btn
    assert 'title="Eliminar perfil"' in delete_btn

    for chunk in (apply_btn, save_btn, save_as_btn, delete_btn):
        assert "<svg" in chunk
        assert _visible_text(chunk) == ""

    select_idx = html.find('id="workspace-profile-select"')
    apply_idx = html.find('id="btn-workspace-profile-apply"')
    save_idx = html.find('id="btn-workspace-profile-save"')
    save_as_idx = html.find('id="btn-workspace-profile-save-as"')
    delete_idx = html.find('id="btn-workspace-profile-delete"')
    assert select_idx < apply_idx < save_idx < save_as_idx < delete_idx

    js = frontend_source()
    assert "function renderWorkspaceProfileSelect" in js
    assert "function applySelectedWorkspaceProfile" in js


def test_js_surfaces_profile_list_load_errors():
    js = frontend_source()
    assert "No se pudieron cargar los perfiles" in js
    assert "catch (_)" not in js.split("async function refreshWorkspaceProfiles")[1].split(
        "function promptWorkspaceProfileName"
    )[0]


def test_js_collects_all_panel_params_not_just_diffs():
    js = frontend_source()
    assert "function collectAllModelParams" in js
    collect_fn = js.split("function collectWorkspaceSnapshot")[1].split(
        "async function persistWorkspaceToConversation"
    )[0]
    assert "collectAllModelParams()" in collect_fn
    assert "buildModelParamsRaw()" not in collect_fn


def test_js_collects_and_applies_workspace_snapshot():
    js = frontend_source()
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
    icon_btn = css.split(".workspace-profile-bar .workspace-profile-icon-btn {")[1].split("}")[0]
    assert "color-mix(in srgb, var(--bg-input, var(--input)) 70%, transparent)" in icon_btn
    select = css.split(".workspace-profile-select {")[1].split("}")[0]
    assert "color-mix(in srgb, var(--bg-input, var(--input)) 70%, transparent)" in select
