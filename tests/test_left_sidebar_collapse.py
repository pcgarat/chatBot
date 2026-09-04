"""El historial izquierdo se puede ocultar y volver a mostrar."""
from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "app.js"


def test_left_sidebar_has_collapse_and_expand_controls():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert 'id="column-left"' in html
    assert 'id="btn-collapse-left"' in html
    assert 'id="btn-expand-left"' in html
    assert 'aria-controls="column-left"' in html
    assert "leftSidebarCollapsed" in html


def test_left_sidebar_collapse_persists_in_js():
    js = APP_JS.read_text(encoding="utf-8")
    assert "initLeftSidebarCollapse" in js
    assert "leftSidebarCollapsed" in js
    assert "data-sidebar-left" in js
    assert "btn-collapse-left" in js
    assert "btn-expand-left" in js


def test_conversation_list_is_single_line_dense():
    js = APP_JS.read_text(encoding="utf-8")
    assert "conv-when" in js
    conv_list_fn = js.split("function renderConversationsList")[1].split("function renderMessageHistoryList")[0]
    assert "conv-meta" not in conv_list_fn
    assert "conv-icon" not in conv_list_fn


def test_index_serves_sidebar_collapse_markup(client):
    r = client.get("/")
    assert r.status_code == 200
    assert 'id="btn-collapse-left"' in r.text
    assert 'id="btn-expand-left"' in r.text


def test_mensajes_button_sits_between_conversacion_and_galeria():
    html = INDEX_HTML.read_text(encoding="utf-8")
    chat = html.index('id="btn-center-chat"')
    messages = html.index('id="btn-history-messages"')
    gallery = html.index('id="btn-image-gallery"')
    assert chat < messages < gallery
    assert 'aria-label="Mensajes"' in html
