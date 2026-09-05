"""Historial izquierdo en modo Mensajes: cada respuesta una vez, fecha bajo el título."""
from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "app.js"
STYLE_CSS = Path(__file__).resolve().parents[1] / "app" / "static" / "css" / "style.css"


def _js() -> str:
    return APP_JS.read_text(encoding="utf-8")


def _css() -> str:
    return STYLE_CSS.read_text(encoding="utf-8")


def _fn(js: str, name: str, next_name: str) -> str:
    start = js.index(name)
    end = js.index(next_name, start + 1)
    return js[start:end]


def _rule_body(css: str, selector: str) -> str:
    marker = f"{selector} {{"
    assert marker in css, f"Falta selector {selector}"
    return css.split(marker, 1)[1].split("}", 1)[0]


def test_message_history_row_shows_created_datetime_under_title():
    js = _js()
    render_fn = _fn(js, "function renderMessageHistoryList", "async function deleteConversation")
    assert "function formatDateTime" in js
    assert "formatDateTime(item.created_at)" in render_fn
    assert "message-history-created" in render_fn
    assert "<time" in render_fn
    assert "conv-when" not in render_fn


def test_message_history_created_line_is_visible_and_small():
    css = _css()
    item = _rule_body(css, ".column-left .message-history-item")
    assert "white-space: normal" in item
    meta = _rule_body(css, ".column-left .message-history-item .message-history-created")
    assert "display: block" in meta
    assert "font-variant-numeric: tabular-nums" in meta
    assert "font-size" in meta
