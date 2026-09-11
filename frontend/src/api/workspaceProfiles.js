import { API, fetchJson } from "./client.js";

export function listWorkspaceProfiles() {
  return fetchJson(`${API}/workspace-profiles`);
}

export function getWorkspaceProfile(id) {
  return fetchJson(`${API}/workspace-profiles/${id}`);
}

export function createWorkspaceProfile(body) {
  return fetchJson(`${API}/workspace-profiles`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateWorkspaceProfile(id, body) {
  return fetchJson(`${API}/workspace-profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteWorkspaceProfile(id) {
  return fetchJson(`${API}/workspace-profiles/${id}`, { method: "DELETE" });
}

export function listPlannerRulePresets() {
  return fetchJson(`${API}/planner-rule-presets`);
}

export function createPlannerRulePreset(body) {
  return fetchJson(`${API}/planner-rule-presets`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePlannerRulePreset(id, body) {
  return fetchJson(`${API}/planner-rule-presets/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deletePlannerRulePreset(id) {
  return fetchJson(`${API}/planner-rule-presets/${id}`, { method: "DELETE" });
}
