"""El composer inferior se puede ocultar; el stream ocupa el hueco."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"
STYLE_CSS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css"


def test_composer_has_collapse_and_expand_controls():
    html = frontend_markup()
    assert 'id="composer-panel"' in html
    assert 'id="btn-collapse-composer"' in html
    assert 'id="btn-expand-composer"' in html
    assert 'aria-controls="composer-panel"' in html
    assert "composerCollapsed" in html


def test_composer_collapse_persists_in_js():
    js = frontend_source()
    assert "initComposerCollapse" in js
    assert "composerCollapsed" in js
    assert "data-composer" in js
    assert "btn-collapse-composer" in js
    assert "btn-expand-composer" in js
    assert "composer-collapsed" in js


def test_composer_collapse_css_hides_panel_and_expands_stream():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert 'html[data-composer="collapsed"] .composer-panel' in css
    assert 'html[data-composer="collapsed"] .composer-expand-btn' in css
    assert ".chat-stream-wrap" in css
    # El stream ya es flex:1; al colapsar el composer debe quedar sin altura útil.
    collapsed = css.split('html[data-composer="collapsed"] .composer-panel')[1].split("}")[0]
    assert "max-height: 0" in collapsed or "max-height:0" in collapsed
    assert "opacity: 0" in collapsed or "opacity:0" in collapsed


def test_index_serves_composer_collapse_markup(client):
    r = client.get("/")
    assert r.status_code == 200
    html = frontend_markup()
    assert 'id="btn-collapse-composer"' in frontend_markup()
    assert 'id="btn-expand-composer"' in frontend_markup()
    assert 'id="composer-panel"' in frontend_markup()
