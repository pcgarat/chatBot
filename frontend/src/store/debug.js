import { createStore } from "./createStore.js";
import { escapeHtml } from "../lib/html.js";
import {
  encodeJsonPath,
  decodeJsonPath,
  jsonSectionHtml,
} from "../lib/debugJsonTree.js";

export const DEBUG_LOG_SIZE_STORAGE_KEY = "chatbot_debug_log_size";
export const DEBUG_LOG_SIZE_DEFAULT = 100;
export const DEBUG_LOG_SIZE_MIN = 20;
export const DEBUG_LOG_SIZE_MAX = 500;
export const DEBUG_LOG_SIZE_STEP = 20;

export const DEBUG_STATUS_LABELS = {
  sending: "Enviando",
  waiting: "Esperando respuesta",
  streaming: "Recibiendo",
  done: "Completado",
  error: "Error",
  cancelled: "Cancelado",
  pending: "Encolada",
  generating: "Generándose",
  completed: "Generada",
  failed: "Fallida",
  info: "Log",
};

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
      const id = entry?.id || `dbg-${++seq}`;
      items.push({ id, ts: Date.now(), ...entry, id });
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
let imageQueueDebugSeen = Object.create(null);
const expandedJsonPaths = new Map();
/** Override manual del acordeón de cada registro: true/false; ausente = auto por status. */
const entryExpandOverride = new Map();

function pathKey(parts) {
  return encodeJsonPath(parts);
}

export function isDebugJsonPathExpanded(entryId, parts) {
  const set = expandedJsonPaths.get(entryId);
  if (!set) return false;
  return set.has(pathKey(parts));
}

function findDebugEntry(entryId) {
  if (!entryId) return null;
  return (
    chatBuffer.list().find((e) => e.id === entryId) ||
    imagesBuffer.list().find((e) => e.id === entryId) ||
    null
  );
}

function debugEntryAutoExpand(entry) {
  return (
    entry?.status === "sending" ||
    entry?.status === "waiting" ||
    entry?.status === "streaming" ||
    entry?.status === "generating"
  );
}

export function isDebugEntryExpanded(entryOrId) {
  const entry =
    typeof entryOrId === "string" || entryOrId == null
      ? findDebugEntry(entryOrId)
      : entryOrId;
  const entryId = entry?.id || (typeof entryOrId === "string" ? entryOrId : "");
  if (entryId && entryExpandOverride.has(entryId)) {
    return entryExpandOverride.get(entryId);
  }
  return debugEntryAutoExpand(entry || {});
}

export function setDebugEntryExpanded(entryId, open) {
  if (!entryId) return false;
  entryExpandOverride.set(entryId, !!open);
  return !!open;
}

export function toggleDebugEntryExpanded(entryId) {
  if (!entryId) return false;
  const next = !isDebugEntryExpanded(entryId);
  setDebugEntryExpanded(entryId, next);
  if (chatBuffer.list().some((e) => e.id === entryId)) renderChatDebugLog();
  else if (imagesBuffer.list().some((e) => e.id === entryId)) renderImagesDebugLog();
  return next;
}

export function toggleDebugJsonPath(entryId, partsOrEncoded) {
  if (!entryId) return false;
  const parts = Array.isArray(partsOrEncoded)
    ? partsOrEncoded
    : decodeJsonPath(partsOrEncoded);
  const key = pathKey(parts);
  let set = expandedJsonPaths.get(entryId);
  if (!set) {
    set = new Set();
    expandedJsonPaths.set(entryId, set);
  }
  const next = !set.has(key);
  if (next) set.add(key);
  else set.delete(key);
  // Expandir JSON implica que el registro debe permanecer abierto tras el re-render.
  entryExpandOverride.set(entryId, true);
  if (chatBuffer.list().some((e) => e.id === entryId)) renderChatDebugLog();
  else if (imagesBuffer.list().some((e) => e.id === entryId)) renderImagesDebugLog();
  return next;
}

export function isDebugPanelOpen(which) {
  const s = debugStore.get();
  return which === "images" ? s.imagesOpen : s.chatOpen;
}

export function formatDebugPayload(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function formatDebugTime(ts) {
  if (typeof ts === "string" && /^\d{2}:\d{2}:\d{2}/.test(ts)) return ts;
  const d = typeof ts === "number" ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(11, 19);
}

function debugEntryShouldExpand(entry) {
  return isDebugEntryExpanded(entry);
}

function entryUsesJsonTree(entry) {
  return !!(entry.request || entry.response || (entry.details && typeof entry.details === "object"));
}

function debugEntryBodyHtml(entry) {
  const parts = [];
  const entryId = entry.id || "";
  const isExpanded = (pathParts) => isDebugJsonPathExpanded(entryId, pathParts);

  if (entryUsesJsonTree(entry)) {
    if (entry.request) {
      parts.push(
        jsonSectionHtml({
          label: "Request",
          value: entry.request,
          path: ["request"],
          isExpanded,
        })
      );
    }
    if (entry.response) {
      parts.push(
        jsonSectionHtml({
          label: "Response",
          value: entry.response,
          path: ["response"],
          isExpanded,
        })
      );
    }
    if (entry.details) {
      parts.push(
        jsonSectionHtml({
          label: "Details",
          value: entry.details,
          path: ["details"],
          isExpanded,
        })
      );
    }
  } else if (entry.details) {
    parts.push("<pre>" + escapeHtml(formatDebugPayload(entry.details)) + "</pre>");
  }

  if (entry.imageLink) {
    const link = entry.imageLink;
    const label = link.filename || link.sceneId || "imagen";
    parts.push(
      '<a href="#" class="debug-image-link"' +
        ' data-conversation-id="' +
        escapeHtml(link.conversationId || "") +
        '"' +
        ' data-message-id="' +
        escapeHtml(link.messageId || "") +
        '"' +
        ' data-filename="' +
        escapeHtml(link.filename || "") +
        '"' +
        ' data-scene-id="' +
        escapeHtml(link.sceneId || "") +
        '">' +
        escapeHtml("Ver en la conversación: " + label) +
        "</a>"
    );
  }
  return parts.join("");
}

export function debugEntryHtml(entry) {
  const expanded = debugEntryShouldExpand(entry);
  const status = DEBUG_STATUS_LABELS[entry.status] || entry.status || "";
  const body = debugEntryBodyHtml(entry);
  return (
    '<article class="debug-entry" data-debug-id="' +
    escapeHtml(entry.id || "") +
    '">' +
    '<button type="button" class="debug-entry-toggle" aria-expanded="' +
    (expanded ? "true" : "false") +
    '">' +
    '<span class="debug-entry-time">' +
    escapeHtml(formatDebugTime(entry.ts)) +
    "</span>" +
    '<span class="debug-entry-status">' +
    escapeHtml(status) +
    "</span>" +
    '<span class="debug-entry-title">' +
    escapeHtml(entry.title || "") +
    "</span>" +
    "</button>" +
    (body ? '<div class="debug-entry-body"' + (expanded ? "" : " hidden") + ">" + body + "</div>" : "") +
    "</article>"
  );
}

function renderDebugLog(logId, items) {
  const log = document.getElementById(logId);
  if (!log) return;
  log.innerHTML = items.length
    ? items.map(debugEntryHtml).join("")
    : '<p class="debug-log-empty">Sin eventos todavía.</p>';
  log.scrollTop = log.scrollHeight;
}

export function renderImagesDebugLog() {
  if (!isDebugPanelOpen("images")) return debugStore.get().imagesLog;
  renderDebugLog("images-debug-log", debugStore.get().imagesLog);
  return debugStore.get().imagesLog;
}

export function renderChatDebugLog() {
  if (!isDebugPanelOpen("chat")) return debugStore.get().chatLog;
  renderDebugLog("chat-debug-log", debugStore.get().chatLog);
  return debugStore.get().chatLog;
}

function syncDebugPanelDom() {
  const column = document.getElementById("column-right");
  const anyOpen = debugStore.get().chatOpen || debugStore.get().imagesOpen;
  if (column) column.classList.toggle("is-debug-expanded", anyOpen);
  ["chat", "images"].forEach(function (id) {
    const section = document.getElementById("debug-accordion-" + id);
    const toggle = document.getElementById("debug-" + id + "-toggle");
    const body = document.getElementById("debug-" + id + "-body");
    const isOpen = id === "images" ? debugStore.get().imagesOpen : debugStore.get().chatOpen;
    if (section) section.classList.toggle("is-open", isOpen);
    if (toggle) toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (body) body.hidden = !isOpen;
  });
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
  syncDebugPanelDom();
  if (debugStore.get().chatOpen) renderChatDebugLog();
  if (debugStore.get().imagesOpen) {
    renderImagesDebugLog();
    loadImageQueueForDebug();
  } else {
    import("../app/queueActions.js").then((m) => m.maybeStopImageQueuePoll()).catch(() => {});
  }
}

function loadImageQueueForDebug() {
  import("../app/queueActions.js").then((m) => m.loadImageQueueForDebug());
}

export function pushChatDebugEntry(partial) {
  const id = chatBuffer.push(partial);
  debugStore.set({ chatLog: chatBuffer.list() });
  renderChatDebugLog();
  return { id };
}

export function updateChatDebugEntry(id, patch) {
  chatBuffer.update(id, patch);
  debugStore.set({ chatLog: chatBuffer.list() });
  renderChatDebugLog();
}

export function pushImagesDebugEntry(partial) {
  const id = imagesBuffer.push(partial);
  debugStore.set({ imagesLog: imagesBuffer.list() });
  renderImagesDebugLog();
  return { id };
}

export function updateImagesDebugEntry(id, patch) {
  imagesBuffer.update(id, patch);
  debugStore.set({ imagesLog: imagesBuffer.list() });
  renderImagesDebugLog();
}

function plannerDebugStatus(response) {
  if (typeof response !== "string" || !response.trim()) return "done";
  try {
    const parsed = JSON.parse(response);
    if (parsed && typeof parsed === "object" && parsed.error) return "error";
  } catch (_) {}
  return "done";
}

export function ingestPlannerLlmDebug(event, entryId) {
  if (!event) return null;
  const payload = event.data && typeof event.data === "object" ? event.data : {};
  const request = payload.debug_request || event.debug_request || "";
  const response = payload.debug_response || event.debug_response || "";
  const title =
    payload.label || event.message || "Petición al LLM de planificador";
  const details = {
    scene_id: event.scene_id || null,
    scene_ids: payload.scene_ids || null,
    batch: payload.batch ?? null,
    paragraph_index: payload.paragraph_index ?? null,
    reason: payload.reason || null,
  };
  const compactDetails = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value != null)
  );
  const patch = {
    title,
    status: plannerDebugStatus(response),
    request,
    response,
  };
  if (Object.keys(compactDetails).length) patch.details = compactDetails;
  if (entryId) {
    updateChatDebugEntry(entryId, patch);
    return { id: entryId };
  }
  return pushChatDebugEntry(patch);
}

export function appendImagesDebugLog(line) {
  pushImagesDebugEntry({ title: String(line), status: "info" });
}

export function formatDebugImageLink(conversationId, messageId, filename, sceneId) {
  return (
    '<a href="#" class="debug-image-link"' +
    ' data-conversation-id="' +
    escapeHtml(conversationId || "") +
    '"' +
    ' data-message-id="' +
    escapeHtml(messageId || "") +
    '"' +
    ' data-filename="' +
    escapeHtml(filename || "") +
    '"' +
    ' data-scene-id="' +
    escapeHtml(sceneId || "") +
    '">' +
    escapeHtml("Ver en la conversación: " + (filename || sceneId || "imagen")) +
    "</a>"
  );
}

export function ingestQueueItemsForDebug(items) {
  (items || []).forEach(function (item) {
    if (!item || !item.id) return;
    const prev = imageQueueDebugSeen[item.id];
    if (prev === item.status) return;
    imageQueueDebugSeen[item.id] = item.status;
    if (prev == null && item.status !== "pending" && item.status !== "generating") {
      return;
    }
    const entry = {
      kind: "queue",
      title: item.scene_id ? "Escena " + item.scene_id : "Job " + item.id,
      status: item.status,
      details: {
        job_id: item.id,
        scene_id: item.scene_id,
        message_id: item.message_id,
        conversation_id: item.conversation_id,
        error: item.error_message || null,
        filename: item.result_filename || null,
      },
    };
    if (item.status === "completed") {
      entry.title = "Imagen generada · " + (item.result_filename || item.scene_id || item.id);
      entry.imageLink = {
        conversationId: item.conversation_id,
        messageId: item.message_id,
        filename: item.result_filename || "",
        sceneId: item.scene_id || "",
      };
    } else if (item.status === "failed") {
      entry.title = "Imagen fallida · " + (item.scene_id || item.id);
    } else if (item.status === "generating") {
      entry.title = "Generando imagen · " + (item.scene_id || item.id);
    } else if (item.status === "pending") {
      entry.title = "Encolada · " + (item.scene_id || item.id);
    }
    pushImagesDebugEntry(entry);
  });
}

export function clearDebugLogs() {
  chatBuffer.clear();
  imagesBuffer.clear();
  imageQueueDebugSeen = Object.create(null);
  expandedJsonPaths.clear();
  entryExpandOverride.clear();
  debugStore.set({ chatLog: [], imagesLog: [] });
}

export function initDebugDock() {
  return true;
}

export { syncDebugPanelDom };
