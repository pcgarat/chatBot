import { applyDocumentLayout, layoutStore } from "../store/layout.js";
import { historyStore } from "../store/history.js";
import { readLastConversationId } from "../store/session.js";
import { showError } from "../store/ui.js";
import {
  loadProviders,
  tryLoadModelsForProvider,
  loadParamsForProvider,
  loadModelContract,
} from "./settingsActions.js";
import { settingsStore } from "../store/settings.js";
import { refreshLeftHistory, applyConsultaChrome } from "./historyActions.js";
import { openConversation } from "./sessionActions.js";
import {
  loadLibraryRules,
  loadPlannerLibraryRules,
  hydrateChatRulesFromLibrary,
  hydratePlannerRulesFromLibrary,
} from "./rulesActions.js";
import { refreshWorkspaceProfiles, refreshPlannerRulePresets } from "./profilesActions.js";
import { loadPlannerContract, ensureImagesPromptSelects, hydratePlannerRulesFromImagesPrefs } from "./imagesPanel.js";

export async function bootApp() {
  hydratePlannerRulesFromImagesPrefs();
  applyDocumentLayout(layoutStore.get());
  applyConsultaChrome();
  await loadProviders();
  const providers = settingsStore.get().providers;
  let loaded = false;
  for (const p of providers) {
    if (await tryLoadModelsForProvider(p)) {
      loaded = true;
      break;
    }
  }
  if (!loaded && providers.length > 0) {
    showError("No se pudo cargar modelos de ningún proveedor. Comprueba Ollama/Mancer.");
  }
  await loadParamsForProvider(settingsStore.get().currentProvider);
  await loadModelContract({ applyParamDefaults: true });
  await refreshLeftHistory();
  const storedId = readLastConversationId();
  if (storedId) {
    try {
      await openConversation(storedId);
    } catch (_) {}
  }
  loadLibraryRules().then(() => hydrateChatRulesFromLibrary());
  loadPlannerLibraryRules().then(() => hydratePlannerRulesFromLibrary());
  refreshWorkspaceProfiles();
  refreshPlannerRulePresets();
  await ensureImagesPromptSelects();
  await loadPlannerContract();
  historyStore.subscribe(() => applyConsultaChrome());
}
