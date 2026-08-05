"""Barra de estado en dark: fondo navy Win11 como los laterales."""
from pathlib import Path
import re

STYLE = Path(__file__).resolve().parents[1] / "app" / "static" / "css" / "style.css"


def test_dark_status_bar_uses_win11_sidebar_navy():
    css = STYLE.read_text(encoding="utf-8")
    matches = list(re.finditer(r'\[data-theme="dark"\] \.app-status-bar\s*\{', css))
    assert matches, "Falta estilo dark de app-status-bar"
    # Último bloque (prioridad de cascada)
    m = matches[-1]
    start = m.end()
    depth = 1
    i = start
    while i < len(css) and depth:
        if css[i] == "{":
            depth += 1
        elif css[i] == "}":
            depth -= 1
        i += 1
    body = css[start : i - 1]
    assert "#0a1830" in body
    assert "backdrop-filter: none" in body
