import { describe, it, expect, beforeEach } from "vitest";
import {
  sessionStore,
  saveLastConversationId,
  readLastConversationId,
  resetSession,
  LAST_CONVERSATION_STORAGE_KEY,
} from "./session.js";

describe("session store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSession();
  });

  it("guarda y lee el último hilo", () => {
    saveLastConversationId("abc");
    expect(readLastConversationId()).toBe("abc");
    expect(localStorage.getItem(LAST_CONVERSATION_STORAGE_KEY)).toBe("abc");
  });

  it("resetSession limpia id y título", () => {
    sessionStore.set({ conversationId: "abc", title: "Hola", messages: [{ id: "1" }] });
    saveLastConversationId("abc");
    resetSession();
    expect(sessionStore.get().conversationId).toBeNull();
    expect(sessionStore.get().title).toBe("");
    expect(sessionStore.get().messages).toEqual([]);
    expect(readLastConversationId()).toBeNull();
  });
});
