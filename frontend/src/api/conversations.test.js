import { describe, it, expect, vi, beforeEach } from "vitest";
import { listConversations, patchConversation, createConversation } from "./conversations.js";
import { ApiError } from "./client.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 400 ? "Bad Request" : "OK",
    json: async () => body,
  };
}

describe("conversations API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lista conversaciones con sort", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    await listConversations("created_at");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/conversations?sort=created_at",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("actualiza con PUT", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "1" }));
    vi.stubGlobal("fetch", fetchMock);
    await patchConversation("1", { title: "x" });
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });

  it("lanza ApiError en 4xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "no" }, 400)));
    await expect(createConversation({})).rejects.toBeInstanceOf(ApiError);
  });
});
