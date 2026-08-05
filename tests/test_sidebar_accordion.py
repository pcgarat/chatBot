"""El panel derecho usa acordeón (Reglas / Ajustes / Imágenes), no pestañas."""
from pathlib import Path

INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"


def test_right_panel_uses_main_accordion_not_tabs():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert 'class="sidebar-tabs-row sidebar-tabs"' not in html
    assert 'role="tablist"' not in html
    assert "sidebar-main-accordion" in html
    for section_id in ("reglas", "parametros", "imagenes"):
        assert f'data-accordion-section="{section_id}"' in html
    assert 'id="accordion-reglas-btn"' in html
    assert 'id="accordion-parametros-btn"' in html
    assert 'id="accordion-imagenes-btn"' in html


def test_index_endpoint_serves_accordion_markup(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.text
    assert "sidebar-main-accordion" in body
    assert "sidebar-tabs-row" not in body
