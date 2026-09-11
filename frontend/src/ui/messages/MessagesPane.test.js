import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent } from "@testing-library/react";

vi.mock("../../app/illustrate.js", () => ({
  maybeIllustrateAssistantMessage: vi.fn(),
  generateRemainingImages: vi.fn(),
  illustrateAtParagraph: vi.fn(),
}));

import { illustrateAtParagraph } from "../../app/illustrate.js";
import { bindMessageTextContextMenu, applyRevealInMessages, initConversationScrollNav } from "./MessagesPane.jsx";
import { sessionStore } from "../../store/session.js";

function mountMenuFixture() {
  document.body.innerHTML = `
    <div id="messages-container">
      <div class="message-row" data-msg-id="msg-42">
        <div class="message-bubble assistant">
          <div class="chat-paragraph" data-paragraph-index="2">Un faro en la costa</div>
        </div>
      </div>
    </div>
    <div id="msg-text-context-menu" class="msg-text-context-menu" role="menu" hidden>
      <button type="button" class="msg-context-item" data-action="illustrate-at">Generar imagen aquí</button>
      <button type="button" class="msg-context-item" data-action="copy-selection" id="msg-text-copy" hidden>Copiar</button>
    </div>
  `;
  bindMessageTextContextMenu();
}

describe("menú contextual de texto en mensajes", () => {
  beforeEach(() => {
    illustrateAtParagraph.mockReset();
    mountMenuFixture();
  });

  it("abre el menú en las coordenadas del puntero", () => {
    const para = document.querySelector("[data-paragraph-index='2']");
    fireEvent.contextMenu(para, { clientX: 240, clientY: 160 });
    const menu = document.getElementById("msg-text-context-menu");
    expect(menu.hidden).toBe(false);
    expect(menu.style.left).toBe("240px");
    expect(menu.style.top).toBe("160px");
  });

  it("al pulsar Generar imagen aquí llama illustrateAtParagraph con mensaje y párrafo", () => {
    const para = document.querySelector("[data-paragraph-index='2']");
    fireEvent.contextMenu(para, { clientX: 100, clientY: 80 });
    fireEvent.click(document.querySelector('[data-action="illustrate-at"]'));
    expect(illustrateAtParagraph).toHaveBeenCalledWith("msg-42", "2", "");
    expect(document.getElementById("msg-text-context-menu").hidden).toBe(true);
  });

  it("cierra el menú al pulsar fuera", () => {
    const para = document.querySelector("[data-paragraph-index='2']");
    fireEvent.contextMenu(para, { clientX: 100, clientY: 80 });
    fireEvent.click(document.getElementById("messages-container"));
    expect(document.getElementById("msg-text-context-menu").hidden).toBe(true);
    expect(illustrateAtParagraph).not.toHaveBeenCalled();
  });
});

describe("applyRevealInMessages", () => {
  function mountPhotoFixture() {
    document.body.innerHTML = `
      <div id="messages-container">
        <div class="message-row" data-msg-id="m-stale">texto</div>
        <div class="message-row" data-msg-id="m-real">
          <span class="chat-illustration-frame">
            <img class="chat-illustration" data-filename="faro.png" src="/api/illustrated-images/faro.png" />
          </span>
        </div>
      </div>
    `;
    const root = document.getElementById("messages-container");
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
    root.getBoundingClientRect = () => ({
      top: 0,
      bottom: 400,
      height: 400,
      left: 0,
      right: 300,
      width: 300,
    });
    document.querySelector('[data-msg-id="m-stale"]').getBoundingClientRect = () => ({
      top: 0,
      bottom: 80,
      height: 80,
      left: 0,
      right: 300,
      width: 300,
    });
    document.querySelector('[data-msg-id="m-real"]').getBoundingClientRect = () => ({
      top: 80,
      bottom: 1200,
      height: 1120,
      left: 0,
      right: 300,
      width: 300,
    });
    const frame = document.querySelector(".chat-illustration-frame");
    const img = document.querySelector('img[data-filename="faro.png"]');
    frame.getBoundingClientRect = () => ({
      top: 800,
      bottom: 1000,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    img.getBoundingClientRect = () => ({
      top: 800,
      bottom: 1000,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    Object.defineProperty(img, "complete", { configurable: true, value: true });
    return {
      getScrollTop() {
        return scrollTop;
      },
    };
  }

  it("ancla la foto aunque el pending traiga otro message_id", () => {
    const { getScrollTop } = mountPhotoFixture();
    sessionStore.set({
      messages: [
        { id: "m-stale", content: "texto" },
        { id: "m-real", content: '<img class="chat-illustration" data-filename="faro.png">' },
      ],
    });
    const done = applyRevealInMessages({
      messageId: "m-stale",
      filename: "faro.png",
      sceneId: "s1",
    });
    expect(done).toBe(true);
    expect(getScrollTop()).toBe(700);
  });

  it("con filename de galería distinto ancla la escena, no el inicio del mensaje", () => {
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
    root.getBoundingClientRect = () => ({
      top: 0,
      bottom: 400,
      height: 400,
      left: 0,
      right: 300,
      width: 300,
    });
    const row = document.querySelector('[data-msg-id="m1"]');
    row.getBoundingClientRect = () => ({
      top: 0,
      bottom: 2000,
      height: 2000,
      left: 0,
      right: 300,
      width: 300,
    });
    const frameS1 = document.getElementById("frame-s1");
    const frameS40 = document.getElementById("frame-s40");
    const img40 = frameS40.querySelector("img");
    frameS1.getBoundingClientRect = () => ({
      top: 40,
      bottom: 240,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    frameS40.getBoundingClientRect = () => ({
      top: 800,
      bottom: 1000,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    img40.getBoundingClientRect = () => ({
      top: 800,
      bottom: 1000,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    Object.defineProperty(img40, "complete", { configurable: true, value: true });
    sessionStore.set({
      messages: [
        {
          id: "m1",
          content:
            '<img class="chat-illustration" data-filename="aaa_s1.jpg" alt="escena s1">' +
            '<img class="chat-illustration" data-filename="bbb_s40.jpg" alt="escena s40">',
        },
      ],
    });
    const done = applyRevealInMessages({
      messageId: "m1",
      filename: "070ace_s40.jpg",
      sceneId: "s40",
    });
    expect(done).toBe(true);
    expect(scrollTop).toBe(700);
  });

  it("no ancla el s40 de un relato anterior", () => {
    document.body.innerHTML = `
      <div id="messages-container">
        <div class="message-row" data-msg-id="m-early">
          <span class="chat-illustration-frame" id="frame-early">
            <img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40" src="/api/illustrated-images/aaa_s40.jpg" />
          </span>
        </div>
        <div class="message-row" data-msg-id="m-gallery">
          <span class="chat-illustration-frame" id="frame-s1">
            <img class="chat-illustration" data-filename="bbb_s1.jpg" alt="escena s1" src="/api/illustrated-images/bbb_s1.jpg" />
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
    root.getBoundingClientRect = () => ({
      top: 0,
      bottom: 400,
      height: 400,
      left: 0,
      right: 300,
      width: 300,
    });
    const early = document.getElementById("frame-early");
    const galleryRow = document.querySelector('[data-msg-id="m-gallery"]');
    early.getBoundingClientRect = () => ({
      top: 800,
      bottom: 1000,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    galleryRow.getBoundingClientRect = () => ({
      top: 1200,
      bottom: 1400,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    const imgEarly = early.querySelector("img");
    Object.defineProperty(imgEarly, "complete", { configurable: true, value: true });
    sessionStore.set({
      messages: [
        {
          id: "m-early",
          content: '<img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40">',
        },
        {
          id: "m-gallery",
          content: '<img class="chat-illustration" data-filename="bbb_s1.jpg" alt="escena s1">',
        },
      ],
    });
    const done = applyRevealInMessages({
      messageId: "m-gallery",
      filename: "070ace_s40.jpg",
      sceneId: "s40",
    });
    expect(done).toBe(false);
    expect(early.classList.contains("illustration-debug-highlight")).toBe(false);
    expect(scrollTop).toBe(0);
  });

  it("si el mensaje del enlace debug aún no está pintado, no ancla el s40 de otro relato", () => {
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
    root.getBoundingClientRect = () => ({
      top: 0,
      bottom: 400,
      height: 400,
      left: 0,
      right: 300,
      width: 300,
    });
    const early = document.getElementById("frame-early");
    early.getBoundingClientRect = () => ({
      top: 800,
      bottom: 1000,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    const imgEarly = early.querySelector("img");
    Object.defineProperty(imgEarly, "complete", { configurable: true, value: true });
    sessionStore.set({
      messages: [
        {
          id: "m-early",
          content: '<img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40">',
        },
        {
          id: "m-debug",
          content: '<img class="chat-illustration" data-filename="ccc_s40.jpg" alt="escena s40">',
        },
      ],
    });
    const done = applyRevealInMessages({
      messageId: "m-debug",
      filename: "ccc_s40.jpg",
      sceneId: "s40",
    });
    expect(done).toBe(false);
    expect(early.classList.contains("illustration-debug-highlight")).toBe(false);
    expect(scrollTop).toBe(0);
  });

  it("el enlace debug ancla la escena del mensaje indicado, no la del relato anterior", () => {
    document.body.innerHTML = `
      <div id="messages-container">
        <div class="message-row" data-msg-id="m-early">
          <span class="chat-illustration-frame" id="frame-early">
            <img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40" data-scene="s40" src="/api/illustrated-images/aaa_s40.jpg" />
          </span>
        </div>
        <div class="message-row" data-msg-id="m-debug">
          <span class="chat-illustration-frame" id="frame-debug">
            <img class="chat-illustration" data-filename="ccc_s40.jpg" alt="escena s40" data-scene="s40" src="/api/illustrated-images/ccc_s40.jpg" />
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
    root.getBoundingClientRect = () => ({
      top: 0,
      bottom: 400,
      height: 400,
      left: 0,
      right: 300,
      width: 300,
    });
    const early = document.getElementById("frame-early");
    const target = document.getElementById("frame-debug");
    const img = target.querySelector("img");
    early.getBoundingClientRect = () => ({
      top: 40,
      bottom: 240,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    target.getBoundingClientRect = () => ({
      top: 800,
      bottom: 1000,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    img.getBoundingClientRect = () => ({
      top: 800,
      bottom: 1000,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    Object.defineProperty(img, "complete", { configurable: true, value: true });
    sessionStore.set({
      messages: [
        {
          id: "m-early",
          content: '<img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40">',
        },
        {
          id: "m-debug",
          content: '<img class="chat-illustration" data-filename="ccc_s40.jpg" alt="escena s40">',
        },
      ],
    });
    const done = applyRevealInMessages({
      messageId: "m-debug",
      filename: "ccc_s40.jpg",
      sceneId: "s40",
    });
    expect(done).toBe(true);
    expect(target.classList.contains("illustration-debug-highlight")).toBe(true);
    expect(early.classList.contains("illustration-debug-highlight")).toBe(false);
    expect(scrollTop).toBe(700);
  });

  it("si busca una foto y aún no está, no da el ancla por buena al inicio del mensaje", () => {
    document.body.innerHTML = `
      <div id="messages-container">
        <div class="message-row" data-msg-id="m1">sin esa foto</div>
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
    root.getBoundingClientRect = () => ({
      top: 0,
      bottom: 400,
      height: 400,
      left: 0,
      right: 300,
      width: 300,
    });
    const row = document.querySelector('[data-msg-id="m1"]');
    row.getBoundingClientRect = () => ({
      top: 0,
      bottom: 80,
      height: 80,
      left: 0,
      right: 300,
      width: 300,
    });
    sessionStore.set({ messages: [{ id: "m1", content: "sin esa foto" }] });
    const done = applyRevealInMessages({
      messageId: "m1",
      filename: "070ace_s40.jpg",
      sceneId: "s40",
    });
    expect(done).toBe(false);
  });

  it("si el mensaje aún no está en esta conversación no da el reveal por bueno", () => {
    document.body.innerHTML = `
      <div id="messages-container">
        <div class="message-row" data-msg-id="m-local">otro hilo</div>
      </div>
    `;
    const root = document.getElementById("messages-container");
    Object.defineProperty(root, "clientHeight", { configurable: true, value: 400 });
    sessionStore.set({
      conversationId: "fork-b",
      messages: [{ id: "m-local", content: "otro hilo" }],
    });
    const done = applyRevealInMessages({
      conversationId: "owner-a",
      messageId: "m-target",
      filename: "faro.png",
      sceneId: "s1",
    });
    expect(done).toBe(false);
  });

  it("si el messageId no está en el store aún, espera en lugar de cerrar el pending", () => {
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
    const early = document.getElementById("frame-early");
    early.getBoundingClientRect = () => ({
      top: 800,
      bottom: 1000,
      height: 200,
      left: 0,
      right: 300,
      width: 300,
    });
    const imgEarly = early.querySelector("img");
    Object.defineProperty(imgEarly, "complete", { configurable: true, value: true });
    sessionStore.set({
      conversationId: "c1",
      messages: [
        {
          id: "m-early",
          content: '<img class="chat-illustration" data-filename="aaa_s40.jpg" alt="escena s40">',
        },
      ],
    });
    const done = applyRevealInMessages({
      conversationId: "c1",
      messageId: "m-debug",
      filename: "ccc_s40.jpg",
      sceneId: "s40",
    });
    expect(done).toBe(false);
    expect(early.classList.contains("illustration-debug-highlight")).toBe(false);
  });
});

describe("initConversationScrollNav", () => {
  function mountNav() {
    document.body.innerHTML = `
      <div class="chat-stream-wrap">
        <div id="messages-container"></div>
        <div class="chat-scroll-nav" id="chat-scroll-nav">
          <button type="button" id="btn-scroll-msg-up"></button>
          <button type="button" id="btn-scroll-msg-down"></button>
        </div>
      </div>
    `;
    initConversationScrollNav();
    return {
      wrap: document.querySelector(".chat-stream-wrap"),
      nav: document.getElementById("chat-scroll-nav"),
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sigue visible si el puntero está sobre los botones", () => {
    const { wrap, nav } = mountNav();
    fireEvent.mouseMove(wrap);
    expect(nav.classList.contains("is-visible")).toBe(true);
    fireEvent.mouseEnter(nav);
    vi.advanceTimersByTime(2500);
    expect(nav.classList.contains("is-visible")).toBe(true);
  });

  it("no parpadea: un mousemove posterior cancela el ocultado anterior", () => {
    const { wrap, nav } = mountNav();
    fireEvent.mouseMove(wrap);
    vi.advanceTimersByTime(1100);
    fireEvent.mouseMove(wrap);
    vi.advanceTimersByTime(1100);
    expect(nav.classList.contains("is-visible")).toBe(true);
    vi.advanceTimersByTime(200);
    expect(nav.classList.contains("is-visible")).toBe(false);
  });
});
