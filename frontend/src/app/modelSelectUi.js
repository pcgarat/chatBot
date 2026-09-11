import { escapeHtml } from "../lib/html.js";
import { settingsStore } from "../store/settings.js";
import { changeModel } from "./settingsActions.js";

let hideTimer = null;

function nodes() {
  return {
    select: document.getElementById("model-select"),
    input: document.getElementById("model-select-input"),
    list: document.getElementById("model-select-list"),
  };
}

export function refreshModelSelectUI() {
  const { select, input, list } = nodes();
  if (!select || !input || !list) return;
  const opt = select.selectedOptions[0];
  if (input !== document.activeElement) {
    input.value = opt ? opt.text : settingsStore.get().currentModel || "";
  }
  list.setAttribute("aria-hidden", "true");
  input.setAttribute("aria-expanded", "false");
}

export function filterAndShowModelSelectList(query) {
  const { select, input, list } = nodes();
  if (!select || !input || !list) return;
  const q = (query || "").trim().toLowerCase();
  const options = Array.from(select.options);
  const filtered = q
    ? options.filter((o) => o.value.toLowerCase().includes(q) || o.text.toLowerCase().includes(q))
    : options;
  list.innerHTML = filtered
    .map(
      (o) =>
        `<li role="option" data-value="${escapeHtml(o.value)}" aria-selected="false">${escapeHtml(o.text)}</li>`,
    )
    .join("");
  if (filtered.length > 0) {
    list.setAttribute("aria-hidden", "false");
    input.setAttribute("aria-expanded", "true");
    list.querySelectorAll("li").forEach((li) => {
      li.addEventListener("mousedown", (e) => e.preventDefault());
      li.addEventListener("click", () => {
        const val = li.getAttribute("data-value");
        const models = settingsStore.get().models || [];
        if (val == null || !models.includes(val)) return;
        select.value = val;
        input.value = li.textContent || val;
        list.setAttribute("aria-hidden", "true");
        input.setAttribute("aria-expanded", "false");
        changeModel(val);
      });
    });
  } else {
    list.setAttribute("aria-hidden", "true");
    input.setAttribute("aria-expanded", "false");
  }
}

export function bindModelSelectCombobox() {
  const { select, input, list } = nodes();
  if (!input || !list || input.dataset.bound === "1") return;
  input.dataset.bound = "1";
  input.addEventListener("input", () => {
    if (hideTimer) clearTimeout(hideTimer);
    settingsStore.set({ modelSelectQuery: input.value, modelSelectOpen: true });
    filterAndShowModelSelectList(input.value);
  });
  input.addEventListener("focus", () => {
    if (hideTimer) clearTimeout(hideTimer);
    filterAndShowModelSelectList("");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.blur();
      list.setAttribute("aria-hidden", "true");
      input.setAttribute("aria-expanded", "false");
      return;
    }
    const selectedText = select && select.selectedOptions[0] ? select.selectedOptions[0].text : "";
    const isPrintableKey = !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1;
    if (isPrintableKey && input.value === selectedText) {
      input.value = "";
    }
  });
  input.addEventListener("blur", () => {
    hideTimer = setTimeout(() => {
      hideTimer = null;
      refreshModelSelectUI();
    }, 200);
  });
}

export function syncModelSelectFromStore() {
  const { input, list } = nodes();
  bindModelSelectCombobox();
  if (list && list.getAttribute("aria-hidden") === "false") {
    filterAndShowModelSelectList(input ? input.value : "");
    return;
  }
  refreshModelSelectUI();
}
