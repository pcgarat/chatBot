"""Header de sesión del panel central: identidad + acción destructiva."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"
STYLE_CSS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css"


def test_chat_panel_header_groups_identity_and_delete_action():
    html = frontend_markup()
    assert 'class="chat-panel-header"' in html
    assert 'class="chat-session-identity"' in html
    assert 'class="chat-session-actions"' in html
    assert 'id="conversation-title"' in html
    assert 'id="conversation-auto-title"' not in html
    assert "auto-title-check" not in html
    assert 'id="session-meta-row"' not in html
    assert 'id="session-created-label"' not in html
    assert 'id="btn-clear-memory"' in html
    assert "chat-delete-btn" in html
    assert "icon-btn-danger" in html
    identity_start = html.index('class="chat-session-identity"')
    identity_end = html.index('class="chat-session-actions"')
    identity_block = html[identity_start:identity_end]
    assert 'id="conversation-title"' in identity_block
    assert 'id="conversation-auto-title"' not in identity_block
    assert 'id="conversation-image-filter-notice"' in identity_block
    assert "Filtros de imágenes activos" in identity_block
    assert "conversation-image-filter-notice-dismiss" in identity_block
    assert 'id="btn-clear-memory"' not in identity_block
    assert "context-usage" not in identity_block
    assert "Ctx" not in identity_block
    assert 'id="btn-center-chat"' not in identity_block
    actions = html[html.index('class="chat-session-actions"') : html.index('id="center-panels-empty"')]
    assert 'id="btn-center-chat"' in actions
    assert 'id="btn-image-gallery"' in actions
    assert 'id="btn-image-queue"' in actions
    assert 'id="btn-clear-memory"' in actions
    assert actions.index('id="btn-center-chat"') < actions.index('id="btn-image-gallery"') < actions.index('id="btn-image-queue"') < actions.index('id="btn-clear-memory"')


def test_chat_panel_header_has_distinct_surface_and_danger_icon_styles():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert "--chat-header-bg" in css
    assert ".chat-panel-header" in css
    assert "box-shadow: inset 3px 0 0 0 var(--accent)" in css
    assert ".chat-delete-btn.icon-btn-danger" in css
    assert "color: var(--icon-danger)" in css
    assert ".center-view-toggle" in css
    assert ".chat-session-actions" in css
    assert "container-name: chat-title" in css


def test_index_serves_session_header_markup(client):
    r = client.get("/")
    assert r.status_code == 200
    assert 'class="chat-session-identity"' in frontend_markup()
    assert 'id="conversation-auto-title"' not in frontend_markup()
    assert 'id="btn-clear-memory"' in frontend_markup()
    assert "chat-delete-btn" in frontend_markup()
    assert 'id="btn-center-chat"' in frontend_markup()
    assert "center-view-toggle" in frontend_markup()


def test_js_persiste_titulo_al_cambiar_el_input():
    """El título se guarda al confirmar el input; no depende de un botón Guardar ausente."""
    js = frontend_source()
    html = frontend_markup()
    assert 'id="btn-save"' not in html
    assert "commitConversationTitle" in js
    assert 'el.conversationTitle.addEventListener("change"' in js
    assert "auto_title: false" in js
    assert "title," in js or "title }" in js or "{ title" in js


def test_js_editar_titulo_desactiva_auto_title_sin_checkbox():
    js = frontend_source()
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert "commitAutoTitleFlag" not in js
    assert "applyAutoTitleUi" in js
    assert "readOnly = currentAutoTitle" not in js
    assert 'id="conversation-auto-title"' not in frontend_markup()
    assert ".auto-title-check" not in css
    assert "auto_title: false" in js
