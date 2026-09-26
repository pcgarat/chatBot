import { beforeEach, describe, expect, it, vi } from "vitest";
import { layoutStore, updateLayout, LAYOUT_KEYS } from "../../store/layout.js";
import {
  computeCenterPanelShare,
  onAppPointerDown,
  onAppPointerMove,
  onAppPointerUp,
} from "./shellEvents.js";

vi.mock("../../app/sendMessage.js", () => ({
  onComposerPrimaryClick: vi.fn(),
  sendPromptGeneratorTurn: vi.fn(),
}));

function mockRect(el, rect) {
  el.getBoundingClientRect = () => ({
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    toJSON() {
      return rect;
    },
  });
}

function setupCenterSplitDom({ stackTop = 100, stackHeight = 400 } = {}) {
  document.body.innerHTML = `
    <div id="app" class="app-shell">
      <main class="column-center">
        <div class="chat-column"></div>
        <div id="center-panels-splitter" class="center-panels-splitter"></div>
        <section id="image-gallery-panel" class="image-gallery-panel"></section>
        <section id="image-queue-panel" class="image-queue-panel" hidden></section>
      </main>
    </div>
  `;
  const chat = document.querySelector(".chat-column");
  const gallery = document.getElementById("image-gallery-panel");
  const mid = stackTop + stackHeight / 2;
  mockRect(chat, {
    left: 0,
    top: stackTop,
    right: 800,
    bottom: mid,
    width: 800,
    height: stackHeight / 2,
  });
  mockRect(gallery, {
    left: 0,
    top: mid + 10,
    right: 800,
    bottom: stackTop + stackHeight,
    width: 800,
    height: stackHeight / 2 - 10,
  });
  return document.getElementById("center-panels-splitter");
}

function pointerEvent(type, target, { clientX = 0, clientY = 0, button = 0 } = {}) {
  return {
    type,
    target,
    button,
    clientX,
    clientY,
    preventDefault: vi.fn(),
  };
}

describe("computeCenterPanelShare", () => {
  it("mapea el delta vertical 1:1 respecto a la altura del stack", () => {
    expect(
      computeCenterPanelShare({
        startShare: 0.5,
        startY: 200,
        clientY: 280,
        stackHeight: 400,
      })
    ).toBeCloseTo(0.7, 5);
  });

  it("respeta los límites de share", () => {
    expect(
      computeCenterPanelShare({
        startShare: 0.5,
        startY: 0,
        clientY: -1000,
        stackHeight: 400,
        shareMin: LAYOUT_KEYS.SHARE_MIN,
        shareMax: LAYOUT_KEYS.SHARE_MAX,
      })
    ).toBe(LAYOUT_KEYS.SHARE_MIN);
  });
});

describe("center panels splitter drag", () => {
  beforeEach(() => {
    onAppPointerUp();
    document.body.className = "";
    updateLayout({ centerChatGalleryShare: 0.5, centerChatVisible: true, centerGalleryVisible: true });
  });

  it("al arrastrar en vertical el share sigue al puntero (no usa clientX)", () => {
    const handle = setupCenterSplitDom({ stackTop: 100, stackHeight: 400 });
    onAppPointerDown(pointerEvent("pointerdown", handle, { clientX: 400, clientY: 300 }));
    onAppPointerMove(pointerEvent("pointermove", handle, { clientX: 400, clientY: 380 }));
    expect(layoutStore.get().centerChatGalleryShare).toBeCloseTo(0.7, 5);
    onAppPointerUp();
  });

  it("un movimiento solo horizontal no cambia el share", () => {
    const handle = setupCenterSplitDom({ stackTop: 100, stackHeight: 400 });
    onAppPointerDown(pointerEvent("pointerdown", handle, { clientX: 200, clientY: 300 }));
    onAppPointerMove(pointerEvent("pointermove", handle, { clientX: 500, clientY: 300 }));
    expect(layoutStore.get().centerChatGalleryShare).toBeCloseTo(0.5, 5);
    onAppPointerUp();
  });

  it("usa la clase center-panels-resizing durante el arrastre vertical", () => {
    const handle = setupCenterSplitDom();
    onAppPointerDown(pointerEvent("pointerdown", handle, { clientX: 10, clientY: 200 }));
    expect(document.body.classList.contains("center-panels-resizing")).toBe(true);
    expect(document.body.classList.contains("side-panels-resizing")).toBe(false);
    onAppPointerUp();
    expect(document.body.classList.contains("center-panels-resizing")).toBe(false);
  });
});
