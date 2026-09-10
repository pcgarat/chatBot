"""History en Ajustes; zoom/colapso flotantes en el stream; sin toolbar intermedia."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
STYLE_CSS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css"


def _header_block(html: str) -> str:
    start = html.index('class="chat-panel-header"')
    end = html.index('<section class="chat-column"', start)
    return html[start:end]


def _stream_wrap_block(html: str) -> str:
    start = html.index('class="chat-stream-wrap"')
    end = html.index('class="input-area', start)
    return html[start:end]


def _ajustes_contexto_block(html: str) -> str:
    start = html.index('id="accordion-params-contexto"')
    end = html.index('id="accordion-params-instruccion"', start)
    return html[start:end]


def test_history_turns_lives_in_ajustes_contexto():
    html = frontend_markup()
    contexto = _ajustes_contexto_block(html)
    assert 'id="history-turns-input"' in contexto
    assert "Mensajes de historial" in contexto
    assert 'id="history-turns-input"' not in _header_block(html)
    pin = html[html.index('id="settings-model-pin"') : html.index('id="accordion-params-presets"')]
    assert 'id="history-turns-input"' not in pin


def test_stream_view_controls_float_in_conversation_panel_corner():
    html = frontend_markup()
    header = _header_block(html)
    stream = _stream_wrap_block(html)
    assert 'id="btn-clear-memory"' in header
    assert "chat-stream-view-controls" not in header
    assert 'id="btn-font-size-decrease"' not in header
    assert "chat-font-size-corner" in stream
    assert "chat-stream-view-controls" in stream
    assert 'id="btn-font-size-decrease"' in stream
    assert 'id="btn-font-size-increase"' in stream
    assert 'id="btn-collapse-all-messages"' in stream


def test_floating_view_controls_are_translucent_until_hover():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".chat-font-size-corner" in css
    assert "opacity: 0.32" in css or "opacity: .32" in css
    assert ".chat-font-size-corner:hover" in css
    assert "opacity: 1" in css
    assert "position: absolute" in css


def test_chat_toolbar_removed_after_relocating_controls():
    html = frontend_markup()
    assert 'id="chat-toolbar"' not in html
    assert 'class="chat-toolbar"' not in html


def test_index_serves_floating_stream_controls(client):
    r = client.get("/")
    assert r.status_code == 200
    html = frontend_markup()
    assert 'id="history-turns-input"' in frontend_markup()
    assert "chat-font-size-corner" in frontend_markup()
    assert 'id="btn-collapse-all-messages"' in frontend_markup()
    assert 'id="chat-toolbar"' not in frontend_markup()
