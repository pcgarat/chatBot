/** Ventana de mensajes del panel: ancla + anteriores bajo demanda. */

export function indexOfMessage(messages, messageId) {
  if (!messageId || !Array.isArray(messages)) return -1;
  const id = String(messageId);
  return messages.findIndex((m) => m && m.id != null && String(m.id) === id);
}

/** Índice inicial: mensaje foco, o el último del camino. */
export function initialViewStartIndex(messages, focusMessageId) {
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  const idx = indexOfMessage(messages, focusMessageId);
  if (idx >= 0) return idx;
  return messages.length - 1;
}

export function clampViewStartIndex(messages, viewStartIndex) {
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  const n = Number(viewStartIndex);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), messages.length - 1);
}

export function messagesInWindow(messages, viewStartIndex) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const start = clampViewStartIndex(messages, viewStartIndex);
  return messages.slice(start);
}

export function canLoadOlderMessage(viewStartIndex) {
  return Number(viewStartIndex) > 0;
}

/** Retrocede un mensaje en el camino (scroll al top). */
export function loadOlderViewStartIndex(viewStartIndex) {
  if (!canLoadOlderMessage(viewStartIndex)) return Math.max(0, Number(viewStartIndex) || 0);
  return Math.floor(viewStartIndex) - 1;
}
