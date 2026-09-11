import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../app/sendMessage.js", () => ({
  onComposerPrimaryClick: vi.fn(),
  sendPromptGeneratorTurn: vi.fn(),
}));

import { onAppKeyDown } from "./shellEvents.js";
import { onComposerPrimaryClick } from "../../app/sendMessage.js";

function keyEvent(overrides = {}) {
  return {
    target: { id: "message-input" },
    key: "Enter",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe("onAppKeyDown message-input", () => {
  beforeEach(() => {
    onComposerPrimaryClick.mockClear();
  });

  it("Enter envía el mensaje", () => {
    const e = keyEvent();
    onAppKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(onComposerPrimaryClick).toHaveBeenCalledTimes(1);
  });

  it("Shift+Enter no envía (permite salto de línea)", () => {
    const e = keyEvent({ shiftKey: true });
    onAppKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(onComposerPrimaryClick).not.toHaveBeenCalled();
  });

  it("ignora teclas que no son Enter", () => {
    const e = keyEvent({ key: "a" });
    onAppKeyDown(e);
    expect(onComposerPrimaryClick).not.toHaveBeenCalled();
  });

  it("ignora Enter fuera del message-input", () => {
    const e = keyEvent({ target: { id: "instruction-override" } });
    onAppKeyDown(e);
    expect(onComposerPrimaryClick).not.toHaveBeenCalled();
  });
});
