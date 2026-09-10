import { settingsStore } from "../store/settings.js";
import { sessionStore } from "../store/session.js";

function valuesEqual(spec, a, b) {
  if (spec && spec.type === "string_list") {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((d, i) => d === b[i]);
  }
  if (a === null || a === undefined || a === "") {
    return b === undefined || b === null || b === "";
  }
  return (typeof b === "number" && Number(a) === b) || a === b || String(a) === String(b);
}

/** Parámetros distintos al baseline (sin exclusiones). */
export function buildModelParamsRaw() {
  const { paramsConfig, paramsBaseline, paramsValues } = settingsStore.get();
  const out = {};
  const specs = (paramsConfig && paramsConfig.params) || {};
  for (const paramId of Object.keys(specs)) {
    const spec = specs[paramId];
    const current = Object.prototype.hasOwnProperty.call(paramsValues, paramId)
      ? paramsValues[paramId]
      : spec.default;
    const def = paramsBaseline[paramId] !== undefined ? paramsBaseline[paramId] : spec.default;
    if (!valuesEqual(spec, current, def)) out[paramId] = current;
  }
  return out;
}

export function getParamsExcludedFromSendSet() {
  const { paramsExcludedFromSendByConv } = settingsStore.get();
  const { conversationId } = sessionStore.get();
  const key = conversationId || "_new";
  const list = paramsExcludedFromSendByConv[key] || [];
  return new Set(list);
}

/** Parámetros que se enviarán al backend: raw menos los que el usuario ha excluido. */
export function buildModelParams() {
  const raw = buildModelParamsRaw();
  const excluded = getParamsExcludedFromSendSet();
  if (excluded.size === 0) return raw;
  const out = {};
  for (const k of Object.keys(raw)) {
    if (!excluded.has(k)) out[k] = raw[k];
  }
  return out;
}

export function collectAllModelParams() {
  const { paramsConfig, paramsValues } = settingsStore.get();
  const out = {};
  const specs = (paramsConfig && paramsConfig.params) || {};
  for (const paramId of Object.keys(specs)) {
    const spec = specs[paramId];
    out[paramId] = Object.prototype.hasOwnProperty.call(paramsValues, paramId)
      ? paramsValues[paramId]
      : spec.default;
  }
  return out;
}

export function toggleParamExcluded(paramId, exclude) {
  const key = sessionStore.get().conversationId || "_new";
  settingsStore.set((s) => {
    const current = new Set(s.paramsExcludedFromSendByConv[key] || []);
    if (exclude) current.add(paramId);
    else current.delete(paramId);
    return {
      ...s,
      paramsExcludedFromSendByConv: {
        ...s.paramsExcludedFromSendByConv,
        [key]: Array.from(current),
      },
    };
  });
}
