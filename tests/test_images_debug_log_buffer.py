"""Debug de imágenes: el log se acumula siempre en un FIFO; al abrir el acordeón se ve el histórico."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app" / "static" / "js" / "app.js"


def _js() -> str:
    return APP_JS.read_text(encoding="utf-8")


def test_images_debug_log_is_buffered_independently_of_ui():
    """Debe existir un buffer en memoria; append registra siempre antes de filtrar UI."""
    js = _js()
    assert "function createDebugLogBuffer" in js
    assert "function pushImagesDebugEntry" in js
    assert "function appendImagesDebugLog" in js
    assert "function renderImagesDebugLog" in js

    m = re.search(
        r"function appendImagesDebugLog\s*\([^)]*\)\s*\{(.*?)\n  \}",
        js,
        re.DOTALL,
    )
    assert m, "No se encontró el cuerpo de appendImagesDebugLog"
    body = m.group(1)
    assert "pushImagesDebugEntry" in body
    assert re.search(r"if\s*\(\s*!\s*isImagesDebugMode\s*\(\s*\)\s*\)\s*return", body) is None


def test_illustration_stream_always_requests_debug_logs():
    """El stream debe pedir debug al backend aunque el acordeón esté cerrado."""
    js = _js()
    assert re.search(r"debug\s*:\s*true", js)
    assert "debug: isImagesDebugMode()" not in js
    assert "include_prompt_debug: true" in js


def test_log_events_are_recorded_even_when_debug_ui_is_off():
    """Los eventos type=log del stream no deben filtrarse por visibilidad del acordeón."""
    js = _js()
    assert 'if (data.type === "log" && isImagesDebugMode())' not in js
    assert 'if (data.type === "log")' in js


def test_opening_debug_syncs_full_buffer_to_panel():
    """Al abrir el acordeón se debe volcar el buffer completo."""
    js = _js()
    assert "renderImagesDebugLog" in js
    fn = js.split("function setDebugPanelOpen")[1].split("\n  function ")[0]
    assert "renderImagesDebugLog" in fn
    assert "renderChatDebugLog" in fn


def test_images_debug_loads_queue_without_opening_cola():
    """El log de Debug imágenes no puede depender de haber abierto el panel Cola."""
    js = _js()
    assert "function loadImageQueueForDebug" in js
    load_fn = re.search(
        r"async function loadImageQueueForDebug\s*\([^)]*\)\s*\{(.*?)\n  async function loadImageQueuePage",
        js,
        re.DOTALL,
    )
    assert load_fn, "No se encontró el cuerpo de loadImageQueueForDebug"
    body = load_fn.group(1)
    assert "ingestQueueItemsForDebug" in body
    assert "/image-generation-queue" in body
    assert "isQueuePanelVisible" not in body
    assert "renderImageQueueList" not in body
    open_fn = js.split("function setDebugPanelOpen")[1].split("\n  function ")[0]
    assert "loadImageQueueForDebug" in open_fn


def test_closing_cola_does_not_unconditionally_stop_queue_poll():
    """Cerrar Cola no debe cortar el watch si Debug imágenes o hay jobs activos."""
    js = _js()
    assert "function maybeStopImageQueuePoll" in js
    assert "function shouldWatchImageQueue" in js
    watch = js.split("function shouldWatchImageQueue")[1].split("\n  function ")[0]
    assert "isQueuePanelVisible" in watch
    assert "imageQueueKnownActive" in watch
    close_fn = js.split("function setQueuePanelVisible")[1].split("\n  function ")[0]
    assert "maybeStopImageQueuePoll" in close_fn
    assert re.search(
        r"else if\s*\(\s*!on\s*\)\s*\{\s*stopImageQueuePoll\s*\(\s*\)\s*;",
        close_fn,
        re.DOTALL,
    ) is None
    poll = js.split("async function pollImageQueue")[1].split("\n  function ")[0]
    assert "maybeStopImageQueuePoll" in poll
    assert "isQueuePanelVisible()) {\n        stopImageQueuePoll" not in poll


def test_images_debug_buffer_declared_before_init_images_panel_call():
    """
    Regresión TDZ: initImagesPanel() no puede ejecutarse antes de
    declarar el buffer de debug de imágenes.
    """
    js = _js()
    decl = js.find("function createDebugLogBuffer")
    assert decl >= 0, "Falta createDebugLogBuffer"
    push_decl = js.find("function pushImagesDebugEntry")
    assert push_decl >= 0, "Falta pushImagesDebugEntry"
    call_matches = [
        m.start()
        for m in re.finditer(r"(?m)^\s*initImagesPanel\s*\(\s*\)\s*;", js)
    ]
    assert call_matches, "No se encontró la llamada initImagesPanel()"
    assert all(pos > decl and pos > push_decl for pos in call_matches), (
        "initImagesPanel() se llama antes de declarar el buffer de debug de imágenes "
        "(Temporal Dead Zone → Cannot access before initialization)"
    )
