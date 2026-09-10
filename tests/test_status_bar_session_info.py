"""Modelo activo y Ctx viven en la barra de estado inferior."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"


def _footer_block(html: str) -> str:
    start = html.index('id="app-status-bar"')
    end = html.index("</footer>", start)
    return html[start:end]


def _header_block(html: str) -> str:
    start = html.index('class="chat-panel-header"')
    end = html.index('<section class="chat-column"', start)
    return html[start:end]


def test_model_and_ctx_live_in_status_bar_right():
    html = frontend_markup()
    footer = _footer_block(html)
    assert 'class="app-status-bar-right"' in footer
    assert 'id="header-provider-name"' in footer
    assert 'id="header-model-name"' in footer
    assert 'id="connection-status-dot"' in footer
    assert 'id="context-usage-row"' in footer
    assert 'id="context-usage-badge"' in footer
    assert 'id="dark-mode-toggle"' not in footer
    assert 'id="auto-scroll-during-generation"' not in footer


def test_header_no_longer_hosts_model_or_ctx():
    html = frontend_markup()
    header = _header_block(html)
    assert 'id="header-provider-name"' not in header
    assert 'id="header-model-name"' not in header
    assert 'id="connection-status-dot"' not in header
    assert 'id="session-created-label"' not in header
    assert 'id="session-meta-row"' not in header
    assert "context-usage" not in header
    assert "Ctx" not in header


def test_status_bar_ctx_shows_used_and_available_detail():
    html = frontend_markup()
    footer = _footer_block(html)
    assert 'id="context-usage-badge"' in footer
    assert 'id="context-usage-text"' in footer
    assert "status-bar-ctx-detail" in footer
    assert "visually-hidden" not in footer.split('id="context-usage-text"')[1].split(">")[0]
    js = frontend_source()
    assert "0/${fmt(contextLength)}" in js or '0/" + fmt(contextLength)' in js or "`0/${fmt(contextLength)}`" in js
    assert "ventana" in js


def test_theme_and_autoscroll_live_in_preferences_not_status_bar():
    html = frontend_markup()
    footer = _footer_block(html)
    prefs = html.split('id="tab-preferencias"')[1].split("sidebar-footer")[0]
    assert 'id="dark-mode-toggle"' not in footer
    assert 'id="auto-scroll-during-generation"' not in footer
    assert 'id="dark-mode-toggle"' in prefs
    assert 'id="auto-scroll-during-generation"' in prefs


def test_context_usage_render_sets_status_bar_title(client):
    js = frontend_source()
    assert "row.title =" in js
    assert "Contexto disponible" in js or "Prompt:" in js
    r = client.get("/")
    assert r.status_code == 200
    assert 'class="app-status-bar-right"' in frontend_markup()
    assert 'id="context-usage-row"' in frontend_markup()
    assert 'id="auto-scroll-during-generation"' in frontend_markup()
    footer = r.text[r.text.index('id="app-status-bar"') : r.text.index("</footer>")]
    assert 'id="auto-scroll-during-generation"' not in footer
