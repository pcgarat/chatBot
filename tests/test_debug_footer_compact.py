"""Footer derecho: acordeones de debug, sin switches compactos."""
from pathlib import Path

from tests.frontend_source import frontend_markup

ROOT = Path(__file__).resolve().parents[1]
STYLE = ROOT / "frontend" / "src" / "styles" / "style.css"


def test_diagnostics_footer_has_no_title():
    html = frontend_markup()
    start = html.index('id="debug-dock"')
    end = html.index('id="app-status-bar"')
    block = html[start:end]
    assert "Diagnóstico" not in block
    assert 'id="diagnostics-heading"' not in block
    assert 'id="debug-chat-toggle"' in block
    assert 'id="debug-images-toggle"' in block
    assert 'id="show-debug-mode"' not in block
    assert 'id="images-debug-mode"' not in block


def test_debug_dock_headers_are_compact():
    css = STYLE.read_text(encoding="utf-8")
    assert ".debug-accordion-toggle" in css
    assert ".debug-dock" in css
