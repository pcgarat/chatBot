import { describe, it, expect, beforeEach, vi } from "vitest";
import { imagesStore } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import { debugStore, setDebugPanelOpen, clearDebugLogs } from "../store/debug.js";
import { maybeIllustrateAssistantMessage, clearMessagePhotos, pruneOrphanAnchors } from "./illustrate.js";
import { readReactorPanelSettings } from "./imagesPanel.js";
import { layoutStore } from "../store/layout.js";

vi.mock("./galleryActions.js", () => ({
  refreshGalleryAfterScopeChange: vi.fn().mockResolvedValue(undefined),
}));


function emptyStreamResponse() {
  return ndjsonStream([]);
}

function ndjsonStream(lines) {
  const encoder = new TextEncoder();
  const chunks = lines.map((line) => encoder.encode(line + "\n"));
  let i = 0;
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    body: {
      getReader() {
        return {
          async read() {
            if (i >= chunks.length) return { done: true, value: undefined };
            return { done: false, value: chunks[i++] };
          },
        };
      },
    },
  };
}

describe("botón generar imágenes del mensaje", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="number" id="images-reactor-codeformer-weight" value="" />
      <input type="checkbox" id="images-reactor-enabled" />
      <input type="checkbox" id="images-reactor-female-enabled" />
      <input type="checkbox" id="images-reactor-male-enabled" />
      <input id="images-reactor-female-face-model" value="" />
      <input id="images-reactor-male-face-model" value="" />
      <input type="number" id="images-forge-steps" value="" />
      <input type="number" id="images-forge-width" value="" />
      <input type="number" id="images-forge-height" value="" />
      <input type="number" id="images-forge-seed" value="" />
    `;
    sessionStore.set({
      conversationId: "conv-1",
      plannerRules: [{ id: "r1", title: "Planner", content: "" }],
    });
    imagesStore.set({
      prefs: {
        enabled: true,
        use_chat_config: false,
        visual_consistency: true,
        prompt_provider: "ollama",
        prompt_model: "llama3.2",
        prompt_model_params: {},
        images_per_response: 2,
        batch_size: 10,
        retries: 1,
        prompt: "",
        reactor: {},
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(emptyStreamResponse()));
  });

  it("envía los params del overlay del planificador aunque no se haya pulsado una receta", async () => {
    imagesStore.set({
      plannerContract: {
        capabilities: { thinking: { kind: "levels", values: ["low", "medium", "high"], default: "medium" } },
        params: { think: { default: "medium" }, temperature: { default: 0.4 }, num_ctx: { default: 32768 } },
        recipes: [{ id: "fast", label: "Rápido", params: { think: "low", temperature: 0.3, num_ctx: 8192 } }],
      },
      prefs: {
        ...imagesStore.get().prefs,
        prompt_model_params: {},
      },
    });
    await maybeIllustrateAssistantMessage("msg-1", { force: true });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.prompt_model_params).toEqual({
      think: "medium",
      temperature: 0.4,
      num_ctx: 32768,
    });
  });

  it("con use_chat_config envía los params vivos del chat, no los del overlay del planificador", async () => {
    const { settingsStore } = await import("../store/settings.js");
    settingsStore.set({
      paramsConfig: {
        params: {
          temperature: { default: 0.7 },
          think: { default: "high" },
        },
      },
      paramsBaseline: { temperature: 0.7, think: "high" },
      paramsValues: { temperature: 0.15, think: "low" },
      paramsExcludedFromSendByConv: {},
    });
    imagesStore.set({
      plannerContract: {
        capabilities: { thinking: { kind: "levels", values: ["low", "high"], default: "high" } },
        params: { think: { default: "high" }, temperature: { default: 0.3 } },
        recipes: [{ id: "fast", label: "Rápido", params: { think: "low", temperature: 0.3 } }],
      },
      prefs: {
        ...imagesStore.get().prefs,
        use_chat_config: true,
        prompt_model_params: { think: "low", temperature: 0.3 },
      },
    });
    await maybeIllustrateAssistantMessage("msg-1", { force: true });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.prompt_model_params).toEqual({ temperature: 0.15, think: "low" });
  });

  it("incluye en la llamada las reglas del planificador aunque el chip no tenga content", async () => {
    const { settingsStore } = await import("../store/settings.js");
    settingsStore.set({
      plannerLibraryRules: [{ id: "r1", title: "Planner", content: "iluminación nocturna" }],
    });
    await maybeIllustrateAssistantMessage("msg-1", { force: true });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.prompt_system_instructions).toContain("iluminación nocturna");
  });

  it("envía instrucciones como string y omite números vacíos del panel (no 422)", async () => {
    await maybeIllustrateAssistantMessage("msg-1", { force: true });
    expect(fetch).toHaveBeenCalled();
    const [, init] = fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(typeof body.prompt_system_instructions).toBe("string");
    expect(Array.isArray(body.prompt_system_instructions)).toBe(false);
    expect(body).not.toHaveProperty("reactor");
    expect(body.steps).not.toBe("");
    expect(body.width).not.toBe("");
    expect(body).not.toHaveProperty("steps");
  });

  it("no manda reactor si face swap está desactivado", async () => {
    await maybeIllustrateAssistantMessage("msg-1", { force: true });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("reactor");
  });

  it("manda reactor solo con lo activo cuando face swap está encendido", async () => {
    document.getElementById("images-reactor-enabled").checked = true;
    document.getElementById("images-reactor-female-enabled").checked = true;
    document.getElementById("images-reactor-female-face-model").value = "woman.safetensors";
    await maybeIllustrateAssistantMessage("msg-1", { force: true });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.reactor).toEqual({
      enabled: true,
      female_enabled: true,
      female_face_model: "woman.safetensors",
    });
    expect(body.reactor).not.toHaveProperty("codeformer_weight");
    expect(body.reactor).not.toHaveProperty("male_face_model");
  });

  it("formatea el 422 de validación en el toast", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: async () => ({
        detail: [
          {
            loc: ["body", "reactor", "codeformer_weight"],
            msg: "Input should be a valid number",
          },
        ],
      }),
    });
    await maybeIllustrateAssistantMessage("msg-1", { force: true });
    const toast = document.querySelector(".error-toast");
    expect(toast).toBeTruthy();
    expect(toast.textContent).not.toContain("[object Object]");
    expect(toast.textContent).toContain("codeformer_weight");
  });

  it("pinta la llamada al LLM del planificador en Debug (chat) como árbol JSON", async () => {
    document.body.innerHTML += `
      <aside id="column-right">
        <section class="debug-accordion" id="debug-accordion-chat">
          <button type="button" id="debug-chat-toggle" aria-expanded="false"></button>
          <div id="debug-chat-body" hidden>
            <div id="chat-debug-log"></div>
          </div>
        </section>
        <section class="debug-accordion" id="debug-accordion-images">
          <button type="button" id="debug-images-toggle" aria-expanded="false"></button>
          <div id="debug-images-body" hidden>
            <div id="images-debug-log"></div>
          </div>
        </section>
      </aside>
    `;
    clearDebugLogs();
    fetch.mockResolvedValueOnce(
      ndjsonStream([
        JSON.stringify({
          type: "status",
          message: "Planificando prompts (lote 1)",
          data: { code: "images.planning", batch: 1 },
        }),
        JSON.stringify({
          type: "llm_debug",
          message: "Petición al LLM de planificador (lote 1)",
          data: {
            debug_request: '{\n  "model": "planner",\n  "stream": false\n}',
            debug_response: '{"illustrate": true, "scenes": [{"id": "s1"}]}',
            label: "Petición al LLM de planificador (lote 1)",
            batch: 1,
            scene_ids: ["s1"],
          },
        }),
      ])
    );
    await maybeIllustrateAssistantMessage("msg-1", { force: true });
    setDebugPanelOpen("chat", true);
    const html = document.getElementById("chat-debug-log").innerHTML;
    expect(html).toContain("Petición al LLM de planificador");
    expect(html).toContain("json-tree");
    expect(html).toContain("Request");
    expect(html).toContain(">model<");
    expect(html).toContain("planner");
    expect(html).toContain("Response");
    expect(html).toContain(">illustrate<");
    expect(html).not.toContain(">llm_debug<");
    expect(document.getElementById("images-debug-log").innerHTML).not.toContain(
      "Petición al LLM de planificador"
    );
    const plannerEntries = debugStore.get().chatLog.filter((e) =>
      String(e.title || "").includes("planificador")
    );
    expect(plannerEntries).toHaveLength(1);
    expect(plannerEntries[0].status).toBe("done");
    expect(plannerEntries[0].request).toContain('"model": "planner"');
  });
});

describe("readReactorPanelSettings", () => {
  it("omite codeformer_weight si el input está vacío", () => {
    document.body.innerHTML = `
      <input type="number" id="images-reactor-codeformer-weight" value="" />
      <input type="checkbox" id="images-reactor-enabled" />
      <input type="checkbox" id="images-reactor-female-enabled" />
      <input type="checkbox" id="images-reactor-male-enabled" />
      <input id="images-reactor-female-face-model" value="" />
      <input id="images-reactor-male-face-model" value="" />
    `;
    imagesStore.set({ prefs: { reactor: {} } });
    const reactor = readReactorPanelSettings();
    expect(reactor).not.toHaveProperty("codeformer_weight");
  });
});

describe("clearMessagePhotos y pruneOrphanAnchors", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.spyOn(window, "confirm").mockReturnValue(true);
    sessionStore.set({
      conversationId: "conv-1",
      allMessages: [{ id: "msg-1", role: "assistant", content: "foto <img>" }],
      messages: [{ id: "msg-1", role: "assistant", content: "foto <img>" }],
    });
    layoutStore.set({ centerGalleryVisible: false });
  });

  it("clear-photos pide confirmación, POST y actualiza el content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "msg-1", content: "texto limpio", deleted_files: 2 }),
      })
    );
    await clearMessagePhotos("msg-1");
    expect(window.confirm).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "/api/conversations/conv-1/messages/msg-1/illustrations/clear-photos",
      expect.objectContaining({ method: "POST" })
    );
    expect(sessionStore.get().messages[0].content).toBe("texto limpio");
    expect(document.querySelector(".notice-toast")?.textContent).toBe("Borradas 2 imagen(es).");
  });

  it("clear-photos no llama API si se cancela el confirm", async () => {
    window.confirm.mockReturnValue(false);
    vi.stubGlobal("fetch", vi.fn());
    await clearMessagePhotos("msg-1");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("prune-orphans POST y actualiza el content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "msg-1", content: "sin anclas", deleted_files: 0 }),
      })
    );
    await pruneOrphanAnchors("msg-1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/conversations/conv-1/messages/msg-1/illustrations/prune-orphans",
      expect.objectContaining({ method: "POST" })
    );
    expect(sessionStore.get().messages[0].content).toBe("sin anclas");
    expect(document.querySelector(".notice-toast")?.textContent).toBe("Anclas huérfanas eliminadas.");
  });
});

