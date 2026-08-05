"""Footer derecho: sin título Diagnóstico; switches de debug compactos."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "app" / "static" / "index.html"
STYLE = ROOT / "app" / "static" / "css" / "style.css"


def test_diagnostics_footer_has_no_title():
    html = INDEX.read_text(encoding="utf-8")
    start = html.index('sidebar-footer-diagnostics')
    end = html.index("</div>", start) + 6
    block = html[start:end]
    assert "Diagnóstico" not in block
    assert 'id="diagnostics-heading"' not in block
    assert 'id="show-debug-mode"' in block
    assert 'id="images-debug-mode"' in block


def test_debug_footer_switches_are_compact():
    css = STYLE.read_text(encoding="utf-8")
    assert ".sidebar-footer-diagnostics .fluent-switch-track" in css
    m = re.search(
        r"\.sidebar-footer-diagnostics \.fluent-switch-track\s*\{([^}]+)\}",
        css,
    )
    assert m, "Falta tamaño compacto de switch en footer debug"
    body = m.group(1)
    assert "width: 26px" in body
    assert "height: 14px" in body
