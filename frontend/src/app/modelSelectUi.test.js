import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { settingsStore } from "../store/settings.js";
import { StoreDomSync } from "../ui/layout/StoreDomSync.jsx";
import {
  bindModelSelectCombobox,
  filterAndShowModelSelectList,
} from "./modelSelectUi.js";

function mountCombobox() {
  document.body.innerHTML = `
    <div class="model-select-wrap">
      <input type="text" id="model-select-input" aria-expanded="false" aria-controls="model-select-list" />
      <select id="model-select" class="model-select-native" aria-hidden="true" tabindex="-1"></select>
      <ul id="model-select-list" class="model-select-list" role="listbox" aria-hidden="true"></ul>
    </div>
  `;
  const select = document.getElementById("model-select");
  select.innerHTML = `<option value="llama">llama</option><option value="mistral">mistral</option>`;
  select.value = "llama";
  settingsStore.set({
    models: ["llama", "mistral"],
    currentModel: "llama",
    currentProvider: "ollama",
  });
}

describe("combobox de modelo de conversación", () => {
  beforeEach(mountCombobox);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("al enfocar el input abre la lista con todos los modelos", () => {
    bindModelSelectCombobox();
    document.getElementById("model-select-input").dispatchEvent(new Event("focus"));
    const list = document.getElementById("model-select-list");
    expect(list.getAttribute("aria-hidden")).toBe("false");
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(document.getElementById("model-select-input").getAttribute("aria-expanded")).toBe("true");
  });

  it("al escribir filtra la lista", () => {
    bindModelSelectCombobox();
    const input = document.getElementById("model-select-input");
    input.value = "mis";
    input.dispatchEvent(new Event("input"));
    const items = document.getElementById("model-select-list").querySelectorAll("li");
    expect(items).toHaveLength(1);
    expect(items[0].getAttribute("data-value")).toBe("mistral");
  });

  it("al elegir un modelo de la lista actualiza el store y cierra el desplegable", () => {
    bindModelSelectCombobox();
    filterAndShowModelSelectList("");
    document.querySelector('[data-value="mistral"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(settingsStore.get().currentModel).toBe("mistral");
    expect(document.getElementById("model-select").value).toBe("mistral");
    expect(document.getElementById("model-select-list").getAttribute("aria-hidden")).toBe("true");
  });

  it("StoreDomSync enlaza el combobox al montar", () => {
    render(createElement(StoreDomSync));
    document.getElementById("model-select-input").dispatchEvent(new Event("focus"));
    const list = document.getElementById("model-select-list");
    expect(list.getAttribute("aria-hidden")).toBe("false");
    expect(list.querySelectorAll("li")).toHaveLength(2);
  });
});
