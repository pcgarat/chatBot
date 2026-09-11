"""UI de papelera (soft-delete) en el historial."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"


def test_index_has_trash_markup():
    html = frontend_markup()
    assert 'id="conversations-trash"' in html
    assert 'id="conversations-trash-list"' in html


def test_app_js_loads_and_restores_deleted():
    js = frontend_source()
    assert "loadDeletedConversations" in js
    assert "restoreConversation" in js
    assert "/conversations/deleted" in js
    assert "/restore" in js
    assert "Papelera" in js or "papelera" in js


def test_trash_eliminar_uses_permanent_delete_not_soft_delete():
    """El botón Eliminar de la papelera debe borrar definitivo, no re-soft-delete."""
    from tests.frontend_source import frontend_file

    lists = frontend_file("ui/history/HistoryLists.jsx")
    actions = frontend_file("app/historyActions.js")
    api = frontend_file("api/conversations.js")

    assert "permanentlyDeleteFromTrash" in lists
    assert "deleteConversationFromHistory" not in lists.split("conversations-trash")[1]
    assert "permanentlyDeleteFromTrash" in actions
    assert "/permanent" in api
    assert "permanentlyDeleteConversation" in api


def test_trash_has_empty_trash_button():
    """Junto a Papelera hay un botón para vaciar toda la papelera."""
    from tests.frontend_source import frontend_file

    lists = frontend_file("ui/history/HistoryLists.jsx")
    actions = frontend_file("app/historyActions.js")
    api = frontend_file("api/conversations.js")

    assert 'id="conversations-trash-empty"' in lists or "conversations-trash-empty" in lists
    assert "emptyTrash" in lists
    assert "emptyTrash" in actions
    assert "purgeDeletedConversations" in api
    assert 'method: "DELETE"' in api or "method: 'DELETE'" in api
