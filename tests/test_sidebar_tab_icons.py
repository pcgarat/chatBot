"""Side tabs del panel derecho: solo icono, tooltip nativo, rail compacto."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "app" / "static" / "index.html"
STYLE = ROOT / "frontend" / "src" / "styles" / "style.css"

TABS = (
    ("sidebar-tab-reglas", "Reglas"),
    ("sidebar-tab-parametros", "Ajustes"),
    ("sidebar-tab-imagenes", "Imágenes"),
    ("sidebar-tab-preferencias", "Preferencias"),
)


def _rail_html() -> str:
    html = INDEX.read_text(encoding="utf-8")
    return html.split('class="sidebar-tab-rail"')[1].split("sidebar-tab-panels")[0]


def _button(html: str, tab_id: str) -> str:
    match = re.search(
        rf'<button[^>]*id="{tab_id}"[\s\S]*?</button>',
        html,
    )
    assert match, f"No está el tab {tab_id}"
    return match.group(0)


def test_side_tabs_have_no_visible_labels():
    rail = _rail_html()
    assert "sidebar-tab-label" not in rail
    for _, label in TABS:
        assert f">{label}<" not in rail


def test_side_tabs_use_native_tooltip_and_aria_label():
    html = INDEX.read_text(encoding="utf-8")
    for tab_id, label in TABS:
        btn = _button(html, tab_id)
        assert f'title="{label}"' in btn
        assert f'aria-label="{label}"' in btn
        assert "<svg" in btn


def test_side_tab_rail_is_compact_icon_well():
    css = STYLE.read_text(encoding="utf-8")
    rail = css.split(".sidebar-tab-rail {")[1].split("}")[0]
    assert "width: 40px" in rail
    tab = css.split(".sidebar-tab {")[1].split("}")[0]
    assert "height: 32px" in tab
    assert "min-height: 32px" in tab
    svg = css.split(".sidebar-tab svg {")[1].split("}")[0]
    assert "width: 18px" in svg
    assert "height: 18px" in svg
    assert ".sidebar-tab-label" not in css
    assert ".sidebar-tab--docked .sidebar-tab-label" not in css
