"""UI de papelera (soft-delete) en el historial."""
from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "app.js"


def test_index_has_trash_markup():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert 'id="conversations-trash"' in html
    assert 'id="conversations-trash-list"' in html


def test_app_js_loads_and_restores_deleted():
    js = APP_JS.read_text(encoding="utf-8")
    assert "loadDeletedConversations" in js
    assert "restoreConversation" in js
    assert "/conversations/deleted" in js
    assert "/restore" in js
    assert "Papelera" in js or "papelera" in js
