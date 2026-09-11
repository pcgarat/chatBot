"""Historial izquierdo en modo Mensajes: cada respuesta una vez, fecha bajo el título."""
from pathlib import Path

from tests.frontend_source import frontend_file, frontend_markup, frontend_source

STYLE_CSS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css"
APP_JSX = Path(__file__).resolve().parents[1] / "frontend" / "src" / "App.jsx"


def _css() -> str:
    return STYLE_CSS.read_text(encoding="utf-8")


def _rule_body(css: str, selector: str) -> str:
    marker = f"{selector} {{"
    assert marker in css, f"Falta selector {selector}"
    return css.split(marker, 1)[1].split("}", 1)[0]


def test_message_history_row_shows_created_datetime_under_title():
    render_fn = frontend_file("ui/history/render.js").split("export function renderMessageHistoryList")[1]
    lists = frontend_file("ui/history/HistoryLists.jsx")
    assert "function formatDateTime" in frontend_file("lib/dates.js")
    assert "formatDateTime(item.created_at)" in render_fn
    assert "message-history-created" in render_fn
    assert "<time" in render_fn
    assert "conv-when" not in render_fn
    assert "message-history-created" in lists


def test_message_history_created_line_is_visible_and_small():
    css = _css()
    item = _rule_body(css, ".column-left .message-history-item")
    assert "white-space: normal" in item
    meta = _rule_body(css, ".column-left .message-history-item .message-history-created")
    assert "display: block" in meta
    assert "font-variant-numeric: tabular-nums" in meta
    assert "font-size" in meta


def test_message_history_search_and_pager_live_in_column_left():
    html = frontend_markup()
    app = APP_JSX.read_text(encoding="utf-8")
    left = app[app.index('id="column-left"') : app.index("</aside>")]
    assert 'id="message-history-search-wrap"' in left
    assert 'id="message-history-search"' in left
    assert 'id="message-history-pager"' in html
    wrap = left[left.index('id="message-history-search-wrap"') : left.index("<ConversationsList")]
    assert "hidden" in wrap
    assert "param-control" in wrap
    assert "param-label" in wrap


def test_message_history_search_only_visible_in_messages_mode():
    actions = frontend_file("app/historyActions.js")
    assert "function syncMessageHistoryChrome" in actions
    assert "isMessagesHistoryMode()" in actions
    assert "messageHistorySearchWrap" in actions
    assert "syncMessageHistoryChrome()" in actions


def test_message_history_load_more_uses_offset():
    actions = frontend_file("app/historyActions.js")
    lists = frontend_file("ui/history/HistoryLists.jsx")
    load_fn = actions.split("export async function loadMessageHistory")[1].split("export async function refreshLeftHistory")[0]
    assert "append" in load_fn
    assert 'params.set("offset"' in load_fn
    assert "message-history-load-more" in lists
    assert "loadMessageHistory({ append: true })" in lists
    assert "Cargar más" in lists


def test_opening_message_does_not_reload_message_history_pagination():
    """Clic en un mensaje no debe recargar el historial desde offset 0 (colapsa páginas ya cargadas)."""
    actions = frontend_file("app/historyActions.js")
    session = frontend_file("app/sessionActions.js")
    lists = frontend_file("ui/history/HistoryLists.jsx")
    assert "function syncMessageHistoryActiveItem" in actions
    assert "message-history-item" in actions
    assert "focusMessageId" in actions or "consultaAssistantId" in actions
    assert "goToConversationTarget" in lists
    open_fn = session.split("export async function openConsultaTurn")[1].split("export async function newConversation")[0]
    assert "openConversationAtMessage" in open_fn
    assert "refreshLeftHistory()" not in open_fn
