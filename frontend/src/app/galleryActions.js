import * as imagesApi from "../api/images.js";
import { imagesStore } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import { showError, showNotice } from "../store/ui.js";
import { updateLayout, setGalleryPanelVisible, setChatPanelVisible } from "../store/layout.js";

export const GALLERY_PAGE_SIZE = 24;

function filterParams() {
  const f = imagesStore.get().galleryFilters;
  const params = { limit: GALLERY_PAGE_SIZE, offset: imagesStore.get().galleryOffset };
  if (f.promptModel) params.prompt_model = f.promptModel;
  if (f.promptProvider) params.prompt_provider = f.promptProvider;
  if (f.forgeModel) params.forge_model = f.forgeModel;
  if (f.steps) params.steps = f.steps;
  if (f.size) params.size = f.size;
  if (f.mode) params.mode = f.mode;
  if (f.seed) params.seed = f.seed;
  if (f.promptQ) params.q = f.promptQ;
  const { galleryScopeAll, galleryMessageId } = imagesStore.get();
  const convId = sessionStore.get().conversationId;
  if (!galleryScopeAll && convId) params.conversation_id = convId;
  if (galleryMessageId) params.message_id = galleryMessageId;
  return params;
}

export { filterParams as galleryListParams };

export function appendGalleryToolbarFilters(params) {
  const f = imagesStore.get().galleryFilters;
  if (f.promptModel) params.prompt_model = f.promptModel;
  if (f.promptProvider) params.prompt_provider = f.promptProvider;
  if (f.forgeModel) params.forge_model = f.forgeModel;
  if (f.steps) params.steps = f.steps;
  if (f.size) params.size = f.size;
  if (f.mode) params.mode = f.mode;
  if (f.seed) params.seed = f.seed;
  if (f.promptQ) params.q = f.promptQ;
  return params;
}

export function hasActiveGalleryToolbarFilters() {
  const f = imagesStore.get().galleryFilters;
  return Object.values(f).some((v) => v != null && String(v).trim() !== "");
}

export function clearGalleryToolbarFilters() {
  imagesStore.set({
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
    galleryOffset: 0,
  });
  loadGalleryPage();
  syncImageFilterNotice();
}

export function onGalleryToolbarFilterChange() {
  imagesStore.set({ galleryOffset: 0 });
  loadGalleryPage();
  scheduleConversationImageFilter();
}

export async function refreshConversationImageFilter() {
  const convId = sessionStore.get().conversationId;
  if (!convId || !hasActiveGalleryToolbarFilters()) {
    sessionStore.set({ imageFilterNotice: false });
    applyIllustrationFilterToRoot(new Set());
    syncImageFilterNotice();
    return;
  }
  const params = appendGalleryToolbarFilters({ conversation_id: convId });
  try {
    const data = await imagesApi.matchingFilenames(params);
    const names = new Set((data && data.filenames) || []);
    applyIllustrationFilterToRoot(names);
    sessionStore.set({ imageFilterNotice: true });
    syncImageFilterNotice();
  } catch (_) {
    sessionStore.set({ imageFilterNotice: false });
    syncImageFilterNotice();
  }
}

export function scheduleConversationImageFilter() {
  refreshConversationImageFilter();
}

export function applyIllustrationFilterToRoot(allowed) {
  document.querySelectorAll(".chat-illustration-frame").forEach((frame) => {
    const src = frame.querySelector("img") && frame.querySelector("img").src;
    const name = src ? decodeURIComponent(src.split("/").pop() || "") : "";
    frame.classList.toggle("is-gallery-filter-hidden", allowed.size > 0 && !allowed.has(name));
  });
}

export function syncImageFilterNotice() {
  const notice = document.getElementById("conversation-image-filter-notice");
  if (!notice) return;
  notice.hidden = !hasActiveGalleryToolbarFilters() || !sessionStore.get().conversationId;
}

export function galleryPageOffsetForAbsolute(absoluteIndex) {
  return Math.floor(absoluteIndex / GALLERY_PAGE_SIZE) * GALLERY_PAGE_SIZE;
}

export async function loadGalleryPage(options = {}) {
  const silent = !!(options && options.silent);
  try {
    const facets = await imagesApi.listIllustratedImageFacets(filterParams());
    imagesStore.set((s) => ({
      ...s,
      galleryFilterOptions: {
        promptModel: (facets && facets.prompt_models) || [],
        promptProvider: (facets && facets.prompt_providers) || [],
        forgeModel: (facets && facets.forge_models) || [],
        steps: (facets && facets.steps) || [],
        size: (facets && facets.sizes) || [],
        mode: (facets && facets.modes) || [],
        seed: (facets && facets.seeds) || [],
      },
    }));
    const data = await imagesApi.listIllustratedMessages(filterParams());
    const items = (data && data.items) || [];
    imagesStore.set({
      galleryItems: items,
      galleryTotal: data && typeof data.total === "number" ? data.total : items.length,
    });
    if (!silent) {
      const pager = document.getElementById("image-gallery-pager");
      if (pager) pager.textContent = "Cargando…";
      renderGalleryGrid();
    }
  } catch (e) {
    if (!silent) showError("Error al cargar la galería: " + e.message);
  }
}

export function renderGalleryGrid() {
  const items = imagesStore.get().galleryItems;
  return items.map((item) => {
    const sizeAttrs =
      item.width > 0 && item.height > 0
        ? ` width="${item.width}" height="${item.height}" style="aspect-ratio: ${item.width} / ${item.height}"`
        : "";
    return `<button type="button" class="image-gallery-card"><img src="${item.url || ""}" alt="" loading="lazy"${sizeAttrs} /></button>`;
  }).join("");
}

export function renderGalleryLightbox() {
  const { galleryItems, galleryTotal, galleryLightboxIndex } = imagesStore.get();
  const prev = { disabled: galleryLightboxIndex <= 0 && galleryTotal <= 1 };
  const next = { disabled: galleryLightboxIndex >= galleryTotal - 1 && galleryTotal <= 1 };
  void prev.disabled;
  void next.disabled;
  return galleryTotal > 1 ? { prev, next } : { prev, next };
}

export function setGalleryFilter(patch) {
  imagesStore.set((s) => ({
    ...s,
    galleryFilters: { ...s.galleryFilters, ...patch },
    galleryOffset: 0,
  }));
  loadGalleryPage();
  onGalleryToolbarFilterChange();
}

export function setGalleryScopeAll(all) {
  imagesStore.set({ galleryScopeAll: !!all, galleryUserChoseAll: !!all, galleryOffset: 0 });
  refreshGalleryAfterScopeChange();
}

export function refreshGalleryAfterScopeChange() {
  loadGalleryPage();
}

export function openGalleryLightbox(index) {
  imagesStore.set({ galleryLightboxIndex: index });
}

export function closeGalleryLightbox() {
  imagesStore.set({ galleryLightboxIndex: -1 });
}

export async function stepGalleryLightbox(delta) {
  const { galleryItems, galleryLightboxIndex, galleryTotal, galleryOffset } = imagesStore.get();
  if (galleryLightboxIndex < 0) return;
  const absolute = galleryOffset + galleryLightboxIndex + delta;
  if (absolute < 0 || absolute >= galleryTotal) return;
  const pageOffset = galleryPageOffsetForAbsolute(absolute);
  if (pageOffset !== galleryOffset) {
    imagesStore.set({ galleryOffset: pageOffset });
    await loadGalleryPage({ silent: true });
  }
  const local = absolute - imagesStore.get().galleryOffset;
  imagesStore.set({ galleryLightboxIndex: local });
}

export async function purgeOrphans() {
  try {
    const preview = await imagesApi.listOrphans();
    const n = (preview && preview.count) || (preview && preview.filenames && preview.filenames.length) || 0;
    if (!n) {
      showNotice("No hay archivos huérfanos.");
      return;
    }
    if (!window.confirm(`¿Eliminar ${n} archivo(s) huérfano(s)?`)) return;
    await imagesApi.purgeOrphanIllustratedFiles();
    showNotice("Archivos huérfanos eliminados.");
    loadGalleryPage();
  } catch (e) {
    showError("Error al limpiar huérfanos: " + e.message);
  }
}

export function enterGalleryView() {
  setGalleryPanelVisible(true);
  setChatPanelVisible(true);
  loadGalleryPage();
}

export function highlightIllustrationInConversation() {}

export function galleryQueryString() {
  const p = filterParams();
  const search = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v == null || v === "") return;
    search.set(k, String(v));
  });
  return search.toString();
}

export function initImageGallery() {
  document.getElementById("btn-image-gallery");
  document.getElementById("btn-center-chat");
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") stepGalleryLightbox(-1);
  });
  loadGalleryPage();
}
