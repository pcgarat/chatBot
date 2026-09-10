import { API, fetchJson } from "./client.js";

export function listProviders() {
  return fetchJson(`${API}/providers`);
}

export function listModels(provider) {
  return fetchJson(`${API}/providers/${encodeURIComponent(provider)}/models`);
}

export function listProviderParams(provider) {
  return fetchJson(`${API}/providers/${encodeURIComponent(provider)}/params`);
}

export function getModelContract(provider, modelId) {
  return fetchJson(
    `${API}/providers/${encodeURIComponent(provider)}/models/${encodeURIComponent(modelId)}/contract`
  );
}

export function listPresets(provider) {
  return fetchJson(`${API}/providers/${encodeURIComponent(provider)}/presets`);
}

export function modelInfoPath(provider, modelId) {
  return `${API}/providers/${encodeURIComponent(provider)}/models/${encodeURIComponent(modelId)}`;
}

export function getContextLength(provider, modelId) {
  return fetchJson(modelInfoPath(provider, modelId) + "/context-length");
}

export function getModelInfo(provider, modelId) {
  return fetchJson(modelInfoPath(provider, modelId) + "/info");
}

export function putModelInfo(provider, modelId, body) {
  return fetchJson(modelInfoPath(provider, modelId) + "/info", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function refreshModelInfo(provider, modelId) {
  return fetchJson(modelInfoPath(provider, modelId) + "/info/refresh", {
    method: "POST",
  });
}

export function listModelTags() {
  return fetchJson(`${API}/models/tags`);
}

export function getProviderCapabilities(provider) {
  return fetchJson(`${API}/providers/${encodeURIComponent(provider)}/capabilities`);
}

export function validateOllama() {
  return fetchJson(`${API}/providers/ollama/validate`);
}

export function clearOllamaMemory() {
  return fetchJson(`${API}/ollama/clear-memory`, { method: "POST" });
}
