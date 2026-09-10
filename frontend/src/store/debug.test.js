import { describe, it, expect, beforeEach } from "vitest";
import { debugStore, setDebugPanelOpen, createDebugLogBuffer } from "./debug.js";

describe("debug store", () => {
  beforeEach(() => {
    debugStore.set({ chatOpen: false, imagesOpen: false, chatLog: [], imagesLog: [] });
  });

  it("abre un panel en exclusivo", () => {
    setDebugPanelOpen("chat", true);
    expect(debugStore.get().chatOpen).toBe(true);
    expect(debugStore.get().imagesOpen).toBe(false);
    setDebugPanelOpen("images", true);
    expect(debugStore.get().chatOpen).toBe(false);
    expect(debugStore.get().imagesOpen).toBe(true);
  });

  it("el buffer recorta al máximo", () => {
    const buf = createDebugLogBuffer(2);
    buf.push({ title: "a" });
    buf.push({ title: "b" });
    buf.push({ title: "c" });
    expect(buf.list()).toHaveLength(2);
    expect(buf.list().map((e) => e.title)).toEqual(["b", "c"]);
  });
});
