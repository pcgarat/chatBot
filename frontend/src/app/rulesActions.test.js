import { describe, it, expect, beforeEach, vi } from "vitest";
import { sessionStore } from "../store/session.js";
import { settingsStore } from "../store/settings.js";

const patchConversation = vi.fn();

vi.mock("../api/conversations.js", () => ({
  patchConversation: (...args) => patchConversation(...args),
}));

vi.mock("../api/rules.js", () => ({
  listRules: vi.fn(async () => []),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
}));

const persistImagesPanel = vi.fn();

describe("persistSessionRules", () => {
  beforeEach(() => {
    patchConversation.mockReset().mockResolvedValue({});
    sessionStore.set({
      conversationId: "c1",
      rules: [{ id: "r1", title: "Estilo", content: "claro" }],
    });
  });

  it("guarda las reglas activas como system_instructions, no como rules", async () => {
    const { persistSessionRules } = await import("./rulesActions.js");
    await persistSessionRules();
    expect(patchConversation).toHaveBeenCalledWith("c1", {
      system_instructions: [{ rule_id: "r1", title: "Estilo", content: "claro" }],
    });
    expect(patchConversation.mock.calls[0][1]).not.toHaveProperty("rules");
  });
});

describe("reorderActiveRules", () => {
  beforeEach(async () => {
    patchConversation.mockReset().mockResolvedValue({});
    persistImagesPanel.mockReset();
    const { registerPlannerRulesPersister } = await import("./rulesActions.js");
    registerPlannerRulesPersister(persistImagesPanel);
  });

  it("reordena las reglas del chat y persiste el nuevo orden", async () => {
    sessionStore.set({
      conversationId: "c1",
      rules: [
        { id: "a", title: "A", content: "1" },
        { id: "b", title: "B", content: "2" },
        { id: "c", title: "C", content: "3" },
      ],
      plannerRules: [],
    });
    const { reorderActiveRules } = await import("./rulesActions.js");
    reorderActiveRules(0, 2, "chat");
    expect(sessionStore.get().rules.map((r) => r.id)).toEqual(["b", "c", "a"]);
    await vi.waitFor(() => {
      expect(patchConversation).toHaveBeenCalledWith("c1", {
        system_instructions: [
          { rule_id: "b", title: "B", content: "2" },
          { rule_id: "c", title: "C", content: "3" },
          { rule_id: "a", title: "A", content: "1" },
        ],
      });
    });
  });

  it("reordena las reglas del planificador y persiste el panel de imágenes", async () => {
    sessionStore.set({
      conversationId: null,
      rules: [],
      plannerRules: [
        { rule_id: "p1", title: "Luz", content: "nocturna" },
        { rule_id: "p2", title: "Cámara", content: "35mm" },
      ],
    });
    const { reorderActiveRules } = await import("./rulesActions.js");
    reorderActiveRules(1, 0, "planner");
    expect(sessionStore.get().plannerRules.map((r) => r.rule_id)).toEqual(["p2", "p1"]);
    expect(persistImagesPanel).toHaveBeenCalled();
  });

  it("no cambia nada si el origen y el destino son el mismo índice", async () => {
    sessionStore.set({
      conversationId: "c1",
      rules: [
        { id: "a", title: "A", content: "1" },
        { id: "b", title: "B", content: "2" },
      ],
    });
    const { reorderActiveRules } = await import("./rulesActions.js");
    reorderActiveRules(0, 0, "chat");
    expect(sessionStore.get().rules.map((r) => r.id)).toEqual(["a", "b"]);
    expect(patchConversation).not.toHaveBeenCalled();
  });
});

describe("removeActiveRule", () => {
  beforeEach(async () => {
    persistImagesPanel.mockReset();
    const { registerPlannerRulesPersister } = await import("./rulesActions.js");
    registerPlannerRulesPersister(persistImagesPanel);
  });

  it("al quitar una regla del planificador persiste el panel de imágenes", async () => {
    sessionStore.set({
      plannerRules: [
        { rule_id: "p1", title: "Luz", content: "nocturna" },
        { rule_id: "p2", title: "Cámara", content: "35mm" },
      ],
    });
    const { removeActiveRule } = await import("./rulesActions.js");
    removeActiveRule("p1", "planner");
    expect(sessionStore.get().plannerRules.map((r) => r.rule_id)).toEqual(["p2"]);
    expect(persistImagesPanel).toHaveBeenCalled();
  });
});

describe("hidratación y texto de sistema", () => {
  beforeEach(() => {
    settingsStore.set({
      libraryRules: [{ id: "chat-1", title: "Tono", content: "sé breve y directo" }],
      plannerLibraryRules: [
        { id: "plan-1", title: "Guía FLUX", content: "prompts en prosa cinematográfica" },
        { id: "plan-2", title: "POV", content: "cámara en primera persona" },
      ],
    });
  });

  it("hidrata reglas del planificador aunque el chip solo tenga id (no rule_id)", async () => {
    sessionStore.set({
      plannerRules: [{ id: "plan-1", title: "Guía FLUX", content: "" }],
    });
    const { hydratePlannerRulesFromLibrary } = await import("./rulesActions.js");
    expect(hydratePlannerRulesFromLibrary()).toBe(true);
    expect(sessionStore.get().plannerRules[0].content).toBe("prompts en prosa cinematográfica");
  });

  it("hidrata reglas del chat desde la biblioteca si el contenido está vacío", async () => {
    sessionStore.set({
      rules: [{ rule_id: "chat-1", title: "Tono", content: "" }],
    });
    const { hydrateChatRulesFromLibrary } = await import("./rulesActions.js");
    expect(hydrateChatRulesFromLibrary()).toBe(true);
    expect(sessionStore.get().rules[0].content).toBe("sé breve y directo");
  });

  it("concatena al LLM el contenido de biblioteca si el chip activo no lo trae", async () => {
    sessionStore.set({
      rules: [
        { id: "chat-1", title: "Tono", content: "" },
        { id: "chat-local", title: "Local", content: "no inventes datos" },
      ],
      plannerRules: [
        { id: "plan-1", title: "Guía FLUX", content: "" },
        { rule_id: "plan-2", title: "POV", content: "" },
      ],
    });
    const { getChatRulesTextForSystem, getPlannerRulesTextForSystem } = await import("./rulesActions.js");
    expect(getChatRulesTextForSystem()).toContain("sé breve y directo");
    expect(getChatRulesTextForSystem()).toContain("no inventes datos");
    const plannerText = getPlannerRulesTextForSystem();
    expect(plannerText).toContain("prompts en prosa cinematográfica");
    expect(plannerText).toContain("cámara en primera persona");
  });
});
