import { describe, it, expect, vi } from "vitest";
import { createStreamBuffer } from "./stream.js";

describe("stream buffer", () => {
  it("N chunks no implican N flushes: como máximo 1 por frame", () => {
    const queued = [];
    vi.stubGlobal("requestAnimationFrame", (cb) => {
      queued.push(cb);
      return queued.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    let flushes = 0;
    const buf = createStreamBuffer(() => {
      flushes += 1;
    });
    for (let i = 0; i < 50; i++) buf.append("x");
    expect(queued.length).toBe(1);
    queued.forEach((cb) => cb());
    expect(flushes).toBe(1);
    expect(buf.getText()).toBe("x".repeat(50));
  });
});
