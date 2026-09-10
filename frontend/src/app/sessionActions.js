import * as conversationsApi from "../api/conversations.js";
import * as modelsApi from "../api/models.js";
import { showError, showNotice } from "../store/ui.js";
import { sessionStore, saveLastConversationId, resetSession } from "../store/session.js";
import { settingsStore } from "../store/settings.js";
import { historyStore } from "../store/history.js";
import { imagesStore, persistImagesPrefs } from "../store/images.js";
import { updateLayout, setChatPanelVisible, isGalleryPanelVisible } from "../store/layout.js";
import { persistImagesPanel, applyImagesSnapshot, imagesSnapshotForConversation } from "./imagesPanel.js";
import { applyConversationTree } from "../lib/tree.js";
import { getDefaultConversationTitle } from "../lib/dates.js";
import { buildModelParams } from "../lib/params.js";
import { applyConsultaChrome, refreshLeftHistory, setLeftHistoryMode } from "./historyActions.js";
import { loadModelContract, loadModels, loadParamsForProvider, applyConversationParams } from "./settingsActions.js";

export { resetSession };

const collapsedMessageKeys = new Set();
const el = {
  conversationTitle: null,
  conversationAutoTitle: null,
};

export function scheduleScrollMessagesToBottom() {
  requestAnimationFrame(() => {
    const node = document.getElementById("messages-container");
    if (node) node.scrollTop = node.scrollHeight;
  });
}

export function scheduleScrollMessagesToTop() {
  requestAnimationFrame(() => {
    const node = document.getElementById("messages-container");
    if (node) node.scrollTop = 0;
  });
}

export function scrollMessagesToBottom() {
  const node = document.getElementById("messages-container");
  if (node) node.scrollTop = node.scrollHeight;
}

export function scrollMessagesToTop() {
  const node = document.getElementById("messages-container");
  if (node) node.scrollTop = 0;
}

async function persistPreviousConversation(previousId) {
  if (!previousId) return;
  const session = sessionStore.get();
  const payload = {};
  const instruction = (session.instructionOverride || "").trim() || null;
  payload.instruction_override = instruction;
  if (!session.autoTitle) {
    payload.title = (session.title || "").trim() || getDefaultConversationTitle();
  }
  if (Object.keys(payload).length > 0) {
    conversationsApi.patchConversation(previousId, payload).catch(() => {});
  }
}

export async function setCurrentConversation(conv, options = {}) {
  const previousId = sessionStore.get().conversationId;
  if (!(options.keepConsulta)) {
    sessionStore.set({ consultaAssistantId: null });
  }
  applyConsultaChrome();
  if (previousId && (!conv || conv.id !== previousId)) {
    await persistPreviousConversation(previousId);
  }
  if (!conv) {
    resetSession();
    return;
  }
  const sameId = conv.id === previousId;
  if (!options.preserveView) {
    sessionStore.set({ collapsedMessageKeys: [] });
    collapsedMessageKeys.clear();
  }
  const tree = applyConversationTree(conv);
  sessionStore.set({
    conversationId: conv.id,
    conversationKind: conv.kind || "chat",
    title: conv.title || "",
    autoTitle: Boolean(conv.auto_title),
    instructionOverride: conv.instruction_override || "",
    rules: Array.isArray(conv.rules) ? conv.rules : [],
    ...tree,
    streamingText: "",
    streamingStatus: null,
    collapsedMessageKeys: options.preserveView ? sessionStore.get().collapsedMessageKeys : [],
  });
  saveLastConversationId(conv.id);
  if (conv.provider) {
    settingsStore.set({ currentProvider: conv.provider });
    await loadParamsForProvider(conv.provider);
  }
  if (conv.model_id) {
    settingsStore.set({ currentModel: conv.model_id });
  }
  await loadModels(true);
  await loadModelContract({ applyParamDefaults: !conv.model_params });
  if (conv.model_params) applyConversationParams(conv.model_params);
  if (conv.images && typeof conv.images === "object") {
    applyImagesSnapshot(conv.images);
  }
  if (conv.save_to_chromadb) settingsStore.set({ saveToChromadb: conv.save_to_chromadb });
  if (conv.history_turns != null) settingsStore.set({ historyTurns: conv.history_turns });
  applyAutoTitleUi(sessionStore.get().autoTitle);
  if (options.keepConsulta) scheduleScrollMessagesToTop();
  else scheduleScrollMessagesToBottom();
  void sameId;
}

let saveRulesDebounceTimer;

export async function openConversation(id, options = {}) {
  sessionStore.set({ consultaAssistantId: null });
  applyConsultaChrome();
  setChatPanelVisible(true);
  isGalleryPanelVisible();
  try {
    const conv = await conversationsApi.getConversation(id);
    await setCurrentConversation(conv, options);
  } catch (e) {
    showError("Error al abrir conversación: " + e.message);
  }
}

export async function openConsultaTurn(conversationId, assistantId) {
  if (!conversationId || !assistantId) return;
  updateLayout({ centerChatVisible: true });
  sessionStore.set({ consultaAssistantId: assistantId });
  applyConsultaChrome();
  try {
    const conv = await conversationsApi.getConversation(conversationId);
    await setCurrentConversation(conv, { preserveView: true, keepConsulta: true });
  } catch (e) {
    showError("Error al abrir el mensaje: " + e.message);
  }
}

export async function newConversation() {
  if (historyStore.get().mode === "messages") await setLeftHistoryMode("conversations");
  sessionStore.set({ consultaAssistantId: null });
  applyConsultaChrome();
  setChatPanelVisible(true);
  const settings = settingsStore.get();
  try {
    const conv = await conversationsApi.createConversation({
      title: getDefaultConversationTitle(),
      provider: settings.currentProvider || "ollama",
      model_id: settings.currentModel || (settings.models[0] || ""),
      kind: "chat",
      images: imagesSnapshotForConversation(),
    });
    await setCurrentConversation(conv);
    await refreshLeftHistory();
    return conv;
  } catch (e) {
    showError("Error al crear conversación: " + e.message);
    return null;
  }
}

export async function newPromptGeneratorConversation() {
  if (historyStore.get().mode === "messages") await setLeftHistoryMode("conversations");
  sessionStore.set({ consultaAssistantId: null });
  applyConsultaChrome();
  updateLayout({ centerChatVisible: true });
  const settings = settingsStore.get();
  try {
    const conv = await conversationsApi.createConversation({
      title: getDefaultConversationTitle(),
      provider: settings.currentProvider || "ollama",
      model_id: settings.currentModel || (settings.models[0] || ""),
      kind: "prompt_generator",
    });
    await setCurrentConversation(conv);
    await refreshLeftHistory();
    return conv;
  } catch (e) {
    showError("Error al crear txt2img: " + e.message);
    return null;
  }
}

export async function saveConversationMeta() {
  const s = sessionStore.get();
  if (!s.conversationId) return;
  const payload = {
    title: (s.title || "").trim() || getDefaultConversationTitle(),
    auto_title: !!s.autoTitle,
    instruction_override: (s.instructionOverride || "").trim() || null,
    provider: settingsStore.get().currentProvider,
    model_id: settingsStore.get().currentModel,
    model_params: buildModelParams(),
  };
  try {
    await conversationsApi.patchConversation(s.conversationId, payload);
    await refreshLeftHistory();
  } catch (e) {
    showError("Error al guardar: " + e.message);
  }
}

export async function forkConversationFromMessage(messageId) {
  const { conversationId } = sessionStore.get();
  if (!messageId || !conversationId) return;
  try {
    if (historyStore.get().mode === "messages") await setLeftHistoryMode("conversations");
    const conv = await conversationsApi.forkConversation(conversationId, { message_id: messageId });
    await setCurrentConversation(conv);
    updateLayout({ composerCollapsed: false });
    showNotice("Conversación nueva. El historial se toma del mensaje original.");
  } catch (e) {
    showError("No se pudo crear la conversación: " + e.message);
  }
}

export function applyAutoTitleUi(enabled) {
  const currentAutoTitle = Boolean(enabled);
  sessionStore.set({ autoTitle: currentAutoTitle });
  el.conversationTitle = document.getElementById("conversation-title");
  el.conversationAutoTitle = document.getElementById("conversation-auto-title");
  if (el.conversationAutoTitle) el.conversationAutoTitle.checked = currentAutoTitle;
  if (el.conversationTitle) el.conversationTitle.readOnly = currentAutoTitle;
}

export async function commitConversationTitle() {
  el.conversationTitle = document.getElementById("conversation-title");
  const currentAutoTitle = sessionStore.get().autoTitle;
  if (!el.conversationTitle || currentAutoTitle) return;
  const title = el.conversationTitle.value.trim() || getDefaultConversationTitle();
  if (el.conversationTitle.value !== title) el.conversationTitle.value = title;
  const currentConversationId = sessionStore.get().conversationId;
  if (!currentConversationId) return;
  try {
    await conversationsApi.patchConversation(currentConversationId, JSON.parse(JSON.stringify({ title })));
    sessionStore.set({ title });
    refreshLeftHistory();
  } catch (e) {
    showError("Error al guardar el título: " + e.message);
  }
}

export async function commitAutoTitleFlag() {
  el.conversationAutoTitle = document.getElementById("conversation-auto-title");
  if (!el.conversationAutoTitle) return;
  applyAutoTitleUi(el.conversationAutoTitle.checked);
  const currentConversationId = sessionStore.get().conversationId;
  if (!currentConversationId) return;
  try {
    const conv = await conversationsApi.patchConversation(currentConversationId, {
      auto_title: Boolean(el.conversationAutoTitle && el.conversationAutoTitle.checked),
    });
    el.conversationTitle = document.getElementById("conversation-title");
    if (el.conversationTitle && conv && conv.title) el.conversationTitle.value = conv.title;
    refreshLeftHistory();
  } catch (e) {
    showError("Error al guardar el título automático: " + e.message);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "conversation-title") commitConversationTitle();
    if (e.target && e.target.id === "conversation-auto-title") commitAutoTitleFlag();
  });
}
el.conversationTitle && el.conversationTitle.addEventListener("change", commitConversationTitle);

export async function persistWorkspaceToConversation() {
  persistImagesPanel();
  const payload = { images: imagesSnapshotForConversation() };
  await saveConversationMeta();
  void payload;
}

export async function saveConversation() {
  await saveConversationMeta();
  await setCurrentConversation(
    await conversationsApi.getConversation(sessionStore.get().conversationId),
    { preserveView: true }
  );
}

export async function openConversationAtMessage(conversationId, messageId) {
  await openConversation(conversationId, { keepConsulta: true });
  sessionStore.set({ consultaAssistantId: messageId || sessionStore.get().consultaAssistantId });
}

export async function openConversationAtIllustration(conversationId, messageId) {
  await openConversationAtMessage(conversationId, messageId);
}

export async function deleteMessageFromHistory(conversationId, messageId) {
  try {
    await conversationsApi.deleteMessage(conversationId, messageId);
    const conv = await conversationsApi.getConversation(conversationId);
    await setCurrentConversation(conv, { keepConsulta: true });
  } catch (e) {
    showError("Error al eliminar mensaje: " + e.message);
  }
}
