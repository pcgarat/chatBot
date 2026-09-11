import { describe, it, expect, beforeEach } from "vitest";
import { layoutStore, persistLayout, applyDocumentLayout, updateLayout, setSidebarTab } from "./layout.js";

describe("layout store", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-sidebar-left");
  });

  it("persiste tema y colapso en localStorage", () => {
    updateLayout({ darkMode: true, leftSidebarCollapsed: true });
    expect(localStorage.getItem("darkMode")).toBe("true");
    expect(localStorage.getItem("leftSidebarCollapsed")).toBe("true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-sidebar-left")).toBe("collapsed");
  });

  it("persiste la preferencia de Markdown en conversación", () => {
    updateLayout({ renderMarkdown: false });
    expect(localStorage.getItem("renderMarkdown")).toBe("false");
    updateLayout({ renderMarkdown: true });
    expect(localStorage.getItem("renderMarkdown")).toBe("true");
  });

  it("applyDocumentLayout respeta el estado actual", () => {
    layoutStore.set({ ...layoutStore.get(), darkMode: false, leftSidebarCollapsed: false });
    applyDocumentLayout(layoutStore.get());
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("al cambiar de tab muestra ese panel y oculta los demás", () => {
    document.body.innerHTML = `
      <div class="sidebar-tab-panel" id="tab-reglas" data-sidebar-panel="reglas"></div>
      <div class="sidebar-tab-panel" id="tab-parametros" data-sidebar-panel="parametros" hidden></div>
      <div class="sidebar-tab-panel" id="tab-imagenes" data-sidebar-panel="imagenes" hidden></div>
      <div class="sidebar-tab-panel" id="tab-preferencias" data-sidebar-panel="preferencias" hidden></div>
    `;
    setSidebarTab("parametros");
    expect(document.getElementById("tab-reglas").hidden).toBe(true);
    expect(document.getElementById("tab-parametros").hidden).toBe(false);
    expect(document.getElementById("tab-imagenes").hidden).toBe(true);
    expect(document.getElementById("tab-preferencias").hidden).toBe(true);
    setSidebarTab("imagenes");
    expect(document.getElementById("tab-parametros").hidden).toBe(true);
    expect(document.getElementById("tab-imagenes").hidden).toBe(false);
  });
});
