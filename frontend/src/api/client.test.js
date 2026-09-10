import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchJson, ApiError } from "./client.js";

describe("fetchJson", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve JSON en 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));
    const data = await fetchJson("/api/x");
    expect(data).toEqual({ ok: true });
  });

  it("lanza ApiError en 4xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "malo" }),
    }));
    await expect(fetchJson("/api/x")).rejects.toMatchObject({ name: "ApiError", status: 400, message: "malo" });
  });
});
