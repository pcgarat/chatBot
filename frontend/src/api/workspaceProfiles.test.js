import { describe, it, expect, vi, beforeEach } from "vitest";
import { listWorkspaceProfiles, createWorkspaceProfile } from "./workspaceProfiles.js";
import { ApiError } from "./client.js";

describe("workspace profiles API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lista perfiles", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "p1", name: "A" }],
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = await listWorkspaceProfiles();
    expect(data[0].id).toBe("p1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/workspace-profiles");
  });

  it("actualiza un preset de reglas del planificador", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "p1", name: "v2" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { updatePlannerRulePreset } = await import("./workspaceProfiles.js");
    await updatePlannerRulePreset("p1", { name: "v2" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/planner-rule-presets/p1");
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });

  it("4xx al crear", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "nombre" }),
    }));
    await expect(createWorkspaceProfile({})).rejects.toBeInstanceOf(ApiError);
  });
});
