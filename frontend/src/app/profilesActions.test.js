import { describe, it, expect, beforeEach } from "vitest";
import { settingsStore } from "../store/settings.js";
import { sessionStore } from "../store/session.js";
import { layoutStore } from "../store/layout.js";
import { collectWorkspaceSnapshot } from "./profilesActions.js";

describe("perfiles de workspace", () => {
  beforeEach(() => {
    settingsStore.set({
      currentProvider: "ollama",
      currentModel: "llama",
      historyTurns: 12,
      paramsConfig: { params: {} },
      paramsValues: {},
      paramsExcludedFromSendByConv: {},
    });
    sessionStore.set({ rules: [{ id: "r1", title: "Tono", content: "sé breve" }] });
    layoutStore.set({ ...layoutStore.get(), darkMode: true, sidebarTab: "settings" });
  });

  it("collectWorkspaceSnapshot lee stores, no el DOM", () => {
    const snap = collectWorkspaceSnapshot();
    expect(snap.provider).toBe("ollama");
    expect(snap.model_id).toBe("llama");
    expect(snap.history_turns).toBe(12);
    expect(snap.rules[0].title).toBe("Tono");
    expect(snap.layout.darkMode).toBe(true);
    expect(snap.layout.sidebarTab).toBe("settings");
  });
});
