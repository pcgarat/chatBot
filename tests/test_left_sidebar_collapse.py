"""El historial izquierdo se puede ocultar y volver a mostrar."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"


def test_left_sidebar_has_collapse_and_expand_controls():
    html = frontend_markup()
    assert 'id="column-left"' in html
    assert 'id="btn-collapse-left"' in html
    assert 'id="btn-expand-left"' in html
    assert 'aria-controls="column-left"' in html
    assert "leftSidebarCollapsed" in html


def test_left_sidebar_collapse_persists_in_js():
    js = frontend_source()
    assert "initLeftSidebarCollapse" in js
    assert "leftSidebarCollapsed" in js
    assert "data-sidebar-left" in js
    assert "btn-collapse-left" in js
    assert "btn-expand-left" in js


def test_conversation_list_is_single_line_dense():
    js = frontend_source()
    assert "conv-when" in js
    conv_list_fn = js.split("function renderConversationsList")[1].split("function renderMessageHistoryList")[0]
    assert "conv-meta" not in conv_list_fn
    assert "conv-icon" not in conv_list_fn


def test_index_serves_sidebar_collapse_markup(client):
    r = client.get("/")
    assert r.status_code == 200
    html = frontend_markup()
    assert 'id="btn-collapse-left"' in frontend_markup()
    assert 'id="btn-expand-left"' in frontend_markup()


def test_mensajes_stays_in_left_sidebar_apart_from_center_toggles():
    html = frontend_markup()
    left = html[html.index('id="column-left"') : html.index("</aside>")]
    actions = html[html.index('class="chat-session-actions"') : html.index('id="center-panels-empty"')]
    assert 'id="btn-history-messages"' in left
    assert 'aria-label="Mensajes"' in left
    assert 'id="btn-center-chat"' not in left
    assert 'id="btn-image-gallery"' not in left
    assert 'id="btn-history-messages"' not in actions
    assert 'id="btn-center-chat"' in actions
    assert 'id="btn-image-gallery"' in actions
    assert 'id="btn-image-queue"' in actions
