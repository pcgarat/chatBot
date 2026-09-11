import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { imagesStore } from "../../store/images.js";
import { QueuePanelBody } from "./QueuePanelBody.jsx";

vi.mock("../../api/queue.js", () => ({
  listQueue: vi.fn(async () => ({ items: [], paused: false, active_count: 0 })),
  mutateQueue: vi.fn(),
  deleteQueueItems: vi.fn(),
  cancelActiveQueue: vi.fn(),
}));

import { listQueue } from "../../api/queue.js";

function pendingBtn() {
  return document.querySelector('[data-queue-status="pending"]');
}

function allBtn() {
  return document.querySelector('.image-queue-filter-btn[data-queue-status=""]');
}

describe("filtros del panel cola", () => {
  beforeEach(() => {
    listQueue.mockClear();
    imagesStore.set({
      queueFilterStatus: "",
      queuePaused: false,
      queueItems: [],
      queueSelectedIds: [],
      queueExpandedId: null,
    });
  });

  it("tras un remount, Pendientes filtra la cola y queda como activo", async () => {
    const first = render(<QueuePanelBody />);
    first.unmount();
    render(<QueuePanelBody />);

    fireEvent.click(pendingBtn());

    expect(imagesStore.get().queueFilterStatus).toBe("pending");
    expect(pendingBtn().classList.contains("is-active")).toBe(true);
    expect(allBtn().classList.contains("is-active")).toBe(false);
    expect(listQueue).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
  });

  it("Todas vuelve a pedir la cola sin status", () => {
    render(<QueuePanelBody />);
    fireEvent.click(pendingBtn());
    listQueue.mockClear();

    fireEvent.click(allBtn());

    expect(imagesStore.get().queueFilterStatus).toBe("");
    expect(allBtn().classList.contains("is-active")).toBe(true);
    expect(pendingBtn().classList.contains("is-active")).toBe(false);
    expect(listQueue).toHaveBeenCalledWith(expect.not.objectContaining({ status: expect.anything() }));
  });
});
