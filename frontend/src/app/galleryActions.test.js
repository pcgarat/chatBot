import { describe, it, expect, beforeEach, vi } from "vitest";
import { imagesStore } from "../store/images.js";
import { sessionStore } from "../store/session.js";
import {
  appendGalleryToolbarFilters,
  galleryListParams,
  clearGalleryToolbarFilters,
  loadGalleryPage,
  renderGalleryLightbox,
  highlightIllustrationInConversation,
  closeGalleryLightbox,
  handleGalleryLightboxOverlayClick,
} from "./galleryActions.js";

const openConversationAtIllustration = vi.fn();
const openConversationAtMessage = vi.fn();

vi.mock("./sessionActions.js", () => ({
  openConversationAtIllustration: (...args) => openConversationAtIllustration(...args),
  openConversationAtMessage: (...args) => openConversationAtMessage(...args),
  goToConversationTarget: (target = {}) => {
    if (target.filename || target.sceneId) {
      return openConversationAtIllustration(target.conversationId, target.messageId, {
        filename: target.filename || "",
        sceneId: target.sceneId || "",
      });
    }
    return openConversationAtMessage(target.conversationId, target.messageId);
  },
}));

describe("galería", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], total: 0 }),
    }));
    openConversationAtIllustration.mockReset();
    openConversationAtMessage.mockReset();
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
    expect(params.prompt_q).toBe("gato");
    const listed = galleryListParams();
    expect(listed.conversation_id).toBe("c1");
    expect(listed.limit).toBe(24);
  });

  it("clearGalleryToolbarFilters vacía el store", () => {
    clearGalleryToolbarFilters();
    expect(imagesStore.get().galleryFilters.promptModel).toBe("");
    expect(imagesStore.get().galleryFilters.promptQ).toBe("");
  });

  it("loadGalleryPage pide /illustrated-images, no /messages sin conversation_id", async () => {
    const urls = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url) => {
      urls.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
          total: 0,
          prompt_models: [],
          prompt_providers: [],
          forge_models: [],
          steps: [],
          sizes: [],
          modes: [],
          seeds: [],
        }),
      };
    }));
    imagesStore.set({
      galleryScopeAll: true,
      galleryOffset: 0,
      galleryMessageId: null,
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
    });
    await loadGalleryPage({ silent: true });
    const listUrls = urls.filter((u) => u.includes("/illustrated-images"));
    expect(listUrls.some((u) => /\/illustrated-images\?/.test(u))).toBe(true);
    expect(
      listUrls.some((u) => /\/illustrated-images\/messages\?/.test(u) && !u.includes("conversation_id"))
    ).toBe(false);
  });

  it("highlightIllustrationInConversation centra la foto, no el inicio del mensaje", () => {
    document.body.innerHTML = `
      <div id="messages-container">
        <div class="message-row" data-msg-id="m1">
          <img class="chat-illustration" data-filename="antes.png" src="/api/illustrated-images/antes.png" />
          <span class="chat-illustration-frame">
            <img class="chat-illustration" data-filename="faro.png" src="/api/illustrated-images/faro.png" />
          </span>
        </div>
      </div>
    `;
    const root = document.getElementById("messages-container");
    const frame = document.querySelector(".chat-illustration-frame");
    const msg = document.querySelector('[data-msg-id="m1"]');
    const msgScroll = vi.fn();
    const photoScroll = vi.fn();
    msg.scrollIntoView = msgScroll;
    frame.scrollIntoView = photoScroll;
    Object.defineProperty(root, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(root, "scrollHeight", { configurable: true, value: 2000 });
    let scrollTop = 0;
    Object.defineProperty(root, "scrollTop", {
      configurable: true,
      get() {
        return scrollTop;
      },
      set(v) {
        scrollTop = v;
      },
    });
    root.getBoundingClientRect = () => ({ top: 0, bottom: 400, height: 400, left: 0, right: 300, width: 300 });
    msg.getBoundingClientRect = () => ({ top: 0, bottom: 2000, height: 2000, left: 0, right: 300, width: 300 });
    frame.getBoundingClientRect = () => ({ top: 800, bottom: 1000, height: 200, left: 0, right: 300, width: 300 });
    highlightIllustrationInConversation("faro.png", "s1");
    expect(scrollTop).toBe(700);
    expect(photoScroll).not.toHaveBeenCalled();
    expect(msgScroll).not.toHaveBeenCalled();
    expect(frame.classList.contains("illustration-debug-highlight")).toBe(true);
  });

  it("si el filename de la galería no está en el chat, ancla por escena (alt)", () => {
    document.body.innerHTML = `
      <div id="messages-container">
        <div class="message-row" data-msg-id="m1">
          <span class="chat-illustration-frame" id="frame-s1">
            <img class="chat-illustration" data-filename="aaa_s1.jpg" alt="escena s1" src="/api/illustrated-images/aaa_s1.jpg" />
          </span>
          <span class="chat-illustration-frame" id="frame-s40">
            <img class="chat-illustration" data-filename="bbb_s40.jpg" alt="escena s40" src="/api/illustrated-images/bbb_s40.jpg" />
          </span>
        </div>
      </div>
    `;
    const root = document.getElementById("messages-container");
    const frameS1 = document.getElementById("frame-s1");
    const frameS40 = document.getElementById("frame-s40");
    Object.defineProperty(root, "clientHeight", { configurable: true, value: 400 });
    let scrollTop = 0;
    Object.defineProperty(root, "scrollTop", {
      configurable: true,
      get() {
        return scrollTop;
      },
      set(v) {
        scrollTop = v;
      },
    });
    root.getBoundingClientRect = () => ({ top: 0, bottom: 400, height: 400, left: 0, right: 300, width: 300 });
    frameS1.getBoundingClientRect = () => ({ top: 40, bottom: 240, height: 200, left: 0, right: 300, width: 300 });
    frameS40.getBoundingClientRect = () => ({ top: 800, bottom: 1000, height: 200, left: 0, right: 300, width: 300 });
    const found = highlightIllustrationInConversation("070ace_s40.jpg", "s40");
    expect(found).toBe(true);
    expect(scrollTop).toBe(700);
    expect(frameS40.classList.contains("illustration-debug-highlight")).toBe(true);
    expect(frameS1.classList.contains("illustration-debug-highlight")).toBe(false);
  });

  it("con messageId de un mensaje que aún no está en el DOM no ancla el s40 de otro relato", () => {
    document.body.innerHTML = `
      <div id="messages-container">
        <div class="message-row" data-msg-id="m-early">
          <span class="chat-illustration-frame" id="frame-early">
            <img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40" data-scene="s40" src="/api/illustrated-images/aaa_s40.jpg" />
          </span>
        </div>
      </div>
    `;
    const root = document.getElementById("messages-container");
    Object.defineProperty(root, "clientHeight", { configurable: true, value: 400 });
    let scrollTop = 0;
    Object.defineProperty(root, "scrollTop", {
      configurable: true,
      get() {
        return scrollTop;
      },
      set(v) {
        scrollTop = v;
      },
    });
    root.getBoundingClientRect = () => ({ top: 0, bottom: 400, height: 400, left: 0, right: 300, width: 300 });
    const early = document.getElementById("frame-early");
    early.getBoundingClientRect = () => ({ top: 800, bottom: 1000, height: 200, left: 0, right: 300, width: 300 });
    const found = highlightIllustrationInConversation("070ace_s40.jpg", "s40", {
      silent: true,
      messageId: "m-target",
    });
    expect(found).toBe(false);
    expect(early.classList.contains("illustration-debug-highlight")).toBe(false);
    expect(scrollTop).toBe(0);
  });

  it("Ir al mensaje del visor cierra el lightbox y salta a la foto concreta", async () => {
    document.body.innerHTML = `
      <div id="image-gallery-lightbox">
        <img id="image-gallery-lightbox-img" alt="" />
        <button type="button" id="image-gallery-lightbox-prev"></button>
        <button type="button" id="image-gallery-lightbox-next"></button>
        <div id="image-gallery-lightbox-meta"></div>
      </div>
    `;
    imagesStore.set({
      galleryItems: [
        {
          filename: "faro.png",
          scene_id: "scene-faro",
          message_id: "m1",
          conversation_id: "c-other",
          url: "/api/illustrated-images/faro.png",
          conversation_title: "faro",
          prompt: "un faro",
        },
      ],
      galleryLightboxIndex: 0,
      galleryOffset: 0,
      galleryTotal: 1,
    });
    sessionStore.set({
      conversationId: "c1",
      messages: [{ id: "m-other" }],
      pendingReveal: null,
    });
    const modal = document.getElementById("image-gallery-lightbox");
    modal.hidden = false;
    renderGalleryLightbox();
    document.getElementById("gallery-open-message").click();
    await vi.waitFor(() => {
      expect(openConversationAtIllustration).toHaveBeenCalled();
    });
    expect(openConversationAtIllustration).toHaveBeenCalledWith("c-other", "m1", {
      filename: "faro.png",
      sceneId: "scene-faro",
    });
    expect(openConversationAtMessage).not.toHaveBeenCalled();
    expect(modal.hidden).toBe(true);
    expect(imagesStore.get().galleryLightboxIndex).toBe(-1);
    expect(sessionStore.get().pendingReveal).toBeNull();
  });

  it("cierra el lightbox al pulsar el fondo fuera del contenido", () => {
    document.body.innerHTML = `
      <div id="image-gallery-lightbox" class="modal-overlay image-gallery-lightbox">
        <div class="modal-content image-gallery-lightbox-content">
          <img id="image-gallery-lightbox-img" alt="" />
        </div>
      </div>
    `;
    const modal = document.getElementById("image-gallery-lightbox");
    modal.hidden = false;
    imagesStore.set({ galleryLightboxIndex: 0 });
    handleGalleryLightboxOverlayClick({ target: modal });
    expect(modal.hidden).toBe(true);
    expect(imagesStore.get().galleryLightboxIndex).toBe(-1);
  });

  it("no cierra el lightbox al pulsar dentro del contenido", () => {
    document.body.innerHTML = `
      <div id="image-gallery-lightbox" class="modal-overlay image-gallery-lightbox">
        <div class="modal-content image-gallery-lightbox-content">
          <img id="image-gallery-lightbox-img" alt="" />
        </div>
      </div>
    `;
    const modal = document.getElementById("image-gallery-lightbox");
    const content = modal.querySelector(".image-gallery-lightbox-content");
    modal.hidden = false;
    imagesStore.set({ galleryLightboxIndex: 0 });
    handleGalleryLightboxOverlayClick({ target: content });
    expect(modal.hidden).toBe(false);
    expect(imagesStore.get().galleryLightboxIndex).toBe(0);
    closeGalleryLightbox();
  });
});
