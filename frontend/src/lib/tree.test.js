import { describe, it, expect } from "vitest";
import { latestLeafInSubtree } from "./tree.js";

describe("latestLeafInSubtree", () => {
  it("elige la hoja más reciente del subárbol", () => {
    const msgs = [
      { id: "u1", parent_id: null },
      { id: "a1", parent_id: "u1" },
      { id: "u2", parent_id: "a1" },
      { id: "a2", parent_id: "u2" },
      { id: "u3", parent_id: "a1" },
      { id: "a3", parent_id: "u3" },
      { id: "u4", parent_id: "a3" },
      { id: "a4", parent_id: "u4" },
    ];
    expect(latestLeafInSubtree(msgs, "a1").id).toBe("a4");
    expect(latestLeafInSubtree(msgs, "u2").id).toBe("a2");
    expect(latestLeafInSubtree(msgs, "a4").id).toBe("a4");
  });
});
