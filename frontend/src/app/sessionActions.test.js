import { describe, it, expect, beforeEach, vi } from "vitest";
import { sessionStore } from "../store/session.js";
import { createConversation } from "../api/conversations.js";

const getConversation = vi.fn();
const patchConversation = vi.fn();

vi.mock("../api/conversations.js", () => ({
  getConversation: (...args) => getConversation(...args),
  patchConversation: (...args) => patchConversation(...args),
  createConversation: vi.fn(),
  forkConversation: vi.fn(),
  deleteMessage: vi.fn(),
}));

vi.mock("./settingsActions.js", () => ({
  loadModelContract: vi.fn(async () => {}),
  loadModels: vi.fn(async () => {}),
  loadParamsForProvider: vi.fn(async () => {}),
  applyConversationParams: vi.fn(),
}));

vi.mock("./historyActions.js", () => ({
  applyConsultaChrome: vi.fn(),
  refreshLeftHistory: vi.fn(),
  setLeftHistoryMode: vi.fn(),
}));

vi.mock("./imagesPanel.js", () => ({
  persistImagesPanel: vi.fn(),
  applyImagesSnapshot: vi.fn(),
  imagesSnapshotForConversation: vi.fn(() => ({})),
}));

function sampleConv(overrides = {}) {
  return {
    id: "c1",
    title: "faro",
    kind: "chat",
    auto_title: false,
    messages: [
      { id: "u1", role: "user", content: "pinta", parent_id: null },
      {
        id: "m1",
        role: "assistant",
        content: '<img class="chat-illustration" data-filename="faro.png">',
        parent_id: "u1",
      },
    ],
    ...overrides,
  };
}

describe("openConversationAtIllustration", () => {
  beforeEach(() => {
    getConversation.mockReset().mockResolvedValue(sampleConv());
    patchConversation.mockReset().mockResolvedValue({});
    sessionStore.set({
      conversationId: "c1",
      messages: sampleConv().messages,
      allMessages: sampleConv().messages,
      collapsedMessageKeys: [],
      consultaAssistantId: null,
      pendingReveal: null,
    });
  });

  it("si la foto ya está en el hilo no recarga y ancla ese mensaje", async () => {
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("c1", "m1", {
      filename: "faro.png",
      sceneId: "s-faro",
    });
    expect(getConversation).not.toHaveBeenCalled();
    expect(sessionStore.get().pendingReveal).toEqual({
      conversationId: "c1",
      messageId: "m1",
      filename: "faro.png",
      sceneId: "s-faro",
    });
  });

  it("si la foto está en el hilo actual no abre la conversación dueña", async () => {
    sessionStore.set({
      conversationId: "fork-b",
      messages: sampleConv().messages,
      allMessages: sampleConv().messages,
      collapsedMessageKeys: [],
      consultaAssistantId: null,
      pendingReveal: null,
    });
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("owner-a", "m1", {
      filename: "faro.png",
      sceneId: "s-faro",
    });
    expect(getConversation).not.toHaveBeenCalled();
    expect(sessionStore.get().pendingReveal).toEqual(
      expect.objectContaining({ conversationId: "fork-b", messageId: "m1" })
    );
  });

  it("no usa la escena s40 de otro relato si el archivo no está en el mensaje de la galería", async () => {
    sessionStore.set({
      conversationId: "c1",
      messages: [
        {
          id: "m-early",
          role: "assistant",
          content: '<img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40">',
        },
        {
          id: "m-gallery",
          role: "assistant",
          content: '<img class="chat-illustration" data-filename="bbb_s1.jpg" alt="escena s1">',
        },
      ],
      consultaAssistantId: null,
      pendingReveal: null,
    });
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("c1", "m-gallery", {
      filename: "070ace_s40.jpg",
      sceneId: "s40",
    });
    expect(sessionStore.get().pendingReveal.messageId).toBe("m-gallery");
  });

  it("con messageId ausente del hilo no ancla la escena s40 de otro mensaje", async () => {
    sessionStore.set({
      conversationId: "c1",
      messages: [
        {
          id: "m-early",
          role: "assistant",
          content: '<img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40">',
        },
      ],
      consultaAssistantId: null,
      pendingReveal: null,
    });
    const { findMessageWithIllustration } = await import("./sessionActions.js");
    const found = findMessageWithIllustration(
      sessionStore.get().messages,
      "ccc_s40.jpg",
      "s40",
      "m-debug"
    );
    expect(found).toBeNull();
  });

  it("al ir a otra conversación guarda el conversationId destino en pendingReveal", async () => {
    sessionStore.set({
      conversationId: "fork-b",
      messages: [{ id: "m-local", role: "assistant", content: "sin foto" }],
      consultaAssistantId: null,
      pendingReveal: null,
    });
    getConversation.mockResolvedValue(
      sampleConv({
        id: "owner-a",
        messages: [
          {
            id: "m1",
            role: "assistant",
            content: '<img class="chat-illustration" data-filename="desaparecida.png">',
          },
        ],
      })
    );
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("owner-a", "m1", {
      filename: "desaparecida.png",
      sceneId: "s-x",
    });
    expect(sessionStore.get().pendingReveal).toEqual(
      expect.objectContaining({
        conversationId: "owner-a",
        messageId: "m1",
        filename: "desaparecida.png",
        sceneId: "s-x",
      })
    );
  });

  it("el enlace debug ancla el mensaje indicado aunque otro relato tenga la misma escena", async () => {
    sessionStore.set({
      conversationId: "c1",
      messages: [
        {
          id: "m-early",
          role: "assistant",
          content: '<img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40">',
        },
        {
          id: "m-debug",
          role: "assistant",
          content: '<img class="chat-illustration" data-filename="ccc_s40.jpg" alt="escena s40">',
        },
      ],
      consultaAssistantId: null,
      pendingReveal: null,
    });
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("c1", "m-debug", {
      filename: "ccc_s40.jpg",
      sceneId: "s40",
    });
    expect(sessionStore.get().pendingReveal).toEqual(
      expect.objectContaining({ messageId: "m-debug", filename: "ccc_s40.jpg", sceneId: "s40" })
    );
  });

  it("si el message_id es de otro mensaje, ancla el que contiene la foto", async () => {
    sessionStore.set({
      conversationId: "fork-b",
      messages: [
        { id: "m-stale", role: "assistant", content: "sin esa foto" },
        {
          id: "m-real",
          role: "assistant",
          content: '<img class="chat-illustration" data-filename="faro.png">',
        },
      ],
      consultaAssistantId: null,
      pendingReveal: null,
    });
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("owner-a", "m-stale", {
      filename: "faro.png",
      sceneId: "s-faro",
    });
    expect(getConversation).not.toHaveBeenCalled();
    expect(sessionStore.get().pendingReveal.messageId).toBe("m-real");
  });

  it("sin filename pide revelar el mensaje del id", async () => {
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("c1", "m1", {});
    expect(sessionStore.get().pendingReveal).toEqual(
      expect.objectContaining({ messageId: "m1", filename: null })
    );
  });

  it("si la foto no está en el HTML pero el mensaje sí, no recarga el hilo", async () => {
    sessionStore.set({
      conversationId: "c1",
      messages: [{ id: "m1", role: "assistant", content: "sin esa foto" }],
      consultaAssistantId: null,
      pendingReveal: null,
    });
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("c1", "m1", {
      filename: "desaparecida.png",
      sceneId: "s-x",
    });
    expect(getConversation).not.toHaveBeenCalled();
    expect(sessionStore.get().pendingReveal).toEqual(
      expect.objectContaining({ conversationId: "c1", messageId: "m1", filename: "desaparecida.png" })
    );
  });

  it("si la foto no está en el hilo actual abre la conversación dueña", async () => {
    sessionStore.set({
      conversationId: "fork-b",
      messages: [{ id: "m1", role: "assistant", content: "sin foto" }],
      consultaAssistantId: null,
      pendingReveal: null,
    });
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("owner-a", "m1", {
      filename: "desaparecida.png",
      sceneId: "s-x",
    });
    expect(getConversation).toHaveBeenCalledWith("owner-a");
    expect(sessionStore.get().pendingReveal).toEqual(
      expect.objectContaining({ filename: "desaparecida.png", messageId: "m1" })
    );
  });

  it("sale del modo consulta para poder anclar la foto en el hilo", async () => {
    sessionStore.set({
      conversationId: "c1",
      consultaAssistantId: "m1",
      messages: sampleConv().messages,
      allMessages: sampleConv().messages,
      collapsedMessageKeys: [],
      pendingReveal: null,
    });
    const { openConversationAtIllustration } = await import("./sessionActions.js");
    await openConversationAtIllustration("c1", "m1", {
      filename: "faro.png",
      sceneId: "s-faro",
    });
    expect(sessionStore.get().consultaAssistantId).toBeNull();
    expect(getConversation).not.toHaveBeenCalled();
    expect(sessionStore.get().pendingReveal).toEqual(
      expect.objectContaining({ filename: "faro.png", sceneId: "s-faro" })
    );
  });
});

describe("setCurrentConversation rules", () => {
  it("hidrata reglas activas desde system_instructions al abrir la conversación", async () => {
    const rules = [
      { rule_id: "r1", title: "Estilo", content: "claro y directo" },
      { rule_id: "r2", title: "Tono", content: "sereno" },
    ];
    sessionStore.set({ conversationId: null, rules: [] });
    const { setCurrentConversation } = await import("./sessionActions.js");
    await setCurrentConversation(
      sampleConv({
        system_instructions: rules,
      })
    );
    expect(sessionStore.get().rules).toEqual(rules);
  });
});

describe("newConversation rules", () => {
  it("crea la conversación con las reglas activas para que entren en el primer mensaje", async () => {
    const rules = [{ id: "r1", title: "Estilo", content: "claro" }];
    sessionStore.set({ conversationId: null, rules });
    createConversation.mockReset().mockResolvedValue(
      sampleConv({
        id: "c-new",
        messages: [],
        system_instructions: [{ rule_id: "r1", title: "Estilo", content: "claro" }],
      })
    );
    const { newConversation } = await import("./sessionActions.js");
    await newConversation();
    expect(createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        system_instructions: [{ rule_id: "r1", title: "Estilo", content: "claro" }],
      })
    );
  });
});
