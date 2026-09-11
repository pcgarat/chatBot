import { describe, it, expect } from "vitest";
import { capabilityBadgesFromContract, recipeMatchesParams, thinkSelectValue } from "./contractUi.js";

describe("contractUi overlay helpers", () => {
  const contract = {
    capabilities: {
      vision: false,
      tools: true,
      thinking: { kind: "levels", values: ["low", "medium", "high"], default: "medium" },
    },
    params: { num_ctx: { max: 131072 } },
    recipes: [{ id: "fast", params: { think: "low", temperature: 0.3 } }],
  };

  it("pinta badges de thinking, tools y ventana del overlay", () => {
    const badges = capabilityBadgesFromContract(contract);
    expect(badges.map((b) => b.id)).toEqual(["thinking", "tools", "ctx"]);
    expect(badges.find((b) => b.id === "ctx").label).toBe("128K");
  });

  it("compara think boolean y string del overlay", () => {
    expect(thinkSelectValue(false)).toBe("false");
    expect(recipeMatchesParams({ params: { think: false } }, { think: "false" })).toBe(true);
    expect(recipeMatchesParams({ params: { think: "low", temperature: 0.3 } }, { think: "low", temperature: 0.3 })).toBe(
      true,
    );
  });
});
