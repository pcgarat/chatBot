"""Contrato del historial izquierdo tras unificar en árbol (sort legacy sigue en store)."""
from pathlib import Path

from tests.frontend_source import frontend_file, frontend_markup, frontend_source

ROOT = Path(__file__).resolve().parents[1]
APP_JSX = ROOT / "frontend" / "src" / "App.jsx"


def _column_left_app() -> str:
    html = APP_JSX.read_text(encoding="utf-8")
    start = html.index('id="column-left"')
    return html[start : html.index("</aside>", start)]


def test_left_history_sort_ui_removed_in_favor_of_tree():
    left = _column_left_app()
    assert 'id="left-history-sort"' not in left
    assert "<ConversationsList" in left
    assert 'id="btn-new-chat"' in left


def test_sort_options_remain_in_store_for_legacy_helpers():
    js = frontend_file("store/history.js")
    assert "CONV_SORT_OPTIONS" in js
    assert "MSG_SORT_OPTIONS" in js
    assert '{ value: "activity"' in js
    assert '{ value: "created_at"' in js


def test_left_history_mode_defaults_to_tree():
    store = frontend_file("store/history.js")
    assert 'return "tree"' in store
    assert "normalizeMode" in store
    assert "isTreeHistoryMode" in store


def test_load_conversations_helper_still_uses_conversation_sort():
    load_conv = frontend_file("app/historyActions.js").split("export async function loadConversations")[1].split(
        "export async function loadDeleted"
    )[0]
    api = frontend_file("api/conversations.js")
    assert "/conversations?sort=" in api
    assert "readStoredConversationSort" in load_conv


def test_message_tree_roots_client_exists():
    api = frontend_file("api/messageTree.js")
    assert "listMessageTreeRoots" in api
    assert "listMessageTreeChildren" in api
    assert frontend_markup()  # SPA servida
