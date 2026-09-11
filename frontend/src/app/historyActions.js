import * as conversationsApi from "../api/conversations.js";
import * as messageTreeApi from "../api/messageTree.js";
import { showError, showNotice } from "../store/ui.js";
import {
  historyStore,
  isMessagesHistoryMode,
  persistConversationSort,
  persistLeftHistoryMode,
  persistMessageSort,
  MESSAGE_HISTORY_PAGE_SIZE,
  MESSAGE_TREE_ROOT_PAGE_SIZE,
  CONV_SORT_OPTIONS,
  MSG_SORT_OPTIONS,
  readStoredConversationSort,
  readStoredMessageSort,
} from "../store/history.js";
import { sessionStore, resetSession } from "../store/session.js";

let messageHistoryLoadSeq = 0;
let treeLoadSeq = 0;
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

export async function loadMessageTreeRoots(options = {}) {
  const append = !!options.append;
  const seq = ++treeLoadSeq;
  const state = historyStore.get();
  const offset = append ? (state.treeRoots || []).length : 0;
  try {
    const data = await messageTreeApi.listMessageTreeRoots({
      limit: MESSAGE_TREE_ROOT_PAGE_SIZE,
      offset,
    });
    if (seq !== treeLoadSeq) return;
    const incoming = (data && data.items) || [];
    const nextRoots = append ? (state.treeRoots || []).concat(incoming) : incoming;
    historyStore.set({
      treeRoots: nextRoots,
      treeRootsTotal: data && typeof data.total === "number" ? data.total : nextRoots.length,
      treeChildrenByParent: append ? state.treeChildrenByParent : {},
      treeExpandedIds: append ? state.treeExpandedIds : {},
      loading: false,
    });
    await loadDeletedConversations();
  } catch (e) {
    if (seq !== treeLoadSeq) return;
    showError("Error al cargar el árbol de mensajes: " + e.message);
  }
}

export async function loadMessageTreeChildren(messageId) {
  if (!messageId) return;
  try {
    const kids = await messageTreeApi.listMessageTreeChildren(messageId);
    const map = { ...(historyStore.get().treeChildrenByParent || {}) };
    map[messageId] = Array.isArray(kids) ? kids : [];
    historyStore.set({ treeChildrenByParent: map });
  } catch (e) {
    showError("Error al expandir el árbol: " + e.message);
  }
}

export async function toggleMessageTreeNode(messageId) {
  if (!messageId) return;
  const state = historyStore.get();
  const expanded = { ...(state.treeExpandedIds || {}) };
  if (expanded[messageId]) {
    delete expanded[messageId];
    historyStore.set({ treeExpandedIds: expanded });
    return;
  }
  expanded[messageId] = true;
  historyStore.set({ treeExpandedIds: expanded });
  if (!(state.treeChildrenByParent || {})[messageId]) {
    await loadMessageTreeChildren(messageId);
  }
}

export async function refreshMessageTreePreservingExpansion() {
  const prevExpanded = { ...(historyStore.get().treeExpandedIds || {}) };
  await loadMessageTreeRoots();
  const ids = Object.keys(prevExpanded);
  if (!ids.length) return;
  historyStore.set({ treeExpandedIds: prevExpanded });
  await Promise.all(ids.map((id) => loadMessageTreeChildren(id)));
}

export async function refreshLeftHistory() {
  if (isMessagesHistoryMode()) return loadMessageHistory();
  return loadMessageTreeRoots();
}

export async function setLeftHistoryMode(mode) {
  const next = "tree";
  persistLeftHistoryMode(next);
  historyStore.set({ mode: next });
  document.documentElement.removeAttribute("data-history-consulta");
  void mode;
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
    showError("Error al borrar: " + e.message);
  }
}

export async function restoreConversationFromTrash(id) {
  try {
    await conversationsApi.restoreConversation(id);
    await refreshLeftHistory();
    showNotice("Conversación restaurada.");
  } catch (e) {
    showError("Error al restaurar: " + e.message);
  }
}

export async function permanentlyDeleteFromTrash(id) {
  if (!window.confirm("¿Eliminar definitivamente esta conversación? No se podrá recuperar.")) {
    return;
  }
  try {
    await conversationsApi.permanentlyDeleteConversation(id);
    if (sessionStore.get().conversationId === id) resetSession();
    await refreshLeftHistory();
    showNotice("Conversación eliminada definitivamente.");
  } catch (e) {
    showError("Error al eliminar: " + e.message);
  }
}

export async function emptyTrash() {
  const n = (historyStore.get().deletedConversations || []).length;
  if (!n) return;
  if (!window.confirm(`¿Vaciar la papelera (${n})? No se podrá recuperar.`)) {
    return;
  }
  try {
    const result = await conversationsApi.purgeDeletedConversations();
    const currentId = sessionStore.get().conversationId;
    const purgedIds = (result && result.ids) || [];
    if (currentId && purgedIds.includes(currentId)) resetSession();
    await refreshLeftHistory();
    showNotice(
      "Papelera vaciada (" + ((result && result.deleted) || purgedIds.length || n) + ")."
    );
  } catch (e) {
    showError("Error al vaciar papelera: " + e.message);
  }
}

export async function clearConversationHistory(id) {
  try {
    await conversationsApi.clearConversationMessages(id);
    if (sessionStore.get().conversationId === id) {
      sessionStore.set({ messages: [], allMessages: [], activeLeafId: null, viewStartIndex: 0 });
    }
    await refreshLeftHistory();
    showNotice("Historial de mensajes limpiado.");
  } catch (e) {
    showError("Error al limpiar: " + e.message);
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
  document.documentElement.removeAttribute("data-history-consulta");
  const btn = document.getElementById("btn-history-messages");
  if (btn) btn.setAttribute("aria-pressed", "false");
  syncMessageHistoryChrome();
}

export function syncMessageHistoryChrome() {
  const messageHistorySearchWrap = document.getElementById("message-history-search-wrap");
  const messageHistoryPager = document.getElementById("message-history-pager");
  if (messageHistorySearchWrap) messageHistorySearchWrap.hidden = true;
  if (messageHistoryPager) messageHistoryPager.hidden = true;
  const sortWrap = document.getElementById("left-history-sort");
  if (sortWrap) sortWrap.hidden = true;
}

export function syncMessageHistoryActiveItem() {
  const list = document.getElementById("conversations-list");
  const focusId = sessionStore.get().focusMessageId || sessionStore.get().consultaAssistantId;
  historyStore.set({ treeSelectedMessageId: focusId || null });
  if (!list) return;
  list.querySelectorAll(".message-history-item, .message-tree-item").forEach((node) => {
    node.classList.toggle("active", node.dataset.id === focusId);
  });
}

export function messageHistoryWhenIso(item, sort) {
  return sort === "image" && item.latest_image_at ? item.latest_image_at : item.created_at;
}

export function renderMessageHistoryPager() {
  return "Cargar más";
}
