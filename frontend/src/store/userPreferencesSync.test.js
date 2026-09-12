import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPreferencesSnapshot,
  collectPreferencesSnapshot,
  hydratePreferencesFromServer,
  startPreferencesSync,
  stopPreferencesSync,
} from "./userPreferencesSync.js";
import { layoutStore, updateLayout } from "./layout.js";
import { imagesStore, persistImagesPrefs, IMAGES_PREFS_KEY } from "./images.js";
import { historyStore, persistConversationSort } from "./history.js";
import { saveLastConversationId, LAST_CONVERSATION_STORAGE_KEY } from "./session.js";
import * as auth from "./auth.js";

vi.mock("./auth.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadUserPreferences: vi.fn(),
    saveUserPreferences: vi.fn(async (preferences) => ({ preferences })),
  };
});

describe("userPreferencesSync", () => {
  beforeEach(() => {
    localStorage.clear();
    stopPreferencesSync();
    auth.loadUserPreferences.mockReset();
    auth.saveUserPreferences.mockReset();
    auth.saveUserPreferences.mockImplementation(async (preferences) => ({ preferences }));
    layoutStore.set({
      darkMode: false,
      renderMarkdown: true,
      autoScrollDuringGeneration: true,
    });
    imagesStore.set({ prefs: {} });
    historyStore.set({ conversationSort: "activity", messageSort: "message", mode: "tree" });
    saveLastConversationId(null);
  });

  it("collect → apply roundtrip conserva layout, images y lastConversation", () => {
    updateLayout({ darkMode: true, renderMarkdown: false });
    persistImagesPrefs({ enabled: true, prompt: "faro" });
    imagesStore.set({ prefs: { enabled: true, prompt: "faro" } });
    persistConversationSort("created_at");
    historyStore.set({ conversationSort: "created_at" });
    saveLastConversationId("conv-42");

    const snap = collectPreferencesSnapshot();
    expect(snap.layout.darkMode).toBe(true);
    expect(snap.layout.renderMarkdown).toBe(false);
    expect(snap.imagesPrefs.prompt).toBe("faro");
    expect(snap.history.conversationSort).toBe("created_at");
    expect(snap.lastConversationId).toBe("conv-42");

    updateLayout({ darkMode: false, renderMarkdown: true });
    persistImagesPrefs({});
    imagesStore.set({ prefs: {} });
    saveLastConversationId(null);

    applyPreferencesSnapshot(snap);
    expect(layoutStore.get().darkMode).toBe(true);
    expect(layoutStore.get().renderMarkdown).toBe(false);
    expect(imagesStore.get().prefs.prompt).toBe("faro");
    expect(JSON.parse(localStorage.getItem(IMAGES_PREFS_KEY)).prompt).toBe("faro");
    expect(historyStore.get().conversationSort).toBe("created_at");
    expect(localStorage.getItem(LAST_CONVERSATION_STORAGE_KEY)).toBe("conv-42");
  });

  it("hydrate sin prefs en servidor siembra el snapshot local", async () => {
    updateLayout({ darkMode: true });
    auth.loadUserPreferences.mockResolvedValue({ preferences: {} });
    const result = await hydratePreferencesFromServer();
    expect(result.seeded).toBe(true);
    expect(auth.saveUserPreferences).toHaveBeenCalled();
    const sent = auth.saveUserPreferences.mock.calls[0][0];
    expect(sent.layout.darkMode).toBe(true);
  });

  it("hydrate con prefs del servidor las aplica", async () => {
    auth.loadUserPreferences.mockResolvedValue({
      preferences: {
        version: 1,
        layout: { darkMode: true },
        imagesPrefs: { steps: 28 },
        history: { conversationSort: "created_at" },
        lastConversationId: "from-server",
      },
    });
    const result = await hydratePreferencesFromServer();
    expect(result.seeded).toBe(false);
    expect(layoutStore.get().darkMode).toBe(true);
    expect(imagesStore.get().prefs.steps).toBe(28);
    expect(historyStore.get().conversationSort).toBe("created_at");
    expect(localStorage.getItem(LAST_CONVERSATION_STORAGE_KEY)).toBe("from-server");
  });

  it("startPreferencesSync programa push al cambiar layout", async () => {
    vi.useFakeTimers();
    startPreferencesSync();
    updateLayout({ darkMode: true });
    expect(auth.saveUserPreferences).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(700);
    expect(auth.saveUserPreferences).toHaveBeenCalled();
    stopPreferencesSync();
    vi.useRealTimers();
  });
});
