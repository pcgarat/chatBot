"""Pantalla completa del panel de conversación (botón junto al zoom)."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
STYLE_CSS = ROOT / "frontend" / "src" / "styles" / "style.css"


def test_fullscreen_button_is_left_of_zoom_controls():
    html = frontend_markup()
    assert 'id="btn-chat-fullscreen"' in html
    assert 'class="icon-btn font-size-btn"' in html
    fs = html.index('id="btn-chat-fullscreen"')
    zoom = html.index('id="btn-font-size-decrease"')
    assert fs < zoom, "El botón fullscreen debe ir a la izquierda de los de zoom"
    controls = html[
        html.index('class="chat-stream-view-controls') : html.index('id="messages-container"')
    ]
    assert "btn-chat-fullscreen" in controls


def test_chat_fullscreen_js_requests_browser_fs_and_restores_panels():
    js = frontend_source()
    assert "initChatFullscreen" in js
    assert "requestFullscreen" in js
    assert "exitFullscreen" in js
    assert "fullscreenchange" in js
    assert "chat-fullscreen" in js or "data-chat-fullscreen" in js
    assert "layoutBeforeFullscreen" in js
    assert "data-sidebar-left" in js
    start = js.index("initChatFullscreen")
    body = js[start : start + 4500]
    assert "captureLayoutSnapshot" in body or "layoutBeforeFullscreen" in body
    assert "restoreLayoutSnapshot" in body or "restoreLayout" in body
    assert "column-left" in body or "sidebar-left" in body or "data-sidebar-left" in body


def test_chat_fullscreen_css_hides_side_panels():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert "chat-fullscreen" in css or "data-chat-fullscreen" in css
    assert ".column-left" in css and ".column-right" in css
    fs_block = css
    assert "data-chat-fullscreen" in fs_block
    assert re.search(
        r"data-chat-fullscreen[^\n]*\.column-left|"
        r"chat-fullscreen[^\n]*\.column-left|"
        r"\.column-left[^\n]*chat-fullscreen",
        fs_block,
    )
    # Ocultación explícita de laterales en modo fullscreen
    idx = css.find("data-chat-fullscreen")
    assert idx >= 0
    chunk = css[idx : idx + 800]
    assert "column-right" in chunk
    assert "display: none" in chunk or "display:none" in chunk


def test_chat_fullscreen_css_hides_composer():
    """En pantalla completa no debe verse el panel de escritura ni el botón Escribir."""
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert re.search(
        r"data-chat-fullscreen[^\n]*\.composer-panel|"
        r"chat-fullscreen[^\n]*\.composer-panel|"
        r"\.composer-panel[^\n]*chat-fullscreen",
        css,
    )
    idx = css.find("data-chat-fullscreen")
    assert idx >= 0
    # Incluye el bloque que oculta composer (tras laterales / expand)
    chunk = css[idx : idx + 1200]
    assert ".composer-panel" in chunk
    assert ".composer-expand-btn" in chunk
    assert "display: none" in chunk or "display:none" in chunk


def test_index_serves_fullscreen_button(client):
    r = client.get("/")
    assert r.status_code == 200
    html = frontend_markup()
    assert 'id="btn-chat-fullscreen"' in frontend_markup()
    assert frontend_markup().index('id="btn-chat-fullscreen"') < r.text.index(
        'id="btn-font-size-decrease"'
    )
