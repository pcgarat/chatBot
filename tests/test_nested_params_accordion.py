"""Subacordeones de Ajustes: solo el panel hijo directo se abre con is-open."""
import re
from pathlib import Path

STYLE_CSS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css"
APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"
INDEX_HTML = Path(__file__).resolve().parents[1] / "app" / "static" / "index.html"


def test_accordion_open_max_height_uses_child_combinator_not_descendant():
    """
    Regresión: `.accordion-section.is-open .accordion-content` (sin >) hace que al
    abrir Ajustes todos los subpaneles anidados queden visibles aunque no tengan is-open.
    """
    css = STYLE_CSS.read_text(encoding="utf-8")
    buggy = re.search(
        r"\.accordion-section\.is-open\s+\.accordion-content\s*\{[^}]*max-height",
        css,
    )
    assert buggy is None, (
        "Selector descendente abre todos los .accordion-content anidados; "
        "usar .accordion-section.is-open > .accordion-content"
    )
    fixed = re.search(
        r"\.accordion-section\.is-open\s*>\s*\.accordion-content\s*\{[^}]*max-height",
        css,
    )
    assert fixed is not None


def test_ajustes_has_principal_param_accordion_sections():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert "sidebar-accordion-params" in html
    for section_id in (
        "params-presets",
        "params-contexto",
        "params-instruccion",
        "params-longitud",
        "params-aleatoriedad",
        "params-seguridad",
        "params-payload",
    ):
        assert f'data-accordion-section="{section_id}"' in html
    assert 'data-accordion-section="params-modelo"' not in html


def test_accordion_click_targets_closest_section_only():
    js = APP_JS.read_text(encoding="utf-8")
    assert 'btn.closest(".accordion-section")' in js
    assert "getSiblingAccordionSections" in js
    assert "setAccordionSectionOpen" in js
