import { API, fetchJson } from "./client.js";

export function listQueue(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v == null || v === "") return;
    search.set(k, String(v));
  });
  return fetchJson(`${API}/image-generation-queue?${search}`);
}

export function mutateQueue(endpoint, body) {
  return fetchJson(`${API}/image-generation-queue/${endpoint}`, {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
}

export function deleteQueueItems(body) {
  return fetchJson(`${API}/image-generation-queue/delete`, {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
}

export function cancelActiveQueue(body) {
  return fetchJson(`${API}/image-generation-queue/cancel-active`, {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
}
