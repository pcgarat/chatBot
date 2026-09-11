import { describe, it, expect, beforeEach } from "vitest";
import {
  historyStore,
  persistConversationSort,
  persistMessageSort,
  persistLeftHistoryMode,
  readStoredConversationSort,
  readStoredMessageSort,
  isMessagesHistoryMode,
  LEFT_HISTORY_MODE_KEY,
} from "./history.js";

describe("history store", () => {
  beforeEach(() => {
    localStorage.clear();
    historyStore.set({
      mode: "conversations",
      conversationSort: "activity",
      messageSort: "message",
      conversations: [],
      deletedConversations: [],
      messageHistoryItems: [],
    });
  });

  it("persiste orden y modo en localStorage", () => {
    persistConversationSort("created_at");
    persistMessageSort("image");
    persistLeftHistoryMode("messages");
    expect(readStoredConversationSort()).toBe("created_at");
    expect(readStoredMessageSort()).toBe("image");
    expect(localStorage.getItem(LEFT_HISTORY_MODE_KEY)).toBe("messages");
  });

  it("isMessagesHistoryMode sigue el modo del store", () => {
    historyStore.set({ mode: "conversations" });
    expect(isMessagesHistoryMode()).toBe(false);
    historyStore.set({ mode: "messages" });
    expect(isMessagesHistoryMode()).toBe(true);
  });
});
