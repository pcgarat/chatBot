"""Botones flotantes ↑/↓ para saltar al inicio/fin del mensaje visible en el stream."""
from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "app.js"
STYLE_CSS = Path(__file__).resolve().parents[1] / "app" / "static" / "css" / "style.css"


def test_index_has_scroll_nav_markup():
    html = INDEX_HTML.read_text(encoding="utf-8")
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
    js = APP_JS.read_text(encoding="utf-8")
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
    assert 'id="chat-scroll-nav"' in r.text
    assert 'id="btn-scroll-msg-up"' in r.text
    assert 'id="btn-scroll-msg-down"' in r.text
