import { describe, it, expect, beforeEach, vi } from "vitest";
import { imagesStore, IMAGES_PREFS_KEY } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import { collectImagesSnapshot, applyImagesSnapshot } from "./imagesPanel.js";

describe("panel imágenes snapshot", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    }));
    sessionStore.set({ conversationId: null, plannerRules: [] });
    imagesStore.set({
      prefs: {
        enabled: true,
        use_chat_config: false,
        visual_consistency: true,
        prompt: "desde store",
        images_per_response: 3,
        batch_size: 8,
        retries: 1,
      },
    });
  });

  it("collectImagesSnapshot lee el store si no hay DOM", () => {
    const snap = collectImagesSnapshot();
    expect(snap.enabled).toBe(true);
    expect(snap.prompt).toBe("desde store");
    expect(snap.images_per_response).toBe(3);
  });

  it("applyImagesSnapshot round-trip al store", async () => {
    await applyImagesSnapshot({ enabled: false, prompt: "nuevo", use_chat_config: true });
    expect(imagesStore.get().prefs.prompt).toBe("nuevo");
    expect(imagesStore.get().prefs.use_chat_config).toBe(true);
    expect(JSON.parse(localStorage.getItem(IMAGES_PREFS_KEY) || "{}").prompt).toBe("nuevo");
  });
});
