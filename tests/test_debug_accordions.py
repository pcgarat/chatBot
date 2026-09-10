"""Debug y Debug imágenes: acordeones al pie del panel derecho, FIFO de sesión."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
STYLE = ROOT / "frontend" / "src" / "styles" / "style.css"


def _html() -> str:
    return frontend_markup()


def _js() -> str:
    return frontend_source()


def _css() -> str:
    return STYLE.read_text(encoding="utf-8")


def _debug_dock() -> str:
    html = _html()
    start = html.index('id="debug-dock"')
    end = html.index('id="app-status-bar"')
    return html[start:end]


def test_debug_dock_replaces_footer_toggles():
    html = _html()
    dock = _debug_dock()
    assert 'id="show-debug-mode"' not in html
    assert 'id="images-debug-mode"' not in html
    assert 'id="images-debug-window"' not in html
    assert 'id="debug-chat-toggle"' in dock
    assert 'id="debug-images-toggle"' in dock
    assert ">Debug<" in dock or ">Debug</span>" in dock
    assert "Debug imágenes" in dock
    assert 'id="chat-debug-log"' in dock
    assert 'id="images-debug-log"' in dock
    assert 'id="images-debug-stop"' in dock
    assert 'id="debug-chat-body"' in dock
    assert 'id="debug-images-body"' in dock


def test_debug_accordions_are_at_bottom_of_right_panel():
    html = _html()
    right = html.split('id="column-right"')[1].split('id="app-status-bar"')[0]
    assert right.index('id="tab-preferencias"') < right.index('id="debug-dock"')
    assert right.index('id="debug-dock"') < right.index('id="debug-chat-toggle"')


def test_debug_expanded_dock_takes_half_panel_height():
    css = _css()
    assert ".column-right.is-debug-expanded .debug-dock" in css
    block = css.split(".column-right.is-debug-expanded .debug-dock")[1].split("}")[0]
    assert "50%" in block


def test_js_opens_debug_panels_exclusively():
    js = _js()
    assert "function setDebugPanelOpen" in js
    fn = js.split("function setDebugPanelOpen")[1].split("\n  function ")[0]
    assert "chat" in fn and "images" in fn
    assert "is-debug-expanded" in fn
    assert "aria-expanded" in fn


def test_js_fifo_buffer_trims_oldest_entries():
    js = _js()
    assert "function createDebugLogBuffer" in js
    body = js.split("function createDebugLogBuffer")[1].split("\n  function ")[0]
    assert "items.shift()" in body
    assert "items.push(" in body
    assert "DEBUG_LOG_SIZE_" in js
    assert "chatbot_debug_log_size" in js


def test_js_collects_chat_debug_without_inline_message_blocks():
    js = _js()
    assert "function pushChatDebugEntry" in js
    assert "function updateChatDebugEntry" in js
    assert "message-debug-block" not in js
    assert "message-debug-stream" not in js
    assert "isShowDebugMode" not in js
    send = js.split("async function sendMessage")[1].split("function cancelLastMessage")[0]
    assert "pushChatDebugEntry" in send
    assert "updateChatDebugEntry" in send


def test_js_images_debug_always_records_llm_and_queue():
    js = _js()
    assert "function pushImagesDebugEntry" in js
    assert "function ingestQueueItemsForDebug" in js
    assert "include_prompt_debug: true" in js
    assert "include_prompt_debug: isShowDebugMode()" not in js
    assert 'if (data.type === "llm_debug" && isShowDebugMode())' not in js
    assert 'data.type === "llm_debug"' in js
    stream = js.split("async function runIllustrationStream")[1].split("(function initDarkMode")[0]
    assert "ephemeral_debug" not in stream
    assert "pushImagesDebugEntry" in stream or "appendImagesDebugLog" in stream


def test_generated_image_debug_entry_is_a_conversation_link():
    js = _js()
    assert "debug-image-link" in js
    assert "function openConversationAtIllustration" in js
    html = _html()
    assert "debug-image-link" in _js()
    assert 'id="images-debug-log"' in html


def test_preferences_interfaz_hosts_debug_log_size():
    html = _html()
    prefs = html.split('id="tab-preferencias"')[1].split("sidebar-footer")[0]
    assert 'id="pref-debug-log-decrease"' in prefs
    assert 'id="pref-debug-log-increase"' in prefs
    assert 'id="pref-debug-log-value"' in prefs
    assert "Historial de debug" in prefs
    image_row = prefs.index('id="pref-image-value"')
    debug_row = prefs.index('id="pref-debug-log-value"')
    dark_row = prefs.index('id="dark-mode-toggle"')
    assert image_row < debug_row < dark_row
    js = _js()
    assert "pref-debug-log-decrease" in js
    assert "setDebugLogSize" in js
    assert "DEBUG_LOG_SIZE_DEFAULT" in js
