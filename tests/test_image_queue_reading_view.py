"""Al terminar una imagen en cola, la lectura no debe cambiar de conversación ni mensaje."""
from pathlib import Path
import re

APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"


def _js() -> str:
    return APP_JS.read_text(encoding="utf-8")


def _fn(js: str, name: str, next_name: str) -> str:
    start = js.index(name)
    end = js.index(next_name, start + 1)
    return js[start:end]


def test_poll_does_not_reopen_conversation_when_any_job_finishes():
    """
    Regresión: si cae active_count, el poll recargaba SIEMPRE la conversación
    abierta (touched || prevActive), aunque la imagen fuera de otro hilo.
    """
    js = _js()
    poll = _fn(js, "async function pollImageQueue", "function startImageQueuePoll")
    assert "refreshCurrentConversationMessages" in poll
    assert "touched || prevActive" not in poll
    assert "setCurrentConversation" not in poll
    assert "openConversation(" not in poll
    assert "openConversationAtMessage" not in poll
    assert "openConsultaTurn" not in poll
    assert "refreshLeftHistory" not in poll


def test_poll_only_patches_when_settled_job_belongs_to_open_conversation():
    """Solo actualizar el texto visible si el job terminado es de la conversación actual."""
    js = _js()
    poll = _fn(js, "async function pollImageQueue", "function startImageQueuePoll")
    assert "conversation_id === currentConversationId" in poll
    assert "takeNewlySettledQueueJobs" in poll or "newlySettled" in poll
    assert "settledHere" in poll
    assert "await refreshCurrentConversationMessages" in poll
    settled_gate = poll[poll.index("settledHere") : poll.index("maybeStopImageQueuePoll")]
    assert "conversation_id === currentConversationId" in poll
    assert "refreshCurrentConversationMessages" in settled_gate


def test_refresh_from_queue_does_not_navigate_or_rebuild_left_panel():
    """
    setCurrentConversation limpia consulta y re-pinta el historial izquierdo:
    eso cambia el mensaje/conversación que el usuario está leyendo.
    """
    js = _js()
    refresh_fn = _fn(
        js,
        "async function refreshCurrentConversationMessages",
        "async function pollImageQueue",
    )
    assert "setCurrentConversation" not in refresh_fn
    assert "refreshLeftHistory" not in refresh_fn
    assert "consultaAssistantId" not in refresh_fn
    assert "openConversation" not in refresh_fn
    assert "applyConversationTree" not in refresh_fn


def test_in_place_patch_updates_content_without_changing_leaf_or_consulta():
    js = _js()
    assert "function applyIllustrationContentToOpenView" in js
    patch_fn = _fn(
        js,
        "function applyIllustrationContentToOpenView",
        "async function refreshCurrentConversationMessages",
    )
    assert "m.content" in patch_fn
    assert "renderMessages" in patch_fn
    assert "activeLeafId" not in patch_fn
    assert "consultaAssistantId" not in patch_fn
    assert "currentConversationId =" not in patch_fn
    assert "refreshLeftHistory" not in patch_fn


def test_reading_mode_is_not_scrolled_to_start_when_an_image_arrives():
    js = _js()
    assert "function syncReadingModeContentPreservingScroll" in js
    sync_fn = _fn(
        js,
        "function syncReadingModeContentPreservingScroll",
        "function applyIllustrationContentToOpenView",
    )
    assert "scrollTop" in sync_fn
    assert "scrollReadingBodyToStart" not in sync_fn
    patch_fn = _fn(
        js,
        "function applyIllustrationContentToOpenView",
        "async function refreshCurrentConversationMessages",
    )
    assert "syncReadingModeContentPreservingScroll" in patch_fn


def test_messages_container_disables_overflow_anchor():
    """Si una imagen carga por encima, overflow-anchor no debe empujar la lectura."""
    css = (Path(__file__).resolve().parents[1] / "frontend" / "src" / "styles" / "style.css").read_text(
        encoding="utf-8"
    )
    marker = ".messages-container {"
    assert marker in css
    body = css.split(marker, 1)[1].split("}", 1)[0]
    assert "overflow-anchor: none" in body
