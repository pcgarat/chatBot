"""Al abrir un mensaje (consulta o lectura) el scroll debe quedar al inicio, no al final."""
from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"
STYLE_CSS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css"


def _js() -> str:
    return APP_JS.read_text(encoding="utf-8")


def _fn(js: str, name: str, next_name: str) -> str:
    start = js.index(name)
    end = js.index(next_name, start + 1)
    return js[start:end]


def _rule_body(css: str, selector: str) -> str:
    marker = f"{selector} {{"
    assert marker in css, f"Falta selector {selector}"
    return css.split(marker, 1)[1].split("}", 1)[0]


def test_open_consulta_scrolls_to_start_not_end():
    """Clic en modo Mensajes no debe dejar la respuesta larga anclada al final."""
    js = _js()
    assert "function scheduleScrollMessagesToTop" in js
    assert "function scrollMessagesToTop" in js
    set_fn = _fn(js, "async function setCurrentConversation", "let saveRulesDebounceTimer")
    assert "keepConsulta" in set_fn
    assert "scheduleScrollMessagesToTop" in set_fn
    open_fn = _fn(js, "async function openConsultaTurn", "async function newConversation")
    assert "keepConsulta: true" in open_fn
    assert "scheduleScrollMessagesToBottom" not in open_fn


def test_render_messages_does_not_force_bottom_in_consulta():
    """Auto-scroll al generar no puede empujar una consulta al final del mensaje."""
    js = _js()
    render_fn = _fn(js, "function renderMessages", "function closeAllMessageContextMenus")
    scroll_block = render_fn[render_fn.rindex("scheduleConversationImageFilter") :]
    assert "consulta" in scroll_block
    assert "scrollHeight" in scroll_block
    consulta_guard = scroll_block.index("consulta")
    height_assign = scroll_block.index("scrollHeight")
    assert consulta_guard < height_assign


def test_open_reading_mode_pins_scroll_to_start_after_layout():
    """scrollTop=0 síncrono no basta: el layout flex y las imágenes te dejan al final."""
    js = _js()
    fn = _fn(js, "function openReadingMode", "function closeReadingMode")
    assert "scrollReadingBodyToStart" in fn
    helper = _fn(js, "function scrollReadingBodyToStart", "function openReadingMode")
    assert "scrollTop = 0" in helper
    assert "requestAnimationFrame" in helper


def test_reading_mode_body_disables_overflow_anchor():
    """Si el contenido inicial cabe, overflow-anchor mantiene el ancla al final al crecer."""
    css = STYLE_CSS.read_text(encoding="utf-8")
    body = _rule_body(css, ".reading-mode-body")
    assert "overflow-anchor: none" in body
