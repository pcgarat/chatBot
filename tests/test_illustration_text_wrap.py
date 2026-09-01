"""El texto del relato debe ocupar el hueco al lado de las ilustraciones."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "static" / "js" / "app.js"
STYLE_CSS = ROOT / "app" / "static" / "css" / "style.css"


def _js() -> str:
    return APP_JS.read_text(encoding="utf-8")


def _css() -> str:
    return STYLE_CSS.read_text(encoding="utf-8")


def _rule(css: str, selector: str) -> str:
    pattern = rf"(?<![-\w]){re.escape(selector)}\s*\{{([^}}]+)\}}"
    match = re.search(pattern, css)
    assert match, f"Falta regla {selector}"
    return match.group(1)


def test_illustration_frame_floats_left_so_text_can_wrap():
    body = _rule(_css(), ".chat-illustration-frame")
    assert re.search(r"float\s*:\s*left", body)
    assert re.search(r"clear\s*:\s*both", body)
    assert "1rem" in body


def test_illustration_placeholder_floats_like_the_image():
    body = _rule(_css(), ".chat-illustration-placeholder")
    assert re.search(r"float\s*:\s*left", body)
    assert re.search(r"clear\s*:\s*both", body)


def test_reading_mode_does_not_center_illustrations():
    css = _css()
    assert ".reading-mode-body .chat-illustration-frame" not in css
    assert ".reading-mode-body .chat-illustration {" not in css


def test_message_content_is_block_and_contains_floats():
    css = _css()
    grouped = re.search(
        r"\.message-content,\s*\.message-content-preview,\s*\.message-content-rest\s*\{([^}]+)\}",
        css,
    )
    assert grouped, "Faltan wrappers de contenido en bloque"
    assert re.search(r"display\s*:\s*block", grouped.group(1))
    after = css.split(".message-content::after")[1].split("}")[0]
    assert "clear: both" in after or "clear:both" in after


def test_narrow_prose_disables_float():
    css = _css()
    assert "container-name: chat-prose" in css
    assert "@container chat-prose (max-width: 28rem)" in css
    query = css.split("@container chat-prose (max-width: 28rem)")[1].split("}")[0]
    assert "float: none" in query


def test_format_message_trims_breaks_beside_illustrations():
    js = _js()
    assert "function trimIllustrationAdjacentWhitespace" in js
    fn = re.search(
        r"function trimIllustrationAdjacentWhitespace\([\s\S]*?\n  \}",
        js,
    )
    assert fn, "No se encontró trimIllustrationAdjacentWhitespace"
    body = fn.group(0)
    assert 'replace(/^[ \\t]*\\n+/, "")' in body
    assert "trimIllustrationAdjacentWhitespace(tokens)" in js


def test_illustration_unit_contains_the_float():
    css = _css()
    assert ".illustration-unit" in css
    unit_after = css.split(".illustration-unit::after")[1].split("}")[0]
    assert "clear: both" in unit_after or "clear:both" in unit_after


def test_illustration_lead_clears_previous_image_row():
    body = _rule(_css(), ".illustration-lead")
    assert re.search(r"clear\s*:\s*both", body)
    assert re.search(r"display\s*:\s*block", body)


def test_layout_keeps_pre_image_paragraph_out_of_wrap_unit():
    """
    Párrafo previo a cada imagen: fila completa.
    Párrafos siguientes: a la derecha de esa imagen, menos el previo a la siguiente.
    """
    js = _js()
    assert "function layoutIllustratedHtml" in js
    fn = re.search(r"function layoutIllustratedHtml\([\s\S]*?\n  \}", js)
    assert fn, "No se encontró layoutIllustratedHtml"
    body = fn.group(0)
    assert "illustration-lead" in body
    assert "illustration-unit" in body
    assert "illustration-wrap" in body
    assert "slice(0, -1)" in body or "slice(0,-1)" in body
    assert "formatMessageHtml" in js
    assert "layoutIllustratedHtml(tokens" in js
    assert "narrativeParagraphHtml" in body
    assert "data-owner-paragraph-index" in body
    assert "data-paragraph-index" in js


def test_message_html_uses_block_wrappers():
    js = _js()
    assert 'class="message-content"' in js
    assert 'class="message-content-preview"' in js
    assert 'class="message-content-rest"' in js
    assert '<span class="message-content-preview">' not in js
    assert "<span>${formatMessageHtml" not in js
