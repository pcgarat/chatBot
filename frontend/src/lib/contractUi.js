export const RECIPE_PARAM_ORDER = ["think", "temperature", "top_p", "top_k", "min_p", "num_ctx"];
export const RECIPE_PARAM_LABELS = {
  think: "Thinking",
  temperature: "Temperatura",
  top_p: "Top-p",
  top_k: "Top-k",
  min_p: "Min-p",
  num_ctx: "Ventana de contexto",
};

export function thinkOptionLabel(value) {
  const v = String(value);
  if (v === "false") return "Apagado";
  if (v === "true") return "Pensando";
  if (v === "low") return "Bajo";
  if (v === "medium") return "Medio";
  if (v === "high") return "Alto";
  if (v === "max") return "Máximo";
  return v;
}

export function thinkSelectValue(value) {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return value != null ? String(value) : "";
}

export function coerceThinkValue(raw) {
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  if (raw === null || raw === undefined || raw === "") return null;
  return raw;
}

export function formatContextWindowLabel(maxTokens) {
  const v = Number(maxTokens);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1048576 && v % 1048576 === 0) return String(v / 1048576) + "M";
  if (v >= 1024 && v % 1024 === 0) return String(v / 1024) + "K";
  if (v >= 1000000) {
    const m = Math.round((v / 1000000) * 10) / 10;
    return String(m).replace(/\.0$/, "") + "M";
  }
  if (v >= 1000) return String(Math.round(v / 1000)) + "K";
  return String(Math.round(v));
}

export function capabilityBadgesFromContract(contract) {
  if (!contract || typeof contract !== "object") return [];
  const caps = contract.capabilities || {};
  const badges = [];
  if (caps.vision) {
    badges.push({ id: "vision", label: "Visión", title: "Soporta entrada de imágenes" });
  }
  const thinking = caps.thinking;
  if (thinking && thinking.kind && thinking.kind !== "none") {
    badges.push({ id: "thinking", label: "Thinking", title: "Razonamiento configurable" });
  }
  if (caps.tools) {
    badges.push({ id: "tools", label: "Tools", title: "Function calling / tools" });
  }
  const maxCtx = contract.params && contract.params.num_ctx && contract.params.num_ctx.max;
  const ctxLabel = formatContextWindowLabel(maxCtx);
  if (ctxLabel) {
    badges.push({
      id: "ctx",
      label: ctxLabel,
      title: "Ventana de contexto máx. " + String(maxCtx) + " tokens",
    });
  }
  return badges;
}

export function recipesFromContract(contract) {
  return contract && Array.isArray(contract.recipes) ? contract.recipes : [];
}

export function thinkingFromContract(contract) {
  return contract && contract.capabilities && contract.capabilities.thinking;
}

export function showThinking(contract) {
  const thinking = thinkingFromContract(contract);
  return Boolean(thinking && thinking.kind && thinking.kind !== "none");
}

export function recipeIdsFromContract(contract) {
  const ids = [];
  recipesFromContract(contract).forEach((recipe) => {
    Object.keys((recipe && recipe.params) || {}).forEach((id) => {
      if (!ids.includes(id)) ids.push(id);
    });
  });
  ids.sort((a, b) => {
    const ia = RECIPE_PARAM_ORDER.indexOf(a);
    const ib = RECIPE_PARAM_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return ids;
}

export function paramValuesEqual(paramId, a, b) {
  if (paramId === "think") return thinkSelectValue(a) === thinkSelectValue(b);
  if (a === b) return true;
  if (a === null || a === undefined || a === "" || b === null || b === undefined || b === "") {
    return a === b || (a === "" && (b === null || b === undefined)) || (b === "" && (a === null || a === undefined));
  }
  if (
    typeof a === "number" ||
    typeof b === "number" ||
    (typeof a === "string" && a !== "" && !Number.isNaN(Number(a)) && typeof b === "string" && b !== "" && !Number.isNaN(Number(b)))
  ) {
    return Number(a) === Number(b);
  }
  return String(a) === String(b);
}

export function recipeMatchesParams(recipe, values) {
  const params = (recipe && recipe.params) || {};
  const current = values || {};
  return Object.keys(params).every((paramId) => paramValuesEqual(paramId, current[paramId], params[paramId]));
}

export function thinkOptionValues(thinking) {
  if (!thinking) return [];
  let values = Array.isArray(thinking.values) && thinking.values.length
    ? thinking.values.slice()
    : thinking.kind === "boolean"
      ? ["false", "true"]
      : [];
  if (!thinking.can_disable) {
    values = values.filter((v) => v !== "false" && v !== false);
  }
  return values;
}

export function fillThinkOptions(control, thinking) {
  if (!control) return;
  const values = thinkOptionValues(thinking);
  control.innerHTML = values
    .map((v) => `<option value="${thinkSelectValue(v)}">${thinkOptionLabel(v)}</option>`)
    .join("");
}

export function fillCapabilityBadgeHost(host, badges) {
  if (!host) return;
  host.innerHTML = "";
  if (!badges.length) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  badges.forEach((badge) => {
    const span = document.createElement("span");
    span.className = "model-capability-chip";
    span.setAttribute("role", "listitem");
    span.dataset.capability = badge.id;
    span.textContent = badge.label;
    span.title = badge.title;
    host.appendChild(span);
  });
}

export function fillRecipeChipHost(host, recipes, applyFn) {
  if (!host) return;
  const list = Array.isArray(recipes) ? recipes : [];
  host.hidden = list.length === 0;
  host.innerHTML = "";
  list.forEach((recipe) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "composer-recipe-chip";
    btn.dataset.recipeId = recipe.id || recipe.label || "";
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = recipe.label || recipe.id;
    btn.addEventListener("click", () => {
      if (applyFn) applyFn(recipe);
    });
    host.appendChild(btn);
  });
}

export function setControlValueIfChanged(control, value) {
  if (!control) return;
  const next = value === null || value === undefined ? "" : String(value);
  if (control.value !== next) control.value = next;
}

export function getCanonicalParamControl(paramId) {
  const nodes = document.querySelectorAll(`[data-control-id="${paramId}"]`);
  return (
    Array.from(nodes).find((el) => {
      const tag = el.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    }) || null
  );
}

export function applyParamsConfigToDom(paramsConfig, paramsValues) {
  const specs = (paramsConfig && paramsConfig.params) || {};
  const values = paramsValues || {};
  document.querySelectorAll("[data-control-id]").forEach((control) => {
    const tag = control.tagName;
    if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") return;
    const paramId = control.getAttribute("data-control-id");
    if (paramId === "model") return;
    const spec = specs[paramId];
    if (spec) {
      control.disabled = false;
      control.classList.remove("control-disabled");
      if (spec.min != null) control.min = String(spec.min);
      if (spec.max != null) control.max = String(spec.max);
      if (spec.step != null) control.step = String(spec.step);
      if (spec.default != null) control.placeholder = String(spec.default);
      if (control === document.activeElement) return;
      const current = Object.prototype.hasOwnProperty.call(values, paramId) ? values[paramId] : spec.default;
      if (current !== undefined && current !== null) {
        if (tag === "TEXTAREA" && Array.isArray(current)) {
          setControlValueIfChanged(control, current.join("\n"));
        } else {
          setControlValueIfChanged(control, paramId === "think" ? thinkSelectValue(current) : current);
        }
      }
    } else if (paramId !== "think") {
      control.disabled = true;
      control.classList.add("control-disabled");
    }
  });
}
