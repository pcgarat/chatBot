import { createStore } from "./createStore.js";

export const LAST_CONVERSATION_STORAGE_KEY = "chatbot_last_conversation_id";

export const sessionStore = createStore({
  conversationId: null,
  conversationKind: "chat",
  title: "",
  autoTitle: false,
  messages: [],
  allMessages: [],
  activeLeafId: null,
  consultaAssistantId: null,
  rules: [],
  plannerRules: [],
  composerDraft: "",
  instructionOverride: "",
  streamingText: "",
  streamingStatus: null,
  abortController: null,
  collapsedMessageKeys: [],
  illustratingIds: [],
  readingModeIndex: null,
  lastUsage: null,
  contextLength: null,
  imageFilterNotice: false,
});

export function saveLastConversationId(id) {
  try {
    if (id) localStorage.setItem(LAST_CONVERSATION_STORAGE_KEY, id);
    else localStorage.removeItem(LAST_CONVERSATION_STORAGE_KEY);
  } catch (_) {}
}

export function readLastConversationId() {
  try {
    return localStorage.getItem(LAST_CONVERSATION_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

export function resetSession() {
  sessionStore.set({
    conversationId: null,
    conversationKind: "chat",
    title: "",
    autoTitle: false,
    messages: [],
    allMessages: [],
    activeLeafId: null,
    consultaAssistantId: null,
    rules: [],
    composerDraft: "",
    instructionOverride: "",
    streamingText: "",
    streamingStatus: null,
    abortController: null,
  });
  saveLastConversationId(null);
}
