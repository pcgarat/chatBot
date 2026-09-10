import { createStore } from "./createStore.js";

export const DEBUG_LOG_SIZE_STORAGE_KEY = "chatbot_debug_log_size";
export const DEBUG_LOG_SIZE_DEFAULT = 100;
export const DEBUG_LOG_SIZE_MIN = 20;
export const DEBUG_LOG_SIZE_MAX = 500;
export const DEBUG_LOG_SIZE_STEP = 20;

export function getStoredDebugLogSize() {
  try {
    const raw = localStorage.getItem(DEBUG_LOG_SIZE_STORAGE_KEY);
    const n = parseInt(raw || "", 10);
    if (!Number.isFinite(n)) return DEBUG_LOG_SIZE_DEFAULT;
    return Math.max(DEBUG_LOG_SIZE_MIN, Math.min(DEBUG_LOG_SIZE_MAX, n));
  } catch (_) {
    return DEBUG_LOG_SIZE_DEFAULT;
  }
}

export function setStoredDebugLogSize(n) {
  try {
    localStorage.setItem(DEBUG_LOG_SIZE_STORAGE_KEY, String(n));
  } catch (_) {}
}

export function createDebugLogBuffer(getMaxSize) {
  const items = [];
  let seq = 0;
  return {
    push(entry) {
      const id = `dbg-${++seq}`;
      items.push({ id, ts: Date.now(), ...entry });
      const max = typeof getMaxSize === "function" ? getMaxSize() : getMaxSize;
      while (items.length > max) items.shift();
      return id;
    },
    update(id, patch) {
      const found = items.find((e) => e.id === id);
      if (found) Object.assign(found, patch);
    },
    list() {
      return items.slice();
    },
    clear() {
      items.length = 0;
    },
  };
}

export const debugStore = createStore({
  chatOpen: false,
  imagesOpen: false,
  chatLog: [],
  imagesLog: [],
  logSize: getStoredDebugLogSize(),
});

const chatBuffer = createDebugLogBuffer(getStoredDebugLogSize);
const imagesBuffer = createDebugLogBuffer(getStoredDebugLogSize);

export function isDebugPanelOpen(which) {
  const s = debugStore.get();
  return which === "images" ? s.imagesOpen : s.chatOpen;
}

export function renderImagesDebugLog() {
  return debugStore.get().imagesLog;
}

export function renderChatDebugLog() {
  return debugStore.get().chatLog;
}

export function setDebugLogSize(delta) {
  const current = getStoredDebugLogSize();
  let next = Math.round((current + (delta || 0)) / DEBUG_LOG_SIZE_STEP) * DEBUG_LOG_SIZE_STEP;
  next = Math.max(DEBUG_LOG_SIZE_MIN, Math.min(DEBUG_LOG_SIZE_MAX, next));
  setStoredDebugLogSize(next);
  debugStore.set({ logSize: next });
  renderChatDebugLog();
  renderImagesDebugLog();
}

export function setDebugPanelOpen(which, open) {
  const wantImages = which === "images";
  const nextOpen = open !== false;
  if (wantImages) {
    debugStore.set({ imagesOpen: nextOpen, chatOpen: false });
  } else {
    debugStore.set({ chatOpen: nextOpen, imagesOpen: false });
  }
  const column = document.getElementById("column-right");
  const anyOpen = debugStore.get().chatOpen || debugStore.get().imagesOpen;
  if (column) column.classList.toggle("is-debug-expanded", anyOpen);
  ["chat", "images"].forEach(function (id) {
    const toggle = document.getElementById("debug-" + id + "-toggle");
    const body = document.getElementById("debug-" + id + "-body");
    const isOpen = id === "images" ? debugStore.get().imagesOpen : debugStore.get().chatOpen;
    if (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (body) body.hidden = !isOpen;
  });
  if (debugStore.get().chatOpen) renderChatDebugLog();
  if (debugStore.get().imagesOpen) {
    renderImagesDebugLog();
    loadImageQueueForDebug();
  }
}

function loadImageQueueForDebug() {
  import("../app/queueActions.js").then((m) => m.loadImageQueueForDebug());
}

export function pushChatDebugEntry(partial) {
  const id = chatBuffer.push(partial);
  debugStore.set({ chatLog: chatBuffer.list() });
  return { id };
}

export function updateChatDebugEntry(id, patch) {
  chatBuffer.update(id, patch);
  debugStore.set({ chatLog: chatBuffer.list() });
}

export function pushImagesDebugEntry(partial) {
  const id = imagesBuffer.push(partial);
  debugStore.set({ imagesLog: imagesBuffer.list() });
  return { id };
}

export function appendImagesDebugLog(line) {
  pushImagesDebugEntry({ title: String(line), status: "info" });
}

export function formatDebugImageLink(conversationId, messageId, filename) {
  return `<button type="button" class="debug-image-link" data-conversation-id="${conversationId || ""}" data-message-id="${messageId || ""}">${filename || "imagen"}</button>`;
}

export function ingestQueueItemsForDebug(items) {
  (items || []).forEach((item) => {
    pushImagesDebugEntry({
      title: item.id || "job",
      status: item.status || "info",
      html: formatDebugImageLink(item.conversation_id, item.message_id, item.result_filename),
    });
  });
}

export function initDebugDock() {
  return true;
}
