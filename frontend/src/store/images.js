import { createStore } from "./createStore.js";

export const IMAGES_PREFS_KEY = "chatbot_images_prefs";

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(IMAGES_PREFS_KEY) || "{}") || {};
  } catch (_) {
    return {};
  }
}

export function persistImagesPrefs(prefs) {
  try {
    localStorage.setItem(IMAGES_PREFS_KEY, JSON.stringify(prefs || {}));
  } catch (_) {}
}

export const imagesStore = createStore({
  prefs: readPrefs(),
  galleryItems: [],
  galleryTotal: 0,
  galleryOffset: 0,
  galleryFilters: {
    promptModel: "",
    promptProvider: "",
    forgeModel: "",
    steps: "",
    size: "",
    mode: "",
    seed: "",
    promptQ: "",
  },
  galleryFilterOptions: {
    promptModel: [],
    promptProvider: [],
    forgeModel: [],
    steps: [],
    size: [],
    mode: [],
    seed: [],
  },
  galleryScopeAll: true,
  galleryUserChoseAll: false,
  galleryLightboxIndex: -1,
  galleryMessageId: null,
  queueItems: [],
  queueFilterStatus: "",
  queueExpandedId: null,
  queuePaused: false,
  queueSelectedIds: [],
  forgeDefaults: {},
  lastForgeParams: null,
  plannerContract: null,
});
