import * as conversationsApi from "../api/conversations.js";
import { showError, showNotice } from "../store/ui.js";
import {
  historyStore,
  isMessagesHistoryMode,
  persistConversationSort,
  persistLeftHistoryMode,
  persistMessageSort,
  MESSAGE_HISTORY_PAGE_SIZE,
  CONV_SORT_OPTIONS,
  MSG_SORT_OPTIONS,
  readStoredConversationSort,
  readStoredMessageSort,
} from "../store/history.js";
import { sessionStore, resetSession } from "../store/session.js";

let messageHistoryLoadSeq = 0;
let searchTimer = null;

export function mergeMessageHistoryItems(existing, incoming) {
  const seen = {};
  const out = [];
  (existing || []).concat(incoming || []).forEach((item) => {
    if (!item || !item.id || seen[item.id]) return;
    seen[item.id] = true;
    out.push(item);
  });
  return out;
}

export async function loadConversations() {
  const sort = readStoredConversationSort();
  try {
    const list = await conversationsApi.listConversations(sort);
    historyStore.set({ conversations: Array.isArray(list) ? list : [], loading: false });
    await loadDeletedConversations();
  } catch (e) {
    showError("Error al cargar conversaciones: " + e.message);
  }
}

export async function loadDeletedConversations() {
  try {
    const deleted = await conversationsApi.listDeletedConversations();
    historyStore.set({ deletedConversations: Array.isArray(deleted) ? deleted : [] });
  } catch (_) {
    historyStore.set({ deletedConversations: [] });
  }
}

export async function loadMessageHistory(options = {}) {
  const append = !!options.append;
  const seq = ++messageHistoryLoadSeq;
  const state = historyStore.get();
  const sort = readStoredMessageSort();
  const params = new URLSearchParams();
  params.set("sort", sort);
  params.set("limit", String(MESSAGE_HISTORY_PAGE_SIZE));
  params.set("offset", String(append ? state.messageHistoryItems.length : 0));
  const q = (state.messageHistoryQuery || "").trim();
  if (q) params.set("q", q);
  try {
    const data = await conversationsApi.listMessages(params);
    if (seq !== messageHistoryLoadSeq) return;
    const incoming = (data && data.items) || [];
    historyStore.set({
      messageHistoryItems: append ? mergeMessageHistoryItems(state.messageHistoryItems, incoming) : incoming,
      messageHistoryTotal: data && typeof data.total === "number" ? data.total : incoming.length,
      messageHistorySearchIn: data && data.search_in ? data.search_in : null,
      loading: false,
    });
  } catch (e) {
    if (seq !== messageHistoryLoadSeq) return;
    showError("Error al cargar mensajes: " + e.message);
  }
}

export async function refreshLeftHistory() {
  if (isMessagesHistoryMode()) return loadMessageHistory();
  return loadConversations();
}

export async function setLeftHistoryMode(mode) {
  const next = mode === "messages" ? "messages" : "conversations";
  persistLeftHistoryMode(next);
  historyStore.set({ mode: next });
  const root = document.documentElement;
  if (next === "messages") root.setAttribute("data-history-consulta", "on");
  else root.removeAttribute("data-history-consulta");
  await refreshLeftHistory();
}

export function onLeftHistorySortChange(value) {
  if (isMessagesHistoryMode()) {
    const sort = value === "image" ? "image" : "message";
    persistMessageSort(sort);
    historyStore.set({ messageSort: sort });
  } else {
    const sort = value === "created_at" ? "created_at" : "activity";
    persistConversationSort(sort);
    historyStore.set({ conversationSort: sort });
  }
  refreshLeftHistory();
}

export function onMessageHistorySearchInput(value) {
  historyStore.set({ messageHistoryQuery: value });
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    if (!isMessagesHistoryMode()) return;
    loadMessageHistory();
  }, 280);
}

export async function deleteConversationFromHistory(id) {
  try {
    await conversationsApi.deleteConversation(id);
    if (sessionStore.get().conversationId === id) resetSession();
    await refreshLeftHistory();
    showNotice("Conversación movida a la papelera.");
  } catch (e) {
    showError("Error al eliminar: " + e.message);
  }
}

export async function restoreConversationFromTrash(id) {
  try {
    await conversationsApi.restoreConversation(id);
    await refreshLeftHistory();
    const { openConversation } = await import("./sessionActions.js");
    await openConversation(id);
    showNotice("Conversación restaurada.");
  } catch (e) {
    showError("Error al restaurar: " + e.message);
  }
}

export async function clearConversationHistory(id) {
  try {
    await conversationsApi.clearConversationMessages(id);
    if (sessionStore.get().conversationId === id) {
      sessionStore.set({ messages: [], allMessages: [], activeLeafId: null, viewStartIndex: 0 });
    }
    showNotice("Historial de mensajes borrado.");
  } catch (e) {
    showError("Error al limpiar historial: " + e.message);
  }
}

export function syncLeftHistorySortControl() {
  return isMessagesHistoryMode() ? MSG_SORT_OPTIONS : CONV_SORT_OPTIONS;
}

export function currentLeftHistorySort() {
  const s = historyStore.get();
  return isMessagesHistoryMode(s) ? s.messageSort : s.conversationSort;
}

export function applyConsultaChrome() {
  const consulta = isMessagesHistoryMode();
  if (consulta) document.documentElement.setAttribute("data-history-consulta", "on");
  else document.documentElement.removeAttribute("data-history-consulta");
  const btn = document.getElementById("btn-history-messages");
  if (btn) btn.setAttribute("aria-pressed", isMessagesHistoryMode() ? "true" : "false");
  syncMessageHistoryChrome();
}

export function syncMessageHistoryChrome() {
  const show = isMessagesHistoryMode();
  const messageHistorySearchWrap = document.getElementById("message-history-search-wrap");
  const messageHistoryPager = document.getElementById("message-history-pager");
  if (messageHistorySearchWrap) messageHistorySearchWrap.hidden = !show;
  if (!show && messageHistoryPager) messageHistoryPager.hidden = true;
}

export function syncMessageHistoryActiveItem() {
  const list = document.getElementById("conversations-list");
  const focusId = sessionStore.get().focusMessageId || sessionStore.get().consultaAssistantId;
  if (!list) return;
  list.querySelectorAll(".message-history-item").forEach((node) => {
    node.classList.toggle("active", node.dataset.id === focusId);
  });
}

export function messageHistoryWhenIso(item, sort) {
  return sort === "image" && item.latest_image_at ? item.latest_image_at : item.created_at;
}

export function renderMessageHistoryPager() {
  return "Cargar más";
}
