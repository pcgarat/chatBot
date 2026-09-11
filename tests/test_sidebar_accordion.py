"""El panel derecho usa side tabs (Reglas / Ajustes / Imágenes)."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"
APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"


def test_right_panel_uses_vertical_side_tabs():
    html = frontend_markup()
    assert 'class="sidebar-tabs-row sidebar-tabs"' not in html
    assert "sidebar-main-accordion" not in html
    assert 'class="sidebar-side-layout"' in html
    assert 'role="tablist"' in html
    assert 'aria-orientation="vertical"' in html
    for tab_id, panel_id in (
        ("sidebar-tab-reglas", "tab-reglas"),
        ("sidebar-tab-parametros", "tab-parametros"),
        ("sidebar-tab-imagenes", "tab-imagenes"),
        ("sidebar-tab-preferencias", "tab-preferencias"),
    ):
        assert f'id="{tab_id}"' in html
        assert f'id="{panel_id}"' in html
        assert f'aria-controls="{panel_id}"' in html
        assert 'role="tab"' in html
        assert 'role="tabpanel"' in html
    assert 'id="accordion-reglas-btn"' not in html
    assert 'id="accordion-parametros-btn"' not in html
    assert 'id="accordion-imagenes-btn"' not in html


def test_index_endpoint_serves_side_tabs_markup(client):
    r = client.get("/")
    assert r.status_code == 200
    body = frontend_markup()
    assert "sidebar-side-layout" in body
    assert 'role="tablist"' in body
    assert "sidebar-main-accordion" not in body
    assert "sidebar-tabs-row" not in body


def test_reglas_subsections_are_principal_stacked_not_accordion():
    html = frontend_markup()
    reglas = html.split('id="tab-reglas"')[1].split('id="tab-parametros"')[0]
    assert 'id="rules-active-heading"' in reglas
    assert 'id="rules-library-heading"' in reglas
    assert 'id="rules-create-heading"' in reglas
    assert "accordion-section" not in reglas
    assert "accordion-header" not in reglas


def test_ajustes_subsections_are_principal_accordion():
    html = frontend_markup()
    ajustes = html.split('id="tab-parametros"')[1].split('id="tab-imagenes"')[0]
    assert "sidebar-accordion-params" in ajustes
    for section_id in (
        "params-presets",
        "params-contexto",
        "params-instruccion",
        "params-longitud",
        "params-aleatoriedad",
        "params-seguridad",
        "params-payload",
    ):
        assert f'data-accordion-section="{section_id}"' in ajustes
    assert 'data-accordion-section="params-modelo"' not in ajustes
    assert 'data-accordion-section="parametros"' not in html


def test_imagenes_subsections_are_principal_accordion():
    html = frontend_markup()
    imagenes = html.split('id="tab-imagenes"')[1].split('id="tab-preferencias"')[0]
    for section_id in (
        "images-activation",
        "images-planner",
        "images-planner-rules",
        "images-limits",
        "images-forge",
        "images-forge-params",
        "images-reactor",
    ):
        assert f'data-accordion-section="{section_id}"' in imagenes
    assert 'data-accordion-section="imagenes"' not in html
    assert 'id="images-activation-heading"' in imagenes
    assert 'id="images-planner-rules-heading"' in imagenes
    assert 'id="images-limits-heading"' in imagenes


def test_js_switches_sidebar_tabs_and_persists():
    js = frontend_source()
    assert "function initSidebarTabs" in js
    assert "function setSidebarTab" in js
    assert "SIDEBAR_TAB_STORAGE_KEY" in js
    assert "localStorage.setItem(SIDEBAR_TAB_STORAGE_KEY" in js
    assert "ensureExclusiveMainAccordion" not in js
    assert "migrateSidebarTabToAccordionState" not in js
    assert "ArrowDown" in js
    assert "querySelectorAll(\".sidebar-tab-panel\")" in js
    assert "panel.hidden = !on" in js
    assert "dataset.sidebarPanel" in js
