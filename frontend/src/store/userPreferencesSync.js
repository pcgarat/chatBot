/**
 * Sync de preferencias de UI/imágenes/historial con el servidor (por usuario).
 * localStorage sigue como caché local; tras login el servidor es la fuente de verdad.
 */

import {
  applyDocumentLayout,
  layoutStore,
  persistLayout,
} from "./layout.js";
import { imagesStore, persistImagesPrefs } from "./images.js";
import {
  historyStore,
  persistConversationSort,
  persistLeftHistoryMode,
  persistMessageSort,
} from "./history.js";
import { debugStore, getStoredDebugLogSize, setStoredDebugLogSize } from "./debug.js";
import { readLastConversationId, saveLastConversationId } from "./session.js";
import { loadUserPreferences, saveUserPreferences } from "./auth.js";

const LAYOUT_KEYS = [
  "darkMode",
  "leftSidebarCollapsed",
  "composerCollapsed",
  "leftWidthPx",
  "rightWidthPx",
  "centerChatVisible",
  "centerGalleryVisible",
  "centerQueueVisible",
  "centerChatGalleryShare",
  "uiBaseFontScale",
  "conversationFontRem",
  "sidebarLeftFontScale",
  "sidebarRightFontScale",
  "imageSizeFactor",
  "readingWidthPx",
  "autoScrollDuringGeneration",
  "renderMarkdown",
  "sidebarTab",
  "accordion",
];

const PUSH_DEBOUNCE_MS = 600;

let applying = false;
let watchStarted = false;
let pushTimer = null;
let unsubscribers = [];

export function collectPreferencesSnapshot() {
  const layout = layoutStore.get();
  const layoutOut = {};
  LAYOUT_KEYS.forEach((key) => {
    if (layout[key] !== undefined) layoutOut[key] = layout[key];
  });
  return {
    version: 1,
    layout: layoutOut,
    imagesPrefs: { ...(imagesStore.get().prefs || {}) },
    history: {
      mode: historyStore.get().mode,
      conversationSort: historyStore.get().conversationSort,
      messageSort: historyStore.get().messageSort,
    },
    debugLogSize: getStoredDebugLogSize(),
    lastConversationId: readLastConversationId() || null,
  };
}

export function applyPreferencesSnapshot(raw) {
  if (!raw || typeof raw !== "object") return;
  applying = true;
  try {
    const layoutPatch = raw.layout && typeof raw.layout === "object" ? raw.layout : null;
    if (layoutPatch) {
      const patch = {};
      LAYOUT_KEYS.forEach((key) => {
        if (key in layoutPatch) patch[key] = layoutPatch[key];
      });
      if (Object.keys(patch).length) {
        layoutStore.set(patch);
        persistLayout(patch);
        applyDocumentLayout(layoutStore.get());
      }
    }

    if (raw.imagesPrefs && typeof raw.imagesPrefs === "object") {
      persistImagesPrefs(raw.imagesPrefs);
      imagesStore.set((s) => ({ ...s, prefs: { ...raw.imagesPrefs } }));
    }

    if (raw.history && typeof raw.history === "object") {
      const histPatch = {};
      if (raw.history.mode != null) {
        persistLeftHistoryMode(raw.history.mode);
        histPatch.mode = "tree";
      }
      if (raw.history.conversationSort != null) {
        persistConversationSort(raw.history.conversationSort);
        histPatch.conversationSort =
          raw.history.conversationSort === "created_at" ? "created_at" : "activity";
      }
      if (raw.history.messageSort != null) {
        persistMessageSort(raw.history.messageSort);
        histPatch.messageSort = raw.history.messageSort === "image" ? "image" : "message";
      }
      if (Object.keys(histPatch).length) historyStore.set(histPatch);
    }

    if (raw.debugLogSize != null) {
      const n = Number(raw.debugLogSize);
      if (Number.isFinite(n)) {
        setStoredDebugLogSize(n);
        debugStore.set({ logSize: n });
      }
    }

    if ("lastConversationId" in raw) {
      saveLastConversationId(raw.lastConversationId || null);
    }
  } finally {
    applying = false;
  }
}

export async function hydratePreferencesFromServer() {
  const data = await loadUserPreferences();
  const prefs = (data && data.preferences) || {};
  const hasServer =
    prefs &&
    typeof prefs === "object" &&
    (prefs.layout || prefs.imagesPrefs || prefs.history || prefs.debugLogSize != null);

  if (!hasServer) {
    const snapshot = collectPreferencesSnapshot();
    await saveUserPreferences(snapshot);
    return { seeded: true, preferences: snapshot };
  }

  applyPreferencesSnapshot(prefs);
  return { seeded: false, preferences: prefs };
}

export function schedulePreferencesPush() {
  if (applying || !watchStarted) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void flushPreferencesPush();
  }, PUSH_DEBOUNCE_MS);
}

export async function flushPreferencesPush() {
  if (applying) return;
  try {
    await saveUserPreferences(collectPreferencesSnapshot());
  } catch (_) {}
}

function onStoreChange() {
  schedulePreferencesPush();
}

export function startPreferencesSync() {
  if (watchStarted) return;
  watchStarted = true;
  unsubscribers = [
    layoutStore.subscribe(onStoreChange),
    imagesStore.subscribe(onStoreChange),
    historyStore.subscribe(onStoreChange),
  ];
}

export function stopPreferencesSync() {
  watchStarted = false;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  unsubscribers.forEach((u) => u && u());
  unsubscribers = [];
}
