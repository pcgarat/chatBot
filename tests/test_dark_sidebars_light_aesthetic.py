"""Laterales en dark: paleta Windows 11 con bloom azul fuerte."""
from pathlib import Path
import re

STYLE_CSS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css"


def test_dark_side_columns_use_win11_blue_bloom():
    css = STYLE_CSS.read_text(encoding="utf-8")
    matches = list(
        re.finditer(
            r'\[data-theme="dark"\] \.column-left,\s*\[data-theme="dark"\] \.column-right\s*\{',
            css,
        )
    )
    assert matches, "Falta el bloque de laterales en dark"
    start = matches[-1].end()
    depth = 1
    i = start
    while i < len(css) and depth:
        if css[i] == "{":
            depth += 1
        elif css[i] == "}":
            depth -= 1
        i += 1
    body = css[start : i - 1]
    assert "color-scheme: dark" in body
    assert "--accent: #60cdff" in body
    assert "--text-primary: #ffffff" in body
    assert "rgba(0, 120, 212, 0.85)" in body
    assert "#0a1830" in body or "#04101f" in body
    assert "backdrop-filter: none" in body
    assert "#b8d4f0" not in body
    assert "--sidebar-foreground: #ffffff" in body


def test_dark_global_wallpaper_has_strong_blue_bloom():
    css = STYLE_CSS.read_text(encoding="utf-8")
    dark_root = css.split('[data-theme="dark"]', 1)[1].split("}", 1)[0]
    assert "rgba(0, 120, 212, 0.75)" in dark_root or "0.75)" in dark_root
