import { describe, it, expect, beforeEach } from "vitest";
import { imagesStore, persistImagesPrefs, IMAGES_PREFS_KEY } from "./images.js";

describe("images store", () => {
  beforeEach(() => {
    localStorage.clear();
    imagesStore.set({
      prefs: {},
      galleryFilters: {
        promptModel: "",
        promptProvider: "",
        forgeModel: "",
        steps: "",
        size: "",
        mode: "",
        seed: "",
        promptQ: "",
      },
      queueSelectedIds: [],
    });
  });

  it("persiste prefs en localStorage", () => {
    persistImagesPrefs({ enabled: true, prompt: "un gato" });
    expect(JSON.parse(localStorage.getItem(IMAGES_PREFS_KEY))).toMatchObject({
      enabled: true,
      prompt: "un gato",
    });
  });
});
