"""Composer: sin icono >_; instrucción temporal centrada."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "app" / "static" / "index.html"
STYLE_CSS = ROOT / "app" / "static" / "css" / "style.css"


def test_composer_has_no_prompt_icon():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert "composer-instruction-icon" not in html
    assert 'id="message-input"' in html
    assert 'id="instruction-override"' in html


def test_instruction_input_text_is_centered():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".composer-panel .inline-input.instruction-input" in css
    idx = css.index(".composer-panel .inline-input.instruction-input {")
    block = css[idx : idx + 280]
    assert "text-align: center" in block


def test_index_serves_composer_without_prompt_icon(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "composer-instruction-icon" not in r.text
    assert 'id="instruction-override"' in r.text
