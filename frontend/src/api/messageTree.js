import { API, fetchJson } from "./client.js";

export function listMessageTreeRoots({ limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return fetchJson(`${API}/message-tree/roots?${params}`);
}

export function listMessageTreeChildren(messageId) {
  return fetchJson(`${API}/message-tree/${encodeURIComponent(messageId)}/children`);
}
