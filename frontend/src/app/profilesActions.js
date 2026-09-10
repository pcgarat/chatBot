import * as profilesApi from "../api/workspaceProfiles.js";
import { layoutStore, updateLayout } from "../store/layout.js";
import { settingsStore } from "../store/settings.js";
import { imagesStore } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import { showError, showNotice } from "../store/ui.js";
import { collectImagesSnapshot, applyImagesSnapshot, imagesSnapshotForConversation, persistImagesPanel } from "./imagesPanel.js";
import { serializeRuleItems, normalizePlannerRulesFromPrefs } from "./rulesActions.js";
import { collectAllModelParams } from "../lib/params.js";
import { changeProvider, changeModel, applyConversationParams } from "./settingsActions.js";

let profilesCache = [];
let plannerPresetsCache = [];

export function collectWorkspaceSnapshot() {
  const layout = layoutStore.get();
  const settings = settingsStore.get();
  return {
    provider: settings.currentProvider,
    model_id: settings.currentModel,
    model_params: collectAllModelParams(),
    params_excluded: settings.paramsExcludedFromSendByConv,
    images: collectImagesSnapshot(),
    system_instructions: sessionStore.get().rules,
    history_turns: settings.historyTurns,
    layout: {
      darkMode: layout.darkMode,
      leftSidebarCollapsed: layout.leftSidebarCollapsed,
      uiBaseFontScale: layout.uiBaseFontScale,
      sidebarTab: layout.sidebarTab,
    },
    rules: sessionStore.get().rules,
  };
}

export async function persistWorkspaceToConversation() {
  const { conversationId } = sessionStore.get();
  if (!conversationId) return;
  const snap = collectWorkspaceSnapshot();
  const images = imagesSnapshotForConversation();
  const { patchConversation } = await import("../api/conversations.js");
  await patchConversation(conversationId, {
    provider: snap.provider,
    model_id: snap.model_id,
    model_params: snap.model_params,
    history_turns: snap.history_turns,
    system_instructions: snap.system_instructions,
    images: images,
  });
}

export async function applyWorkspaceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  if (snapshot.provider) await changeProvider(snapshot.provider);
  if (snapshot.model_id) changeModel(snapshot.model_id);
  if (snapshot.model_params) applyConversationParams(snapshot.model_params);
  if (snapshot.images) applyImagesSnapshot(snapshot.images, { includePlannerRules: true });
  if (snapshot.layout) updateLayout(snapshot.layout);
  if (Array.isArray(snapshot.rules) || snapshot.system_instructions) {
    sessionStore.set({ rules: snapshot.rules || snapshot.system_instructions || [] });
  }
  await persistWorkspaceToConversation();
}

export async function refreshWorkspaceProfiles() {
  try {
    profilesCache = await profilesApi.listWorkspaceProfiles();
    return profilesCache;
  } catch (e) {
    showError("No se pudieron cargar los perfiles: " + e.message);
    profilesCache = [];
    return [];
  }
}

export async function saveWorkspaceProfile({ asNew = false, name, profileId } = {}) {
  const snapshot = collectWorkspaceSnapshot();
  try {
    const saved = profileId && !asNew
      ? await profilesApi.updateWorkspaceProfile(profileId, { name, snapshot })
      : await profilesApi.createWorkspaceProfile({ name, snapshot });
    await refreshWorkspaceProfiles();
    showNotice(profileId && !asNew ? "Perfil actualizado." : "Perfil guardado.");
    return saved;
  } catch (e) {
    showError("No se pudo guardar el perfil: " + (e.message || e));
    return null;
  }
}

export async function applyWorkspaceProfile(profileId) {
  if (!profileId) return;
  let profile = profilesCache.find((p) => p.id === profileId);
  if (!profile) {
    try {
      profile = await profilesApi.getWorkspaceProfile(profileId);
    } catch (e) {
      showError("No se pudo cargar el perfil: " + (e.message || e));
      return;
    }
  }
  try {
    await applyWorkspaceSnapshot(profile.snapshot || {});
    showNotice("Perfil «" + profile.name + "» aplicado.");
  } catch (e) {
    showError("No se pudo aplicar el perfil: " + (e.message || e));
  }
}

export async function deleteWorkspaceProfile(profileId) {
  if (!profileId) return;
  const current = profilesCache.find((p) => p.id === profileId);
  const label = current ? current.name : "este perfil";
  if (!window.confirm("¿Eliminar el perfil «" + label + "»?")) return;
  try {
    await profilesApi.deleteWorkspaceProfile(profileId);
    await refreshWorkspaceProfiles();
    showNotice("Perfil eliminado.");
  } catch (e) {
    showError("No se pudo eliminar el perfil: " + (e.message || e));
  }
}

export async function refreshPlannerRulePresets() {
  try {
    plannerPresetsCache = await profilesApi.listPlannerRulePresets();
    return plannerPresetsCache;
  } catch (e) {
    showError("No se pudieron cargar los presets de reglas: " + (e.message || e));
    plannerPresetsCache = [];
    return [];
  }
}

export function collectPlannerRulePresetSnapshot() {
  const plannerRules = sessionStore.get().plannerRules;
  return { rules: serializeRuleItems(plannerRules) };
}

export function applyPlannerRulePresetSnapshot(snapshot) {
  const rules = snapshot && typeof snapshot === "object" ? snapshot.rules : snapshot;
  sessionStore.set({ plannerRules: normalizePlannerRulesFromPrefs(rules) });
  persistImagesPanel();
}

export function getWorkspaceProfiles() {
  return profilesCache;
}

export function getSelectedWorkspaceProfileId() {
  const el = document.getElementById("workspace-profile-select");
  return el && el.value ? el.value : "";
}

export function getSelectedPlannerRulePresetId() {
  const el = document.getElementById("planner-rule-preset-select");
  return el && el.value ? el.value : "";
}

export function renderWorkspaceProfileSelect() {
  return getWorkspaceProfiles();
}

export function applySelectedWorkspaceProfile() {
  return applyWorkspaceProfile(getSelectedWorkspaceProfileId());
}

export function promptWorkspaceProfileName(current) {
  return window.prompt("Nombre del perfil", current || "");
}

export function getPlannerRulePresets() {
  return plannerPresetsCache;
}

export async function savePlannerRulePreset({ asNew = false, name, presetId } = {}) {
  const snapshot = { rules: sessionStore.get().plannerRules };
  try {
    const saved = presetId && !asNew
      ? await profilesApi.createPlannerRulePreset({ name, snapshot })
      : await profilesApi.createPlannerRulePreset({ name, snapshot });
    await refreshPlannerRulePresets();
    showNotice("Preset de reglas guardado.");
    return saved;
  } catch (e) {
    showError("No se pudo guardar el preset: " + (e.message || e));
    return null;
  }
}

export async function applyPlannerRulePreset(presetId) {
  const preset = plannerPresetsCache.find((p) => p.id === presetId);
  if (!preset) return;
  const rules = (preset.snapshot && preset.snapshot.rules) || [];
  sessionStore.set({ plannerRules: rules });
  showNotice("Preset «" + preset.name + "» cargado.");
}

export async function deletePlannerRulePreset(presetId) {
  if (!presetId) return;
  if (!window.confirm("¿Eliminar este preset?")) return;
  try {
    await profilesApi.deletePlannerRulePreset(presetId);
    await refreshPlannerRulePresets();
    showNotice("Preset de reglas eliminado.");
  } catch (e) {
    showError("No se pudo eliminar el preset: " + (e.message || e));
  }
}
