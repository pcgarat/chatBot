"""UI estática del prompt generator (txt2img)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "app" / "static" / "index.html"
APP_JS = ROOT / "frontend" / "src" / "app.js"
STYLE_CSS = ROOT / "frontend" / "src" / "styles" / "style.css"


def test_sidebar_has_txt2img_button_under_new():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert 'id="btn-new-chat"' in html
    assert 'id="btn-prompt-generator"' in html
    assert ">txt2img<" in html or "txt2img</span>" in html
    new_i = html.index('id="btn-new-chat"')
    pg_i = html.index('id="btn-prompt-generator"')
    assert new_i < pg_i


def test_composer_has_generate_prompt_button():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert 'id="btn-generate-prompt"' in html
    assert "Generar prompt" in html


def test_js_wires_prompt_generator_flow():
    js = APP_JS.read_text(encoding="utf-8")
    assert "newPromptGeneratorConversation" in js
    assert "sendPromptGeneratorTurn" in js
    assert "prompt-generator/turn" in js
    assert "splitTxt2imgPrompt" in js
    assert "txt2img-prompt-copy" in js
    assert 'kind: "prompt_generator"' in js


def test_css_prompt_block_styles():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".txt2img-prompt-block" in css
    assert ".sidebar-create-stack" in css
