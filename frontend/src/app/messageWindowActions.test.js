import { describe, it, expect, beforeEach } from "vitest";
import { sessionStore } from "../store/session.js";
import { loadOlderMessageInView } from "./messageWindowActions.js";
import { messagesForDisplay } from "../lib/tree.js";

describe("loadOlderMessageInView", () => {
  beforeEach(() => {
    sessionStore.set({
      messages: [
        { id: "u1", role: "user", content: "a" },
        { id: "a1", role: "assistant", content: "b" },
        { id: "u2", role: "user", content: "c" },
        { id: "a2", role: "assistant", content: "d" },
      ],
      viewStartIndex: 3,
      focusMessageId: "a2",
    });
  });

  it("revela un mensaje anterior por llamada", () => {
    expect(messagesForDisplay(sessionStore.get().messages, sessionStore.get().viewStartIndex)).toHaveLength(1);
    expect(loadOlderMessageInView()).toBe(true);
    expect(sessionStore.get().viewStartIndex).toBe(2);
    expect(messagesForDisplay(sessionStore.get().messages, sessionStore.get().viewStartIndex).map((m) => m.id)).toEqual([
      "u2",
      "a2",
    ]);
    expect(loadOlderMessageInView()).toBe(true);
    expect(loadOlderMessageInView()).toBe(true);
    expect(loadOlderMessageInView()).toBe(false);
    expect(sessionStore.get().viewStartIndex).toBe(0);
    expect(messagesForDisplay(sessionStore.get().messages, 0)).toHaveLength(4);
  });
});
