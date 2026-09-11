import { describe, it, expect, beforeEach, vi } from "vitest";
import { imagesStore, IMAGES_PREFS_KEY } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import { settingsStore } from "../store/settings.js";
import {
  collectImagesSnapshot,
  applyImagesSnapshot,
  ensureImagesPromptSelects,
  loadPlannerContract,
  applyPlannerRecipe,
  fillImagesPanelFromPrefs,
  persistImagesPanel,
  resetPlannerRulesHydration,
} from "./imagesPanel.js";

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

  it("loadPlannerContract pinta recetas del overlay de imágenes", async () => {
    document.body.innerHTML = `
      <select id="images-prompt-provider"><option value="ollama" selected>ollama</option></select>
      <select id="images-prompt-model"><option value="gpt-oss:120b-cloud" selected>gpt-oss:120b-cloud</option></select>
      <input type="checkbox" id="images-use-chat-config" />
      <p id="planner-presets-empty">Este modelo no tiene recetas.</p>
      <p id="planner-presets-chat-hint" hidden></p>
      <div id="planner-presets-controls" hidden>
        <label id="planner-think-wrap" hidden>
          <select id="planner-think" disabled></select>
        </label>
        <div id="planner-recipes" hidden></div>
      </div>
      <div id="planner-recipe-params" hidden></div>
    `;
    document.getElementById("images-prompt-provider").value = "ollama";
    document.getElementById("images-prompt-model").value = "gpt-oss:120b-cloud";
    imagesStore.set({
      prefs: { use_chat_config: false, prompt_provider: "ollama", prompt_model: "gpt-oss:120b-cloud" },
      plannerContract: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          capabilities: { thinking: { kind: "levels", values: ["low", "medium", "high"], default: "medium" } },
          params: { think: { default: "medium" }, temperature: { default: 0.4 } },
          recipes: [{ id: "fast", label: "Rápido", params: { think: "low", temperature: 0.3 } }],
        }),
      }),
    );
    await loadPlannerContract();
    const host = document.getElementById("planner-recipes");
    expect(document.getElementById("planner-presets-controls").hidden).toBe(false);
    expect(host.hidden).toBe(false);
    expect(host.querySelector(".composer-recipe-chip")).toHaveTextContent("Rápido");
    expect(imagesStore.get().prefs.prompt_model_params).toEqual({ think: "medium", temperature: 0.4 });
    expect(collectImagesSnapshot().prompt_model_params).toEqual({ think: "medium", temperature: 0.4 });
    await applyPlannerRecipe({ id: "fast", label: "Rápido", params: { think: "low", temperature: 0.3 } });
    expect(imagesStore.get().prefs.prompt_model_params).toEqual({ think: "low", temperature: 0.3 });
    expect(host.querySelector('[data-recipe-id="fast"]').classList.contains("is-active")).toBe(true);
  });
});

describe("selectores LLM del planificador de imágenes", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <select id="images-prompt-provider"></select>
      <select id="images-prompt-model"></select>
    `;
    settingsStore.set({ providers: [], currentProvider: "ollama", currentModel: "" });
    imagesStore.set({
      prefs: { prompt_provider: "mancer", prompt_model: "mythomax" },
      plannerContract: null,
    });
  });

  it("ensureImagesPromptSelects rellena proveedor aunque el store aún no tenga la lista", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const path = String(url);
        if (path.includes("/providers/") && path.includes("/models")) {
          return { ok: true, status: 200, json: async () => [{ name: "mythomax" }, { name: "other" }] };
        }
        return { ok: true, status: 200, json: async () => [{ name: "ollama" }, { name: "mancer" }] };
      }),
    );
    await ensureImagesPromptSelects();
    const providerSel = document.getElementById("images-prompt-provider");
    expect(Array.from(providerSel.options).map((o) => o.value)).toEqual(["ollama", "mancer"]);
    expect(providerSel.value).toBe("mancer");
    const modelSel = document.getElementById("images-prompt-model");
    expect(Array.from(modelSel.options).map((o) => o.value)).toEqual(["mythomax", "other"]);
    expect(modelSel.value).toBe("mythomax");
  });
});

describe("reglas activas del planificador", () => {
  beforeEach(() => {
    localStorage.clear();
    resetPlannerRulesHydration();
    sessionStore.set({ conversationId: null, plannerRules: [] });
    imagesStore.set({ prefs: {} });
  });

  it("fillImagesPanelFromPrefs hidrata las reglas activas desde prefs", () => {
    fillImagesPanelFromPrefs({
      prompt_system_instructions: [{ rule_id: "r1", title: "Luz", content: "nocturna" }],
    });
    expect(sessionStore.get().plannerRules[0].title).toBe("Luz");
  });

  it("persistImagesPanel no borra reglas de prefs si aún no se hidrataron", () => {
    imagesStore.set({
      prefs: {
        prompt_system_instructions: [{ rule_id: "r1", title: "Luz", content: "nocturna" }],
      },
    });
    sessionStore.set({ plannerRules: [] });
    persistImagesPanel();
    const saved = JSON.parse(localStorage.getItem(IMAGES_PREFS_KEY) || "{}");
    expect(saved.prompt_system_instructions[0].title).toBe("Luz");
    expect(imagesStore.get().prefs.prompt_system_instructions[0].title).toBe("Luz");
  });

  it("reordenar reglas del planificador escribe el nuevo orden en prefs", async () => {
    sessionStore.set({
      plannerRules: [
        { rule_id: "r1", title: "Luz", content: "nocturna" },
        { rule_id: "r2", title: "Cámara", content: "35mm" },
      ],
    });
    const { reorderActiveRules } = await import("./rulesActions.js");
    reorderActiveRules(1, 0, "planner");
    expect(sessionStore.get().plannerRules.map((r) => r.rule_id)).toEqual(["r2", "r1"]);
    expect(imagesStore.get().prefs.prompt_system_instructions.map((r) => r.rule_id)).toEqual(["r2", "r1"]);
  });
});
