import { describe, it, expect } from "vitest";
import { takeNewlySettledQueueJobs, toggleQueueSelected } from "./queueActions.js";
import { imagesStore } from "../store/images.js";

describe("cola", () => {
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
});
