import { describe, it, expect, beforeEach, vi } from "vitest";
import { settingsStore } from "../store/settings.js";
import { sessionStore } from "../store/session.js";
import { layoutStore } from "../store/layout.js";
import { imagesStore } from "../store/images.js";
import {
  collectWorkspaceSnapshot,
  refreshPlannerRulePresets,
  applyPlannerRulePreset,
  getPlannerRulePresets,
} from "./profilesActions.js";

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

describe("presets de reglas del planificador", () => {
  beforeEach(() => {
    settingsStore.set({ plannerRulePresets: [] });
    sessionStore.set({ plannerRules: [] });
    imagesStore.set({ prefs: {} });
  });

  it("refreshPlannerRulePresets deja los presets en el store para pintarlos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: "p1", name: "Flux nocturno", snapshot: { rules: [] } }],
      }),
    );
    const list = await refreshPlannerRulePresets();
    expect(list).toHaveLength(1);
    expect(getPlannerRulePresets()[0].name).toBe("Flux nocturno");
    expect(settingsStore.get().plannerRulePresets[0].name).toBe("Flux nocturno");
  });

  it("aplicar un preset hidrata las reglas activas y las persiste", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: "p1",
            name: "Flux nocturno",
            snapshot: {
              rules: [{ rule_id: "pr1", title: "Luz", content: "nocturna" }],
            },
          },
        ],
      }),
    );
    await refreshPlannerRulePresets();
    applyPlannerRulePreset("p1");
    expect(sessionStore.get().plannerRules[0].title).toBe("Luz");
    expect(imagesStore.get().prefs.prompt_system_instructions[0].title).toBe("Luz");
  });
});
