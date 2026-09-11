"""Composer: un solo botón que alterna Enviar ↔ Detener durante el stream."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
STYLE = ROOT / "frontend" / "src" / "styles" / "style.css"


def test_composer_has_no_separate_stop_button():
    html = frontend_markup()
    assert 'id="btn-cancel-message"' not in html
    assert 'id="btn-send"' in html
    assert 'data-composer-action="send"' in html


def test_js_toggles_send_button_to_stop_while_streaming():
    js = frontend_source()
    assert "function setComposerPrimaryActionState" in js
    assert 'classList.toggle("is-stop"' in js
    assert "function onComposerPrimaryClick" in js
    assert "cancelLastMessage()" in js
    assert "onComposerPrimaryClick" in js
    assert "btnCancelMessage" not in js
    # No envío concurrente mientras hay abort controller
    assert "if (currentAbortController) return;" in js


def test_css_stop_mode_on_send_button():
    css = STYLE.read_text(encoding="utf-8")
    assert "#btn-send.composer-send-btn.is-stop" in css
    assert "btn-cancel-message" not in css


def test_send_button_is_white_with_blue_icon_and_border():
    css = STYLE.read_text(encoding="utf-8")
    # Azul navy del fondo de laterales dark (#0a1830)
    assert "fill='%230a1830'" in css or 'fill="%230a1830"' in css
    assert "#btn-send.composer-send-btn:not(.is-stop)" in css
    assert "border: 1px solid #0a1830" in css
    assert "background-color: #ffffff" in css
