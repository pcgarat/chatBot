import * as queueApi from "../api/queue.js";
import * as conversationsApi from "../api/conversations.js";
import { API } from "../api/client.js";
import { imagesStore } from "../store/images.js";
import { layoutStore, isQueuePanelVisible, setQueuePanelVisible as setQueueVisible } from "../store/layout.js";
import { debugStore } from "../store/debug.js";
import { sessionStore } from "../store/session.js";
import { showError, showNotice } from "../store/ui.js";
import { formatDateTime } from "../lib/dates.js";
import { mapApiMessage } from "../lib/tree.js";
import { ingestQueueItemsForDebug } from "../store/debug.js";

const IMAGE_QUEUE_POLL_MS = 2500;
let pollTimer = null;
let pollBusy = false;
let imageQueuePollBusy = false;
let imageQueueKnownActive = 0;
let imageQueueLastStatusById = {};
let imageQueueLastRenderKey = "";
let imageQueuePaused = false;

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

export async function loadImageQueuePage() {
  const { queueFilterStatus } = imagesStore.get();
  const params = {};
  if (isQueuePanelVisible() && queueFilterStatus) params.status = queueFilterStatus;
  params.limit = 100;
  try {
    const data = await queueApi.listQueue(params);
    const items = (data && data.items) || data || [];
    imageQueuePaused = !!(data && data.paused);
    imageQueueKnownActive = (data && data.active_count) || 0;
    imagesStore.set({
      queueItems: Array.isArray(items) ? items : [],
      queuePaused: imageQueuePaused,
    });
    if (isQueuePanelVisible()) renderImageQueueList();
  } catch (e) {
    showError("Error al cargar la cola: " + e.message);
  }
}

export function setQueueFilter(status) {
  imagesStore.set({ queueFilterStatus: status || "" });
  loadImageQueuePage();
}

export async function toggleQueuePause() {
  const paused = imagesStore.get().queuePaused;
  try {
    await queueApi.mutateQueue(paused ? "resume" : "pause", {});
    imagesStore.set({ queuePaused: !paused });
    await loadImageQueuePage();
  } catch (e) {
    showError("No se pudo cambiar la pausa: " + e.message);
  }
}

export async function cancelAllQueue() {
  try {
    await queueApi.cancelActiveQueue({});
    await loadImageQueuePage();
    showNotice("Cola cancelada.");
  } catch (e) {
    showError("No se pudo cancelar: " + e.message);
  }
}

export async function deleteQueueSelection(ids) {
  const selected = ids || imagesStore.get().queueSelectedIds;
  if (!selected.length) return;
  try {
    await queueApi.deleteQueueItems({ ids: selected });
    imagesStore.set({ queueSelectedIds: [] });
    await loadImageQueuePage();
  } catch (e) {
    showError("No se pudo eliminar: " + e.message);
  }
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
  if (imageQueuePollBusy || pollBusy) return;
  imageQueuePollBusy = true;
  pollBusy = true;
  try {
    const params = {};
    const { queueFilterStatus } = imagesStore.get();
    if (isQueuePanelVisible() && queueFilterStatus) params.status = queueFilterStatus;
    params.limit = 100;
    const data = await queueApi.listQueue(params);
    imageQueuePaused = Boolean(data.paused);
    imageQueueKnownActive = data.active_count || 0;
    const items = data.items || [];
    imagesStore.set({ queueItems: items, queuePaused: imageQueuePaused });
    if (isQueuePanelVisible()) {
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
    pollBusy = false;
  }
}

export function startImageQueuePoll() {
  if (pollTimer) return;
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
  const itemsKey = (imagesStore.get().queueItems || [])
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
  pruneImageQueueSelection();
  const renderKey = imageQueueListRenderKey();
  if (renderKey === imageQueueLastRenderKey) return;
  imageQueueLastRenderKey = renderKey;
  const list = document.getElementById("image-queue-list");
  if (!list) return imagesStore.get().queueItems.map((item) => renderImageQueueThumb(item) + renderImageQueueDates(item)).join("");
  const imageQueueItems = imagesStore.get().queueItems;
  if (!imageQueueItems.length) {
    list.innerHTML = '<p class="image-queue-empty">No hay trabajos en la cola.</p>';
    return;
  }
  list.innerHTML = imageQueueItems
    .map(function (item) {
      return renderImageQueueThumb(item) + renderImageQueueDates(item);
    })
    .join("");
}

export function pruneImageQueueSelection() {
  const ids = new Set(imagesStore.get().queueItems.map((i) => i.id));
  imagesStore.set((s) => ({ ...s, queueSelectedIds: s.queueSelectedIds.filter((id) => ids.has(id)) }));
}

export function deleteImageQueueJobs(ids) {
  return deleteQueueSelection(ids);
}

export function toggleImageQueuePaused() {
  return toggleQueuePause();
}

export function cancelAllActiveImageQueueJobs() {
  return cancelAllQueue();
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
  } else if (!on) {
    maybeStopImageQueuePoll();
  }
  void options;
}
