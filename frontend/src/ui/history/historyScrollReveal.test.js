import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import {
  initHistoryScrollReveal,
  initChatScrollReveal,
} from "./historyScrollReveal.js";

describe("initHistoryScrollReveal", () => {
  function mount() {
    document.body.innerHTML = `
      <aside id="column-left" class="column-left">
        <div class="conversations-list-wrap">
          <div id="conversations-list" class="conversations-list"></div>
        </div>
      </aside>
    `;
    initHistoryScrollReveal();
    return document.querySelector(".conversations-list-wrap");
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("sigue visible mientras el puntero está sobre el panel", () => {
    const wrap = mount();
    fireEvent.mouseEnter(wrap);
    expect(wrap.classList.contains("is-scrollbar-visible")).toBe(true);
    vi.advanceTimersByTime(2500);
    expect(wrap.classList.contains("is-scrollbar-visible")).toBe(true);
  });

  it("oculta tras idle al salir del panel", () => {
    const wrap = mount();
    fireEvent.mouseEnter(wrap);
    fireEvent.mouseLeave(wrap);
    expect(wrap.classList.contains("is-scrollbar-visible")).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(wrap.classList.contains("is-scrollbar-visible")).toBe(false);
  });

  it("no parpadea: un mousemove posterior cancela el ocultado anterior", () => {
    const wrap = mount();
    fireEvent.mouseMove(wrap);
    vi.advanceTimersByTime(1100);
    fireEvent.mouseMove(wrap);
    vi.advanceTimersByTime(1100);
    expect(wrap.classList.contains("is-scrollbar-visible")).toBe(true);
    vi.advanceTimersByTime(200);
    expect(wrap.classList.contains("is-scrollbar-visible")).toBe(false);
  });

  it("también revela al hacer scroll con la rueda", () => {
    const wrap = mount();
    fireEvent.scroll(wrap);
    expect(wrap.classList.contains("is-scrollbar-visible")).toBe(true);
  });
});

describe("initChatScrollReveal", () => {
  function mount() {
    document.body.innerHTML = `
      <div class="chat-stream-wrap">
        <div id="messages-container" class="chat-stream scroll-y-reveal"></div>
      </div>
    `;
    initChatScrollReveal();
    return {
      wrap: document.querySelector(".chat-stream-wrap"),
      node: document.getElementById("messages-container"),
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("usa el mismo revelado por hover/idle que el historial", () => {
    const { wrap, node } = mount();
    fireEvent.mouseEnter(wrap);
    expect(node.classList.contains("is-scrollbar-visible")).toBe(true);
    vi.advanceTimersByTime(2500);
    expect(node.classList.contains("is-scrollbar-visible")).toBe(true);
    fireEvent.mouseLeave(wrap);
    vi.advanceTimersByTime(1200);
    expect(node.classList.contains("is-scrollbar-visible")).toBe(false);
  });

  it("sigue funcionando si el messages-container se remonta", () => {
    const { wrap } = mount();
    fireEvent.mouseEnter(wrap);
    const replacement = document.createElement("div");
    replacement.id = "messages-container";
    replacement.className = "chat-stream scroll-y-reveal";
    wrap.replaceChild(replacement, wrap.querySelector("#messages-container"));
    fireEvent.mouseMove(wrap);
    expect(replacement.classList.contains("is-scrollbar-visible")).toBe(true);
  });
});
