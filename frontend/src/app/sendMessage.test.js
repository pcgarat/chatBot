import { describe, it, expect } from "vitest";
import { sessionStore } from "../store/session.js";
import { cancelLastMessage } from "./sendMessage.js";

describe("send/stop", () => {
  it("cancelLastMessage aborta el AbortController de sesión", () => {
    const ctrl = new AbortController();
    sessionStore.set({ abortController: ctrl });
    cancelLastMessage();
    expect(ctrl.signal.aborted).toBe(true);
  });
});
