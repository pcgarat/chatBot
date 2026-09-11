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
import {
  illustrationNeedleInContent as contentHasIllustration,
  contentHasExactFilename,
} from "../lib/illustrationLocate.js";
import { applyConsultaChrome, refreshLeftHistory, setLeftHistoryMode } from "./historyActions.js";
import { serializeRuleItems, hydrateChatRulesFromLibrary } from "./rulesActions.js";
import { loadModelContract, loadModels, loadParamsForProvider, applyConversationParams } from "./settingsActions.js";

export { resetSession };

const collapsedMessageKeys = new Set();
const el = {
  conversationTitle: null,
  conversationAutoTitle: null,
};

export function scheduleScrollMessagesToBottom() {
  if (sessionStore.get().pendingReveal) return;
  requestAnimationFrame(() => {
    if (sessionStore.get().pendingReveal) return;
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
    rules: Array.isArray(conv.system_instructions)
      ? conv.system_instructions
      : Array.isArray(conv.rules)
        ? conv.rules
        : [],
    ...tree,
    streamingText: "",
    streamingStatus: null,
    collapsedMessageKeys: options.preserveView ? sessionStore.get().collapsedMessageKeys : [],
  });
  hydrateChatRulesFromLibrary();
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
  if (!options.skipScroll) {
    if (options.keepConsulta) scheduleScrollMessagesToTop();
    else scheduleScrollMessagesToBottom();
  }
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
      system_instructions: serializeRuleItems(sessionStore.get().rules),
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

function waitForMessagesPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function ensureMessageExpanded(messageId) {
  if (!messageId) return false;
  const keys = sessionStore.get().collapsedMessageKeys || [];
  const id = String(messageId);
  const next = keys.filter((k) => k !== id);
  if (next.length === keys.length) return false;
  sessionStore.set({ collapsedMessageKeys: next });
  return true;
}

export function illustrationNeedleInContent(content, filename, sceneId) {
  return contentHasIllustration(content, filename, sceneId);
}

export function findMessageWithIllustration(messages, filename, sceneId, preferredMessageId) {
  if (!Array.isArray(messages)) return null;
  const preferred = preferredMessageId
    ? messages.find((m) => m && String(m.id) === String(preferredMessageId)) || null
    : null;
  if (preferred) {
    if (contentHasExactFilename(preferred.content, filename)) return preferred;
    if (sceneId && illustrationNeedleInContent(preferred.content, null, sceneId)) return preferred;
  }
  if (filename) {
    for (let i = 0; i < messages.length; i++) {
      if (contentHasExactFilename(messages[i] && messages[i].content, filename)) {
        return messages[i];
      }
    }
  }
  if (preferred) return preferred;
  // Con messageId explícito no "robamos" la misma escena de otro mensaje.
  if (preferredMessageId) return null;
  if (!sceneId) return null;
  for (let i = 0; i < messages.length; i++) {
    if (illustrationNeedleInContent(messages[i] && messages[i].content, null, sceneId)) {
      return messages[i];
    }
  }
  return null;
}

async function revealMessageInConversation(conversationId, messageId, options = {}) {
  setChatPanelVisible(true);
  const current = sessionStore.get();
  if (current.consultaAssistantId) {
    sessionStore.set({ consultaAssistantId: null });
    applyConsultaChrome();
  }
  const lookingForPhoto = !!(options.filename || options.sceneId);
  const photoHere = findMessageWithIllustration(current.messages, options.filename, null);
  const messageHere = !!messageId && (current.messages || []).some((m) => m.id === messageId);
  const sameConv = !conversationId || conversationId === current.conversationId;
  const stayHere = !!photoHere || (sameConv && messageHere) || (!lookingForPhoto && messageHere);
  if (!stayHere) {
    const targetConv = conversationId || current.conversationId;
    if (!targetConv) return photoHere;
    await openConversation(targetConv, { skipScroll: true });
    const opened = sessionStore.get().messages || [];
    const photoAfter = findMessageWithIllustration(opened, options.filename, null);
    const visible = !!photoAfter || opened.some((m) => m.id === messageId);
    if (!visible && messageId) {
      await conversationsApi.patchConversation(targetConv, { active_leaf_message_id: messageId });
      await openConversation(targetConv, { skipScroll: true });
    }
  }
  const resolved = findMessageWithIllustration(
    sessionStore.get().messages,
    options.filename,
    options.sceneId,
    messageId
  );
  const expandId = (resolved && resolved.id) || messageId;
  if (ensureMessageExpanded(expandId)) await waitForMessagesPaint();
  return resolved;
}

function queueRevealInMessages(conversationId, messageId, options = {}) {
  const found = findMessageWithIllustration(
    sessionStore.get().messages,
    options.filename,
    options.sceneId,
    messageId
  );
  sessionStore.set({
    pendingReveal: {
      conversationId: sessionStore.get().conversationId || conversationId || null,
      messageId: (found && found.id) || messageId || null,
      filename: options.filename || null,
      sceneId: options.sceneId || null,
    },
  });
}

/** Punto único para ir a un mensaje/foto desde galería, cola, debug, etc. */
export async function goToConversationTarget(target = {}) {
  const conversationId = target.conversationId || "";
  const messageId = target.messageId || "";
  const filename = target.filename || "";
  const sceneId = target.sceneId || "";
  if (filename || sceneId) {
    return openConversationAtIllustration(conversationId, messageId, { filename, sceneId });
  }
  return openConversationAtMessage(conversationId, messageId);
}

export async function openConversationAtMessage(conversationId, messageId) {
  try {
    await revealMessageInConversation(conversationId, messageId);
    queueRevealInMessages(conversationId, messageId);
  } catch (err) {
    showError("No se pudo abrir el mensaje: " + err.message);
  }
}

export async function openConversationAtIllustration(conversationId, messageId, filenameOrOptions, sceneId) {
  const options =
    filenameOrOptions && typeof filenameOrOptions === "object"
      ? filenameOrOptions
      : { filename: filenameOrOptions || "", sceneId: sceneId || "" };
  try {
    await revealMessageInConversation(conversationId, messageId, options);
    queueRevealInMessages(conversationId, messageId, options);
  } catch (err) {
    showError("No se pudo abrir el mensaje: " + err.message);
  }
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
