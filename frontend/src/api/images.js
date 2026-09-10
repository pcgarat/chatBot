import { API, fetchJson } from "./client.js";

export function getIllustratedMeta(filename) {
  return fetchJson(`${API}/illustrated-images/${encodeURIComponent(filename)}/meta`);
}

export function matchingFilenames(params) {
  const search = new URLSearchParams(params || {});
  return fetchJson(`${API}/illustrated-images/matching-filenames?${search}`);
}

export function listIllustratedMessages(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v == null || v === "") return;
    search.set(k, String(v));
  });
  return fetchJson(`${API}/illustrated-images/messages?${search}`);
}

export function listIllustratedImageFacets(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v == null || v === "") return;
    search.set(k, String(v));
  });
  const q = search.toString();
  return fetchJson(`${API}/illustrated-images/facets${q ? `?${q}` : ""}`);
}

export function listIllustratedImages(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v == null || v === "") return;
    search.set(k, String(v));
  });
  return fetchJson(`${API}/illustrated-images?${search}`);
}

export function listOrphans() {
  return fetchJson(`${API}/illustrated-images/orphans`);
}

export function purgeOrphanIllustratedFiles() {
  return fetchJson(`${API}/illustrated-images/orphans/purge`, { method: "POST" });
}

export function getForgeReactorDefaults() {
  return fetchJson(`${API}/forge/reactor-defaults`);
}

export function getForgeLastGenerationParams() {
  return fetchJson(`${API}/forge/last-generation-params`);
}

export function messageIllustrationPath(conversationId, messageId, path) {
  return fetchJson(
    `${API}/conversations/${conversationId}/messages/${messageId}/illustrations/${path}`
  );
}
