import { describe, expect, it, beforeEach } from "vitest";
import {
  formatBatchProgressLabel,
  normalizeBatchProgress,
  syncImageBatchProgressDom,
} from "./imageBatchProgress.js";

describe("imageBatchProgress", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="image-batch-progress" class="image-batch-progress" hidden></span>
      <span id="header-provider-name">ollama</span>
      <span id="header-model-name">modelo</span>
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

  it("pinta todos los chips a la izquierda del proveedor, en orden", () => {
    syncImageBatchProgressDom([
      { batch_id: "b1", completed: 2, total: 20, created_at: "2026-09-11T12:00:00" },
      { batch_id: "b2", completed: 0, total: 3, created_at: "2026-09-11T12:01:00" },
    ]);
    const host = document.getElementById("image-batch-progress");
    const provider = document.getElementById("header-provider-name");
    expect(host.hidden).toBe(false);
    expect(host.textContent).toBe("2/200/3");
    expect([...host.querySelectorAll(".image-batch-progress-chip")].map((el) => el.textContent)).toEqual([
      "2/20",
      "0/3",
    ]);
    expect(host.compareDocumentPosition(provider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.getElementById("image-batch-progress-left")).toBeNull();
    expect(document.getElementById("image-batch-progress-right")).toBeNull();
    expect(formatBatchProgressLabel({ completed: 2, total: 20 })).toBe("2/20");
  });

  it("oculta los chips cuando no hay batches activos", () => {
    syncImageBatchProgressDom([
      { batch_id: "b1", completed: 3, total: 16, created_at: "2026-09-11T12:00:00" },
    ]);
    syncImageBatchProgressDom([]);
    expect(document.getElementById("image-batch-progress").hidden).toBe(true);
    expect(document.getElementById("image-batch-progress").innerHTML).toBe("");
  });
});
