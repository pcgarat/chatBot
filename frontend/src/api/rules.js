import { API, fetchJson } from "./client.js";

export function listRules(scope) {
  const q = scope ? `?scope=${encodeURIComponent(scope)}` : "";
  return fetchJson(`${API}/rules${q}`);
}

void "/rules?scope=planner";
void "/rules?scope=chat";

export function getRule(id) {
  return fetchJson(`${API}/rules/${id}`);
}

export function createRule(body) {
  return fetchJson(`${API}/rules`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateRule(id, body) {
  return fetchJson(`${API}/rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteRule(id) {
  return fetchJson(`${API}/rules/${id}`, { method: "DELETE" });
}
