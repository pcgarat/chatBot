"""Los paneles laterales se redimensionan arrastrando el borde interior."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLE_CSS = ROOT / "frontend" / "src" / "styles" / "style.css"


def test_side_splitters_exist_in_html():
    html = frontend_markup()
    assert 'id="sidebar-left-splitter"' in html
    assert 'id="sidebar-right-splitter"' in html
    assert 'id="column-right"' in html
    assert 'aria-controls="column-left"' in html
    assert 'aria-controls="column-right"' in html
    assert 'role="separator"' in html
    assert 'aria-orientation="vertical"' in html
    assert 'aria-label="Redimensionar historial"' in html
    assert "sidebarLeftWidthPx" in html
    assert "sidebarRightWidthPx" in html
    left = html.index('id="sidebar-left-splitter"')
    right_col = html.index('id="column-right"')
    right = html.index('id="sidebar-right-splitter"')
    assert left < right_col < right


def test_side_panel_resize_js_persists_and_binds_pointer():
    js = frontend_source()
    assert "initSidePanelResize" in js
    start = js.index("function initSidePanelResize")
    body = js[start : start + 5500]
    assert "sidebarLeftWidthPx" in body
    assert "sidebarRightWidthPx" in body
    assert "pointerdown" in body
    assert "setPointerCapture" in body
    assert "ArrowLeft" in body
    assert "ArrowRight" in body
    assert "dblclick" in body
    assert "--sidebar-left-width" in body
    assert "--sidebar-right-width" in body
    assert "side-panels-resizing" in body
    assert "CENTER_MIN" in body
    assert "LEFT_MAX = 420" in body
    assert "RIGHT_MAX = 480" in body
    assert "return leftWidth" in body
    assert "return rightWidth" in body


def test_side_panel_resize_css_uses_variables_and_handles():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert "--sidebar-left-width" in css
    assert "--sidebar-right-width" in css
    assert ".sidebar-column-splitter" in css
    assert "cursor: ew-resize" in css
    assert "body.side-panels-resizing" in css
    assert "html[data-sidebar-left=\"collapsed\"] #sidebar-left-splitter" in css
    assert "html[data-chat-fullscreen=\"on\"] .sidebar-column-splitter" in css
    assert "flex: 0 0 var(--sidebar-left-width, 188px)" in css
    assert "flex: 0 0 var(--sidebar-right-width, 284px)" in css
    assert "html[data-sidebar-left=\"collapsed\"] .column-left" in css
    collapsed = css[
        css.index("html[data-sidebar-left=\"collapsed\"] .column-left") : css.index(
            "html[data-sidebar-left=\"collapsed\"] .column-left"
        )
        + 420
    ]
    assert "flex: 0 0 0" in collapsed
    assert "transition: none" in collapsed
    assert "max-width: 420px" in css
    assert "max-width: 480px" in css
    assert "min-width: 180px" in css
    assert "min-width: 260px" in css
    assert "min-width: 188px" not in css
    assert "max-width: 188px" not in css


def test_index_serves_side_splitters(client):
    r = client.get("/")
    assert r.status_code == 200
    assert 'id="sidebar-left-splitter"' in frontend_markup()
    assert 'id="sidebar-right-splitter"' in frontend_markup()
    assert 'id="column-right"' in frontend_markup()
