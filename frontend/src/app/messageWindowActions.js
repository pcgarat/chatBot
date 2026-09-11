/** Acciones de carga bajo demanda de la ventana de mensajes del panel. */
import { sessionStore } from "../store/session.js";
import {
  canLoadOlderMessage,
  clampViewStartIndex,
  loadOlderViewStartIndex,
} from "../lib/messageWindow.js";

export function syncViewStartToMessages(messages, viewStartIndex) {
  return clampViewStartIndex(messages, viewStartIndex);
}

export function loadOlderMessageInView() {
  const { viewStartIndex, messages } = sessionStore.get();
  if (!canLoadOlderMessage(viewStartIndex)) return false;
  const next = loadOlderViewStartIndex(viewStartIndex);
  if (next === viewStartIndex) return false;
  sessionStore.set({ viewStartIndex: clampViewStartIndex(messages, next) });
  return true;
}
