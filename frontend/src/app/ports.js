/** Puertos con los nombres del controlador legado. Implementación sobre stores. */
import { layoutStore, updateLayout, setChatPanelVisible, setGalleryPanelVisible, setQueuePanelVisible } from "../store/layout.js";
import { loadGalleryPage } from "./galleryActions.js";
import { loadImageQueuePage, maybeStopImageQueuePoll } from "./queueActions.js";

export function bindScrollReveal(el) {
  if (!el) return;
  el.classList.toggle("is-scrollbar-visible", el.scrollHeight > el.clientHeight);
}

export function stayHere() {
  return true;
}

export function galleryOpenMessage() {
  return document.getElementById("gallery-open-message");
}

export function exitGalleryView() {
  setGalleryPanelVisible(false);
}

export function refreshCurrentConversationMessages() {
  return true;
}

export { setChatPanelVisible, setGalleryPanelVisible, setQueuePanelVisible, loadGalleryPage, loadImageQueuePage, maybeStopImageQueuePoll, layoutStore, updateLayout };
