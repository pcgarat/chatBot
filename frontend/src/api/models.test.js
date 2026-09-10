import { describe, it, expect, vi, beforeEach } from "vitest";
import { listProviders, getModelContract } from "./models.js";
import { ApiError } from "./client.js";

describe("models API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lista proveedores", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ name: "ollama" }],
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = await listProviders();
    expect(data[0].name).toBe("ollama");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/providers");
  });

  it("4xx en contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "sin overlay" }),
    }));
    await expect(getModelContract("ollama", "x")).rejects.toBeInstanceOf(ApiError);
  });
});
