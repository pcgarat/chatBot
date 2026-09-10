"""UI: click derecho en un párrafo del mensaje para generar una imagen ahí."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLE_CSS = ROOT / "frontend" / "src" / "styles" / "style.css"


def test_text_context_menu_exists_in_html():
    html = frontend_markup()
    assert 'id="msg-text-context-menu"' in html
    assert 'data-action="illustrate-at"' in html
    assert "Generar imagen aquí" in html
    assert 'id="msg-text-copy"' in html


def test_js_maps_paragraph_and_calls_illustrate_at():
    js = frontend_source()
    assert "function bindMessageTextContextMenu" in js
    assert "function illustrateAtParagraph" in js
    assert "function paragraphIndexFromEventTarget" in js
    assert "data-paragraph-index" in js
    assert "data-owner-paragraph-index" in js
    assert "/illustrations/illustrate-at" in js
    assert "paragraph_index" in js
    assert "selected_excerpt" in js
    assert "contextmenu" in js
    at_fn = js.split("async function illustrateAtParagraph")[1].split(
        "async function runIllustrationStream"
    )[0]
    assert "readForgePanelParams()" in at_fn
    assert "illustrate-at" in at_fn


def test_plain_messages_wrap_paragraphs_for_click_targets():
    js = frontend_source()
    assert "function wrapNarrativeParagraphs" in js
    assert "function countNarrativeParagraphs" in js
    collapsible = js.split("function buildCollapsibleMessageHtml")[1].split(
        "function saveLastConversationId"
    )[0]
    assert "countNarrativeParagraphs(parts.first)" in collapsible
    assert "formatMessageHtml(parts.rest, restOffset)" in collapsible


def test_text_context_menu_css_is_fixed():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".msg-text-context-menu" in css
    block = css.split(".msg-text-context-menu {")[1].split("}")[0]
    assert "position: fixed" in block
