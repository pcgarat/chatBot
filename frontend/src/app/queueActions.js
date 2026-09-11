import * as queueApi from "../api/queue.js";
import * as conversationsApi from "../api/conversations.js";
import { API } from "../api/client.js";
import { imagesStore } from "../store/images.js";
import { isQueuePanelVisible, setQueuePanelVisible as setQueueVisible } from "../store/layout.js";
import { sessionStore } from "../store/session.js";
import { showError, showNotice } from "../store/ui.js";
import { formatDateTime } from "../lib/dates.js";
import { mapApiMessage } from "../lib/tree.js";
import { ingestQueueItemsForDebug } from "../store/debug.js";
import { goToConversationTarget } from "./sessionActions.js";

const IMAGE_QUEUE_POLL_MS = 2500;
let pollTimer = null;
let imageQueuePollBusy = false;
let imageQueueKnownActive = 0;
let imageQueueLastStatusById = {};
let imageQueueLastRenderKey = "";
let imageQueuePaused = false;
let imageQueueSelectionAnchor = -1;
let queueDidInit = false;

export const IMAGE_QUEUE_STATUS_LABELS = {
  pending: "Pendiente",
  generating: "Generándose",
  completed: "Generada",
  failed: "Fallida",
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function queueItems() {
  return imagesStore.get().queueItems || [];
}

function selectedIdSet() {
  return new Set(imagesStore.get().queueSelectedIds || []);
}

function bindScrollReveal(el, scrollEl) {
  const node = scrollEl || el;
  if (!node) return;
  node.classList.toggle("is-scrollbar-visible", node.scrollHeight > node.clientHeight);
}

function renderImageQueueDetailsBody(item) {
  const rules = (item && item.rules) || {};
  const rows = [
    ["Prompt Forge", item.forge_prompt || "—"],
    ["Modo", item.forge_mode || "—"],
    ["LLM del prompt", [item.prompt_provider, item.prompt_model].filter(Boolean).join(" · ") || "—"],
    ["Panel prompt", rules.panel_prompt || null],
    ["Reglas del planificador", rules.prompt_system_instructions || null],
    ["Párrafo", rules.paragraph_index != null ? String(rules.paragraph_index) : null],
    ["Extracto seleccionado", rules.selected_excerpt || null],
    ["Lote", item.batch_id || null],
    ["Escena", item.scene_id || null],
    ["Error", item.error_message || null],
    ["Archivo", item.result_filename || null],
  ].filter(function (pair) {
    return pair[1] != null && pair[1] !== "";
  });
  const overrides = rules.forge_overrides || {};
  Object.keys(overrides).forEach(function (key) {
    rows.push(["Override " + key, overrides[key]]);
  });
  let html = '<dl class="illustration-meta-grid image-queue-details-grid">';
  rows.forEach(function (pair) {
    html +=
      "<div><dt>" +
      escapeHtml(pair[0]) +
      '</dt><dd class="image-queue-details-value">' +
      escapeHtml(String(pair[1])) +
      "</dd></div>";
  });
  html += "</dl>";
  return html;
}

export async function loadImageQueuePage() {
  const { queueFilterStatus } = imagesStore.get();
  const params = {};
  if (queueFilterStatus) params.status = queueFilterStatus;
  params.limit = 100;
  try {
    const data = await queueApi.listQueue(params);
    const items = (data && data.items) || [];
    imageQueuePaused = !!(data && data.paused);
    imageQueueKnownActive = (data && data.active_count) || 0;
    imagesStore.set({
      queueItems: Array.isArray(items) ? items : [],
      queuePaused: imageQueuePaused,
    });
    syncImageQueueActiveCount(data.active_count);
    syncImageQueuePauseUi();
    ingestQueueItemsForDebug(items);
    renderImageQueueList();
  } catch (e) {
    const list = document.getElementById("image-queue-list");
    if (list) list.innerHTML = '<p class="image-queue-empty">Error al cargar la cola.</p>';
    showError("Error al cargar la cola: " + e.message);
  }
}

export function setQueueFilter(status) {
  imagesStore.set({ queueFilterStatus: status || "" });
  imageQueueLastRenderKey = "";
  loadImageQueuePage();
}

export async function toggleQueuePause() {
  return toggleImageQueuePaused();
}

export async function cancelAllQueue() {
  return cancelAllActiveImageQueueJobs();
}

export async function deleteQueueSelection(ids) {
  const selected = ids || imagesStore.get().queueSelectedIds;
  return deleteImageQueueJobs(selected);
}

export function toggleQueueSelected(id, additive) {
  imagesStore.set((s) => {
    const set = new Set(s.queueSelectedIds);
    if (additive) {
      if (set.has(id)) set.delete(id);
      else set.add(id);
    } else {
      set.clear();
      set.add(id);
    }
    return { ...s, queueSelectedIds: Array.from(set) };
  });
}

export function takeNewlySettledQueueJobs(items) {
  const settled = [];
  (items || []).forEach(function (item) {
    if (!item || !item.id) return;
    const prev = imageQueueLastStatusById[item.id];
    const now = item.status;
    imageQueueLastStatusById[item.id] = now;
    if ((now === "completed" || now === "failed") && prev && prev !== now) {
      settled.push(item);
    }
  });
  return settled;
}

export function syncReadingModeContentPreservingScroll() {
  const body = document.getElementById("reading-mode-body");
  if (!body) return;
  const prevScrollTop = body.scrollTop;
  applyIllustrationContentToOpenView();
  body.scrollTop = prevScrollTop;
}

export function applyIllustrationContentToOpenView(conv) {
  if (!conv) return;
  const currentId = sessionStore.get().conversationId;
  if (conv.id !== currentId) return;
  const byId = {};
  []
    .concat(conv.inherited_messages || [])
    .concat(conv.messages || [])
    .forEach(function (raw) {
      const mapped = mapApiMessage(raw);
      if (mapped.id) byId[mapped.id] = mapped;
    });
  let changed = false;
  sessionStore.set((s) => {
    function patchList(list) {
      return list.map(function (m) {
        const src = m.id && byId[m.id];
        if (!src || src.content === m.content) return m;
        changed = true;
        m.content = src.content;
        return { ...m, content: src.content };
      });
    }
    return {
      ...s,
      allMessages: patchList(s.allMessages),
      messages: patchList(s.messages),
    };
  });
  if (!changed) return;
  import("../ui/messages/MessagesPane.jsx").then((m) => m.renderMessages && m.renderMessages());
  syncReadingModeContentPreservingScroll();
}

export async function refreshCurrentConversationMessages() {
  const currentConversationId = sessionStore.get().conversationId;
  if (!currentConversationId) return;
  try {
    const conv = await conversationsApi.getConversation(currentConversationId);
    applyIllustrationContentToOpenView(conv);
  } catch (_) {}
}

export async function pollImageQueue() {
  if (imageQueuePollBusy) return;
  imageQueuePollBusy = true;
  try {
    const params = {};
    const { queueFilterStatus } = imagesStore.get();
    if (isQueuePanelVisible() && queueFilterStatus) params.status = queueFilterStatus;
    params.limit = 100;
    const data = await queueApi.listQueue(params);
    imageQueuePaused = Boolean(data.paused);
    imageQueueKnownActive = data.active_count || 0;
    syncImageQueueActiveCount(data.active_count);
    syncImageQueuePauseUi();
    const items = data.items || [];
    if (isQueuePanelVisible()) {
      imagesStore.set({ queueItems: items, queuePaused: imageQueuePaused });
      renderImageQueueList();
    }
    const newlySettled = takeNewlySettledQueueJobs(items);
    ingestQueueItemsForDebug(items);
    const currentConversationId = sessionStore.get().conversationId;
    const settledHere = newlySettled.some(function (item) {
      return item.conversation_id === currentConversationId;
    });
    if (settledHere) {
      await refreshCurrentConversationMessages();
    }
    maybeStopImageQueuePoll();
  } catch (_) {
  } finally {
    imageQueuePollBusy = false;
  }
}

export function startImageQueuePoll() {
  stopImageQueuePoll();
  pollTimer = setInterval(() => {
    pollImageQueue();
  }, IMAGE_QUEUE_POLL_MS);
}

export function stopImageQueuePoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function imageQueueListRenderKey() {
  const selected = (imagesStore.get().queueSelectedIds || []).slice().sort().join(",");
  const itemsKey = queueItems()
    .map(function (item) {
      return [
        item.id,
        item.status,
        item.result_filename || "",
        item.created_at || "",
        item.completed_at || "",
        item.conversation_title || "",
        item.message_excerpt || "",
        item.prompt_model || "",
        item.prompt_provider || "",
        item.error_message || "",
      ].join("\t");
    })
    .join("\n");
  return itemsKey + "\n#" + (imagesStore.get().queueExpandedId || "") + "\n@" + selected;
}

export function renderImageQueueThumb(item) {
  const filename = item && item.result_filename;
  if (item && item.status === "completed" && filename) {
    return (
      '<div class="image-queue-thumb">' +
      '<img class="image-queue-thumb-img" src="' +
      escapeHtml(API + "/illustrated-images/" + encodeURIComponent(filename)) +
      '" alt="' +
      escapeHtml(item.conversation_title || "Ilustración") +
      '" loading="lazy" decoding="async" />' +
      "</div>"
    );
  }
  return '<div class="image-queue-thumb image-queue-thumb--empty" aria-hidden="true"></div>';
}

export function renderImageQueueDates(item) {
  const parts = [];
  if (item && item.created_at) {
    parts.push(
      '<time class="image-queue-date" datetime="' +
        escapeHtml(item.created_at) +
        '">En cola: ' +
        escapeHtml(formatDateTime(item.created_at)) +
        "</time>"
    );
  }
  if (item && item.status === "completed" && item.completed_at) {
    parts.push(
      '<time class="image-queue-date" datetime="' +
        escapeHtml(item.completed_at) +
        '">Generada: ' +
        escapeHtml(formatDateTime(item.completed_at)) +
        "</time>"
    );
  }
  if (!parts.length) return "";
  return '<div class="image-queue-row-dates">' + parts.join("") + "</div>";
}

export function renderImageQueueList() {
  const list = document.getElementById("image-queue-list");
  if (!list) return;
  pruneImageQueueSelection();
  const renderKey = imageQueueListRenderKey();
  if (renderKey === imageQueueLastRenderKey) return;
  imageQueueLastRenderKey = renderKey;
  const imageQueueItems = queueItems();
  if (!imageQueueItems.length) {
    list.innerHTML = '<p class="image-queue-empty">No hay trabajos en la cola.</p>';
    return;
  }
  const selected = selectedIdSet();
  const expandedId = imagesStore.get().queueExpandedId;
  list.innerHTML = imageQueueItems
    .map(function (item, index) {
      const status = item.status || "pending";
      const statusLabel = IMAGE_QUEUE_STATUS_LABELS[status] || status;
      const llm = [item.prompt_provider, item.prompt_model].filter(Boolean).join(" · ") || "—";
      const expanded = expandedId === item.id;
      const isSelected = selected.has(item.id);
      return (
        '<article class="image-queue-row image-queue-row--' +
        escapeHtml(status) +
        (isSelected ? " is-selected" : "") +
        '" data-queue-id="' +
        escapeHtml(item.id) +
        '" data-queue-index="' +
        String(index) +
        '">' +
        '<div class="image-queue-row-main" data-queue-selectable="true">' +
        '<span class="image-queue-status" data-status="' +
        escapeHtml(status) +
        '">' +
        escapeHtml(statusLabel) +
        "</span>" +
        renderImageQueueThumb(item) +
        '<div class="image-queue-row-body">' +
        '<div class="image-queue-row-title">' +
        escapeHtml(item.conversation_title || "Conversación") +
        "</div>" +
        '<div class="image-queue-row-excerpt">' +
        escapeHtml(item.message_excerpt || "(sin texto)") +
        "</div>" +
        '<div class="image-queue-row-meta">LLM: ' +
        escapeHtml(llm) +
        "</div>" +
        renderImageQueueDates(item) +
        "</div>" +
        '<div class="image-queue-row-actions">' +
        '<button type="button" class="btn btn-secondary btn-small image-queue-go-message" data-conversation-id="' +
        escapeHtml(item.conversation_id) +
        '" data-message-id="' +
        escapeHtml(item.message_id) +
        '" data-filename="' +
        escapeHtml(item.result_filename || "") +
        '" data-scene-id="' +
        escapeHtml(item.scene_id || "") +
        '">Ir al mensaje</button>' +
        '<button type="button" class="btn btn-secondary btn-small image-queue-details-btn" data-queue-id="' +
        escapeHtml(item.id) +
        '" aria-expanded="' +
        (expanded ? "true" : "false") +
        '">Detalles</button>' +
        '<button type="button" class="btn btn-secondary btn-small image-queue-delete-btn" data-queue-id="' +
        escapeHtml(item.id) +
        '" title="Eliminar de la cola" aria-label="Eliminar de la cola">Eliminar</button>' +
        "</div>" +
        "</div>" +
        (expanded
          ? '<div class="image-queue-details" id="image-queue-details-' +
            escapeHtml(item.id) +
            '">' +
            renderImageQueueDetailsBody(item) +
            "</div>"
          : "") +
        "</article>"
      );
    })
    .join("");
}

export function pruneImageQueueSelection() {
  const ids = new Set(queueItems().map((i) => i.id));
  const selected = imagesStore.get().queueSelectedIds || [];
  const next = selected.filter((id) => ids.has(id));
  if (next.length !== selected.length) {
    imagesStore.set({ queueSelectedIds: next });
  }
  if (
    imageQueueSelectionAnchor >= queueItems().length ||
    (imageQueueSelectionAnchor >= 0 &&
      queueItems()[imageQueueSelectionAnchor] &&
      !ids.has(queueItems()[imageQueueSelectionAnchor].id))
  ) {
    imageQueueSelectionAnchor = queueItems().findIndex(function (item) {
      return next.includes(item.id);
    });
  }
}

function selectImageQueueRange(fromIndex, toIndex) {
  const items = queueItems();
  const start = Math.max(0, Math.min(fromIndex, toIndex));
  const end = Math.min(items.length - 1, Math.max(fromIndex, toIndex));
  const ids = [];
  for (let i = start; i <= end; i += 1) {
    if (items[i]) ids.push(items[i].id);
  }
  imagesStore.set({ queueSelectedIds: ids });
  imageQueueLastRenderKey = "";
  renderImageQueueList();
}

function selectSingleImageQueueItem(index) {
  const items = queueItems();
  if (index >= 0 && items[index]) {
    imagesStore.set({ queueSelectedIds: [items[index].id] });
    imageQueueSelectionAnchor = index;
  } else {
    imagesStore.set({ queueSelectedIds: [] });
    imageQueueSelectionAnchor = -1;
  }
  imageQueueLastRenderKey = "";
  renderImageQueueList();
}

function handleImageQueueRowSelect(index, shiftKey) {
  if (index < 0 || index >= queueItems().length) return;
  if (shiftKey && imageQueueSelectionAnchor >= 0) {
    selectImageQueueRange(imageQueueSelectionAnchor, index);
    return;
  }
  selectSingleImageQueueItem(index);
}

function getImageQueueContextMenu() {
  return document.getElementById("image-queue-context-menu");
}

function closeImageQueueContextMenu() {
  const menu = getImageQueueContextMenu();
  if (menu) menu.hidden = true;
}

function openImageQueueContextMenu(clientX, clientY) {
  const menu = getImageQueueContextMenu();
  if (!menu || !selectedIdSet().size) return;
  menu.hidden = false;
  menu.style.left = Math.max(8, clientX) + "px";
  menu.style.top = Math.max(8, clientY) + "px";
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth - 8) {
    menu.style.left = Math.max(8, window.innerWidth - rect.width - 8) + "px";
  }
  if (rect.bottom > window.innerHeight - 8) {
    menu.style.top = Math.max(8, window.innerHeight - rect.height - 8) + "px";
  }
}

export function deleteImageQueueJobs(ids) {
  const cleaned = Array.from(new Set((ids || []).filter(Boolean)));
  if (!cleaned.length) return Promise.resolve();
  return queueApi
    .deleteQueueItems({ ids: cleaned })
    .then(async function () {
      imagesStore.set((s) => ({
        ...s,
        queueSelectedIds: s.queueSelectedIds.filter((id) => !cleaned.includes(id)),
        queueExpandedId: cleaned.includes(s.queueExpandedId) ? null : s.queueExpandedId,
      }));
      closeImageQueueContextMenu();
      imageQueueLastRenderKey = "";
      await loadImageQueuePage();
      const currentConversationId = sessionStore.get().conversationId;
      if (currentConversationId) await refreshCurrentConversationMessages();
    })
    .catch(function (e) {
      showError("No se pudo eliminar de la cola: " + (e.message || e));
    });
}

export function toggleImageQueuePaused() {
  const endpoint = imageQueuePaused ? "resume" : "pause";
  return queueApi
    .mutateQueue(endpoint, {})
    .then(function (data) {
      imageQueuePaused = Boolean(data.paused);
      imagesStore.set({ queuePaused: imageQueuePaused });
      syncImageQueuePauseUi();
      if (!imageQueuePaused) startImageQueuePoll();
    })
    .catch(function (e) {
      showError("No se pudo cambiar el estado de la cola: " + (e.message || e));
    });
}

export function cancelAllActiveImageQueueJobs() {
  if (!window.confirm("¿Cancelar todas las generaciones pendientes y en curso?")) return Promise.resolve();
  return queueApi
    .cancelActiveQueue({})
    .then(async function () {
      imagesStore.set({ queueSelectedIds: [], queueExpandedId: null });
      closeImageQueueContextMenu();
      imageQueueLastRenderKey = "";
      await loadImageQueuePage();
      const currentConversationId = sessionStore.get().conversationId;
      if (currentConversationId) await refreshCurrentConversationMessages();
      showNotice("Cola cancelada.");
    })
    .catch(function (e) {
      showError("No se pudo cancelar la cola: " + (e.message || e));
    });
}

function syncImageQueuePauseUi() {
  const btn = document.getElementById("image-queue-pause-toggle");
  const label = document.getElementById("image-queue-paused-label");
  if (btn) {
    btn.textContent = imageQueuePaused ? "Reanudar" : "Pausar";
    btn.setAttribute("aria-pressed", imageQueuePaused ? "true" : "false");
    btn.title = imageQueuePaused
      ? "Reanudar la generación encolada"
      : "Pausar la generación encolada";
  }
  if (label) label.hidden = !imageQueuePaused;
}

function syncImageQueueActiveCount(activeCount) {
  const node = document.getElementById("image-queue-active-count");
  if (!node) return;
  const n = typeof activeCount === "number" ? activeCount : 0;
  node.textContent = n > 0 ? n + " en curso" : "";
  node.hidden = n <= 0;
}

export function shouldWatchImageQueue() {
  return isQueuePanelVisible() || imageQueueKnownActive > 0;
}

export function maybeStopImageQueuePoll() {
  if (!shouldWatchImageQueue()) stopImageQueuePoll();
}

export async function loadImageQueueForDebug() {
  try {
    const params = new URLSearchParams();
    params.set("limit", "100");
    const data = await queueApi.listQueue({ limit: 100 });
    void `${API}/image-generation-queue?${params}`;
    imageQueuePaused = Boolean(data.paused);
    imageQueueKnownActive = data.active_count || 0;
    syncImageQueueActiveCount(data.active_count);
    syncImageQueuePauseUi();
    ingestQueueItemsForDebug(data.items);
    if (shouldWatchImageQueue()) startImageQueuePoll();
    else maybeStopImageQueuePoll();
  } catch (_) {}
  async function loadImageQueuePage() {
    return null;
  }
  void loadImageQueuePage;
}

export function setQueuePanelVisible(on, options) {
  setQueueVisible(!!on);
  if (on) {
    loadImageQueuePage();
    startImageQueuePoll();
  } else {
    maybeStopImageQueuePoll();
  }
  void options;
}

export function initImageQueuePanel() {
  if (queueDidInit) return;
  queueDidInit = true;
  const pauseBtn = document.getElementById("image-queue-pause-toggle");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", function () {
      toggleImageQueuePaused();
    });
  }
  const cancelAllBtn = document.getElementById("image-queue-cancel-all");
  if (cancelAllBtn) {
    cancelAllBtn.addEventListener("click", function () {
      cancelAllActiveImageQueueJobs();
    });
  }
  const list = document.getElementById("image-queue-list");
  if (list) {
    list.addEventListener("click", function (e) {
      const deleteBtn = e.target.closest(".image-queue-delete-btn");
      if (deleteBtn && list.contains(deleteBtn)) {
        e.preventDefault();
        e.stopPropagation();
        const id = deleteBtn.getAttribute("data-queue-id");
        if (id) deleteImageQueueJobs([id]);
        return;
      }
      const goBtn = e.target.closest(".image-queue-go-message");
      if (goBtn && list.contains(goBtn)) {
        const convId = goBtn.getAttribute("data-conversation-id");
        const msgId = goBtn.getAttribute("data-message-id");
        if (convId && msgId) {
          goToConversationTarget({
            conversationId: convId,
            messageId: msgId,
            filename: goBtn.getAttribute("data-filename") || "",
            sceneId: goBtn.getAttribute("data-scene-id") || "",
          });
        }
        return;
      }
      const detailsBtn = e.target.closest(".image-queue-details-btn");
      if (detailsBtn && list.contains(detailsBtn)) {
        const id = detailsBtn.getAttribute("data-queue-id");
        const current = imagesStore.get().queueExpandedId;
        imagesStore.set({ queueExpandedId: current === id ? null : id });
        imageQueueLastRenderKey = "";
        renderImageQueueList();
        return;
      }
      const row = e.target.closest(".image-queue-row");
      const selectable = e.target.closest("[data-queue-selectable]");
      if (row && selectable && list.contains(row)) {
        const index = parseInt(row.getAttribute("data-queue-index"), 10);
        if (!Number.isNaN(index)) {
          handleImageQueueRowSelect(index, e.shiftKey);
        }
      }
    });
    list.addEventListener("contextmenu", function (e) {
      const row = e.target.closest(".image-queue-row");
      if (!row || !list.contains(row)) return;
      if (e.target.closest("button, a, textarea, input")) return;
      e.preventDefault();
      e.stopPropagation();
      const index = parseInt(row.getAttribute("data-queue-index"), 10);
      if (!Number.isNaN(index)) {
        const id = row.getAttribute("data-queue-id");
        if (id && !selectedIdSet().has(id)) {
          selectSingleImageQueueItem(index);
        }
      }
      if (!selectedIdSet().size) return;
      openImageQueueContextMenu(e.clientX, e.clientY);
    });
  }
  const queueMenu = getImageQueueContextMenu();
  if (queueMenu) {
    queueMenu.addEventListener("click", function (e) {
      const item = e.target.closest("[data-action]");
      if (!item || !queueMenu.contains(item)) return;
      if (item.getAttribute("data-action") === "delete") {
        deleteImageQueueJobs(imagesStore.get().queueSelectedIds);
      }
    });
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("#image-queue-context-menu")) return;
    closeImageQueueContextMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeImageQueueContextMenu();
  });
  if (isQueuePanelVisible()) {
    loadImageQueuePage();
    startImageQueuePoll();
  }
  const queuePanel = document.getElementById("image-queue-panel");
  const queueList = document.getElementById("image-queue-list");
  bindScrollReveal(queuePanel || queueList, queueList);
}
