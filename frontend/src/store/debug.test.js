import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../app/queueActions.js", () => ({
  loadImageQueueForDebug: vi.fn(),
  maybeStopImageQueuePoll: vi.fn(),
}));

import {
  debugStore,
  setDebugPanelOpen,
  createDebugLogBuffer,
  debugEntryHtml,
  formatDebugPayload,
  renderChatDebugLog,
  renderImagesDebugLog,
  ingestQueueItemsForDebug,
  ingestPlannerLlmDebug,
  pushChatDebugEntry,
  toggleDebugJsonPath,
  toggleDebugEntryExpanded,
  isDebugJsonPathExpanded,
  clearDebugLogs,
} from "./debug.js";

function mountDebugDock() {
  document.body.innerHTML = `
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
}

describe("debug store", () => {
  beforeEach(() => {
    clearDebugLogs();
    debugStore.set({ chatOpen: false, imagesOpen: false, chatLog: [], imagesLog: [] });
    mountDebugDock();
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

  it("serializa payloads objeto como JSON, no [object Object]", () => {
    const json = formatDebugPayload({ model: "qwen", params: { temp: 0.7 } });
    expect(json).toContain('"model": "qwen"');
    expect(json).not.toContain("[object Object]");
  });

  it("el HTML de cada entrada LLM muestra estado y árboles Request/Response/details", () => {
    const html = debugEntryHtml({
      id: "chat-1",
      ts: "12:40:01",
      title: "Petición al LLM de chat",
      status: "done",
      request: { model: "qwen" },
      response: { done: true },
      details: { conversation_id: "c1" },
    });
    expect(html).toContain("debug-entry-toggle");
    expect(html).toContain("Completado");
    expect(html).toContain("Petición al LLM de chat");
    expect(html).toContain("json-tree");
    expect(html).toContain("Request");
    expect(html).toContain(">model<");
    expect(html).toContain("qwen");
    expect(html).toContain("Response");
    expect(html).toContain(">conversation_id<");
    expect(html).toContain("c1");
    expect(html).not.toContain("[object Object]");
  });

  it("al abrir Debug vuelca el histórico con árboles JSON y da altura al acordeón", () => {
    pushChatDebugEntry({
      title: "Petición al LLM de chat",
      status: "waiting",
      request: { provider: "ollama" },
      details: { conversation_id: "abc" },
    });
    setDebugPanelOpen("chat", true);
    const log = document.getElementById("chat-debug-log");
    expect(document.getElementById("debug-accordion-chat").classList.contains("is-open")).toBe(true);
    expect(document.getElementById("debug-chat-body").hidden).toBe(false);
    expect(log.innerHTML).toContain("Petición al LLM de chat");
    expect(log.innerHTML).toContain("Esperando respuesta");
    expect(log.innerHTML).toContain("json-tree");
    expect(log.innerHTML).toContain("Request");
    expect(log.innerHTML).toContain(">provider<");
    expect(log.innerHTML).toContain("ollama");
    expect(log.innerHTML).toContain(">conversation_id<");
    expect(log.innerHTML).toContain("abc");
    expect(log.innerHTML).not.toContain("[object Object]");
  });

  it("sin eventos muestra el vacío; cola completada incluye details y enlace a la imagen", () => {
    setDebugPanelOpen("chat", true);
    renderChatDebugLog();
    expect(document.getElementById("chat-debug-log").innerHTML).toContain("Sin eventos todavía.");

    ingestQueueItemsForDebug([
      { id: "j1", status: "generating", scene_id: "s1", message_id: "m1", conversation_id: "c1" },
    ]);
    ingestQueueItemsForDebug([
      {
        id: "j1",
        status: "completed",
        scene_id: "s1",
        message_id: "m1",
        conversation_id: "c1",
        result_filename: "faro.png",
      },
    ]);
    setDebugPanelOpen("images", true);
    renderImagesDebugLog();
    const html = document.getElementById("images-debug-log").innerHTML;
    expect(html).toContain("Imagen generada");
    expect(html).toContain("faro.png");
    expect(html).toContain("debug-image-link");
    expect(html).toContain(">job_id<");
    expect(html).toContain("j1");
    expect(html).toContain("Ver en la conversación");
    expect(html).toContain('data-conversation-id="c1"');
    expect(html).toContain('data-message-id="m1"');
    expect(html).toContain('data-filename="faro.png"');
    expect(html).toContain('data-scene-id="s1"');
  });

  it("la llamada al LLM del planificador va a Debug (chat), no a Debug imágenes", () => {
    ingestPlannerLlmDebug({
      type: "llm_debug",
      message: "Petición al LLM de planificador (lote 1)",
      scene_id: "s1",
      data: {
        debug_request: '{\n  "model": "planner",\n  "messages": []\n}',
        debug_response: '{"illustrate": true, "scenes": []}',
        label: "Petición al LLM de planificador (lote 1)",
        batch: 1,
        scene_ids: ["s1", "s2"],
        reason: "relato",
      },
    });
    setDebugPanelOpen("chat", true);
    const html = document.getElementById("chat-debug-log").innerHTML;
    expect(html).toContain("Petición al LLM de planificador");
    expect(html).toContain("Completado");
    expect(html).toContain("json-tree");
    expect(html).toContain("Request");
    expect(html).toContain(">model<");
    expect(html).toContain("planner");
    expect(html).toContain("Response");
    expect(html).toContain(">illustrate<");
    expect(html).not.toContain(">llm_debug<");
    expect(debugStore.get().imagesLog.some((e) => String(e.title || "").includes("planificador"))).toBe(
      false
    );
    const entry = debugStore.get().chatLog.find((e) => e.title.includes("planificador"));
    expect(entry.request).toContain('"model": "planner"');
    expect(entry.response).toContain("illustrate");
    expect(entry.details.scene_ids).toEqual(["s1", "s2"]);
  });

  it("si el planificador responde error, la entrada queda en Error con el request", () => {
    ingestPlannerLlmDebug({
      type: "llm_debug",
      data: {
        debug_request: '{"model": "planner"}',
        debug_response: '{"error": "connection refused"}',
        label: "Petición al LLM de planificador",
      },
    });
    const entry = debugStore.get().chatLog.at(-1);
    expect(entry.status).toBe("error");
    expect(entry.request).toContain("planner");
    expect(entry.response).toContain("connection refused");
  });

  it("actualiza la entrada sending del planificador en lugar de duplicarla", () => {
    const pending = pushChatDebugEntry({
      title: "Petición al LLM de planificador",
      status: "sending",
    });
    ingestPlannerLlmDebug(
      {
        type: "llm_debug",
        data: {
          debug_request: '{"model": "m"}',
          debug_response: '{"illustrate": false}',
          label: "Petición al LLM de planificador (lote 2)",
          batch: 2,
        },
      },
      pending.id
    );
    const plannerEntries = debugStore.get().chatLog.filter((e) =>
      String(e.title || "").includes("planificador")
    );
    expect(plannerEntries).toHaveLength(1);
    expect(plannerEntries[0].id).toBe(pending.id);
    expect(plannerEntries[0].status).toBe("done");
    expect(plannerEntries[0].title).toContain("lote 2");
    expect(plannerEntries[0].request).toContain('"model": "m"');
  });

  it("toggleDebugJsonPath expande un nivel y sobrevive al re-render", () => {
    const { id } = pushChatDebugEntry({
      title: "Petición al LLM de chat",
      status: "done",
      request: { options: { temperature: 0.2 } },
    });
    setDebugPanelOpen("chat", true);
    expect(document.getElementById("chat-debug-log").innerHTML).not.toContain(">temperature<");
    toggleDebugJsonPath(id, ["request", "options"]);
    expect(isDebugJsonPathExpanded(id, ["request", "options"])).toBe(true);
    renderChatDebugLog();
    expect(document.getElementById("chat-debug-log").innerHTML).toContain(">temperature<");
    expect(document.getElementById("chat-debug-log").innerHTML).toContain("0.2");
  });

  it("expandir una propiedad JSON no contrae el registro completo", () => {
    const { id } = pushChatDebugEntry({
      title: "Petición al LLM de chat",
      status: "done",
      request: { options: { temperature: 0.2 } },
    });
    setDebugPanelOpen("chat", true);
    toggleDebugEntryExpanded(id);
    let body = document.querySelector(`[data-debug-id="${id}"] .debug-entry-body`);
    expect(body.hidden).toBe(false);

    toggleDebugJsonPath(id, ["request", "options"]);

    const entryAfter = document.querySelector(`[data-debug-id="${id}"]`);
    const bodyAfter = entryAfter.querySelector(".debug-entry-body");
    expect(bodyAfter.hidden).toBe(false);
    expect(entryAfter.querySelector(".debug-entry-toggle").getAttribute("aria-expanded")).toBe("true");
    expect(bodyAfter.innerHTML).toContain(">temperature<");
  });

  it("toggleDebugEntryExpanded persiste el acordeón tras re-render", () => {
    const { id } = pushChatDebugEntry({
      title: "Petición al LLM de chat",
      status: "done",
      request: { model: "qwen" },
    });
    setDebugPanelOpen("chat", true);
    expect(document.querySelector(`[data-debug-id="${id}"] .debug-entry-body`).hidden).toBe(true);
    toggleDebugEntryExpanded(id);
    expect(document.querySelector(`[data-debug-id="${id}"] .debug-entry-body`).hidden).toBe(false);
    renderChatDebugLog();
    expect(document.querySelector(`[data-debug-id="${id}"] .debug-entry-body`).hidden).toBe(false);
    toggleDebugEntryExpanded(id);
    expect(document.querySelector(`[data-debug-id="${id}"] .debug-entry-body`).hidden).toBe(true);
  });
});
