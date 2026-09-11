import { API } from "../api/client.js";
import { imagesStore } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import { appStatus, showError, showNotice } from "../store/ui.js";
import { pushChatDebugEntry, appendImagesDebugLog, ingestPlannerLlmDebug, updateChatDebugEntry } from "../store/debug.js";
import { buildModelParams } from "../lib/params.js";
import { collectImagesSnapshot, readForgePanelParams, isVisualConsistencyEnabled } from "./imagesPanel.js";
import { getPlannerRulesTextForSystem } from "./rulesActions.js";
import { startImageQueuePoll, loadImageQueuePage } from "./queueActions.js";
import { layoutStore } from "../store/layout.js";

const illustrating = new Set();
const abortControllers = new Set();

function apiErrorMessage(err, fallback) {
  const detail = err && err.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || !item.msg) return "";
        const loc = Array.isArray(item.loc)
          ? item.loc.filter((part) => part !== "body").join(".")
          : "";
        return loc ? `${loc}: ${item.msg}` : item.msg;
      })
      .filter(Boolean)
      .join("; ");
  }
  return fallback;
}

function assignOptionalNumber(body, key, value) {
  if (typeof value === "number" && Number.isFinite(value)) body[key] = value;
}

function reactorForIllustration(reactor) {
  if (!reactor || !reactor.enabled) return null;
  const out = { enabled: true };
  if (reactor.female_enabled) {
    out.female_enabled = true;
    if (reactor.female_face_model) out.female_face_model = reactor.female_face_model;
  }
  if (reactor.male_enabled) {
    out.male_enabled = true;
    if (reactor.male_face_model) out.male_face_model = reactor.male_face_model;
  }
  if (typeof reactor.codeformer_weight === "number" && Number.isFinite(reactor.codeformer_weight)) {
    out.codeformer_weight = reactor.codeformer_weight;
  }
  return out;
}

function snapshotBody(extra = {}) {
  const snap = collectImagesSnapshot();
  const forge = readForgePanelParams();
  const body = {
    images_per_response: snap.images_per_response,
    batch_size: snap.batch_size,
    prompt_provider: snap.prompt_provider || "ollama",
    prompt_model: snap.prompt_model || "",
    retries: snap.retries,
    prompt: snap.prompt || "",
    prompt_system_instructions: getPlannerRulesTextForSystem(),
    use_chat_config: snap.use_chat_config,
    visual_consistency: isVisualConsistencyEnabled(),
    prompt_model_params: snap.use_chat_config
      ? buildModelParams()
      : snap.prompt_model_params || {},
    include_prompt_debug: true,
    debug: true,
  };
  const reactor = reactorForIllustration(snap.reactor);
  if (reactor) body.reactor = reactor;
  assignOptionalNumber(body, "steps", forge.steps);
  assignOptionalNumber(body, "width", forge.width);
  assignOptionalNumber(body, "height", forge.height);
  assignOptionalNumber(body, "seed", forge.seed);
  const forgeKeys = new Set(["steps", "width", "height", "seed"]);
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    if (forgeKeys.has(key)) {
      if (value === "" || value == null) delete body[key];
      else assignOptionalNumber(body, key, value);
      continue;
    }
    body[key] = value;
  }
  return body;
}

export async function runIllustrationStream(opts) {
  const messageId = opts.messageId;
  const abortCtrl = new AbortController();
  abortControllers.add(abortCtrl);
  illustrating.add(messageId);
  sessionStore.set({ illustratingIds: Array.from(illustrating) });
  const imgStatusId = appStatus.push("images", "images.starting");
  appendImagesDebugLog(opts.debugLabel || `Iniciando stream message=${messageId}`);
  let queuedAny = false;
  let plannerDebugEntry = null;
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortCtrl.signal,
      body: JSON.stringify(opts.body || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(apiErrorMessage(err, res.statusText) || res.statusText);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let data;
        try {
          data = JSON.parse(line);
        } catch (_) {
          continue;
        }
        if (data.status) appStatus.update(imgStatusId, data.status, data.message, data);
        if (data.type === "status" && data.data && data.data.code === "images.planning") {
          plannerDebugEntry = pushChatDebugEntry({
            title: "Petición al LLM de planificador",
            status: "sending",
            details: {
              batch: data.data.batch ?? null,
              paragraph_index: data.data.paragraph_index ?? null,
              message_id: messageId,
            },
          });
        }
        if (data.content != null && data.message_id) {
          sessionStore.set((s) => ({
            ...s,
            allMessages: s.allMessages.map((m) =>
              m.id === data.message_id ? { ...m, content: data.content } : m
            ),
            messages: s.messages.map((m) =>
              m.id === data.message_id ? { ...m, content: data.content } : m
            ),
          }));
        }
        if (data.type === "log") {
          appendImagesDebugLog(data.message || JSON.stringify(data));
        }
        if (data.type === "llm_debug") {
          ingestPlannerLlmDebug(data, plannerDebugEntry && plannerDebugEntry.id);
          plannerDebugEntry = null;
        }
      }
    }
    appendImagesDebugLog("Stream de ilustración terminado");
    if (queuedAny) {
      startImageQueuePoll();
      if (layoutStore.get().centerQueueVisible) loadImageQueuePage();
      if (!opts.doneNotice) showNotice("Imágenes encoladas para generación.");
    }
    if (opts.doneNotice) showNotice(opts.doneNotice);
  } catch (e) {
    if (e && (e.name === "AbortError" || e.message === "The user aborted a request.")) {
      appStatus.update(imgStatusId, "images.cancelled");
      appendImagesDebugLog(`Stream abortado message=${messageId}`);
      if (plannerDebugEntry) {
        updateChatDebugEntry(plannerDebugEntry.id, {
          status: "cancelled",
          details: e.message || e.name,
        });
      }
    } else {
      appStatus.update(imgStatusId, "images.error", e.message || "");
      appendImagesDebugLog("Error: " + e.message);
      if (plannerDebugEntry) {
        updateChatDebugEntry(plannerDebugEntry.id, {
          status: "error",
          details: e.message || e.name,
        });
      }
      showError((opts.errorPrefix || "Ilustración: ") + e.message);
    }
  } finally {
    abortControllers.delete(abortCtrl);
    illustrating.delete(messageId);
    sessionStore.set({ illustratingIds: Array.from(illustrating) });
    appStatus.pop(imgStatusId);
  }
}

export async function maybeIllustrateAssistantMessage(messageId, options = {}) {
  const force = !!options.force;
  const prefs = imagesStore.get().prefs || {};
  const { conversationId } = sessionStore.get();
  if ((!force && !prefs.enabled) || !conversationId || !messageId) return;
  if (illustrating.has(messageId)) return;
  const snap = collectImagesSnapshot();
  if (!snap.use_chat_config && !snap.prompt_model) {
    showNotice("Imágenes: elige un modelo LLM de prompts en la pestaña Imágenes.");
    return;
  }
  const forge = readForgePanelParams();
  await runIllustrationStream({
    messageId,
    url: `${API}/conversations/${conversationId}/messages/${messageId}/illustrate`,
    body: snapshotBody({
      visual_consistency: isVisualConsistencyEnabled(),
      prompt_system_instructions: getPlannerRulesTextForSystem(),
      steps: forge.steps,
      width: forge.width,
      height: forge.height,
      seed: forge.seed,
    }),
    debugLabel: `Iniciando illustrate message=${messageId}${force ? " (manual)" : ""}`,
    doneNotice: force ? "Ilustración terminada." : null,
    errorPrefix: "Ilustración: ",
  });
}

export async function generateRemainingImages(messageId) {
  const { conversationId } = sessionStore.get();
  if (!conversationId || !messageId || illustrating.has(messageId)) return;
  const snap = collectImagesSnapshot();
  const forge = readForgePanelParams();
  await runIllustrationStream({
    messageId,
    url: `${API}/conversations/${conversationId}/messages/${messageId}/illustrations/generate-remaining`,
    body: snapshotBody({
      retries: snap.retries,
      batch_size: snap.batch_size,
      visual_consistency: isVisualConsistencyEnabled(),
      steps: forge.steps,
    }),
    debugLabel: `Iniciando generate-remaining message=${messageId}`,
    doneNotice: "Imágenes restantes terminadas.",
    errorPrefix: "Imágenes restantes: ",
  });
}

export async function illustrateAtParagraph(messageId, paragraphIndex, excerpt) {
  const { conversationId } = sessionStore.get();
  if (!conversationId || !messageId || illustrating.has(messageId)) return;
  const idx = paragraphIndex == null ? 0 : parseInt(paragraphIndex, 10);
  if (Number.isNaN(idx) || idx < 0) {
    showNotice("No se pudo localizar el párrafo.");
    return;
  }
  const snap = collectImagesSnapshot();
  if (!snap.use_chat_config && !snap.prompt_model) {
    showNotice("Imágenes: elige un modelo LLM de prompts en la pestaña Imágenes.");
    return;
  }
  const forge = readForgePanelParams();
  await runIllustrationStream({
    messageId,
    url: `${API}/conversations/${conversationId}/messages/${messageId}/illustrations/illustrate-at`,
    body: snapshotBody({
      images_per_response: 1,
      paragraph_index: idx,
      selected_excerpt: excerpt ? String(excerpt).trim() : "",
      visual_consistency: isVisualConsistencyEnabled(),
      steps: forge.steps,
    }),
    debugLabel: `Iniciando illustrate-at message=${messageId} párrafo=${idx}`,
    doneNotice: "Imagen del párrafo terminada.",
    errorPrefix: "Ilustración: ",
  });
}

export function abortAllIllustrations() {
  const n = abortControllers.size;
  abortControllers.forEach((c) => c.abort());
  abortControllers.clear();
  illustrating.clear();
  sessionStore.set({ illustratingIds: [] });
  showNotice(n ? `Abortadas ${n} generación(es) de imágenes.` : "No hay generaciones activas.");
}
