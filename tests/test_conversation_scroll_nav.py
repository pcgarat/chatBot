"""Botones flotantes ↑/↓ para saltar al inicio/fin del mensaje visible en el stream."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path
import re

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"
STYLE_CSS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css"


def _fn_body(js: str, name: str) -> str:
    marker = f"function {name}"
    start = js.index(marker)
    return js[start : start + 900]


def compute_scroll_top_to_align_end(message_top: float, message_height: float, client_height: float) -> float:
    """ScrollTop absoluto para dejar el bottom del mensaje al bottom del viewport."""
    return max(0.0, message_top + message_height - client_height)


def test_align_end_math_reaches_bottom_in_one_step():
    """Reproduce el fallo: un único delta incompleto no basta; el target absoluto sí."""
    message_top = 0.0
    message_height = 2000.0
    client_height = 500.0
    target = compute_scroll_top_to_align_end(message_top, message_height, client_height)
    assert target == 1500.0

    # Simula el bug reportado: primera pasada se queda corta (p.ej. flex/subpixel).
    first_pass_scroll = 1400.0
    visible_bottom = first_pass_scroll + client_height
    residual = (message_top + message_height) - visible_bottom
    assert residual == 100.0
    assert first_pass_scroll + residual == target


def test_scroll_message_end_corrects_residual_after_layout():
    """El click ↓ debe corregir residual tras layout; si no, hace falta un segundo click."""
    body = _fn_body(frontend_source(), "scrollMessageEndIntoView")
    assert "clientHeight" in body
    assert "requestAnimationFrame" in body
    assert re.search(r"scrollTop\s*=", body), "debe asignar scrollTop absoluto, no solo += delta"


def test_index_has_scroll_nav_markup():
    html = frontend_markup()
    assert 'id="chat-scroll-nav"' in html
    assert 'id="btn-scroll-msg-up"' in html
    assert 'id="btn-scroll-msg-down"' in html
    assert "primer mensaje visible" in html
    assert "último mensaje visible" in html


def test_scroll_nav_css_is_mid_right_and_idle_hidden():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".chat-scroll-nav" in css
    assert "top: 50%" in css
    assert "right: 10px" in css
    assert ".chat-scroll-nav.is-visible" in css
    assert "opacity: 0" in css
    assert "pointer-events: none" in css


def test_scroll_nav_js_wires_visibility_and_message_targets():
    js = frontend_source()
    assert "initConversationScrollNav" in js
    assert "getPartiallyVisibleMessageRows" in js
    assert "scrollToFirstVisibleMessageStart" in js
    assert "scrollToLastVisibleMessageEnd" in js
    assert "scrollMessageStartIntoView" in js
    assert "scrollMessageEndIntoView" in js
    assert "pointerOverNav" in js
    assert "IDLE_HIDE_MS" in js


def test_index_serves_scroll_nav_markup(client):
    r = client.get("/")
    assert r.status_code == 200
    html = frontend_markup()
    assert 'id="chat-scroll-nav"' in frontend_markup()
    assert 'id="btn-scroll-msg-up"' in frontend_markup()
    assert 'id="btn-scroll-msg-down"' in frontend_markup()
