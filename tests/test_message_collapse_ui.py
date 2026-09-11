"""Colapso de mensajes: solo por acción del usuario; al abrir, ir al último."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "frontend" / "src" / "app.js"


def _js() -> str:
    return frontend_source()


def _fn(js: str, name: str, next_name: str) -> str:
    start = js.index(name)
    end = js.index(next_name, start + 1)
    return js[start:end]


def test_messages_default_expanded_collapse_is_opt_in():
    """Los mensajes colapsables empiezan abiertos; el set guarda los que el usuario plegó."""
    js = _js()
    assert "collapsedMessageKeys" in js
    assert "expandedMessageKeys" not in js
    build_fn = _fn(js, "function buildCollapsibleMessageHtml", "function saveLastConversationId")
    assert "collapsed" in build_fn
    render_fn = _fn(js, "function renderMessages", "function closeAllMessageContextMenus")
    assert "collapsedMessageKeys.has(collapseKey)" in render_fn
    assert "expandedMessageKeys.has(collapseKey)" not in render_fn
    toggle_block = render_fn[render_fn.index("msg-collapse-toggle") :]
    assert "collapsedMessageKeys.add(key)" in toggle_block
    assert "collapsedMessageKeys.delete(key)" in toggle_block


def test_collapse_all_marks_visible_messages_not_a_global_reset():
    """Colapsar todos es una acción del usuario: añade claves, no vacía un set de expandidos."""
    js = _js()
    collapse_fn = _fn(js, "function collapseAllMessages", "const illustrationInfoIconSvg")
    assert "collapsedMessageKeys.add" in collapse_fn
    assert "collapsedMessageKeys.clear()" not in collapse_fn


def test_refreshing_same_conversation_does_not_reset_collapse_or_force_scroll():
    """Al refrescar por imágenes/guardado no se pliegan mensajes ni se salta al final."""
    js = _js()
    set_fn = _fn(js, "async function setCurrentConversation", "let saveRulesDebounceTimer")
    assert "preserveView" in set_fn
    assert "collapsedMessageKeys.clear()" in set_fn
    refresh_fn = _fn(js, "async function refreshCurrentConversationMessages", "async function pollImageQueue")
    assert "setCurrentConversation" not in refresh_fn
    assert "applyIllustrationContentToOpenView" in refresh_fn
    save_fn = _fn(js, "async function saveConversation", "async function deleteMessageFromHistory")
    assert "preserveView: true" in save_fn
    open_fn = _fn(js, "async function openConversation", "async function openConsultaTurn")
    assert "preserveView" not in open_fn or "preserveView: true" not in open_fn


def test_open_conversation_always_scrolls_to_last_message():
    """Abrir una conversación lleva el panel al último mensaje, sin depender del auto-scroll."""
    js = _js()
    assert "function scrollMessagesToBottom" in js
    assert "function scheduleScrollMessagesToBottom" in js
    set_fn = _fn(js, "async function setCurrentConversation", "let saveRulesDebounceTimer")
    assert "scheduleScrollMessagesToBottom" in set_fn
    render_fn = _fn(js, "function renderMessages", "function closeAllMessageContextMenus")
    assert "prevScrollTop" in render_fn
    highlight_fn = _fn(js, "function scrollAndHighlightMessage", "async function openConversationAtMessage")
    assert "cancelScheduledScrollToBottom" in highlight_fn
