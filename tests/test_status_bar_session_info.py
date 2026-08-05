"""Modelo activo, Ctx y preferencias viven en la barra de estado inferior."""
from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "app.js"


def _footer_block(html: str) -> str:
    start = html.index('id="app-status-bar"')
    end = html.index("</footer>", start)
    return html[start:end]


def _header_block(html: str) -> str:
    start = html.index('class="chat-panel-header"')
    end = html.index('<section class="chat-column"', start)
    return html[start:end]


def test_model_and_ctx_live_in_status_bar_right():
    html = INDEX_HTML.read_text(encoding="utf-8")
    footer = _footer_block(html)
    assert 'class="app-status-bar-right"' in footer
    assert 'id="header-provider-name"' in footer
    assert 'id="header-model-name"' in footer
    assert 'id="connection-status-dot"' in footer
    assert 'id="context-usage-row"' in footer
    assert 'id="context-usage-badge"' in footer
    assert 'id="dark-mode-toggle"' in footer
    assert 'id="auto-scroll-during-generation"' in footer


def test_header_no_longer_hosts_model_or_ctx():
    html = INDEX_HTML.read_text(encoding="utf-8")
    header = _header_block(html)
    assert 'id="header-provider-name"' not in header
    assert 'id="header-model-name"' not in header
    assert 'id="connection-status-dot"' not in header
    assert 'id="session-created-label"' not in header
    assert 'id="session-meta-row"' not in header
    assert "context-usage" not in header
    assert "Ctx" not in header


def test_status_bar_ctx_shows_used_and_available_detail():
    html = INDEX_HTML.read_text(encoding="utf-8")
    footer = _footer_block(html)
    assert 'id="context-usage-badge"' in footer
    assert 'id="context-usage-text"' in footer
    assert "status-bar-ctx-detail" in footer
    assert "visually-hidden" not in footer.split('id="context-usage-text"')[1].split(">")[0]
    js = APP_JS.read_text(encoding="utf-8")
    assert "0/${fmt(contextLength)}" in js or '0/" + fmt(contextLength)' in js or "`0/${fmt(contextLength)}`" in js
    assert "ventana" in js


def test_autoscroll_sits_beside_theme_toggle_in_status_bar():
    html = INDEX_HTML.read_text(encoding="utf-8")
    footer = _footer_block(html)
    auto_pos = footer.index('id="auto-scroll-during-generation"')
    theme_pos = footer.index('id="dark-mode-toggle"')
    assert auto_pos < theme_pos
    assert "status-bar-autoscroll" in footer
    assert "status-bar-theme" in footer


def test_context_usage_render_sets_status_bar_title(client):
    js = APP_JS.read_text(encoding="utf-8")
    assert "row.title =" in js
    assert "Contexto disponible" in js or "Prompt:" in js
    r = client.get("/")
    assert r.status_code == 200
    assert 'class="app-status-bar-right"' in r.text
    assert 'id="context-usage-row"' in r.text
    assert 'id="auto-scroll-during-generation"' in r.text
