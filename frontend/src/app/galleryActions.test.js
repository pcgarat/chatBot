import { describe, it, expect, beforeEach } from "vitest";
import { imagesStore } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import { appendGalleryToolbarFilters, galleryListParams, clearGalleryToolbarFilters } from "./galleryActions.js";
import { vi } from "vitest";

describe("galería", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0 }),
    }));
    sessionStore.set({ conversationId: "c1" });
    imagesStore.set({
      galleryOffset: 0,
      galleryScopeAll: false,
      galleryMessageId: null,
      galleryFilters: {
        promptModel: "sdxl",
        promptProvider: "",
        forgeModel: "",
        steps: "20",
        size: "",
        mode: "",
        seed: "",
        promptQ: "gato",
      },
    });
  });

  it("filtros activos van al query", () => {
    const params = appendGalleryToolbarFilters({});
    expect(params.prompt_model).toBe("sdxl");
    expect(params.steps).toBe("20");
    expect(params.q).toBe("gato");
    const listed = galleryListParams();
    expect(listed.conversation_id).toBe("c1");
    expect(listed.limit).toBe(24);
  });

  it("clearGalleryToolbarFilters vacía el store", () => {
    clearGalleryToolbarFilters();
    expect(imagesStore.get().galleryFilters.promptModel).toBe("");
    expect(imagesStore.get().galleryFilters.promptQ).toBe("");
  });
});
