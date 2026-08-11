"""Debug de imágenes: el log se acumula siempre; al abrir la ventana se ve el histórico."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "static" / "js" / "app.js"


def _js() -> str:
    return APP_JS.read_text(encoding="utf-8")


def test_images_debug_log_is_buffered_independently_of_ui():
    """Debe existir un buffer en memoria; append registra siempre antes de filtrar UI."""
    js = _js()
    assert "imagesDebugLogLines" in js
    assert "function appendImagesDebugLog" in js
    assert "function syncImagesDebugWindow" in js

    m = re.search(
        r"function appendImagesDebugLog\s*\([^)]*\)\s*\{(.*?)\n  \}",
        js,
        re.DOTALL,
    )
    assert m, "No se encontró el cuerpo de appendImagesDebugLog"
    body = m.group(1)
    push_pos = body.find(".push(")
    assert push_pos >= 0, "appendImagesDebugLog debe hacer push al buffer"
    # Si hay early-return por modo UI, debe ir DESPUÉS del push
    ui_return = re.search(r"if\s*\(\s*!\s*isImagesDebugMode\s*\(\s*\)\s*\)\s*return", body)
    if ui_return:
        assert ui_return.start() > push_pos


def test_illustration_stream_always_requests_debug_logs():
    """El stream debe pedir debug al backend aunque la ventana esté cerrada."""
    js = _js()
    # No atar el flag del body al checkbox de UI
    assert re.search(r"debug\s*:\s*true", js)
    assert "debug: isImagesDebugMode()" not in js


def test_log_events_are_recorded_even_when_debug_ui_is_off():
    """Los eventos type=log del stream no deben filtrarse por isImagesDebugMode."""
    js = _js()
    assert 'if (data.type === "log" && isImagesDebugMode())' not in js
    assert 'if (data.type === "log")' in js


def test_opening_debug_syncs_full_buffer_to_window():
    """Al activar el checkbox se debe volcar el buffer completo a la ventana."""
    js = _js()
    assert "syncImagesDebugWindow" in js
    # persist / change del checkbox debe sincronizar (no solo win.hidden)
    persist_m = re.search(r"function persist\s*\(\s*\)\s*\{(.*?)\n    \}", js, re.DOTALL)
    assert persist_m, "No se encontró persist en initImagesPanel"
    assert "syncImagesDebugWindow" in persist_m.group(1)


def test_images_debug_buffer_declared_before_init_images_panel_call():
    """
    Regresión TDZ: initImagesPanel() no puede ejecutarse antes de
    `const imagesDebugLogLines` (ReferenceError en syncImagesDebugWindow).
    """
    js = _js()
    decl = js.find("const imagesDebugLogLines")
    assert decl >= 0, "Falta la declaración de imagesDebugLogLines"
    # Solo la llamada de arranque (indentación típica del init), no la definición
    call_matches = [
        m.start()
        for m in re.finditer(r"(?m)^\s*initImagesPanel\s*\(\s*\)\s*;", js)
    ]
    assert call_matches, "No se encontró la llamada initImagesPanel()"
    assert all(pos > decl for pos in call_matches), (
        "initImagesPanel() se llama antes de declarar imagesDebugLogLines "
        "(Temporal Dead Zone → Cannot access before initialization)"
    )
