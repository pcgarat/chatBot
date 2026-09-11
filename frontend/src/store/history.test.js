import { describe, it, expect, beforeEach } from "vitest";
import {
  historyStore,
  persistConversationSort,
  persistMessageSort,
  persistLeftHistoryMode,
  readStoredConversationSort,
  readStoredMessageSort,
  isMessagesHistoryMode,
  isTreeHistoryMode,
  LEFT_HISTORY_MODE_KEY,
} from "./history.js";

describe("history store", () => {
  beforeEach(() => {
    localStorage.clear();
    historyStore.set({
      mode: "tree",
      conversationSort: "activity",
      messageSort: "message",
      conversations: [],
      deletedConversations: [],
      messageHistoryItems: [],
      treeRoots: [],
      treeChildrenByParent: {},
      treeExpandedIds: {},
    });
  });

  it("persiste orden y modo tree en localStorage", () => {
    persistConversationSort("created_at");
    persistMessageSort("image");
    persistLeftHistoryMode("tree");
    expect(readStoredConversationSort()).toBe("created_at");
    expect(readStoredMessageSort()).toBe("image");
    expect(localStorage.getItem(LEFT_HISTORY_MODE_KEY)).toBe("tree");
  });

  it("migra modos legacy a tree al persistir", () => {
    persistLeftHistoryMode("messages");
    expect(localStorage.getItem(LEFT_HISTORY_MODE_KEY)).toBe("tree");
    persistLeftHistoryMode("conversations");
    expect(localStorage.getItem(LEFT_HISTORY_MODE_KEY)).toBe("tree");
  });

  it("isTreeHistoryMode es el default", () => {
    historyStore.set({ mode: "tree" });
    expect(isTreeHistoryMode()).toBe(true);
    expect(isMessagesHistoryMode()).toBe(false);
  });
});
