"""Ilustraciones lazy dentro del colapso del mensaje deben poder llegar a verse."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "frontend" / "src" / "app.js"
STYLE_CSS = ROOT / "frontend" / "src" / "styles" / "style.css"


def _js() -> str:
    return APP_JS.read_text(encoding="utf-8")


def _css() -> str:
    return STYLE_CSS.read_text(encoding="utf-8")


def test_chat_illustration_css_reserves_layout_size_before_load():
    """
    Con height:auto y sin tamaño intrínseco, loading=lazy no dispara el IO
    (altura 0 → nunca intersecta el viewport). Hace falta min-height o aspect-ratio.
    """
    css = _css()
    block = re.search(r"\.chat-illustration\s*\{([^}]+)\}", css)
    assert block, "Falta regla .chat-illustration"
    body = block.group(1)
    has_size_hint = (
        "aspect-ratio" in body
        or "min-height" in body
        or re.search(r"\bheight\s*:\s*\d", body)
    )
    assert has_size_hint, (
        ".chat-illustration debe reservar alto (aspect-ratio/min-height) "
        "para que loading=lazy funcione tras expandir"
    )


def test_chat_illustration_does_not_force_a_single_aspect_ratio():
    """
    Las imágenes de Forge no son todas 3:2. Un aspect-ratio numérico en el
    <img> aplasta retrato y panorama al mismo recuadro.
    """
    css = _css()
    block = re.search(r"\.chat-illustration\s*\{([^}]+)\}", css)
    assert block, "Falta regla .chat-illustration"
    body = block.group(1)
    assert not re.search(r"aspect-ratio\s*:\s*[\d.]+", body), (
        ".chat-illustration no debe forzar una proporción fija "
        "(usar la intrínseca de cada imagen; min-height basta para lazy)"
    )
    assert re.search(r"height\s*:\s*auto", body)
    assert "min-height" in body


def test_expand_collapse_kicks_lazy_illustrations():
    """Al expandir un mensaje, hay que empujar las imgs lazy ocultas en display:none."""
    js = _js()
    assert "function kickLazyIllustrations" in js or "function revealLazyIllustrations" in js
    # El toggle de colapso debe invocar el kick al expandir
    toggle = re.search(
        r"msg-collapse-toggle[\s\S]{0,200}?addEventListener\([\s\S]{0,800}?willExpand[\s\S]{0,600}?\}",
        js,
    )
    assert toggle, "No se encontró el handler del toggle de colapso"
    body = toggle.group(0)
    assert (
        "kickLazyIllustrations" in body or "revealLazyIllustrations" in body
    ), "Al expandir (willExpand) debe llamar a kick/reveal de ilustraciones lazy"


def test_js_marks_broken_illustrations_on_error():
    js = _js()
    css = _css()
    enhance = js.split("function enhanceIllustrationFrames")[1].split("function kickLazyIllustrations")[0]
    assert 'addEventListener("error"' in enhance
    assert "chat-illustration-missing" in enhance
    assert ".chat-illustration-missing" in css
