import { imagesStore, persistImagesPrefs } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import * as conversationsApi from "../api/conversations.js";
import * as modelsApi from "../api/models.js";
import * as imagesApi from "../api/images.js";
import {
  serializeRuleItems,
  normalizePlannerRulesFromPrefs,
  hydratePlannerRulesFromLibrary,
  loadPlannerLibraryRules,
} from "./rulesActions.js";

const GALLERY_PAGE_SIZE = 24;

function readOptionalIntInput(el) {
  if (!el) return undefined;
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) ? v : undefined;
}

export function readForgePanelParams() {
  return {
    steps: readOptionalIntInput(document.getElementById("images-forge-steps")),
    width: readOptionalIntInput(document.getElementById("images-forge-width")),
    height: readOptionalIntInput(document.getElementById("images-forge-height")),
    seed: readOptionalIntInput(document.getElementById("images-forge-seed")),
  };
}

export function applyForgePanelParams(prefs) {
  const steps = document.getElementById("images-forge-steps");
  const width = document.getElementById("images-forge-width");
  const height = document.getElementById("images-forge-height");
  const seed = document.getElementById("images-forge-seed");
  if (steps && prefs.steps != null) steps.value = prefs.steps;
  if (width && prefs.width != null) width.value = prefs.width;
  if (height && prefs.height != null) height.value = prefs.height;
  if (seed && prefs.seed != null) seed.value = prefs.seed;
}

export function isVisualConsistencyEnabled() {
  const el = document.getElementById("images-visual-consistency");
  if (el) return !!el.checked;
  return imagesStore.get().prefs.visual_consistency !== false;
}

export function readReactorPanelSettings() {
  const enabled = document.getElementById("images-reactor-enabled");
  const femaleOn = document.getElementById("images-reactor-female-enabled");
  const maleOn = document.getElementById("images-reactor-male-enabled");
  const femaleModel = document.getElementById("images-reactor-female-face-model");
  const maleModel = document.getElementById("images-reactor-male-face-model");
  const codeformer = document.getElementById("images-reactor-codeformer-weight");
  const stored = imagesStore.get().prefs.reactor || {};
  return {
    enabled: enabled ? !!enabled.checked : !!stored.enabled,
    female_enabled: femaleOn ? !!femaleOn.checked : !!stored.female_enabled,
    male_enabled: maleOn ? !!maleOn.checked : !!stored.male_enabled,
    female_face_model: femaleModel ? femaleModel.value : stored.female_face_model || "",
    male_face_model: maleModel ? maleModel.value : stored.male_face_model || "",
    codeformer_weight: codeformer ? codeformer.value : stored.codeformer_weight,
  };
}

export function applyReactorPanelSettings(reactor) {
  const r = reactor || {};
  const enabled = document.getElementById("images-reactor-enabled");
  const femaleOn = document.getElementById("images-reactor-female-enabled");
  const maleOn = document.getElementById("images-reactor-male-enabled");
  const femaleModel = document.getElementById("images-reactor-female-face-model");
  const maleModel = document.getElementById("images-reactor-male-face-model");
  const codeformer = document.getElementById("images-reactor-codeformer-weight");
  if (enabled) enabled.checked = !!r.enabled;
  if (femaleOn) femaleOn.checked = !!r.female_enabled;
  if (maleOn) maleOn.checked = !!r.male_enabled;
  if (femaleModel && r.female_face_model != null) femaleModel.value = r.female_face_model;
  if (maleModel && r.male_face_model != null) maleModel.value = r.male_face_model;
  if (codeformer && r.codeformer_weight != null) codeformer.value = r.codeformer_weight;
  syncReactorGenderInputs();
}

export function syncReactorGenderInputs() {
  const femaleOn = document.getElementById("images-reactor-female-enabled");
  const femaleModel = document.getElementById("images-reactor-female-face-model");
  const maleOn = document.getElementById("images-reactor-male-enabled");
  const maleModel = document.getElementById("images-reactor-male-face-model");
  if (femaleModel) femaleModel.disabled = !(femaleOn && femaleOn.checked);
  if (maleModel) maleModel.disabled = !(maleOn && maleOn.checked);
}

export async function fetchForgeReactorDefaults() {
  try {
    const data = await imagesApi.getForgeReactorDefaults();
    if (data && data.defaults) {
      applyReactorPlaceholders(data.defaults);
    }
  } catch (_) {}
}

export function applyReactorPlaceholders(defaults) {
  void defaults;
}

export function reactorPanelInputNodes() {
  return [
    document.getElementById("images-reactor-enabled"),
    document.getElementById("images-reactor-female-enabled"),
    document.getElementById("images-reactor-male-enabled"),
    document.getElementById("images-reactor-female-face-model"),
    document.getElementById("images-reactor-male-face-model"),
    document.getElementById("images-reactor-codeformer-weight"),
  ].filter(Boolean);
}

export function collectPlannerModelParams() {
  return imagesStore.get().prefs.prompt_model_params || {};
}

export function collectImagesSnapshot() {
  const enabled = document.getElementById("images-enabled");
  const useChatConfig = document.getElementById("images-use-chat-config");
  const per = document.getElementById("images-per-response");
  const batchSize = document.getElementById("images-batch-size");
  const retries = document.getElementById("images-retries");
  const promptEl = document.getElementById("images-prompt");
  const providerSel = document.getElementById("images-prompt-provider");
  const modelSel = document.getElementById("images-prompt-model");
  const prefs = imagesStore.get().prefs || {};
  const plannerRules = sessionStore.get().plannerRules || [];
  const forge = readForgePanelParams();
  return {
    enabled: enabled ? !!enabled.checked : !!prefs.enabled,
    use_chat_config: useChatConfig ? !!useChatConfig.checked : !!prefs.use_chat_config,
    visual_consistency: isVisualConsistencyEnabled(),
    images_per_response: per ? parseInt(per.value, 10) || 2 : parseInt(prefs.images_per_response, 10) || 2,
    batch_size: batchSize ? parseInt(batchSize.value, 10) || 10 : parseInt(prefs.batch_size, 10) || 10,
    retries: retries ? parseInt(retries.value, 10) || 0 : parseInt(prefs.retries, 10) || 0,
    prompt: promptEl ? String(promptEl.value || "") : String(prefs.prompt || ""),
    prompt_system_instructions: serializeRuleItems(plannerRules),
    prompt_provider: providerSel ? providerSel.value : prefs.prompt_provider || "",
    prompt_model: modelSel ? modelSel.value : prefs.prompt_model || "",
    prompt_model_params: collectPlannerModelParams(),
    steps: forge.steps != null ? forge.steps : prefs.steps,
    width: forge.width != null ? forge.width : prefs.width,
    height: forge.height != null ? forge.height : prefs.height,
    seed: forge.seed != null ? forge.seed : prefs.seed,
    reactor: readReactorPanelSettings(),
  };
}

export function fillImagesPanelFromPrefs(prefs) {
  if (!prefs) return;
  const enabled = document.getElementById("images-enabled");
  const useChatConfig = document.getElementById("images-use-chat-config");
  const visualConsistency = document.getElementById("images-visual-consistency");
  const per = document.getElementById("images-per-response");
  const batchSize = document.getElementById("images-batch-size");
  const retries = document.getElementById("images-retries");
  const promptEl = document.getElementById("images-prompt");
  if (enabled) enabled.checked = !!prefs.enabled;
  if (useChatConfig) useChatConfig.checked = !!prefs.use_chat_config;
  if (visualConsistency) visualConsistency.checked = prefs.visual_consistency !== false;
  if (per && prefs.images_per_response != null) per.value = prefs.images_per_response;
  if (batchSize && prefs.batch_size != null) batchSize.value = prefs.batch_size;
  if (retries && prefs.retries != null) retries.value = prefs.retries;
  if (promptEl && prefs.prompt != null) promptEl.value = prefs.prompt;
  if (prefs.prompt_system_instructions) {
    sessionStore.set({ plannerRules: normalizePlannerRulesFromPrefs(prefs.prompt_system_instructions) });
  }
  applyReactorPanelSettings(prefs.reactor || (prefs.reactor_enabled ? { enabled: true } : {}));
  if (prefs.steps != null || prefs.width != null || prefs.height != null || prefs.seed != null) {
    applyForgePanelParams(prefs);
  }
  imagesStore.set((s) => {
    const next = { ...s.prefs, ...prefs };
    persistImagesPrefs(next);
    return { ...s, prefs: next };
  });
}

export function syncImagesChatConfigDisabled() {
  const on = !!imagesStore.get().prefs.use_chat_config;
  document.querySelectorAll("[data-images-chat-config-control]").forEach((el) => {
    el.querySelectorAll("input, select, textarea, button").forEach((ctrl) => {
      ctrl.disabled = on;
    });
  });
  const hint = document.getElementById("planner-presets-chat-hint");
  if (hint) hint.hidden = !on;
}

export function imagesSnapshotForConversation() {
  const snap = collectImagesSnapshot();
  const prev = imagesStore.get().prefs || {};
  if (!snap.prompt_provider && prev.prompt_provider) snap.prompt_provider = prev.prompt_provider;
  if (!snap.prompt_model && prev.prompt_model) snap.prompt_model = prev.prompt_model;
  delete snap.prompt_system_instructions;
  return snap;
}

export function persistImagesToConversation() {
  const id = sessionStore.get().conversationId;
  if (!id) return;
  const snap = imagesSnapshotForConversation();
  conversationsApi.patchConversation(id, { images: snap }).catch(() => {});
}

export function debouncedPersistImagesToConversation() {
  persistImagesToConversation();
}

export function persistImagesPanel() {
  const snap = collectImagesSnapshot();
  const prev = imagesStore.get().prefs || {};
  if (!snap.prompt_provider && prev.prompt_provider) snap.prompt_provider = prev.prompt_provider;
  if (!snap.prompt_model && prev.prompt_model) snap.prompt_model = prev.prompt_model;
  persistImagesPrefs(snap);
  imagesStore.set((s) => ({ ...s, prefs: { ...s.prefs, ...snap } }));
  syncImagesChatConfigDisabled();
  debouncedPersistImagesToConversation();
}

export function updateImagesPref(patch) {
  imagesStore.set((s) => {
    const prefs = { ...s.prefs, ...patch };
    persistImagesPrefs(prefs);
    return { ...s, prefs };
  });
  persistImagesPanel();
}

export async function applyImagesSnapshot(images, options) {
  const incoming = images && typeof images === "object" ? Object.assign({}, images) : {};
  if (!(options && options.includePlannerRules)) {
    delete incoming.prompt_system_instructions;
  }
  const next = Object.assign({}, imagesStore.get().prefs || {}, incoming);
  delete next.debug;
  persistImagesPrefs(next);
  imagesStore.set((s) => ({ ...s, prefs: next }));
  fillImagesPanelFromPrefs(imagesStore.get().prefs);
  syncImagesChatConfigDisabled();
  await ensureImagesPromptSelects();
  const providerSel = document.getElementById("images-prompt-provider");
  const modelSel = document.getElementById("images-prompt-model");
  if (providerSel && incoming.prompt_provider) {
    providerSel.value = incoming.prompt_provider;
    await loadImagesPromptModels();
  }
  if (modelSel && incoming.prompt_model) modelSel.value = incoming.prompt_model;
  await loadPlannerContract();
  persistImagesPanel();
}

export async function loadImagesPromptModels() {
  const providerSel = document.getElementById("images-prompt-provider");
  const provider = (providerSel && providerSel.value) || imagesStore.get().prefs.prompt_provider || "ollama";
  try {
    const data = await modelsApi.listModels(provider);
    const names = Array.isArray(data)
      ? data.map((m) => (m && m.name) || m).filter(Boolean)
      : [];
    const modelSel = document.getElementById("images-prompt-model");
    if (modelSel) {
      const keep = modelSel.value;
      modelSel.innerHTML = names.map((n) => `<option value="${n}">${n}</option>`).join("");
      if (keep && names.includes(keep)) modelSel.value = keep;
    }
    imagesStore.set((s) => ({
      ...s,
      prefs: { ...s.prefs, _promptModels: names },
    }));
  } catch (_) {}
}

export async function loadPlannerContract() {
  const providerSel = document.getElementById("images-prompt-provider");
  const modelSel = document.getElementById("images-prompt-model");
  const provider = providerSel ? providerSel.value : "";
  const modelId = modelSel ? modelSel.value : "";
  const prefs = imagesStore.get().prefs || {};
  if (!provider || !modelId) {
    imagesStore.set({ plannerContract: null });
    return;
  }
  try {
    const contract = await modelsApi.getModelContract(provider, modelId);
    imagesStore.set({ plannerContract: contract });
  } catch (_) {
    imagesStore.set({ plannerContract: null });
  }
  void prefs;
}

export async function applyPlannerRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return;
  updateImagesPref({ prompt_model_params: { ...(recipe.params || {}) } });
}

export async function ensureImagesPromptSelects() {
  await loadImagesPromptModels();
}

export async function reloadForgeParamsFromLastGen(options = {}) {
  try {
    const data = await imagesApi.getForgeLastGenerationParams();
    if (!data || !data.available) {
      throw new Error((data && data.detail) || "No hay último gen disponible");
    }
    updateImagesPref({
      steps: data.steps,
      width: data.width,
      height: data.height,
      seed: data.seed,
    });
    applyForgePanelParams(data);
    void options;
    return data;
  } catch (e) {
    throw e;
  }
}

export async function fetchForgeLastGenerationParams() {
  return reloadForgeParamsFromLastGen();
}

export async function initImagesPanel() {
  const prefs = imagesStore.get().prefs || {};
  fillImagesPanelFromPrefs(prefs);
  await fetchForgeReactorDefaults();
  await ensureImagesPromptSelects();
  await loadPlannerLibraryRules();
  hydratePlannerRulesFromLibrary();
  const enabled = document.getElementById("images-enabled");
  const useChatConfig = document.getElementById("images-use-chat-config");
  const visualConsistency = document.getElementById("images-visual-consistency");
  const per = document.getElementById("images-per-response");
  const batchSize = document.getElementById("images-batch-size");
  const retries = document.getElementById("images-retries");
  const promptEl = document.getElementById("images-prompt");
  const providerSel = document.getElementById("images-prompt-provider");
  const modelSel = document.getElementById("images-prompt-model");
  const forgeSteps = document.getElementById("images-forge-steps");
  const forgeWidth = document.getElementById("images-forge-width");
  const forgeHeight = document.getElementById("images-forge-height");
  const forgeSeed = document.getElementById("images-forge-seed");
  const reloadForgeBtn = document.getElementById("btn-images-forge-reload-params");
  const forgeParamInputs = [forgeSteps, forgeWidth, forgeHeight, forgeSeed];
  [enabled, useChatConfig, visualConsistency, per, batchSize, retries, promptEl, providerSel, modelSel]
    .concat(forgeParamInputs)
    .concat(reactorPanelInputNodes())
    .forEach((node) => {
      if (!node) return;
      const evt =
        node === promptEl ||
        node.id === "images-reactor-female-face-model" ||
        node.id === "images-reactor-male-face-model" ||
        (node.id && node.id.indexOf("images-reactor-") === 0 && node.type === "text")
          ? "input"
          : "change";
      node.addEventListener(evt, function () {
        if (node.id === "images-reactor-female-enabled" || node.id === "images-reactor-male-enabled") {
          syncReactorGenderInputs();
        }
        persistImagesPanel();
      });
    });
  syncReactorGenderInputs();
  if (reloadForgeBtn) {
    reloadForgeBtn.addEventListener("click", function () {
      reloadForgeParamsFromLastGen({ notify: true }).catch(function () {});
    });
  }
  persistImagesPanel();
}

void GALLERY_PAGE_SIZE;
export { initImageGallery } from "./galleryActions.js";
