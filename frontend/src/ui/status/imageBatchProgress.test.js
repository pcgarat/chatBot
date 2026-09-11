import { describe, expect, it, beforeEach } from "vitest";
import {
  formatBatchProgressLabel,
  normalizeBatchProgress,
  splitBatchProgressAroundProvider,
  syncImageBatchProgressDom,
} from "./imageBatchProgress.js";

describe("imageBatchProgress", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="image-batch-progress-left" class="image-batch-progress" hidden></span>
      <span id="header-provider-name">ollama</span>
      <span id="image-batch-progress-right" class="image-batch-progress" hidden></span>
    `;
  });

  it("normaliza y ordena batches incompletos", () => {
    const out = normalizeBatchProgress([
      { batch_id: "b2", completed: 0, total: 10, created_at: "2026-09-11T12:01:00" },
      { batch_id: "b1", completed: 3, total: 16, created_at: "2026-09-11T12:00:00" },
      { batch_id: "done", completed: 5, total: 5, created_at: "2026-09-11T11:00:00" },
    ]);
    expect(out).toEqual([
      { batchId: "b1", completed: 3, total: 16, createdAt: "2026-09-11T12:00:00" },
      { batchId: "b2", completed: 0, total: 10, createdAt: "2026-09-11T12:01:00" },
    ]);
  });

  it("reparte a izquierda y derecha del proveedor (2 peticiones)", () => {
    const batches = [
      { batchId: "b1", completed: 3, total: 16, createdAt: "a" },
      { batchId: "b2", completed: 0, total: 10, createdAt: "b" },
    ];
    expect(splitBatchProgressAroundProvider(batches)).toEqual({
      left: [batches[0]],
      right: [batches[1]],
    });
  });

  it("pinta 3/16 a la izquierda y 0/10 a la derecha del proveedor", () => {
    syncImageBatchProgressDom([
      { batch_id: "b1", completed: 3, total: 16, created_at: "2026-09-11T12:00:00" },
      { batch_id: "b2", completed: 0, total: 10, created_at: "2026-09-11T12:01:00" },
    ]);
    const left = document.getElementById("image-batch-progress-left");
    const right = document.getElementById("image-batch-progress-right");
    expect(left.hidden).toBe(false);
    expect(right.hidden).toBe(false);
    expect(left.textContent).toBe("3/16");
    expect(right.textContent).toBe("0/10");
    expect(formatBatchProgressLabel({ completed: 3, total: 16 })).toBe("3/16");
  });

  it("oculta los chips cuando no hay batches activos", () => {
    syncImageBatchProgressDom([
      { batch_id: "b1", completed: 3, total: 16, created_at: "2026-09-11T12:00:00" },
    ]);
    syncImageBatchProgressDom([]);
    expect(document.getElementById("image-batch-progress-left").hidden).toBe(true);
    expect(document.getElementById("image-batch-progress-right").hidden).toBe(true);
    expect(document.getElementById("image-batch-progress-left").innerHTML).toBe("");
  });
});
