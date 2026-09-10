import { describe, it, expect, vi, beforeEach } from "vitest";
import { listQueue, mutateQueue } from "./queue.js";
import { ApiError } from "./client.js";

describe("queue API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lista con filtro de estado", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], paused: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await listQueue({ status: "pending", limit: 100 });
    expect(fetchMock.mock.calls[0][0]).toContain("status=pending");
  });

  it("4xx al pausar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "no" }),
    }));
    await expect(mutateQueue("pause", {})).rejects.toBeInstanceOf(ApiError);
  });
});
