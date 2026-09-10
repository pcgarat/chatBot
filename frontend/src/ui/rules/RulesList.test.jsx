import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { sessionStore } from "../../store/session.js";
import { RulesList } from "./RulesList.jsx";
import { ruleEditStore } from "./ruleEditStore.js";

describe("RulesList", () => {
  it("pinta reglas del store y abre el modal al clic", () => {
    sessionStore.set({
      rules: [{ id: "r1", title: "Estilo", content: "claro" }],
      plannerRules: [],
    });
    ruleEditStore.close();
    const { getByText } = render(<RulesList scope="chat" />);
    expect(getByText("Estilo")).toBeInTheDocument();
    fireEvent.click(getByText("Estilo"));
    expect(ruleEditStore.get().rule.id).toBe("r1");
  });
});
