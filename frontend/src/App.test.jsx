import { fireEvent, render, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, vi } from "vitest";
import App from "./App.jsx";
import { settingsStore } from "./store/settings.js";
import { sessionStore } from "./store/session.js";
import { imagesStore } from "./store/images.js";

vi.mock("./app/boot.js", () => ({
  bootApp: vi.fn(),
}));

describe("shell React", () => {
  beforeEach(() => {
    sessionStore.set({ plannerRules: [] });
    settingsStore.set({ plannerRulePresets: [] });
    imagesStore.set({ prefs: { ...(imagesStore.get().prefs || {}), prompt_system_instructions: [] } });
  });

  it("pinta el árbol principal con los IDs del contrato de UI", () => {
    render(<App />);
    expect(document.getElementById("app")).toBeInTheDocument();
    expect(document.getElementById("column-left")).toBeInTheDocument();
    expect(document.getElementById("column-right")).toBeInTheDocument();
    expect(document.getElementById("messages-container")).toBeInTheDocument();
    expect(document.getElementById("chat-column")).toBeInTheDocument();
    expect(document.getElementById("image-gallery-panel")).toBeInTheDocument();
    expect(document.getElementById("image-queue-panel")).toBeInTheDocument();
    expect(document.getElementById("btn-new-chat")).toBeInTheDocument();
    expect(document.getElementById("btn-center-chat")).toBeInTheDocument();
    expect(document.getElementById("btn-image-gallery")).toBeInTheDocument();
    expect(document.getElementById("btn-image-queue")).toBeInTheDocument();
    expect(document.getElementById("app-status-bar")).toBeInTheDocument();
  });

  it("al pulsar Ajustes enseña las opciones de modelo", () => {
    render(<App />);
    fireEvent.click(document.getElementById("sidebar-tab-parametros"));
    expect(document.getElementById("tab-parametros").hidden).toBe(false);
    expect(document.getElementById("tab-reglas").hidden).toBe(true);
    expect(document.getElementById("provider-select")).toBeVisible();
  });

  it("pinta presets y reglas activas del planificador", async () => {
    const rules = [{ rule_id: "pr1", title: "Luz nocturna", content: "cinematic" }];
    imagesStore.set({
      prefs: { ...(imagesStore.get().prefs || {}), prompt_system_instructions: rules },
    });
    sessionStore.set({ plannerRules: rules });
    render(<App />);
    fireEvent.click(document.getElementById("sidebar-tab-imagenes"));
    act(() => {
      settingsStore.set({
        plannerRulePresets: [{ id: "p1", name: "Flux nocturno" }],
      });
    });
    await waitFor(() => {
      expect(document.getElementById("planner-rules-list").textContent).toContain("Luz nocturna");
      const sel = document.getElementById("planner-rule-preset-select");
      expect(Array.from(sel.options).map((o) => o.textContent)).toContain("Flux nocturno");
    });
  });
});
