import { imagesStore, persistImagesPrefs } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import { settingsStore } from "../store/settings.js";
import * as conversationsApi from "../api/conversations.js";
import * as modelsApi from "../api/models.js";
import * as imagesApi from "../api/images.js";
import {
  serializeRuleItems,
  normalizePlannerRulesFromPrefs,
  hydratePlannerRulesFromLibrary,
  loadPlannerLibraryRules,
  registerPlannerRulesPersister,
} from "./rulesActions.js";
import {
  fillRecipeChipHost,
  fillThinkOptions,
  paramValuesEqual,
  RECIPE_PARAM_LABELS,
  recipeIdsFromContract,
  recipesFromContract,
  showThinking,
  thinkSelectValue,
  thinkingFromContract,
} from "../lib/contractUi.js";
import { normalizeModelsResponse } from "./settingsActions.js";

const GALLERY_PAGE_SIZE = 24;

function readOptionalIntInput(el) {
  if (!el) return undefined;
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) ? v : undefined;
}

function readOptionalNumber(value) {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
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
  const reactor = {
    enabled: enabled ? !!enabled.checked : !!stored.enabled,
    female_enabled: femaleOn ? !!femaleOn.checked : !!stored.female_enabled,
    male_enabled: maleOn ? !!maleOn.checked : !!stored.male_enabled,
    female_face_model: femaleModel ? femaleModel.value : stored.female_face_model || "",
    male_face_model: maleModel ? maleModel.value : stored.male_face_model || "",
  };
  const codeformerWeight = readOptionalNumber(
    codeformer ? codeformer.value : stored.codeformer_weight
  );
  if (codeformerWeight != null) reactor.codeformer_weight = codeformerWeight;
  return reactor;
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

function plannerOverlayParamDefaults() {
  const contract = imagesStore.get().plannerContract;
  if (!contract) return {};
  const out = {};
  if (showThinking(contract)) {
    const spec = plannerParamSpec("think");
    const thinking = thinkingFromContract(contract);
    const def = spec && spec.default !== undefined ? spec.default : thinking && thinking.default;
    if (def !== undefined && def !== null) out.think = def;
  }
  recipeIdsFromContract(contract).forEach((paramId) => {
    if (paramId === "think") return;
    const spec = plannerParamSpec(paramId);
    if (spec && spec.default !== undefined && spec.default !== null) {
      out[paramId] = spec.default;
    }
  });
  return out;
}

export function collectPlannerModelParams() {
  const stored = imagesStore.get().prefs.prompt_model_params || {};
  return {
    ...plannerOverlayParamDefaults(),
    ...stored,
  };
}

function plannerModelParams() {
  return collectPlannerModelParams();
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

let plannerRulesHydrated = false;

export function resetPlannerRulesHydration() {
  plannerRulesHydrated = false;
}

export function hydratePlannerRulesFromImagesPrefs() {
  const prefs = imagesStore.get().prefs || {};
  if (prefs.prompt_system_instructions) {
    sessionStore.set({ plannerRules: normalizePlannerRulesFromPrefs(prefs.prompt_system_instructions) });
  }
  plannerRulesHydrated = true;
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
  plannerRulesHydrated = true;
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
  const incomingRules = snap.prompt_system_instructions;
  const prevRules = prev.prompt_system_instructions;
  if (
    !plannerRulesHydrated &&
    Array.isArray(prevRules) &&
    prevRules.length &&
    (!Array.isArray(incomingRules) || incomingRules.length === 0)
  ) {
    snap.prompt_system_instructions = prevRules;
  }
  persistImagesPrefs(snap);
  imagesStore.set((s) => ({ ...s, prefs: { ...s.prefs, ...snap } }));
  syncImagesChatConfigDisabled();
  debouncedPersistImagesToConversation();
}

registerPlannerRulesPersister(persistImagesPanel);

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
    const names = normalizeModelsResponse(data);
    const modelSel = document.getElementById("images-prompt-model");
    if (modelSel) {
      const keep = modelSel.value || imagesStore.get().prefs.prompt_model || "";
      modelSel.innerHTML = names.map((n) => `<option value="${n}">${n}</option>`).join("");
      if (keep && names.includes(keep)) modelSel.value = keep;
      else if (names[0]) modelSel.value = names[0];
    }
    imagesStore.set((s) => ({
      ...s,
      prefs: { ...s.prefs, _promptModels: names },
    }));
  } catch (_) {}
}

export async function ensureImagesPromptSelects() {
  const providerSel = document.getElementById("images-prompt-provider");
  const modelSel = document.getElementById("images-prompt-model");
  if (!providerSel || !modelSel) return;
  const prefs = imagesStore.get().prefs || {};
  let providers = (settingsStore.get().providers || [])
    .map((p) => (typeof p === "string" ? p : p.name))
    .filter(Boolean);
  if (!providers.length) {
    try {
      const data = await modelsApi.listProviders();
      providers = (data || []).map((p) => (typeof p === "string" ? p : p.name)).filter(Boolean);
      if (providers.length) {
        const current = settingsStore.get().currentProvider;
        const next = providers.includes(current) ? current : providers[0];
        settingsStore.set({ providers, currentProvider: next });
      }
    } catch (_) {}
  }
  if (providers.length) {
    providerSel.innerHTML = providers.map((p) => `<option value="${p}">${p}</option>`).join("");
    const keep = prefs.prompt_provider || settingsStore.get().currentProvider || providers[0];
    if (keep && providers.includes(keep)) providerSel.value = keep;
  }
  await loadImagesPromptModels();
}

function plannerRecipes() {
  return recipesFromContract(imagesStore.get().plannerContract);
}

function plannerParamSpec(paramId) {
  const contract = imagesStore.get().plannerContract;
  return (contract && contract.params && contract.params[paramId]) || null;
}

function plannerPresetsUseChatConfig() {
  const node = document.getElementById("images-use-chat-config");
  if (node) return !!node.checked;
  return !!imagesStore.get().prefs.use_chat_config;
}

function coercePlannerParamValue(paramId, raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (paramId === "think") {
    if (raw === true || raw === "true") return true;
    if (raw === false || raw === "false") return false;
    return raw;
  }
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const n = Number(raw);
  if (Number.isFinite(n) && String(raw).trim() !== "") return n;
  return raw;
}

function plannerRecipeMatches(recipe) {
  const params = (recipe && recipe.params) || {};
  const current = plannerModelParams();
  return Object.keys(params).every((paramId) => {
    if (!Object.prototype.hasOwnProperty.call(current, paramId)) return false;
    return paramValuesEqual(paramId, current[paramId], params[paramId]);
  });
}

function plannerParamLabel(paramId) {
  const spec = plannerParamSpec(paramId);
  return (spec && spec.label) || RECIPE_PARAM_LABELS[paramId] || paramId;
}

function syncPlannerRecipeChipSelection() {
  const recipes = plannerRecipes();
  const active = recipes.find((recipe) => plannerRecipeMatches(recipe));
  const activeId = active && active.id;
  document.querySelectorAll("#planner-recipes .composer-recipe-chip").forEach((btn) => {
    const on = Boolean(activeId && btn.dataset.recipeId === activeId);
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const owned = active && active.params ? Object.keys(active.params) : [];
  document.querySelectorAll("#planner-recipe-params .settings-recipe-param").forEach((row) => {
    row.classList.toggle("is-owned", owned.includes(row.dataset.paramId));
  });
}

function syncPlannerPresetsVisibility() {
  const onChat = plannerPresetsUseChatConfig();
  const hint = document.getElementById("planner-presets-chat-hint");
  const emptyEl = document.getElementById("planner-presets-empty");
  const controls = document.getElementById("planner-presets-controls");
  const inspector = document.getElementById("planner-recipe-params");
  const wrap = document.getElementById("planner-think-wrap");
  const thinkEl = document.getElementById("planner-think");
  if (hint) hint.hidden = !onChat;
  if (onChat) {
    if (emptyEl) emptyEl.hidden = true;
    if (controls) controls.hidden = true;
    if (inspector) inspector.hidden = true;
    return;
  }
  const recipes = plannerRecipes();
  const contract = imagesStore.get().plannerContract;
  const canThink = showThinking(contract);
  const showRecipes = recipes.length > 0;
  if (emptyEl) emptyEl.hidden = showRecipes;
  if (controls) controls.hidden = !canThink && !showRecipes;
  if (wrap) wrap.hidden = !canThink;
  if (thinkEl) thinkEl.disabled = !canThink;
  if (inspector) {
    const ids = recipeIdsFromContract(contract).filter((id) => id !== "think");
    inspector.hidden = !ids.length;
  }
}

function createPlannerParamControl(paramId, spec) {
  const control = document.createElement("input");
  control.type = "number";
  control.className = "param-control";
  control.setAttribute("data-planner-param-id", paramId);
  if (paramId === "temperature" || paramId === "top_p" || paramId === "min_p") {
    control.step = "0.1";
    if (!control.min) control.min = "0";
    if (paramId === "temperature") control.max = "2";
    if (paramId === "top_p" || paramId === "min_p") control.max = "1";
  } else {
    control.step = "1";
  }
  if (spec) {
    if (spec.min != null) control.min = String(spec.min);
    if (spec.max != null) control.max = String(spec.max);
    if (spec.step != null) control.step = String(spec.step);
    if (spec.default != null) control.placeholder = String(spec.default);
  }
  if (paramId === "num_ctx" && !control.min) control.min = "512";
  return control;
}

function writePlannerParamFromControl(paramId, control) {
  const value = coercePlannerParamValue(paramId, control.value);
  const next = { ...plannerModelParams() };
  if (value === null) delete next[paramId];
  else next[paramId] = value;
  updateImagesPref({ prompt_model_params: next });
  syncPlannerRecipeChipSelection();
}

function rebuildPlannerRecipeInspector() {
  const host = document.getElementById("planner-recipe-params");
  if (!host) return;
  const contract = imagesStore.get().plannerContract;
  const ids = recipeIdsFromContract(contract).filter((id) => id !== "think");
  host.innerHTML = "";
  if (!ids.length || plannerPresetsUseChatConfig()) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  ids.forEach((paramId) => {
    const spec = plannerParamSpec(paramId) || {};
    const row = document.createElement("div");
    row.className = "settings-recipe-param";
    row.dataset.paramId = paramId;
    const label = document.createElement("label");
    label.className = "settings-recipe-param-label";
    const controlId = "planner-recipe-param-" + paramId;
    label.setAttribute("for", controlId);
    label.textContent = plannerParamLabel(paramId);
    const control = createPlannerParamControl(paramId, spec);
    control.id = controlId;
    const stored = plannerModelParams()[paramId];
    const display = stored !== undefined && stored !== null ? stored : spec.default;
    if (display !== undefined && display !== null) control.value = String(display);
    control.addEventListener("input", () => writePlannerParamFromControl(paramId, control));
    control.addEventListener("change", () => writePlannerParamFromControl(paramId, control));
    row.appendChild(label);
    row.appendChild(control);
    host.appendChild(row);
  });
  syncPlannerRecipeChipSelection();
}

export function renderPlannerRecipes() {
  const wrap = document.getElementById("planner-think-wrap");
  const thinkEl = document.getElementById("planner-think");
  const recipes = plannerRecipes();
  const contract = imagesStore.get().plannerContract;
  const thinking = thinkingFromContract(contract);
  const canThink = showThinking(contract);
  if (wrap) wrap.hidden = !canThink;
  if (thinkEl) {
    if (canThink) {
      fillThinkOptions(thinkEl, thinking);
      thinkEl.disabled = plannerPresetsUseChatConfig();
      thinkEl.classList.remove("control-disabled");
      const spec = plannerParamSpec("think");
      const def = spec && spec.default !== undefined ? spec.default : thinking.default;
      const current = Object.prototype.hasOwnProperty.call(plannerModelParams(), "think")
        ? plannerModelParams().think
        : def;
      if (current !== undefined && current !== null) thinkEl.value = thinkSelectValue(current);
    } else {
      thinkEl.disabled = true;
      thinkEl.classList.add("control-disabled");
      thinkEl.innerHTML = "";
    }
  }
  fillRecipeChipHost(document.getElementById("planner-recipes"), recipes, applyPlannerRecipe);
  rebuildPlannerRecipeInspector();
  syncPlannerPresetsVisibility();
  syncPlannerRecipeChipSelection();
}

export async function loadPlannerContract() {
  const providerSel = document.getElementById("images-prompt-provider");
  const modelSel = document.getElementById("images-prompt-model");
  const provider = (providerSel && providerSel.value) || imagesStore.get().prefs.prompt_provider || "";
  const modelId = (modelSel && modelSel.value) || imagesStore.get().prefs.prompt_model || "";
  if (!provider || !modelId) {
    imagesStore.set({ plannerContract: null });
    renderPlannerRecipes();
    return;
  }
  try {
    const contract = await modelsApi.getModelContract(provider, modelId);
    imagesStore.set({ plannerContract: contract });
  } catch (_) {
    imagesStore.set({ plannerContract: null });
  }
  const latest = imagesStore.get().prefs || {};
  const sameTarget = latest.prompt_provider === provider && latest.prompt_model === modelId;
  const previous =
    sameTarget && latest.prompt_model_params && typeof latest.prompt_model_params === "object"
      ? latest.prompt_model_params
      : {};
  const seeded = { ...plannerOverlayParamDefaults(), ...previous };
  imagesStore.set((s) => {
    const prefs = { ...s.prefs, prompt_model_params: seeded };
    persistImagesPrefs(prefs);
    return { ...s, prefs };
  });
  renderPlannerRecipes();
}

export async function applyPlannerRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return;
  updateImagesPref({
    prompt_model_params: { ...plannerOverlayParamDefaults(), ...(recipe.params || {}) },
  });
  renderPlannerRecipes();
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
  hydratePlannerRulesFromImagesPrefs();
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
        if (node === providerSel) {
          loadImagesPromptModels()
            .then(loadPlannerContract)
            .then(persistImagesPanel);
        } else if (node === modelSel) {
          loadPlannerContract().then(persistImagesPanel);
        } else persistImagesPanel();
      });
    });
  syncReactorGenderInputs();
  if (reloadForgeBtn) {
    reloadForgeBtn.addEventListener("click", function () {
      reloadForgeParamsFromLastGen({ notify: true }).catch(function () {});
    });
  }
  const plannerThink = document.getElementById("planner-think");
  if (plannerThink && !plannerThink.dataset.boundThink) {
    plannerThink.dataset.boundThink = "1";
    plannerThink.addEventListener("change", function () {
      const value = coercePlannerParamValue("think", plannerThink.value);
      const next = { ...plannerModelParams() };
      if (value === null) delete next.think;
      else next.think = value;
      updateImagesPref({ prompt_model_params: next });
      renderPlannerRecipes();
    });
  }
  await loadPlannerContract();
  persistImagesPanel();
}

void GALLERY_PAGE_SIZE;
export { initImageGallery } from "./galleryActions.js";
