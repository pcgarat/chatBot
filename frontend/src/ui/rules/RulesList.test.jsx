import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { sessionStore } from "../../store/session.js";
import { RulesList } from "./RulesList.jsx";
import { ruleEditStore } from "./ruleEditStore.js";

function dragDataTransfer() {
  const data = {};
  return {
    data,
    effectAllowed: "all",
    dropEffect: "move",
    setData(type, value) {
      data[type] = value;
    },
    getData(type) {
      return data[type] || "";
    },
    setDragImage() {},
  };
}

describe("RulesList", () => {
  it("pinta reglas del API con rule_id (sin id)", () => {
    sessionStore.set({
      rules: [{ rule_id: "lib-1", title: "Narrador", content: "tercera persona" }],
      plannerRules: [],
    });
    const { getByText } = render(<RulesList scope="chat" />);
    expect(getByText("Narrador")).toBeInTheDocument();
  });

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

  it("pinta las reglas activas del planificador", () => {
    sessionStore.set({
      rules: [],
      plannerRules: [{ rule_id: "pr1", title: "Luz nocturna", content: "cinematic" }],
    });
    const { getByText } = render(<RulesList scope="planner" />);
    expect(getByText("Luz nocturna")).toBeInTheDocument();
  });

  it("cada regla activa tiene asa de arrastre para reordenar", () => {
    sessionStore.set({
      rules: [
        { id: "a", title: "Estilo", content: "claro" },
        { id: "b", title: "Tono", content: "seco" },
      ],
      plannerRules: [
        { rule_id: "p1", title: "Luz", content: "nocturna" },
        { rule_id: "p2", title: "Cámara", content: "35mm" },
      ],
    });
    const chat = render(<RulesList scope="chat" />);
    expect(chat.container.querySelectorAll(".rule-tag-drag")).toHaveLength(2);
    expect(chat.getAllByLabelText("Arrastrar para reordenar")).toHaveLength(2);

    const planner = render(<RulesList scope="planner" />);
    expect(planner.container.querySelectorAll(".rule-tag-drag")).toHaveLength(2);
  });

  it("al soltar una regla sobre otra cambia el orden activo", () => {
    sessionStore.set({
      conversationId: null,
      rules: [
        { id: "a", title: "Primera", content: "1" },
        { id: "b", title: "Segunda", content: "2" },
        { id: "c", title: "Tercera", content: "3" },
      ],
      plannerRules: [],
    });
    const { container } = render(<RulesList scope="chat" />);
    const tags = container.querySelectorAll(".rule-tag");
    const handle = tags[0].querySelector(".rule-tag-drag");
    const dt = dragDataTransfer();
    fireEvent.dragStart(handle, { dataTransfer: dt });
    fireEvent.dragOver(tags[2], { dataTransfer: dt });
    fireEvent.drop(tags[2], { dataTransfer: dt });
    expect(sessionStore.get().rules.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});
