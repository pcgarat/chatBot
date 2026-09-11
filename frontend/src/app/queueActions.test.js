import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  takeNewlySettledQueueJobs,
  toggleQueueSelected,
  renderImageQueueList,
  setQueueFilter,
  initImageQueuePanel,
} from "./queueActions.js";
import { imagesStore } from "../store/images.js";
import { listQueue } from "../api/queue.js";

const openConversationAtIllustration = vi.fn();
const openConversationAtMessage = vi.fn();

vi.mock("../api/queue.js", () => ({
  listQueue: vi.fn(async () => ({ items: [], paused: false, active_count: 0 })),
  mutateQueue: vi.fn(),
  deleteQueueItems: vi.fn(),
  cancelActiveQueue: vi.fn(),
}));

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

describe("cola", () => {
  beforeEach(() => {
    listQueue.mockClear();
    openConversationAtIllustration.mockReset();
    openConversationAtMessage.mockReset();
    imagesStore.set({ queueFilterStatus: "", queueItems: [], queueSelectedIds: [] });
  });

  it("setQueueFilter pide la cola con el estado elegido", () => {
    setQueueFilter("generating");
    expect(imagesStore.get().queueFilterStatus).toBe("generating");
    expect(listQueue).toHaveBeenCalledWith(expect.objectContaining({ status: "generating" }));
  });

  it("detecta jobs que acaban de completar", () => {
    takeNewlySettledQueueJobs([{ id: "j1", status: "generating" }]);
    const settled = takeNewlySettledQueueJobs([{ id: "j1", status: "completed" }]);
    expect(settled).toHaveLength(1);
    expect(settled[0].id).toBe("j1");
  });

  it("toggleQueueSelected sustituye o añade", () => {
    imagesStore.set({ queueSelectedIds: [] });
    toggleQueueSelected("a", false);
    expect(imagesStore.get().queueSelectedIds).toEqual(["a"]);
    toggleQueueSelected("b", true);
    expect(imagesStore.get().queueSelectedIds.sort()).toEqual(["a", "b"]);
  });

  it("pinta filas completas con miniatura, título y fechas", () => {
    document.body.innerHTML = '<div id="image-queue-list"></div>';
    imagesStore.set({
      queueItems: [
        {
          id: "j1",
          status: "completed",
          result_filename: "faro.png",
          created_at: "2026-01-01T10:00:00",
          completed_at: "2026-01-01T10:01:00",
          conversation_title: "faro",
          message_excerpt: "había un faro",
          prompt_model: "qwen",
          prompt_provider: "ollama",
          conversation_id: "c1",
          message_id: "m1",
          scene_id: "s1",
        },
      ],
      queueSelectedIds: [],
      queueExpandedId: null,
    });
    renderImageQueueList();
    const html = document.getElementById("image-queue-list").innerHTML;
    expect(html).toContain("image-queue-row-main");
    expect(html).toContain("faro");
    expect(html).toContain("En cola:");
    expect(html).toContain("illustrated-images/faro.png");
    expect(html).toContain('data-filename="faro.png"');
    expect(html).toContain('data-scene-id="s1"');
  });

  it("Ir al mensaje de la cola ancla la foto con la misma API que galería/debug", () => {
    document.body.innerHTML = '<div id="image-queue-list"></div>';
    imagesStore.set({
      queueItems: [
        {
          id: "j1",
          status: "completed",
          result_filename: "faro.png",
          scene_id: "s-faro",
          conversation_title: "faro",
          message_excerpt: "había un faro",
          conversation_id: "c-other",
          message_id: "m1",
        },
      ],
      queueSelectedIds: [],
      queueExpandedId: null,
    });
    renderImageQueueList();
    initImageQueuePanel();
    document.querySelector(".image-queue-go-message").click();
    expect(openConversationAtIllustration).toHaveBeenCalledWith("c-other", "m1", {
      filename: "faro.png",
      sceneId: "s-faro",
    });
    expect(openConversationAtMessage).not.toHaveBeenCalled();
  });
});
