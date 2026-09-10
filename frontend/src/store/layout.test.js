import { describe, it, expect, beforeEach } from "vitest";
import { layoutStore, persistLayout, applyDocumentLayout, updateLayout } from "./layout.js";

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

  it("applyDocumentLayout respeta el estado actual", () => {
    layoutStore.set({ ...layoutStore.get(), darkMode: false, leftSidebarCollapsed: false });
    applyDocumentLayout(layoutStore.get());
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
