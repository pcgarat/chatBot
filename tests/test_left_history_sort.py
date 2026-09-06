"""Control de ordenación del historial izquierdo (markup + contrato JS)."""
from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "app.js"


def _column_left_html(html: str) -> str:
    start = html.index('id="column-left"')
    end = html.index('id="column-center"', start) if 'id="column-center"' in html[start:] else html.index("</aside>", start)
    return html[start:end]


def test_left_history_sort_control_lives_in_column_left():
    html = INDEX_HTML.read_text(encoding="utf-8")
    left = _column_left_html(html)
    assert 'id="left-history-sort"' in left
    assert 'id="left-history-sort-select"' in left
    assert 'id="left-history-sort-select"' in html
    prefs_start = html.find('id="accordion-preferences"')
    if prefs_start != -1:
        assert 'id="left-history-sort-select"' not in html[prefs_start:]
    assert "pref-image-" not in left
    assert "pref-font-" not in left


def test_left_history_sort_default_options_are_conversation_criteria():
    html = INDEX_HTML.read_text(encoding="utf-8")
    left = _column_left_html(html)
    select_start = left.index('id="left-history-sort-select"')
    select_block = left[select_start : left.index("</select>", select_start)]
    assert 'value="activity"' in select_block
    assert 'value="created_at"' in select_block
    assert 'value="image"' not in select_block
    assert 'value="message"' not in select_block


def test_left_history_sort_persists_separate_keys(client):
    js = APP_JS.read_text(encoding="utf-8")
    assert 'leftHistorySortConversations' in js
    assert 'leftHistorySortMessages' in js
    assert 'value: "activity"' in js
    assert 'value: "created_at"' in js
    assert 'value: "message"' in js
    assert 'value: "image"' in js
    r = client.get("/")
    assert r.status_code == 200
    assert 'id="left-history-sort-select"' in r.text


def test_load_conversations_sends_conversation_sort_never_image():
    js = APP_JS.read_text(encoding="utf-8")
    load_conv = js.split("async function loadConversations")[1].split("const LEFT_HISTORY_MODE_KEY")[0]
    assert "/conversations?sort=" in load_conv
    assert "readStoredConversationSort" in load_conv
    assert "image" not in load_conv
    assert "leftHistorySortMessages" not in load_conv


def test_load_message_history_sends_message_or_image_sort():
    js = APP_JS.read_text(encoding="utf-8")
    load_msg = js.split("async function loadMessageHistory")[1].split("async function")[0]
    assert "/messages?" in load_msg
    assert 'params.set("sort"' in load_msg
    assert "readStoredMessageSort" in load_msg
    assert 'params.set("limit"' in load_msg
    assert 'params.set("offset"' in load_msg
    assert 'params.set("q"' in load_msg


def test_image_sort_only_applies_in_messages_mode():
    js = APP_JS.read_text(encoding="utf-8")
    assert "MSG_SORT_OPTIONS" in js
    assert "CONV_SORT_OPTIONS" in js
    sync_fn = js.split("function syncLeftHistorySortControl")[1].split("function onLeftHistorySortChange")[0]
    assert "isMessagesHistoryMode()" in sync_fn
    assert "MSG_SORT_OPTIONS" in sync_fn
    assert "CONV_SORT_OPTIONS" in sync_fn
    persist_msg = js.split("function persistMessageSort")[1].split("function currentLeftHistorySort")[0]
    assert 'sort === "image"' in persist_msg
    persist_conv = js.split("function persistConversationSort")[1].split("function readStoredMessageSort")[0]
    assert "image" not in persist_conv
    render_conv = js.split("function renderConversationsList")[1].split("function messageHistoryWhenIso")[0]
    assert "readStoredConversationSort" in render_conv
    assert "readStoredMessageSort" not in render_conv
    render_msg = js.split("function renderMessageHistoryList")[1].split("async function deleteConversation")[0]
    assert "readStoredMessageSort" in render_msg
    assert "messageHistoryWhenIso" in render_msg
    when_iso = js.split("function messageHistoryWhenIso")[1].split("function renderMessageHistoryList")[0]
    assert "latest_image_at" in when_iso
    assert 'sort === "image"' in when_iso
