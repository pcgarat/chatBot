"""Historial izquierdo en modo Mensajes: cada respuesta una vez, fecha bajo el título."""
from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "app.js"
STYLE_CSS = Path(__file__).resolve().parents[1] / "app" / "static" / "css" / "style.css"
INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"


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


def _column_left_html(html: str) -> str:
    start = html.index('id="column-left"')
    end = html.index('id="column-center"', start) if 'id="column-center"' in html[start:] else html.index("</aside>", start)
    return html[start:end]


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


def test_message_history_search_and_pager_live_in_column_left():
    html = INDEX_HTML.read_text(encoding="utf-8")
    left = _column_left_html(html)
    assert 'id="message-history-search-wrap"' in left
    assert 'id="message-history-search"' in left
    assert 'id="message-history-pager"' in left
    wrap = left[left.index('id="message-history-search-wrap"') : left.index('id="conversations-list"')]
    assert "hidden" in wrap
    assert "param-control" in wrap
    assert "param-label" in wrap


def test_message_history_search_only_visible_in_messages_mode():
    js = _js()
    assert "function syncMessageHistoryChrome" in js
    sync_fn = _fn(js, "function syncMessageHistoryChrome", "function messagesForDisplay")
    assert "isMessagesHistoryMode()" in sync_fn
    assert "messageHistorySearchWrap" in sync_fn
    apply_fn = _fn(js, "function applyConsultaChrome", "function syncMessageHistoryChrome")
    assert "syncMessageHistoryChrome()" in apply_fn


def test_message_history_load_more_uses_offset():
    js = _js()
    load_fn = _fn(js, "async function loadMessageHistory", "async function setLeftHistoryMode")
    assert "append" in load_fn
    assert 'params.set("offset"' in load_fn
    pager_fn = _fn(js, "function renderMessageHistoryPager", "async function deleteConversation")
    assert "message-history-load-more" in pager_fn
    assert "loadMessageHistory({ append: true })" in pager_fn
    assert "Cargar más" in pager_fn


def test_opening_consulta_does_not_reload_message_history_pagination():
    """Clic en un mensaje no debe recargar el historial desde offset 0 (colapsa páginas ya cargadas)."""
    js = _js()
    assert "function syncMessageHistoryActiveItem" in js
    sync_fn = _fn(js, "function syncMessageHistoryActiveItem", "async function refreshLeftHistory")
    assert "message-history-item" in sync_fn
    assert "consultaAssistantId" in sync_fn
    set_fn = _fn(js, "async function setCurrentConversation", "let saveRulesDebounceTimer")
    open_fn = _fn(js, "async function openConsultaTurn", "async function newConversation")
    assert "keepConsulta: true" in open_fn
    assert "syncMessageHistoryActiveItem()" in set_fn
    tail = set_fn[set_fn.index("scheduleScrollMessagesToTop") :]
    first_block, else_block = tail.split("} else {", 1)
    assert "syncMessageHistoryActiveItem()" in first_block
    assert "refreshLeftHistory()" not in first_block
    assert "refreshLeftHistory()" in else_block
    assert "scheduleScrollMessagesToBottom" in else_block
