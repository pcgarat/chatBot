"""UI estática del prompt generator (txt2img)."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STYLE_CSS = ROOT / "frontend" / "src" / "styles" / "style.css"


def test_sidebar_has_txt2img_button_under_new():
    html = frontend_markup()
    assert 'id="btn-new-chat"' in html
    assert 'id="btn-prompt-generator"' in html
    assert "Nueva conversación" in html
    assert "Generador de prompts" in html
    assert ">txt2img<" not in html
    new_i = html.index('id="btn-new-chat"')
    pg_i = html.index('id="btn-prompt-generator"')
    assert new_i < pg_i
    new_block = html[new_i:pg_i]
    assert "<svg" not in new_block
    pg_end = html.index("</button>", pg_i)
    assert "<svg" not in html[pg_i:pg_end]


def test_composer_has_generate_prompt_button():
    html = frontend_markup()
    assert 'id="btn-generate-prompt"' in html
    assert 'aria-label="Generar prompt"' in html
    assert "composer-generate-prompt-icon" in html
    assert ">Generar prompt</button>" not in html


def test_css_generate_prompt_btn_matches_send_size_and_opacity():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert "#btn-generate-prompt.composer-generate-prompt-btn" in css
    # Mismo bloque de tamaño base que el botón enviar
    shared = css.index(
        ".composer-panel .send-button.composer-send-btn,\n"
        ".composer-panel .send-button.composer-generate-prompt-btn,\n"
        "#btn-send.composer-send-btn,\n"
        "#btn-generate-prompt.composer-generate-prompt-btn {"
    )
    shared_block = css[shared : shared + 280]
    assert "width: 36px" in shared_block
    assert "height: 36px" in shared_block
    # Opacidad 50% → 100% al hover
    gen_idx = css.index("opacity: 0.5", css.index("#btn-generate-prompt.composer-generate-prompt-btn {"))
    hover_idx = css.index(
        "#btn-generate-prompt.composer-generate-prompt-btn:hover",
        gen_idx,
    )
    assert "opacity: 1" in css[hover_idx : hover_idx + 200]


def test_js_wires_prompt_generator_flow():
    js = frontend_source()
    assert "newPromptGeneratorConversation" in js
    assert "sendPromptGeneratorTurn" in js
    assert "prompt-generator/turn" in js
    assert "splitTxt2imgPrompt" in js
    assert "txt2img-prompt-copy" in js
    assert 'kind: "prompt_generator"' in js
    assert "function onAppKeyDown" in js
    assert 't.id !== "message-input"' in js
    assert 'e.key !== "Enter"' in js
    assert "onComposerPrimaryClick()" in js


def test_css_prompt_block_styles():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".txt2img-prompt-block" in css
    assert ".sidebar-create-stack" in css
