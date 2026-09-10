import * as modelsApi from "../api/models.js";
import { settingsStore } from "../store/settings.js";
import { showError } from "../store/ui.js";

export function normalizeModelsResponse(data) {
  function toNames(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((m) => (m && typeof m === "object" && m.name != null ? String(m.name).trim() : null))
      .filter((name) => name !== null && name !== "");
  }
  if (Array.isArray(data)) return toNames(data);
  if (data && typeof data === "object") {
    const arr = data.data || data.models;
    if (Array.isArray(arr)) return toNames(arr);
    if (typeof arr === "object" && arr !== null && !Array.isArray(arr)) return toNames(Object.values(arr));
  }
  return [];
}

export async function loadProviders() {
  try {
    const data = await modelsApi.listProviders();
    const providers = (data || []).map((p) => (typeof p === "string" ? p : p.name)).filter(Boolean);
    const current = settingsStore.get().currentProvider;
    const next = providers.includes(current) ? current : providers[0] || "ollama";
    settingsStore.set({ providers, currentProvider: next });
    return providers;
  } catch (_) {
    settingsStore.set({ providers: ["ollama"], currentProvider: "ollama" });
    return ["ollama"];
  }
}

export async function tryLoadModelsForProvider(providerName) {
  try {
    const data = await modelsApi.listModels(providerName);
    const models = normalizeModelsResponse(data);
    const prev = settingsStore.get().currentModel;
    const currentModel = models.includes(prev) ? prev : models[0] || "";
    settingsStore.set({ models, currentProvider: providerName, currentModel });
    return true;
  } catch (_) {
    return false;
  }
}

export async function loadModels(preserveSelection = false) {
  const { currentProvider, currentModel } = settingsStore.get();
  const provider = currentProvider || "ollama";
  try {
    const data = await modelsApi.listModels(provider);
    const models = normalizeModelsResponse(data);
    let nextModel = currentModel;
    if (!preserveSelection || !models.includes(currentModel)) {
      nextModel = models[0] || "";
    }
    settingsStore.set({ models, currentModel: nextModel });
    return models;
  } catch (e) {
    showError(`No se pudieron cargar los modelos de ${provider}: ` + e.message);
    settingsStore.set({ models: [], currentModel: preserveSelection ? currentModel : "" });
    return [];
  }
}

export async function loadParamsForProvider(providerName) {
  try {
    const data = await modelsApi.listProviderParams(providerName);
    const params = (data && data.params) || data || {};
    settingsStore.set({
      paramsConfig: { provider: providerName, params },
    });
  } catch (_) {
    settingsStore.set({ paramsConfig: { provider: providerName, params: {} } });
  }
}

export async function loadModelContract(opts = {}) {
  const { currentProvider, currentModel, paramsConfig } = settingsStore.get();
  if (!currentProvider || !currentModel) {
    settingsStore.set({ contract: null });
    return;
  }
  try {
    const contract = await modelsApi.getModelContract(currentProvider, currentModel);
    const merged = {
      ...paramsConfig.params,
      ...((contract && contract.params) || {}),
    };
    const baseline = { ...settingsStore.get().paramsBaseline };
    if (contract && contract.params) {
      Object.keys(contract.params).forEach((id) => {
        if (contract.params[id] && contract.params[id].default !== undefined) {
          baseline[id] = contract.params[id].default;
        }
      });
    }
    const patch = {
      contract,
      paramsConfig: { ...paramsConfig, params: merged },
      paramsBaseline: baseline,
    };
    if (opts.applyParamDefaults && contract && contract.params) {
      const values = { ...settingsStore.get().paramsValues };
      Object.keys(contract.params).forEach((id) => {
        if (contract.params[id] && contract.params[id].default !== undefined) {
          values[id] = contract.params[id].default;
        }
      });
      patch.paramsValues = values;
      patch.paramsSource = "default";
    }
    settingsStore.set(patch);
  } catch (_) {
    settingsStore.set({ contract: null });
  }
}

export function applyConversationParams(modelParams) {
  if (!modelParams || typeof modelParams !== "object") return;
  settingsStore.set((s) => ({
    ...s,
    paramsValues: { ...s.paramsValues, ...modelParams },
    paramsSource: "user",
  }));
}

export function applyModelRecipe(recipe) {
  if (!recipe || typeof recipe !== "object") return;
  if (settingsStore.get().paramsSource === "user") {
    const label = recipe.label || recipe.id || "esta receta";
    const ok = window.confirm(
      `Esto sustituye los ajustes de esta conversación por la receta «${label}». ¿Continuar?`
    );
    if (!ok) return;
  }
  applyConversationParams(recipe.params || {});
}

export async function refreshModels() {
  await loadModels(true);
  await loadModelContract({ applyParamDefaults: false });
}

export async function changeProvider(providerName) {
  settingsStore.set({ currentProvider: providerName });
  await loadParamsForProvider(providerName);
  const ok = await tryLoadModelsForProvider(providerName);
  if (!ok) await loadModels(false);
  await loadModelContract({ applyParamDefaults: true });
}

export function changeModel(modelId) {
  settingsStore.set({ currentModel: modelId, modelSelectOpen: false, modelSelectQuery: "" });
  loadModelContract({ applyParamDefaults: true });
}

export function currentRecipes() {
  const contract = settingsStore.get().contract;
  return (contract && contract.recipes) || [];
}

export function fillRecipeChipHost(host, recipes, applyFn) {
  if (!host) return;
  const list = recipes || [];
  host.innerHTML = list
    .map((r) => `<button type="button" class="recipe-chip" data-recipe-id="${r.id || r.label}">${r.label || r.id}</button>`)
    .join("");
  host.querySelectorAll(".recipe-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const recipe = list.find((r) => String(r.id || r.label) === btn.dataset.recipeId);
      if (recipe && applyFn) applyFn(recipe);
    });
  });
}

export function syncRecipeChipSelection() {
  const recipes = currentRecipes();
  const values = settingsStore.get().paramsValues;
  document.querySelectorAll(".recipe-chip").forEach((btn) => {
    const recipe = recipes.find((r) => String(r.id || r.label) === btn.dataset.recipeId);
    const match = recipe && recipe.params && Object.keys(recipe.params).every((k) => values[k] === recipe.params[k]);
    btn.classList.toggle("is-selected", !!match);
  });
}

export function rebuildRecipeParamInspector() {
  const host = document.getElementById("settings-recipe-params");
  document.getElementById("settings-recipes");
  document.getElementById("settings-think");
  if (!host) return;
  const recipes = currentRecipes();
  host.hidden = recipes.length === 0;
  const ids = new Set();
  recipes.forEach((r) => {
    Object.keys((r && r.params) || {}).forEach((id) => ids.add(id));
  });
  host.innerHTML = Array.from(ids)
    .map((id) => `<label class="settings-recipe-param" data-recipe-param-id="${id}" data-planner-param-id="${id}">${id}</label>`)
    .join("");
}

export function syncSettingsPresetsMirrors() {
  const recipes = currentRecipes();
  fillRecipeChipHost(document.getElementById("settings-recipes"), recipes, applyModelRecipe);
  fillRecipeChipHost(document.getElementById("composer-recipes"), recipes, applyModelRecipe);
  fillRecipeChipHost(document.getElementById("planner-recipes"), recipes, applyPlannerRecipeFromSettings);
  syncRecipeChipSelection();
  rebuildRecipeParamInspector();
}

function applyPlannerRecipeFromSettings(recipe) {
  import("./imagesPanel.js").then((m) => m.applyPlannerRecipe(recipe));
}
