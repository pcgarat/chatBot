import { describe, it, expect, beforeEach, vi } from "vitest";
import { settingsStore } from "../store/settings.js";
import { sessionStore } from "../store/session.js";
import {
  applyModelRecipe,
  applyThinkAndRecipesFromContract,
  loadModelContract,
  syncSettingsPresetsMirrors,
} from "./settingsActions.js";

const OVERLAY_CONTRACT = {
  capabilities: {
    vision: false,
    tools: true,
    thinking: {
      kind: "levels",
      values: ["low", "medium", "high"],
      can_disable: false,
      default: "medium",
    },
  },
  params: {
    temperature: { default: 0.4 },
    num_ctx: { default: 32768, max: 131072 },
    think: { api_key: "think", type: "enum", values: ["low", "medium", "high"], default: "medium" },
  },
  recipes: [
    { id: "fast", label: "Rápido", params: { think: "low", temperature: 0.3, num_ctx: 8192 } },
    { id: "hard", label: "Máximo", params: { think: "high", temperature: 0.2, num_ctx: 65536 } },
  ],
  quirks: [],
};

function mountPresetDom() {
  document.body.innerHTML = `
    <div id="composer-model-row" hidden>
      <label id="composer-think-wrap" hidden>
        <select id="param-think" data-control-id="think" disabled></select>
      </label>
      <div class="composer-recipes" id="composer-recipes" hidden></div>
    </div>
    <p id="settings-presets-empty">Este modelo no tiene recetas.</p>
    <div id="settings-presets-controls" hidden>
      <label id="settings-think-wrap" hidden>
        <select id="settings-think" disabled></select>
      </label>
      <div class="composer-recipes" id="settings-recipes" hidden></div>
    </div>
    <div id="settings-recipe-params" hidden></div>
    <div id="settings-model-capabilities" hidden></div>
    <span id="status-model-capabilities" hidden></span>
    <input id="param-temperature" data-control-id="temperature" disabled class="control-disabled" />
    <input id="param-num-ctx" data-control-id="num_ctx" disabled class="control-disabled" />
  `;
}

describe("presets de conversación y overlay", () => {
  beforeEach(() => {
    mountPresetDom();
    sessionStore.set({ conversationId: null });
    settingsStore.set({
      currentProvider: "ollama",
      currentModel: "gpt-oss:120b-cloud",
      paramsConfig: { provider: "ollama", params: { temperature: { default: 0.8 } } },
      paramsBaseline: { temperature: 0.8 },
      paramsValues: {},
      paramsSource: "default",
      contract: null,
    });
  });

  it("al aplicar el contrato del overlay enseña recetas, thinking y badges", () => {
    settingsStore.set({
      contract: OVERLAY_CONTRACT,
      paramsConfig: {
        provider: "ollama",
        params: { temperature: { default: 0.8 }, ...OVERLAY_CONTRACT.params },
      },
    });
    applyThinkAndRecipesFromContract({ applyParamDefaults: true });
    const settingsHost = document.getElementById("settings-recipes");
    expect(document.getElementById("settings-presets-controls").hidden).toBe(false);
    expect(settingsHost.hidden).toBe(false);
    expect(settingsHost.querySelectorAll(".composer-recipe-chip")).toHaveLength(2);
    expect(settingsHost.querySelector('[data-recipe-id="fast"]')).toHaveTextContent("Rápido");
    expect(document.getElementById("settings-presets-empty").hidden).toBe(true);
    expect(document.getElementById("composer-model-row").hidden).toBe(false);
    expect(document.getElementById("param-think").disabled).toBe(false);
    expect(Array.from(document.getElementById("param-think").options).map((o) => o.value)).toEqual([
      "low",
      "medium",
      "high",
    ]);
    const badges = document.getElementById("settings-model-capabilities");
    expect(badges.hidden).toBe(false);
    expect(badges.textContent).toContain("Thinking");
    expect(badges.textContent).toContain("Tools");
    expect(badges.textContent).toMatch(/128K/);
  });

  it("syncSettingsPresetsMirrors pinta chips visibles del contrato", () => {
    settingsStore.set({ contract: OVERLAY_CONTRACT });
    syncSettingsPresetsMirrors();
    const host = document.getElementById("settings-recipes");
    expect(host.hidden).toBe(false);
    expect(host.querySelector(".composer-recipe-chip")).toHaveTextContent("Rápido");
  });

  it("clic en receta aplica params del overlay al store", () => {
    settingsStore.set({
      contract: OVERLAY_CONTRACT,
      paramsConfig: { provider: "ollama", params: OVERLAY_CONTRACT.params },
      paramsValues: { think: "medium", temperature: 0.4 },
    });
    applyThinkAndRecipesFromContract({ applyParamDefaults: false });
    document.getElementById("param-think").disabled = false;
    document.getElementById("param-temperature").disabled = false;
    document.getElementById("param-num-ctx").disabled = false;
    applyModelRecipe(OVERLAY_CONTRACT.recipes[0]);
    expect(settingsStore.get().paramsValues.think).toBe("low");
    expect(settingsStore.get().paramsValues.temperature).toBe(0.3);
    expect(settingsStore.get().paramsValues.num_ctx).toBe(8192);
    expect(document.querySelector('#settings-recipes [data-recipe-id="fast"]').classList.contains("is-active")).toBe(
      true,
    );
  });

  it("loadModelContract aplica recetas del overlay a la UI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => OVERLAY_CONTRACT,
      }),
    );
    await loadModelContract({ applyParamDefaults: true });
    expect(settingsStore.get().contract.recipes).toHaveLength(2);
    expect(document.getElementById("settings-recipes").querySelectorAll(".composer-recipe-chip")).toHaveLength(2);
    expect(document.getElementById("param-think").disabled).toBe(false);
  });
});
