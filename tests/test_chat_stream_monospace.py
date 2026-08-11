"""El stream de conversación usa tipografía monospace."""
from pathlib import Path

STYLE_CSS = Path(__file__).resolve().parents[1] / "app" / "static" / "css" / "style.css"


def _rule_body(css: str, selector: str) -> str:
    marker = f"{selector} {{"
    assert marker in css, f"Falta selector {selector}"
    return css.split(marker, 1)[1].split("}", 1)[0]


def test_chat_stream_uses_monospace_font():
    css = STYLE_CSS.read_text(encoding="utf-8")
    body = _rule_body(css, ".chat-stream")
    assert "font-family: var(--font-family-mono)" in body


def test_reading_mode_body_uses_monospace_font():
    css = STYLE_CSS.read_text(encoding="utf-8")
    body = _rule_body(css, ".reading-mode-body")
    assert "font-family: var(--font-family-mono)" in body


def test_font_family_mono_token_defined():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert "--font-family-mono:" in css
