"""Control de ordenación del historial izquierdo (markup + contrato JS)."""
from pathlib import Path

from tests.frontend_source import frontend_file, frontend_markup, frontend_source

ROOT = Path(__file__).resolve().parents[1]
STYLE_CSS = ROOT / "frontend" / "src" / "styles" / "style.css"
APP_JSX = ROOT / "frontend" / "src" / "App.jsx"


def _column_left_app() -> str:
    html = APP_JSX.read_text(encoding="utf-8")
    start = html.index('id="column-left"')
    return html[start : html.index("</aside>", start)]


def test_left_history_sort_control_lives_in_column_left():
    html = frontend_markup()
    assert 'id="left-history-sort"' in html
    assert 'id="left-history-sort-select"' in html
    left = _column_left_app()
    assert "pref-image-" not in left
    assert "pref-font-" not in left
    assert "<HistorySortSelect" in left


def test_left_history_sort_default_options_are_conversation_criteria():
    js = frontend_file("store/history.js")
    conv = js.split("CONV_SORT_OPTIONS")[1].split("MSG_SORT_OPTIONS")[0]
    assert '{ value: "activity"' in conv
    assert '{ value: "created_at"' in conv
    assert "image" not in conv
    assert 'id="left-history-sort-select"' in frontend_markup()


def test_left_history_sort_persists_separate_keys(client):
    js = frontend_source()
    assert "leftHistorySortConversations" in js
    assert "leftHistorySortMessages" in js
    assert 'value: "activity"' in js
    assert 'value: "created_at"' in js
    assert 'value: "message"' in js
    assert 'value: "image"' in js
    r = client.get("/")
    assert r.status_code == 200
    assert 'id="left-history-sort-select"' in frontend_markup()


def test_load_conversations_sends_conversation_sort_never_image():
    load_conv = frontend_file("app/historyActions.js").split("export async function loadConversations")[1].split("export async function loadDeleted")[0]
    api = frontend_file("api/conversations.js")
    assert "/conversations?sort=" in api
    assert "readStoredConversationSort" in load_conv
    assert "image" not in load_conv
    assert "leftHistorySortMessages" not in load_conv


def test_load_message_history_sends_message_or_image_sort():
    load_msg = frontend_file("app/historyActions.js").split("export async function loadMessageHistory")[1].split("export async function refreshLeftHistory")[0]
    assert 'params.set("sort"' in load_msg
    assert "readStoredMessageSort" in load_msg
    assert 'params.set("limit"' in load_msg
    assert 'params.set("offset"' in load_msg
    assert 'params.set("q"' in load_msg
    assert "/messages?" in frontend_file("api/conversations.js")


def test_image_sort_only_applies_in_messages_mode():
    store = frontend_file("store/history.js")
    actions = frontend_file("app/historyActions.js")
    render = frontend_file("ui/history/render.js")
    assert "MSG_SORT_OPTIONS" in store
    assert "CONV_SORT_OPTIONS" in store
    assert "isMessagesHistoryMode()" in actions
    persist_msg = store.split("export function persistMessageSort")[1].split("export function persistLeftHistoryMode")[0]
    assert 'sort === "image"' in persist_msg
    persist_conv = store.split("export function persistConversationSort")[1].split("export function readStoredMessageSort")[0]
    assert "image" not in persist_conv
    assert "latest_image_at" in render
    assert 'sort === "image"' in render
    assert "messageHistoryWhenIso" in actions


def test_left_history_filters_match_right_panel_control_chrome():
    html = _column_left_app()
    css = STYLE_CSS.read_text(encoding="utf-8")
    sort = html[html.index('id="left-history-sort"') : html.index('id="message-history-search-wrap"')]
    search = html[html.index('id="message-history-search-wrap"') : html.index("<ConversationsList")]
    assert "param-label" in sort
    assert "param-control" in sort or "HistorySortSelect" in sort
    assert "param-label" in search
    assert "param-control" in search
    sort_layout = css.split(".column-left .left-history-sort {", 1)[1].split("}", 1)[0]
    assert "flex-direction: column" in sort_layout
    search_layout = css.split(".column-left .message-history-search-wrap {", 1)[1].split("}", 1)[0]
    assert "flex-direction: column" in search_layout
    label = css.split(".column-left .left-history-sort-label {", 1)[1].split("}", 1)[0]
    assert "text-transform: none" in label
    assert "uppercase" not in label
    assert "font-weight: 500" in label
    controls = css.split(
        ".column-left .left-history-sort-select,\n.column-left .message-history-search {", 1
    )[1].split("}", 1)[0]
    assert "min-height: 28px" in controls
    assert "padding: 4px 8px" in controls
    assert "border: 1px solid var(--stroke-control)" in controls
    assert "border-radius: var(--radius-sm)" in controls
    focus = css.split(
        ".column-left .left-history-sort-select:focus,\n.column-left .message-history-search:focus {",
        1,
    )[1].split("}", 1)[0]
    assert "border-color: var(--accent)" in focus
    assert "box-shadow: 0 0 0 1px var(--accent)" in focus
    right = css.split(".column-right .param-control,", 1)[1].split("}", 1)[0]
    assert "min-height: var(--rp-control-h)" in right
    assert "padding: 4px 8px" in right
    assert "border-radius: var(--radius-sm)" in right
