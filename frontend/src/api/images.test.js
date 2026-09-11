import { describe, it, expect, vi, beforeEach } from "vitest";
import { listIllustratedImages } from "./images.js";
import { ApiError } from "./client.js";

describe("images API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("serializa filtros en la query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listIllustratedImages({ prompt_model: "sd", conversation_id: "c1", limit: 24 });
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain("/api/illustrated-images?");
    expect(url).toContain("prompt_model=sd");
    expect(url).toContain("conversation_id=c1");
    expect(url).toContain("limit=24");
  });

  it("4xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "no" }),
    }));
    await expect(listIllustratedImages({})).rejects.toBeInstanceOf(ApiError);
  });
});
