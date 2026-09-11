"""Al abrir un mensaje el panel usa la ventana unificada (ancla + scroll), no consulta Q+A."""
from tests.frontend_source import frontend_source

from pathlib import Path

STYLE_CSS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css"


def _js() -> str:
    return frontend_source()


def _fn(js: str, name: str, next_name: str) -> str:
    start = js.index(name)
    end = js.index(next_name, start + 1)
    return js[start:end]


def _rule_body(css: str, selector: str) -> str:
    marker = f"{selector} {{"
    assert marker in css, f"Falta selector {selector}"
    return css.split(marker, 1)[1].split("}", 1)[0]


def test_open_message_uses_unified_window_not_consulta_filter():
    """Historial/galería/debug comparten goToConversationTarget + viewStartIndex."""
    js = _js()
    assert "viewStartIndex" in js
    assert "function messagesInWindow" in js or "messagesInWindow" in js
    assert "loadOlderMessageInView" in js
    open_fn = _fn(js, "async function openConsultaTurn", "async function newConversation")
    assert "openConversationAtMessage" in open_fn
    assert "keepConsulta: true" not in open_fn


def test_messages_pane_loads_older_on_scroll_top():
    js = _js()
    pane = _fn(js, "function MessagesPane", "function toggleCollapse")
    assert "viewStartIndex" in pane
    assert "loadOlderMessageInView" in pane
    assert "scrollTop" in pane


def test_open_reading_mode_pins_scroll_to_start_after_layout():
    """scrollTop=0 síncrono no basta: el layout flex y las imágenes te dejan al final."""
    js = _js()
    fn = _fn(js, "function openReadingMode", "function closeReadingMode")
    assert "scrollReadingBodyToStart" in fn
    helper = _fn(js, "function scrollReadingBodyToStart", "function openReadingMode")
    assert "scrollTop = 0" in helper
    assert "requestAnimationFrame" in helper


def test_reading_mode_body_disables_overflow_anchor():
    """Si el contenido inicial cabe, overflow-anchor mantiene el ancla al final al crecer."""
    css = STYLE_CSS.read_text(encoding="utf-8")
    body = _rule_body(css, ".reading-mode-body")
    assert "overflow-anchor: none" in body


def test_chat_stream_disables_overflow_anchor():
    """El nodo vivo del chat es #messages-container.chat-stream, no .messages-container."""
    css = STYLE_CSS.read_text(encoding="utf-8")
    body = _rule_body(css, ".chat-stream")
    assert "overflow-anchor: none" in body
