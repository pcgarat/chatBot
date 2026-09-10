import { describe, it, expect, vi, beforeEach } from "vitest";
import { listRules, createRule } from "./rules.js";
import { ApiError } from "./client.js";

describe("rules API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lista reglas de planner", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);
    await listRules("planner");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/rules?scope=planner");
  });

  it("4xx al crear", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "vacío" }),
    }));
    await expect(createRule({})).rejects.toBeInstanceOf(ApiError);
  });
});
