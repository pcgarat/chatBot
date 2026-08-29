(function () {
  function init() {
  const API = "/api";
  const appRoot = document.getElementById("app");
  const chatArea = document.querySelector(".chat-area");
  if (!appRoot || !chatArea || !appRoot.contains(chatArea)) {
    console.error("DOM roto: #app o .chat-area no encontrados o fuera de #app.");
    return;
  }
  let currentConversationId = null;
  let messages = [];
  let allMessages = [];
  let activeLeafId = null;
  let providers = [];
  let models = [];
  let currentProvider = "ollama";
  let currentAbortController = null;
  /** Referencias al mensaje en streaming para poder mostrar/ocultar debug sin re-renderizar. */
  let currentStreamingMsgEl = null;
  let currentStreamingDebugEl = null;
  /** Parámetros del proveedor actual: { provider, params: { paramId: { type, default, min, max, api_key } } } */
  let paramsConfig = { provider: "", params: {} };
  /** Origen de los parámetros mostrados: "user" | "preset" | "default" */
  let paramsSource = "default";
  /** Valores de referencia para no enviar un param si coincide (preset del modelo o default del provider). */
  let paramsBaseline = {};
  /** Parámetros que el usuario ha marcado como "no enviar" (por conversación). Clave: conversationId o "_new". */
  let paramsExcludedFromSendByConv = {};
  /** Uso de contexto (último turno): prompt_tokens, completion_tokens. null si no hay datos. */
  let lastUsage = null;
  /** Contexto máximo del modelo actual (tokens). null si no se conoce. */
  let contextLength = null;
  /** Lista de reglas (system instructions) de la conversación actual. Se concatenan con espacio al enviar. */
  let rules = [];
  /** Reglas del planificador de prompts (panel Imágenes). Independientes del chat. */
  let plannerRules = [];

  const el = {
    conversationsList: document.getElementById("conversations-list"),
    conversationsTrash: document.getElementById("conversations-trash"),
    conversationsTrashList: document.getElementById("conversations-trash-list"),
    conversationTitle: document.getElementById("conversation-title"),
    providerSelect: document.getElementById("provider-select"),
    modelSelect: document.getElementById("model-select"),
    modelSelectInput: document.getElementById("model-select-input"),
    modelSelectList: document.getElementById("model-select-list"),
    btnRefreshModels: document.getElementById("btn-refresh-models"),
    rulesList: document.getElementById("rules-list"),
    rulesAddBlock: document.getElementById("rules-add-block"),
    ruleNewTitle: document.getElementById("rule-new-title"),
    ruleNewInput: document.getElementById("rule-new-input"),
    btnAddRule: document.getElementById("btn-add-rule"),
    ruleLibrarySelect: document.getElementById("rule-library-select"),
    btnAddLibraryRule: document.getElementById("btn-add-library-rule"),
    plannerRulesList: document.getElementById("planner-rules-list"),
    plannerRuleLibrarySelect: document.getElementById("planner-rule-library-select"),
    btnAddPlannerLibraryRule: document.getElementById("btn-add-planner-library-rule"),
    plannerRuleNewTitle: document.getElementById("planner-rule-new-title"),
    plannerRuleNewInput: document.getElementById("planner-rule-new-input"),
    btnAddPlannerRule: document.getElementById("btn-add-planner-rule"),
    ruleEditModal: document.getElementById("rule-edit-modal"),
    ruleEditTitle: document.getElementById("rule-edit-title"),
    ruleEditContent: document.getElementById("rule-edit-content"),
    ruleEditBtnDelete: document.getElementById("rule-edit-btn-delete"),
    ruleEditBtnSave: document.getElementById("rule-edit-btn-save"),
    ruleEditBtnSaveNew: document.getElementById("rule-edit-btn-save-new"),
    saveToChromadbSelect: document.getElementById("save-to-chromadb-select"),
    historyTurnsInput: document.getElementById("history-turns-input"),
    showDebugModeCheck: document.getElementById("show-debug-mode"),
    autoScrollDuringGenerationCheck: document.getElementById("auto-scroll-during-generation"),
    messagesContainer: document.getElementById("messages-container"),
    instructionOverride: document.getElementById("instruction-override"),
    messageInput: document.getElementById("message-input"),
    btnNewChat: document.getElementById("btn-new-chat"),
    btnSave: document.getElementById("btn-save"),
    btnSend: document.getElementById("btn-send"),
    btnClearMemory: document.getElementById("btn-clear-memory"),
    btnResetParams: document.getElementById("btn-reset-params"),
    btnResetParamsFooter: document.getElementById("btn-reset-params-footer"),
    btnModelInfo: document.getElementById("btn-model-info"),
    modelInfoModal: document.getElementById("model-info-modal"),
    modelInfoModalTitle: document.getElementById("model-info-modal-title"),
    modelInfoModalSubtitle: document.getElementById("model-info-modal-subtitle"),
    modelInfoProviderContent: document.getElementById("model-info-provider-content"),
    modelInfoRefreshRow: document.getElementById("model-info-refresh-row"),
    btnModelInfoRefresh: document.getElementById("btn-model-info-refresh"),
    modelInfoRefreshStatus: document.getElementById("model-info-refresh-status"),
    modelInfoUncensored: document.getElementById("model-info-uncensored"),
    modelInfoInstructionsList: document.getElementById("model-info-instructions-list"),
    btnAddInstruction: document.getElementById("btn-add-instruction"),
    modelInfoTagsChips: document.getElementById("model-info-tags-chips"),
    modelInfoTagsInput: document.getElementById("model-info-tags-input"),
    modelInfoTagsSuggestions: document.getElementById("model-info-tags-suggestions"),
    btnModelInfoSave: document.getElementById("btn-model-info-save"),
    modelInfoModalClose: document.getElementById("model-info-modal-close"),
    headerProviderName: document.getElementById("header-provider-name"),
    headerModelName: document.getElementById("header-model-name"),
    connectionStatusDot: document.getElementById("connection-status-dot"),
    contextUsageRow: document.getElementById("context-usage-row"),
    contextUsageBarWrap: document.getElementById("context-usage-bar-wrap"),
    contextUsageBar: document.getElementById("context-usage-bar"),
    contextUsageSegmentPrompt: document.getElementById("context-usage-segment-prompt"),
    contextUsageSegmentCompletion: document.getElementById("context-usage-segment-completion"),
    contextUsageText: document.getElementById("context-usage-text"),
    contextUsageBadge: document.getElementById("context-usage-badge"),
    btnFontSizeDecrease: document.getElementById("btn-font-size-decrease"),
    btnFontSizeIncrease: document.getElementById("btn-font-size-increase"),
    btnCollapseAllMessages: document.getElementById("btn-collapse-all-messages"),
    paramsSourceLabel: document.getElementById("params-source-label"),
    paramsToSendContainer: document.getElementById("params-to-send-container"),
  };

  const msgDeleteIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 6h18\"/><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"/><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/></svg>";
  const msgCopyIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\" ry=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1\"/></svg>";
  const msgToInputIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 10L4 15 9 20\"/><path d=\"M20 4v11a4 4 0 01-4 4H4\"/></svg>";
  const msgIllustrateIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/><path d=\"M21 15l-5-5L5 21\"/></svg>";
  const msgReadIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\"/><path d=\"M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\"/></svg>";
  const msgMoreIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\"><circle cx=\"12\" cy=\"5\" r=\"1.75\"/><circle cx=\"12\" cy=\"12\" r=\"1.75\"/><circle cx=\"12\" cy=\"19\" r=\"1.75\"/></svg>";
  const illustratingMessageIds = new Set();
  const illustrateAbortControllers = new Set();
  let readingModeMessageIndex = null;

  /** Etiquetas profesionales para la barra de estado (códigos → texto). */
  const STATUS_LABELS = {
    "app.ready": "Listo",
    "chat.preparing": "Preparando solicitud",
    "chat.sending": "Enviando mensaje al modelo",
    "chat.awaiting_response": "Esperando respuesta del modelo",
    "chat.receiving_context": "Recuperando contexto auxiliar",
    "chat.streaming": "Recibiendo respuesta",
    "chat.finalizing": "Finalizando respuesta",
    "chat.cancelled": "Solicitud cancelada",
    "chat.error": "Error de comunicación con el modelo",
    "images.starting": "Iniciando ilustración",
    "images.planning": "Planificando escenas",
    "images.plan_ready": "Plan de escenas listo",
    "images.skipped": "Ilustración no aplicable",
    "images.inserting_anchors": "Insertando anclas de imagen",
    "images.loading_forge_payload": "Cargando parámetros de generación",
    "images.submitting_prompt": "Enviando prompt de imagen",
    "images.awaiting_generation": "Esperando generación de imagen",
    "images.image_ready": "Imagen recibida",
    "images.image_failed": "Error al generar imagen",
    "images.retrying": "Reintentando imágenes fallidas",
    "images.done": "Ilustración completada",
    "images.error": "Error en la ilustración",
    "images.cancelled": "Ilustración cancelada",
  };

  /**
   * Barra de estado inferior: stack de actividades concurrentes (chat + ilustración).
   * Patrón Observer ligero — la UI solo lee el tope del stack.
   */
  const appStatus = (function createAppStatus() {
    const textEl = document.getElementById("app-status-text");
    const detailEl = document.getElementById("app-status-detail");
    const barEl = document.getElementById("app-status-bar");
    /** @type {{ id: string, code: string, label: string, detail: string }[]} */
    const stack = [];
    let seq = 0;

    function render() {
      if (!textEl) return;
      const top = stack.length ? stack[stack.length - 1] : null;
      const label = top ? top.label : STATUS_LABELS["app.ready"];
      const detail = top && top.detail ? top.detail : "";
      textEl.textContent = label;
      if (detailEl) {
        if (detail) {
          detailEl.hidden = false;
          detailEl.textContent = detail;
        } else {
          detailEl.hidden = true;
          detailEl.textContent = "";
        }
      }
      if (barEl) barEl.classList.toggle("is-busy", stack.length > 0);
    }

    function labelFor(code, message, data) {
      const base = (message && String(message).trim()) || STATUS_LABELS[code] || code;
      const index = data && data.index != null ? data.index : null;
      const total = data && data.total != null ? data.total : null;
      if (
        index != null &&
        total != null &&
        !/\(\d+\s*\/\s*\d+\)/.test(base) &&
        (code === "images.submitting_prompt" ||
          code === "images.awaiting_generation" ||
          code === "images.image_ready" ||
          code === "images.image_failed" ||
          code === "images.plan_ready" ||
          code === "images.retrying")
      ) {
        return `${STATUS_LABELS[code] || base} (${index}/${total})`;
      }
      if (code === "images.plan_ready" && total != null && !/\(\d+\)/.test(base)) {
        return `${STATUS_LABELS[code] || base} (${total})`;
      }
      return base;
    }

    function push(source, code, message, data) {
      const id = `${source}-${++seq}`;
      stack.push({
        id,
        code: code || "app.ready",
        label: labelFor(code, message, data),
        detail: (data && data.detail) || "",
      });
      render();
      return id;
    }

    function update(id, code, message, data) {
      const item = stack.find((s) => s.id === id);
      if (!item) return;
      if (code) item.code = code;
      item.label = labelFor(code || item.code, message, data);
      if (data && data.detail != null) item.detail = data.detail;
      render();
    }

    function pop(id) {
      const i = stack.findIndex((s) => s.id === id);
      if (i >= 0) stack.splice(i, 1);
      render();
    }

    function clearSource(sourcePrefix) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].id.startsWith(sourcePrefix + "-")) stack.splice(i, 1);
      }
      render();
    }

    render();
    return { push, update, pop, clearSource, render };
  })();

  function showError(msg) {
    const toast = document.createElement("div");
    toast.className = "error-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function showNotice(msg) {
    const toast = document.createElement("div");
    toast.className = "notice-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function loadProviders() {
    try {
      const data = await fetchJson(`${API}/providers`);
      providers = data.map((p) => p.name);
      if (el.providerSelect) {
        el.providerSelect.innerHTML = providers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
        if (providers.includes(currentProvider)) {
          el.providerSelect.value = currentProvider;
        } else if (providers.length > 0) {
          el.providerSelect.value = providers[0];
          currentProvider = providers[0];
        }
      }
      return providers;
    } catch (e) {
      // Si falla, poner solo Ollama como fallback
      providers = ["ollama"];
      if (el.providerSelect) {
        el.providerSelect.innerHTML = '<option value="ollama">ollama</option>';
      }
      return providers;
    }
  }

  /** Intenta cargar modelos de un proveedor. Devuelve true si ok, false si falló. */
  async function tryLoadModelsForProvider(providerName) {
    try {
      const data = await fetchJson(`${API}/providers/${providerName}/models`);
      models = normalizeModelsResponse(data);
      currentProvider = providerName;
      if (el.providerSelect) el.providerSelect.value = providerName;
      if (el.modelSelect) {
        el.modelSelect.innerHTML = models.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
        refreshModelSelectUI();
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Normaliza la respuesta de GET /api/providers/{provider}/models a array de nombres. */
  function normalizeModelsResponse(data) {
    function toNames(arr) {
      if (!Array.isArray(arr)) return [];
      return arr
        .map((m) => (m && typeof m === "object" && m.name != null ? String(m.name).trim() : null))
        .filter((name) => name !== null && name !== "");
    }
    if (Array.isArray(data)) return toNames(data);
    if (data && typeof data === "object") {
      const arr = data.data || data.models;
      if (Array.isArray(arr)) return toNames(arr);
      if (typeof arr === "object" && arr !== null && !Array.isArray(arr)) return toNames(Object.values(arr));
    }
    return [];
  }

  async function loadModels(preserveSelection = false) {
    const previousModel = preserveSelection && el.modelSelect ? el.modelSelect.value : null;
    const provider = (el.providerSelect && el.providerSelect.value) ? el.providerSelect.value : currentProvider || "ollama";
    try {
      const data = await fetchJson(`${API}/providers/${provider}/models`);
      models = normalizeModelsResponse(data);
      if (el.modelSelect) {
        el.modelSelect.innerHTML = models.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
        if (previousModel && models.includes(previousModel)) {
          el.modelSelect.value = previousModel;
        }
        refreshModelSelectUI();
      }
      return models;
    } catch (e) {
      showError(`No se pudieron cargar los modelos de ${provider}: ` + e.message);
      models = [];
      if (el.modelSelect) el.modelSelect.innerHTML = "";
      refreshModelSelectUI();
      return [];
    }
  }

  /** Sincroniza el input y la lista del selector de modelo con el &lt;select&gt; (opciones y valor seleccionado). */
  function refreshModelSelectUI() {
    if (!el.modelSelect || !el.modelSelectInput || !el.modelSelectList) return;
    const opt = el.modelSelect.selectedOptions[0];
    el.modelSelectInput.value = opt ? opt.text : "";
    el.modelSelectList.setAttribute("aria-hidden", "true");
    el.modelSelectInput.setAttribute("aria-expanded", "false");
    syncHeaderProviderModel();
  }

  /** Filtra y muestra la lista de modelos según el texto del input; al hacer clic en uno se asigna y se cierra. */
  function filterAndShowModelSelectList(query) {
    if (!el.modelSelect || !el.modelSelectInput || !el.modelSelectList) return;
    const q = (query || "").trim().toLowerCase();
    const options = Array.from(el.modelSelect.options);
    const filtered = q ? options.filter((o) => o.value.toLowerCase().includes(q) || o.text.toLowerCase().includes(q)) : options;
    el.modelSelectList.innerHTML = filtered
      .map(
        (o) =>
          `<li role="option" data-value="${escapeHtml(o.value)}" aria-selected="false">${escapeHtml(o.text)}</li>`
      )
      .join("");
    if (filtered.length > 0) {
      el.modelSelectList.setAttribute("aria-hidden", "false");
      el.modelSelectInput.setAttribute("aria-expanded", "true");
      el.modelSelectList.querySelectorAll("li").forEach((li) => {
        li.addEventListener("click", function () {
          const val = li.getAttribute("data-value");
          if (val != null && models.includes(val)) {
            el.modelSelect.value = val;
            el.modelSelectInput.value = li.textContent || val;
            el.modelSelectList.setAttribute("aria-hidden", "true");
            el.modelSelectInput.setAttribute("aria-expanded", "false");
            el.modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      });
    } else {
      el.modelSelectList.setAttribute("aria-hidden", "true");
      el.modelSelectInput.setAttribute("aria-expanded", "false");
    }
  }

  async function refreshModels() {
    if (el.btnRefreshModels) el.btnRefreshModels.classList.add("loading");
    try {
      await loadModels(true);
      showNotice("Lista de modelos actualizada.");
    } finally {
      if (el.btnRefreshModels) el.btnRefreshModels.classList.remove("loading");
    }
  }

  async function loadParamsForProvider(providerName) {
    try {
      const data = await fetchJson(`${API}/providers/${providerName}/params`);
      paramsConfig = { provider: data.provider || providerName, params: data.params || {} };
      applyParamsConfig();
    } catch (_) {
      paramsConfig = { provider: providerName, params: {} };
      applyParamsConfig();
    }
    renderParamsToSend();
  }

  function applyParamsConfig() {
    document.querySelectorAll("[data-control-id]").forEach((control) => {
      const paramId = control.getAttribute("data-control-id");
      const spec = paramsConfig.params[paramId];
      if (spec) {
        control.disabled = false;
        control.classList.remove("control-disabled");
        const def = spec.default;
        if (control.tagName === "INPUT" || control.tagName === "TEXTAREA") {
          if (control.type === "number" && (typeof def === "number" || typeof def === "string")) {
            control.value = def !== undefined && def !== null ? String(def) : "";
          } else if (control.type === "text" && typeof def === "string") {
            control.value = def;
          } else if (Array.isArray(def)) {
            control.value = def.join("\n");
          } else {
            control.value = def !== undefined && def !== null ? String(def) : "";
          }
        } else if (control.tagName === "SELECT") {
          control.value = def !== undefined && def !== null ? String(def) : "";
        }
      } else {
        control.disabled = true;
        control.classList.add("control-disabled");
      }
    });
    // Baseline para comparación: si el valor del control coincide con el baseline no se envía el param.
    paramsBaseline = {};
    for (const paramId of Object.keys(paramsConfig.params)) {
      const spec = paramsConfig.params[paramId];
      if (spec && spec.default !== undefined) paramsBaseline[paramId] = spec.default;
    }
  }

  /**
   * Establece el baseline de parámetros desde un preset de modelo.
   * Si el valor del control coincide con este baseline, el param no se envía en el request.
   */
  function setParamsBaselineFromPreset(presetObj) {
    if (!presetObj || typeof presetObj !== "object") return;
    for (const paramId of Object.keys(presetObj)) {
      const spec = presetObj[paramId];
      if (spec && spec.default !== undefined) paramsBaseline[paramId] = spec.default;
    }
  }

  /** Carga el preset del modelo actual y actualiza paramsBaseline para no enviar params que coincidan con el preset. */
  async function ensureParamsBaselineForCurrentModel() {
    const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "";
    const modelId = (el.modelSelect && el.modelSelect.value) || "";
    if (!provider || !modelId) return;
    try {
      const data = await fetchJson(`${API}/providers/${provider}/presets`);
      const presets = data.presets || {};
      const preset = presets[modelId];
      if (preset) setParamsBaselineFromPreset(preset);
    } catch (_) {}
  }

  /**
   * Restaura parámetros: carga el preset del modelo actual y lo aplica a los controles.
   * Si no hay preset para el modelo, usa los valores por defecto del proveedor.
   * Tras restaurar, los valores coinciden con el baseline y no se envían en el request.
   */
  async function resetParamsToDefaults() {
    const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "";
    const modelId = (el.modelSelect && el.modelSelect.value) || "";
    if (provider && modelId) {
      try {
        const data = await fetchJson(`${API}/providers/${provider}/presets`);
        const presets = data.presets || {};
        const preset = presets[modelId];
        if (preset) {
          applyPresetToControls(preset);
          setParamsBaselineFromPreset(preset);
          paramsSource = "preset";
          showNotice("Parámetros restaurados al preset del modelo.");
          return;
        }
      } catch (_) {}
    }
    applyParamsConfig();
    paramsSource = "default";
    showNotice("Parámetros restaurados a los valores por defecto del proveedor.");
  }

  /**
   * Aplica valores guardados por el usuario (objeto param_id -> value) a los controles.
   * Solo afecta a controles que existan en paramsConfig.params.
   */
  function applyUserParamsToControls(modelParamsObj) {
    if (!modelParamsObj || typeof modelParamsObj !== "object") return;
    Object.keys(modelParamsObj).forEach((paramId) => {
      const spec = paramsConfig.params[paramId];
      const control = document.querySelector(`[data-control-id="${paramId}"]`);
      if (!spec || !control || control.disabled) return;
      const val = modelParamsObj[paramId];
      if (control.tagName === "INPUT") {
        if (control.type === "number") {
          control.value = val !== null && val !== undefined && val !== "" ? String(val) : "";
        } else {
          control.value = val !== null && val !== undefined ? String(val) : "";
        }
      } else if (control.tagName === "TEXTAREA") {
        control.value = Array.isArray(val) ? val.join("\n") : (val !== null && val !== undefined ? String(val) : "");
      } else if (control.tagName === "SELECT") {
        control.value = val !== null && val !== undefined ? String(val) : "";
      }
    });
  }

  /**
   * Aplica los valores de un preset (objeto param_id -> { default, type, ... }) a los controles.
   * Solo afecta a controles que existan y estén en paramsConfig.params (habilitados).
   */
  function applyPresetToControls(presetObj) {
    if (!presetObj || typeof presetObj !== "object") return;
    document.querySelectorAll("[data-control-id]").forEach((control) => {
      const paramId = control.getAttribute("data-control-id");
      if (!paramsConfig.params[paramId]) return;
      const spec = presetObj[paramId];
      if (!spec || spec.default === undefined) return;
      const def = spec.default;
      if (control.tagName === "INPUT" || control.tagName === "TEXTAREA") {
        if (control.type === "number" && (typeof def === "number" || typeof def === "string")) {
          control.value = def !== null ? String(def) : "";
        } else if (Array.isArray(def)) {
          control.value = def.join("\n");
        } else {
          control.value = def !== undefined && def !== null ? String(def) : "";
        }
      } else if (control.tagName === "SELECT") {
        control.value = def !== undefined && def !== null ? String(def) : "";
      }
    });
  }

  // ----- Ficha del modelo (model info modal) -----
  let modelInfoCurrentProvider = "";
  let modelInfoCurrentModelId = "";
  let allTagsCache = [];

  function getModelInfoPath(provider, modelId) {
    return `${API}/providers/${encodeURIComponent(provider)}/models/${encodeURIComponent(modelId)}`;
  }

  async function loadContextLength() {
    const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama";
    const modelId = (el.modelSelect && el.modelSelect.value) || "";
    if (!modelId) {
      contextLength = null;
      renderContextUsageBar();
      syncNumCtxControlFromApi(null);
      return;
    }
    try {
      const data = await fetchJson(getModelInfoPath(provider, modelId) + "/context-length");
      contextLength = data.context_length != null ? data.context_length : null;
    } catch (_) {
      contextLength = null;
    }
    renderContextUsageBar();
    syncNumCtxControlFromApi(contextLength);
  }

  /**
   * Si el proveedor no tiene param num_ctx (ej. OpenAI), muestra en "Ventana de contexto"
   * el context_length de la API. Así gpt-5-mini muestra 400000 en lugar de un valor residual (2048).
   */
  function syncNumCtxControlFromApi(apiContextLength) {
    const numCtxControl = document.getElementById("param-num-ctx");
    if (!numCtxControl) return;
    if (paramsConfig.params["num_ctx"]) {
      return;
    }
    numCtxControl.value = apiContextLength != null ? String(apiContextLength) : "";
    const maxAttr = apiContextLength != null && apiContextLength > 131072 ? String(apiContextLength) : "131072";
    numCtxControl.setAttribute("max", maxAttr);
  }

  function renderContextUsageBar() {
    const row = el.contextUsageRow || document.getElementById("context-usage-row");
    const textEl = el.contextUsageText || document.getElementById("context-usage-text");
    const badgeEl = el.contextUsageBadge || document.getElementById("context-usage-badge");
    const barWrap = el.contextUsageBarWrap || document.getElementById("context-usage-bar-wrap");
    const bar = el.contextUsageBar || document.getElementById("context-usage-bar");
    const segPrompt = el.contextUsageSegmentPrompt || document.getElementById("context-usage-segment-prompt");
    const segCompletion = el.contextUsageSegmentCompletion || document.getElementById("context-usage-segment-completion");
    if (!row) return;
    const fmt = function (n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n); };
    const hasUsage = lastUsage && (lastUsage.prompt_tokens > 0 || lastUsage.completion_tokens > 0);
    const pt = (lastUsage && lastUsage.prompt_tokens) || 0;
    const ct = (lastUsage && lastUsage.completion_tokens) || 0;
    if (!hasUsage) {
      if (badgeEl) {
        badgeEl.textContent = contextLength != null ? `0/${fmt(contextLength)}` : "—";
      }
      if (textEl) {
        textEl.textContent = contextLength != null ? `ventana ${fmt(contextLength)}` : "";
      }
      if (barWrap) barWrap.hidden = true;
      if (bar) bar.setAttribute("aria-valuenow", "0");
      row.title = contextLength != null
        ? `Contexto disponible: ${contextLength} tokens`
        : "Uso de contexto";
      return;
    }
    const total = pt + ct;
    let detail;
    if (contextLength != null) {
      detail = `usados ${fmt(total)} · prompt ${fmt(pt)} · resp ${fmt(ct)} · ventana ${fmt(contextLength)}`;
    } else {
      detail = `usados ${fmt(total)} · prompt ${fmt(pt)} · resp ${fmt(ct)}`;
    }
    if (textEl) textEl.textContent = detail;
    row.title = contextLength != null
      ? `Prompt: ${pt} · Respuesta: ${ct} / ${contextLength} tokens`
      : `Prompt: ${pt} · Respuesta: ${ct} tokens`;
    if (badgeEl) {
      badgeEl.textContent = contextLength != null ? `${fmt(total)}/${fmt(contextLength)}` : `${fmt(pt)}+${fmt(ct)}`;
    }
    if (contextLength != null && contextLength > 0 && barWrap && segPrompt && segCompletion) {
      barWrap.hidden = false;
      const pctTotal = Math.min(100, (total / contextLength) * 100);
      const pctPrompt = total > 0 ? (pt / total) * pctTotal : 0;
      const pctCompletion = total > 0 ? (ct / total) * pctTotal : 0;
      segPrompt.style.width = pctPrompt + "%";
      segCompletion.style.width = pctCompletion + "%";
      if (bar) {
        bar.setAttribute("aria-valuenow", Math.round(pctTotal));
        bar.setAttribute("aria-valuemax", 100);
      }
    } else {
      if (barWrap) barWrap.hidden = true;
    }
  }

  async function loadAllTags() {
    try {
      const data = await fetchJson(`${API}/models/tags`);
      allTagsCache = (data && data.tags) ? data.tags : [];
      return allTagsCache;
    } catch (_) {
      allTagsCache = [];
      return [];
    }
  }

  function formatProviderInfoForDisplay(providerInfo) {
    if (!providerInfo || Object.keys(providerInfo).length === 0) return "";
    const lines = [];
    const details = providerInfo.details || {};
    if (details.family) lines.push("Familia: " + details.family);
    if (details.parameter_size) lines.push("Tamaño: " + details.parameter_size);
    if (details.quantization_level) lines.push("Cuantización: " + details.quantization_level);
    if (details.format) lines.push("Formato: " + details.format);
    const modelInfo = providerInfo.model_info || {};
    const ctx = modelInfo["llama.context_length"] ?? modelInfo["context_length"] ?? providerInfo.context_length;
    if (ctx) lines.push("Contexto: " + ctx + " tokens");
    if (providerInfo.fetched_at) lines.push("Actualizado: " + new Date(providerInfo.fetched_at).toLocaleString("es"));
    if (providerInfo.modified_at) lines.push("Modificado (modelo): " + new Date(providerInfo.modified_at).toLocaleString("es"));
    if (providerInfo.license) lines.push("Licencia: " + providerInfo.license);
    const caps = providerInfo.capabilities;
    if (caps && caps.length) lines.push("Capacidades: " + caps.join(", "));
    if (providerInfo.template && providerInfo.template.trim()) {
      lines.push("");
      lines.push("Template (extracto):");
      lines.push(providerInfo.template.trim().slice(0, 400) + (providerInfo.template.length > 400 ? "…" : ""));
    }
    return lines.join("\n");
  }

  /** Serializa a JSON de forma segura (referencias circulares → "[Circular]"). */
  function safeStringify(obj, indent) {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      function (key, value) {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
        }
        return value;
      },
      indent
    );
  }

  function renderProviderInfoBlock(providerInfo) {
    if (!el.modelInfoProviderContent) return;
    let raw = providerInfo;
    if (raw == null) raw = {};
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (_) {
        el.modelInfoProviderContent.textContent = raw;
        return;
      }
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
      el.modelInfoProviderContent.textContent = String(raw);
      return;
    }
    if (Object.keys(raw).length === 0) {
      el.modelInfoProviderContent.textContent = "";
      return;
    }
    try {
      el.modelInfoProviderContent.textContent = safeStringify(raw, 2);
    } catch (_) {
      el.modelInfoProviderContent.textContent = formatProviderInfoForDisplay(raw);
    }
  }

  function fillUserInfoInModal(userInfo) {
    if (!userInfo) return;
    if (el.modelInfoUncensored) el.modelInfoUncensored.checked = !!userInfo.uncensored;
    if (el.modelInfoInstructionsList) {
      const list = Array.isArray(userInfo.instructions) ? userInfo.instructions : [];
      el.modelInfoInstructionsList.innerHTML = list
        .map(
          (line, i) =>
            `<div class="model-info-instruction-row" data-index="${i}">
              <input type="text" value="${escapeHtml(line)}" data-instruction />
              <button type="button" class="btn-icon model-info-instruction-remove" data-index="${i}" title="Quitar">×</button>
            </div>`
        )
        .join("");
      el.modelInfoInstructionsList.querySelectorAll(".model-info-instruction-remove").forEach((btn) => {
        btn.addEventListener("click", function () {
          const row = btn.closest(".model-info-instruction-row");
          if (row) row.remove();
        });
      });
    }
    const tags = Array.isArray(userInfo.tags) ? userInfo.tags : [];
    renderModelInfoTagsChips(tags);
    if (el.modelInfoTagsInput) el.modelInfoTagsInput.value = "";
    if (el.modelInfoTagsSuggestions) {
      el.modelInfoTagsSuggestions.hidden = true;
      el.modelInfoTagsSuggestions.innerHTML = "";
    }
  }

  function renderModelInfoTagsChips(tags) {
    if (!el.modelInfoTagsChips) return;
    el.modelInfoTagsChips.innerHTML = (tags || [])
      .map(
        (tag, i) =>
          `<span class="model-info-tag-chip" data-tag-index="${i}">
            ${escapeHtml(tag)}
            <button type="button" class="model-info-tag-chip-remove" data-tag-index="${i}" aria-label="Quitar tag">×</button>
          </span>`
      )
      .join("");
    el.modelInfoTagsChips.querySelectorAll(".model-info-tag-chip-remove").forEach((btn) => {
      btn.addEventListener("click", function () {
        const idx = parseInt(btn.getAttribute("data-tag-index"), 10);
        const currentTags = getModelInfoTagsFromModal();
        const next = currentTags.filter((_, i) => i !== idx);
        renderModelInfoTagsChips(next);
      });
    });
  }

  function getModelInfoTagsFromModal() {
    if (!el.modelInfoTagsChips) return [];
    return Array.from(el.modelInfoTagsChips.querySelectorAll(".model-info-tag-chip"))
      .map((c) => (c.textContent || "").replace(/×\s*$/, "").trim())
      .filter(Boolean);
  }

  function getModelInfoInstructionsFromModal() {
    if (!el.modelInfoInstructionsList) return [];
    return Array.from(el.modelInfoInstructionsList.querySelectorAll("input[data-instruction]"))
      .map((inp) => (inp.value || "").trim())
      .filter(Boolean);
  }

  function collectUserInfoFromModal() {
    return {
      uncensored: el.modelInfoUncensored ? el.modelInfoUncensored.checked : false,
      instructions: getModelInfoInstructionsFromModal(),
      tags: getModelInfoTagsFromModal(),
    };
  }

  function showModelInfoTagsSuggestions(prefix) {
    const pre = (prefix || "").trim().toLowerCase();
    const filtered = pre ? allTagsCache.filter((t) => t.toLowerCase().startsWith(pre) && !getModelInfoTagsFromModal().includes(t)) : allTagsCache.filter((t) => !getModelInfoTagsFromModal().includes(t));
    if (!el.modelInfoTagsSuggestions) return;
    el.modelInfoTagsSuggestions.hidden = filtered.length === 0;
    el.modelInfoTagsSuggestions.innerHTML = filtered
      .slice(0, 15)
      .map((tag) => `<div class="model-info-tags-suggestion" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</div>`)
      .join("");
    el.modelInfoTagsSuggestions.querySelectorAll(".model-info-tags-suggestion").forEach((node) => {
      node.addEventListener("click", () => {
        addModelInfoTag(node.getAttribute("data-tag"));
        el.modelInfoTagsInput.value = "";
        el.modelInfoTagsSuggestions.hidden = true;
        el.modelInfoTagsSuggestions.innerHTML = "";
      });
    });
  }

  function addModelInfoTag(tag) {
    const t = (tag || "").trim();
    if (!t) return;
    const current = getModelInfoTagsFromModal();
    if (current.includes(t)) return;
    renderModelInfoTagsChips([...current, t]);
    if (el.modelInfoTagsInput) el.modelInfoTagsInput.value = "";
    if (el.modelInfoTagsSuggestions) {
      el.modelInfoTagsSuggestions.hidden = true;
      el.modelInfoTagsSuggestions.innerHTML = "";
    }
  }

  async function openModelInfoModal() {
    const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama";
    const modelId = (el.modelSelect && el.modelSelect.value) || "";
    if (!modelId) {
      showError("Selecciona un modelo.");
      return;
    }
    modelInfoCurrentProvider = provider;
    modelInfoCurrentModelId = modelId;
    if (el.modelInfoModalTitle) el.modelInfoModalTitle.textContent = "Ficha del modelo";
    if (el.modelInfoModalSubtitle) el.modelInfoModalSubtitle.textContent = provider + " / " + modelId;
    if (el.modelInfoRefreshStatus) {
      el.modelInfoRefreshStatus.textContent = "";
      el.modelInfoRefreshStatus.className = "model-info-status";
    }
    const baseUrl = getModelInfoPath(provider, modelId);
    try {
      const [infoData, capsData] = await Promise.all([
        fetchJson(`${baseUrl}/info`),
        fetchJson(`${API}/providers/${encodeURIComponent(provider)}/capabilities`).catch(() => ({ capabilities: [] })),
      ]);
      const capabilities = (capsData && capsData.capabilities) || [];
      const hasShowModel = capabilities.includes("show_model");
      if (el.modelInfoRefreshRow) el.modelInfoRefreshRow.style.display = hasShowModel ? "" : "none";
      renderProviderInfoBlock(infoData.provider_info || {});
      fillUserInfoInModal(infoData.user_info || { uncensored: false, instructions: [], tags: [] });
      await loadAllTags();
    } catch (e) {
      showError("No se pudo cargar la ficha: " + e.message);
      renderProviderInfoBlock({});
      fillUserInfoInModal({ uncensored: false, instructions: [], tags: [] });
      if (el.modelInfoRefreshRow) el.modelInfoRefreshRow.style.display = "none";
    }
    if (el.modelInfoModal) el.modelInfoModal.hidden = false;
  }

  function closeModelInfoModal() {
    if (el.modelInfoModal) el.modelInfoModal.hidden = true;
  }

  async function saveModelInfo() {
    const provider = modelInfoCurrentProvider;
    const modelId = modelInfoCurrentModelId;
    if (!provider || !modelId) return;
    const body = collectUserInfoFromModal();
    try {
      await fetchJson(getModelInfoPath(provider, modelId) + "/info", {
        method: "PUT",
        body: JSON.stringify(body),
      });
      showNotice("Ficha guardada.");
      const infoData = await fetchJson(getModelInfoPath(provider, modelId) + "/info");
      renderProviderInfoBlock(infoData.provider_info || {});
      fillUserInfoInModal(infoData.user_info || {});
    } catch (e) {
      showError("Error al guardar: " + e.message);
    }
  }

  async function refreshModelInfoProvider() {
    const provider = modelInfoCurrentProvider;
    const modelId = modelInfoCurrentModelId;
    if (!provider || !modelId) return;
    if (el.modelInfoRefreshStatus) {
      el.modelInfoRefreshStatus.textContent = "Actualizando…";
      el.modelInfoRefreshStatus.className = "model-info-status";
    }
    try {
      await fetchJson(getModelInfoPath(provider, modelId) + "/info/refresh", { method: "POST" });
      if (el.modelInfoRefreshStatus) {
        el.modelInfoRefreshStatus.textContent = "Actualizado.";
        el.modelInfoRefreshStatus.className = "model-info-status success";
      }
      const infoData = await fetchJson(getModelInfoPath(provider, modelId) + "/info");
      renderProviderInfoBlock(infoData.provider_info || {});
    } catch (e) {
      if (el.modelInfoRefreshStatus) {
        el.modelInfoRefreshStatus.textContent = "No se pudo actualizar. " + (e.message || "");
        el.modelInfoRefreshStatus.className = "model-info-status error";
      }
      showError("Error al refrescar: " + e.message);
    }
  }

  let saveParamsDebounceTimer = null;
  const SAVE_PARAMS_DEBOUNCE_MS = 800;

  function saveParamsToConversation() {
    if (!currentConversationId) return;
    const modelParams = buildModelParams();
    fetchJson(`${API}/conversations/${currentConversationId}`, {
      method: "PUT",
      body: JSON.stringify({ model_params: modelParams }),
    }).catch(() => {});
  }

  function debouncedSaveParams() {
    paramsSource = "user";
    renderParamsSourceLabel();
    renderParamsToSend();
    if (saveParamsDebounceTimer) clearTimeout(saveParamsDebounceTimer);
    saveParamsDebounceTimer = setTimeout(function () {
      saveParamsDebounceTimer = null;
      saveParamsToConversation();
    }, SAVE_PARAMS_DEBOUNCE_MS);
  }

  function getParamsExcludedFromSendSet() {
    const key = currentConversationId || "_new";
    if (!paramsExcludedFromSendByConv[key]) paramsExcludedFromSendByConv[key] = new Set();
    return paramsExcludedFromSendByConv[key];
  }

  /**
   * Parámetros que se enviarían (valor distinto al baseline). No aplica exclusiones del usuario.
   * Usado para la UI "parámetros que se enviarán" y como base para el payload.
   */
  function buildModelParamsRaw() {
    const out = {};
    for (const paramId of Object.keys(paramsConfig.params)) {
      const spec = paramsConfig.params[paramId];
      const control = document.querySelector(`[data-control-id="${paramId}"]`);
      if (!control || control.disabled) continue;
      let current;
      if (control.tagName === "INPUT") {
        current = control.type === "number" ? (control.value === "" ? null : Number(control.value)) : control.value;
      } else if (control.tagName === "TEXTAREA") {
        const v = control.value.trim();
        current = spec.type === "string_list" ? (v ? v.split("\n").map((s) => s.trim()).filter(Boolean) : []) : v;
      } else if (control.tagName === "SELECT") {
        current = control.value;
      } else {
        continue;
      }
      const def = paramsBaseline[paramId] !== undefined ? paramsBaseline[paramId] : spec.default;
      let same = false;
      if (spec.type === "string_list") {
        same = Array.isArray(def) && Array.isArray(current) && def.length === current.length && def.every((d, i) => d === current[i]);
      } else if (current === null || current === undefined || current === "") {
        same = def === undefined || def === null || def === "";
      } else {
        same = (typeof def === "number" && Number(current) === def) || (current === def) || (String(current) === String(def));
      }
      if (!same) out[paramId] = current;
    }
    return out;
  }

  /** Parámetros que se enviarán al backend: raw menos los que el usuario ha excluido. */
  function buildModelParams() {
    const raw = buildModelParamsRaw();
    const excluded = getParamsExcludedFromSendSet();
    if (excluded.size === 0) return raw;
    const out = {};
    for (const k of Object.keys(raw)) {
      if (!excluded.has(k)) out[k] = raw[k];
    }
    return out;
  }

  function syncHeaderProviderModel() {
    if (el.headerProviderName && el.providerSelect) {
      const opt = el.providerSelect.selectedOptions[0];
      const text = opt ? opt.text : "";
      el.headerProviderName.textContent = text;
      el.headerProviderName.title = text;
    }
    if (el.headerModelName && el.modelSelect) {
      const opt = el.modelSelect.selectedOptions[0];
      const text = opt ? opt.text : "";
      el.headerModelName.textContent = text;
      el.headerModelName.title = text;
    }
  }

  async function onProviderChange() {
    currentProvider = el.providerSelect ? el.providerSelect.value : "ollama";
    await loadModels(false);
    await loadParamsForProvider(currentProvider);
    await ensureParamsBaselineForCurrentModel();
    syncHeaderProviderModel();
    // Actualizar conversación si hay una abierta
    if (currentConversationId) {
      fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({
          provider: currentProvider,
          model_id: (el.modelSelect && el.modelSelect.value) || (models[0] || ""),
          model_params: buildModelParams(),
        }),
      }).catch(() => {});
    }
    lastUsage = null;
    await loadContextLength();
  }

  async function loadConversations() {
    try {
      const list = await fetchJson(`${API}/conversations`);
      renderConversationsList(list);
      await loadDeletedConversations();
    } catch (e) {
      showError("Error al cargar conversaciones: " + e.message);
    }
  }

  async function loadDeletedConversations() {
    if (!el.conversationsTrash || !el.conversationsTrashList) return;
    try {
      const deleted = await fetchJson(`${API}/conversations/deleted`);
      renderDeletedConversations(deleted);
    } catch (e) {
      el.conversationsTrash.hidden = true;
      el.conversationsTrashList.innerHTML = "";
    }
  }

  function renderDeletedConversations(list) {
    if (!el.conversationsTrash || !el.conversationsTrashList) return;
    if (!list || list.length === 0) {
      el.conversationsTrash.hidden = true;
      el.conversationsTrashList.innerHTML = "";
      return;
    }
    el.conversationsTrash.hidden = false;
    el.conversationsTrashList.innerHTML = list
      .map((c) => {
        const when = formatDate(c.deleted_at || c.last_message_at || c.updated_at);
        return `<div class="conversation-item conversation-item-deleted" data-id="${escapeHtml(c.id)}" title="Eliminada · ${escapeHtml(when)}">
            <div class="conv-row">
              <span class="conv-title">${escapeHtml(c.title)}</span>
              <button type="button" class="conv-restore-btn" data-id="${escapeHtml(c.id)}" title="Restaurar" aria-label="Restaurar conversación">Restaurar</button>
            </div>
          </div>`;
      })
      .join("");
    el.conversationsTrashList.querySelectorAll(".conv-restore-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        restoreConversation(btn.dataset.id);
      });
    });
  }

  async function restoreConversation(id) {
    try {
      const res = await fetch(`${API}/conversations/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      await loadConversations();
      await openConversation(id);
      showNotice("Conversación restaurada.");
    } catch (e) {
      showError("Error al restaurar: " + e.message);
    }
  }

  const clearHistoryIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 20H7L3 16l10-10 4 4-6 6h9l4-4\"/></svg>";

  const CONV_GROUP_LABELS = { hoy: "Hoy", ayer: "Ayer", semana: "Semana", anteriores: "Antes" };

  function getConversationGroup(lastActivityAt) {
    const d = lastActivityAt ? new Date(lastActivityAt) : new Date(0);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekAgoStart = new Date(todayStart);
    weekAgoStart.setDate(weekAgoStart.getDate() - 7);
    if (d >= todayStart) return "hoy";
    if (d >= yesterdayStart) return "ayer";
    if (d >= weekAgoStart) return "semana";
    return "anteriores";
  }

  function conversationActivityTs(c, childrenByParent) {
    let t = new Date(c.last_message_at || c.updated_at || 0).getTime();
    (childrenByParent.get(c.id) || []).forEach((ch) => {
      t = Math.max(t, conversationActivityTs(ch, childrenByParent));
    });
    return t;
  }

  function buildConversationForest(list) {
    const byId = new Map(list.map((c) => [c.id, c]));
    const childrenByParent = new Map();
    list.forEach((c) => {
      const pid = c.forked_from_conversation_id;
      if (pid && byId.has(pid)) {
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid).push(c);
      }
    });
    childrenByParent.forEach((kids) => {
      kids.sort(
        (a, b) => conversationActivityTs(b, childrenByParent) - conversationActivityTs(a, childrenByParent)
      );
    });
    const roots = list.filter(
      (c) => !c.forked_from_conversation_id || !byId.has(c.forked_from_conversation_id)
    );
    return { roots, childrenByParent };
  }

  function renderConversationsList(list) {
    if (!el.conversationsList) return;
    const { roots, childrenByParent } = buildConversationForest(list || []);
    const groups = { hoy: [], ayer: [], semana: [], anteriores: [] };
    roots.forEach((c) => {
      const g = getConversationGroup(new Date(conversationActivityTs(c, childrenByParent)));
      groups[g].push(c);
    });
    const order = ["hoy", "ayer", "semana", "anteriores"];
    const renderItem = (c, depth) => {
      const when = formatDate(c.last_message_at || c.updated_at);
      const meta = `${c.provider || "ollama"}/${c.model_id} · ${when}`;
      const kids = childrenByParent.get(c.id) || [];
      const item = `<div class="conversation-item ${c.id === currentConversationId ? "active" : ""} ${depth ? "conversation-item-fork" : ""}" data-id="${escapeHtml(c.id)}" data-depth="${depth}" title="${escapeHtml(meta)}" style="padding-left: ${8 + depth * 14}px">
                <div class="conv-row">
                  <span class="conv-title">${escapeHtml(c.title)}</span>
                  <span class="conv-when">${escapeHtml(when)}</span>
                  ${c.id === currentConversationId ? `<button type="button" class="conv-clear-btn" data-id="${escapeHtml(c.id)}" title="Limpiar historial de mensajes" aria-label="Limpiar historial">${clearHistoryIconSvg}</button>` : ""}
                </div>
              </div>`;
      return item + kids.map((ch) => renderItem(ch, depth + 1)).join("");
    };
    const html = order
      .filter((key) => groups[key].length > 0)
      .map((key) => {
        const header = `<div class="conv-group-label" aria-hidden="true">${escapeHtml(CONV_GROUP_LABELS[key])}</div>`;
        const items = groups[key].map((c) => renderItem(c, 0)).join("");
        return header + items;
      })
      .join("");
    el.conversationsList.innerHTML = html;
    el.conversationsList.querySelectorAll(".conversation-item").forEach((node) => {
      node.addEventListener("click", (e) => {
        if (e.target.closest(".conv-clear-btn")) return;
        openConversation(node.dataset.id);
      });
    });
    el.conversationsList.querySelectorAll(".conv-clear-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearConversationHistory(btn.dataset.id);
      });
    });
  }

  async function deleteConversation(id) {
    try {
      const res = await fetch(`${API}/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      if (currentConversationId === id) setCurrentConversation(null);
      loadConversations();
      showNotice("Conversación movida a la papelera.");
    } catch (e) {
      showError("Error al eliminar: " + e.message);
    }
  }

  async function clearConversationHistory(id) {
    try {
      const res = await fetch(`${API}/conversations/${id}/messages`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      if (currentConversationId === id) {
        resetConversationTree();
        renderMessages();
      }
      showNotice("Historial de mensajes borrado.");
    } catch (e) {
      showError("Error al limpiar historial: " + e.message);
    }
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("es", { day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
    } catch (_) {
      return "";
    }
  }

  function getDefaultConversationTitle() {
    const now = new Date();
    return now.toLocaleString("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  /** Escapa texto pero conserva img/placeholder/error de ilustración y marcadores. */
  function formatMessageHtml(content) {
    const raw = content == null ? "" : String(content);
    const tokens = [];
    const pattern =
      /(<img\b[^>]*class="[^"]*chat-illustration[^"]*"[^>]*>|<span\b[^>]*class="[^"]*chat-illustration-(?:error|placeholder)[^"]*"[^>]*>[\s\S]*?<\/span>|⟦img:[^⟧]+⟧)/gi;
    let last = 0;
    let m;
    while ((m = pattern.exec(raw)) !== null) {
      if (m.index > last) tokens.push({ t: "text", v: raw.slice(last, m.index) });
      const piece = m[0];
      if (piece.startsWith("⟦img:")) {
        tokens.push({
          t: "html",
          v: `<span class="chat-illustration-placeholder">Generando imagen…\n\n${escapeHtml(piece)}</span>`,
        });
      } else {
        tokens.push({ t: "html", v: piece });
      }
      last = m.index + piece.length;
    }
    if (last < raw.length) tokens.push({ t: "text", v: raw.slice(last) });
    trimIllustrationAdjacentWhitespace(tokens);
    if (!tokens.some((tok) => tok.t === "html")) {
      return tokens
        .map((tok) => (tok.t === "html" ? tok.v : escapeHtml(tok.v).replace(/\n/g, "<br>")))
        .join("");
    }
    return layoutIllustratedHtml(tokens);
  }

  function splitIllustrationParagraphs(text) {
    return String(text || "")
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function isWrapIllustrationHtml(html) {
    const s = String(html || "");
    if (/chat-illustration-error/.test(s)) return false;
    return /chat-illustration/.test(s);
  }

  /**
   * Párrafo previo a cada imagen: fila completa.
   * Lo que sigue envuelve a la derecha; el previo a la siguiente imagen
   * queda fuera de esa unidad para no meterse en el hueco que sobre.
   */
  function layoutIllustratedHtml(tokens) {
    const items = [];
    tokens.forEach((tok) => {
      if (tok.t === "html") {
        items.push({
          kind: isWrapIllustrationHtml(tok.v) ? "illust" : "html",
          v: tok.v,
        });
        return;
      }
      splitIllustrationParagraphs(tok.v).forEach((p) => {
        items.push({ kind: "para", v: p });
      });
    });

    const out = [];
    let i = 0;
    while (i < items.length) {
      const item = items[i];
      if (item.kind === "para") {
        out.push(`<div class="illustration-lead">${escapeHtml(item.v).replace(/\n/g, "<br>")}</div>`);
        i += 1;
        continue;
      }
      if (item.kind === "html") {
        out.push(item.v);
        i += 1;
        continue;
      }

      let nextIllust = -1;
      for (let k = i + 1; k < items.length; k++) {
        if (items[k].kind === "illust") {
          nextIllust = k;
          break;
        }
      }
      const hasNext = nextIllust !== -1;
      const limit = hasNext ? nextIllust : items.length;
      const following = [];
      for (let j = i + 1; j < limit; j++) {
        if (items[j].kind !== "para") break;
        following.push(items[j]);
      }
      let wrapParas = following;
      if (hasNext && following.length) {
        wrapParas = following.slice(0, -1);
      }
      const wrapHtml = wrapParas
        .map((p) => `<div class="illustration-wrap">${escapeHtml(p.v).replace(/\n/g, "<br>")}</div>`)
        .join("");
      out.push(`<div class="illustration-unit">${item.v}${wrapHtml}</div>`);
      i += 1 + wrapParas.length;
    }
    return out.join("");
  }

  /** Sin esto, los \n junto al <img> se vuelven <br> y dejan el hueco del float vacío. */
  function trimIllustrationAdjacentWhitespace(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].t !== "html") continue;
      if (i > 0 && tokens[i - 1].t === "text") {
        tokens[i - 1].v = tokens[i - 1].v.replace(/(\n[ \t]*)+$/, "\n");
      }
      if (i + 1 < tokens.length && tokens[i + 1].t === "text") {
        tokens[i + 1].v = tokens[i + 1].v.replace(/^[ \t]*\n+/, "");
      }
    }
  }

  /**
   * Separa el primer párrafo del resto.
   * Prioriza bloques separados por línea en blanco; si no hay, usa el primer salto
   * de línea cuando el resto aporta contenido relevante.
   */
  function splitFirstParagraph(content) {
    const raw = content == null ? "" : String(content);
    const blank = raw.match(/^([\s\S]*?)(\n\s*\n+)([\s\S]+)$/);
    if (blank && blank[3].trim()) {
      return { first: blank[1], rest: blank[2] + blank[3], collapsible: true };
    }
    const single = raw.match(/^([^\n]+)(\n+)([\s\S]+)$/);
    if (single && single[3].trim()) {
      const restTrim = single[3].trim();
      if (restTrim.length >= 80 || /\n/.test(restTrim)) {
        return { first: single[1], rest: single[2] + single[3], collapsible: true };
      }
    }
    return { first: raw, rest: "", collapsible: false };
  }

  function messageCollapseKey(m, idx) {
    return m && m.id ? String(m.id) : `idx:${idx}`;
  }

  /** Claves de mensajes assistant que el usuario ha expandido (el resto colapsable queda plegado). */
  const expandedMessageKeys = new Set();

  function collapseAllMessages() {
    expandedMessageKeys.clear();
    renderMessages();
  }

  const illustrationInfoIconSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

  function filenameFromIllustratedSrc(src) {
    if (!src) return "";
    try {
      const path = String(src).split("?")[0];
      const marker = "/illustrated-images/";
      const idx = path.indexOf(marker);
      if (idx >= 0) return decodeURIComponent(path.slice(idx + marker.length).replace(/^\/+/, ""));
      const parts = path.split("/");
      return decodeURIComponent(parts[parts.length - 1] || "");
    } catch (_) {
      return "";
    }
  }

  function enhanceIllustrationFrames(root) {
    if (!root) return;
    root.querySelectorAll("img.chat-illustration").forEach(function (img) {
      if (img.closest(".chat-illustration-frame")) return;
      const parent = img.parentNode;
      if (!parent) return;
      const frame = document.createElement("span");
      frame.className = "chat-illustration-frame";
      parent.insertBefore(frame, img);
      frame.appendChild(img);
      const filename =
        img.getAttribute("data-filename") || filenameFromIllustratedSrc(img.getAttribute("src"));
      if (!filename) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-illustration-info-btn";
      btn.title = "Parámetros de generación";
      btn.setAttribute("aria-label", "Ver parámetros de generación");
      btn.innerHTML = illustrationInfoIconSvg;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openIllustrationMetaModal(filename);
      });
      frame.appendChild(btn);
    });
  }

  /** Tras salir de display:none, fuerza el fetch de imgs lazy que quedaron a 0×0. */
  function kickLazyIllustrations(root) {
    if (!root) return;
    root.querySelectorAll("img.chat-illustration").forEach(function (img) {
      if (img.naturalWidth > 0) return;
      try {
        img.loading = "eager";
      } catch (_) {}
      const src = img.getAttribute("src");
      if (src) img.src = src;
    });
  }

  function closeIllustrationMetaModal() {
    const modal = document.getElementById("illustration-meta-modal");
    if (modal) modal.hidden = true;
  }

  function formatIllustrationMetaValue(value) {
    if (value == null) return "—";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch (_) {
        return String(value);
      }
    }
    return String(value);
  }

  /** Formatea ms de generación para el popup (p. ej. 850 ms, 12.3 s). */
  function formatGenerationDuration(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n < 0) return "—";
    if (n < 1000) return `${Math.round(n)} ms`;
    const seconds = n / 1000;
    if (seconds < 60) {
      return `${seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1)} s`;
    }
    const minutes = Math.floor(seconds / 60);
    const rem = seconds - minutes * 60;
    return `${minutes} min ${rem.toFixed(0)} s`;
  }

  function renderIllustrationMetaBody(data) {
    const params = (data && data.params) || {};
    const model =
      params.model ||
      (params.override_settings && params.override_settings.sd_model_checkpoint) ||
      "—";
    const size =
      params.width != null && params.height != null
        ? `${params.width} × ${params.height}`
        : "—";
    const genTime =
      params.generation_time_ms != null && Number.isFinite(Number(params.generation_time_ms))
        ? formatGenerationDuration(Number(params.generation_time_ms))
        : null;
    const llmLabel =
      [data.prompt_provider, data.prompt_model].filter(Boolean).join(" · ") ||
      [params.prompt_llm_provider, params.prompt_llm_model].filter(Boolean).join(" · ") ||
      null;
    const rows = [
      ["LLM del prompt", llmLabel],
      ["Modo", data.mode || params.mode || "—"],
      ["Modelo", model],
      ["Tamaño", size],
      ["Tiempo de generación", genTime],
      ["Sampler", params.sampler_name || "—"],
      ["Scheduler", params.scheduler || "—"],
      ["Steps", params.steps != null ? params.steps : "—"],
      ["CFG", params.cfg_scale != null ? params.cfg_scale : "—"],
      ["Seed", params.seed != null ? params.seed : "—"],
      ["Denoising", params.denoising_strength != null ? params.denoising_strength : null],
      ["Escena", data.scene_id || null],
      ["Archivo", data.filename || null],
    ].filter(function (pair) {
      return pair[1] != null && pair[1] !== "";
    });

    const skipKeys = new Set([
      "prompt",
      "negative_prompt",
      "model",
      "mode",
      "width",
      "height",
      "sampler_name",
      "scheduler",
      "steps",
      "cfg_scale",
      "seed",
      "denoising_strength",
      "generation_time_ms",
      "override_settings",
      "init_images",
      "mask",
      "include_init_images",
      "prompt_llm_model",
      "prompt_llm_provider",
      "use_chat_config",
    ]);
    Object.keys(params).forEach(function (key) {
      if (skipKeys.has(key)) return;
      rows.push([key, formatIllustrationMetaValue(params[key])]);
    });
    if (params.override_settings && typeof params.override_settings === "object") {
      Object.keys(params.override_settings).forEach(function (key) {
        if (key === "sd_model_checkpoint") return;
        rows.push([
          "override." + key,
          formatIllustrationMetaValue(params.override_settings[key]),
        ]);
      });
    }

    let html = '<dl class="illustration-meta-grid">';
    rows.forEach(function (pair) {
      html +=
        `<dt>${escapeHtml(pair[0])}</dt><dd>${escapeHtml(formatIllustrationMetaValue(pair[1]))}</dd>`;
    });
    html += "</dl>";
    html += '<div class="illustration-meta-prompt"><h3>Prompt</h3><pre>' +
      escapeHtml(params.prompt || "—") +
      "</pre></div>";
    if (params.negative_prompt) {
      html +=
        '<div class="illustration-meta-prompt"><h3>Negative prompt</h3><pre>' +
        escapeHtml(params.negative_prompt) +
        "</pre></div>";
    }
    return html;
  }

  async function openIllustrationMetaModal(filename) {
    const modal = document.getElementById("illustration-meta-modal");
    const body = document.getElementById("illustration-meta-body");
    if (!modal || !body || !filename) return;
    body.innerHTML = '<p class="illustration-meta-loading">Cargando parámetros…</p>';
    modal.hidden = false;
    try {
      const data = await fetchJson(
        `${API}/illustrated-images/${encodeURIComponent(filename)}/meta`
      );
      body.innerHTML = renderIllustrationMetaBody(data || {});
    } catch (err) {
      body.innerHTML =
        '<p class="illustration-meta-empty">No hay metadatos guardados para esta imagen.</p>';
    }
  }

  function initIllustrationMetaModal() {
    const modal = document.getElementById("illustration-meta-modal");
    const closeBtn = document.getElementById("illustration-meta-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeIllustrationMetaModal();
      });
    }
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeIllustrationMetaModal();
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeIllustrationMetaModal();
    });
  }

  function buildCollapsibleMessageHtml(content, key, expanded) {
    const parts = splitFirstParagraph(content);
    if (!parts.collapsible) {
      return `<div class="message-content">${formatMessageHtml(content || "")}</div>`;
    }
    const collapsed = !expanded;
    const toggleLabel = collapsed ? "Show more" : "Show less";
    return `<div class="message-body-collapsible${collapsed ? " is-collapsed" : ""}" data-collapse-key="${escapeHtml(key)}">
      <div class="message-content-preview">${formatMessageHtml(parts.first)}</div>
      <div class="message-content-rest">${formatMessageHtml(parts.rest)}</div>
      <button type="button" class="msg-collapse-toggle" aria-expanded="${collapsed ? "false" : "true"}">${toggleLabel}</button>
    </div>`;
  }

  function saveLastConversationId(id) {
    try {
      if (id) localStorage.setItem(LAST_CONVERSATION_STORAGE_KEY, id);
      else localStorage.removeItem(LAST_CONVERSATION_STORAGE_KEY);
    } catch (_) {}
  }

  function renderParamsSourceLabel() {
    if (el.paramsSourceLabel) el.paramsSourceLabel.textContent = paramsSource;
  }

  /** Icono para "no enviar este parámetro". */
  const paramExcludeIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>";
  /** Icono para "incluir de nuevo en el envío". */
  const paramIncludeIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/></svg>";

  function renderParamsToSend() {
    if (!el.paramsToSendContainer) return;
    const raw = buildModelParamsRaw();
    const excluded = getParamsExcludedFromSendSet();
    const toSend = Object.keys(raw).filter((id) => !excluded.has(id));
    const excludedList = Array.from(excluded);
    const specLabel = (paramId) => (paramsConfig.params[paramId] && paramsConfig.params[paramId].label) || paramId;
    let html = "";
    if (toSend.length > 0 || excludedList.length > 0) {
      html += "<div class=\"params-to-send-section\">";
      if (toSend.length > 0) {
        html += "<div class=\"params-to-send-row\">";
        toSend.forEach((paramId) => {
          html += `<span class="params-to-send-chip">${escapeHtml(specLabel(paramId))}<button type="button" class="params-to-send-btn params-to-send-exclude" data-param-id="${escapeHtml(paramId)}" title="No enviar este parámetro" aria-label="No enviar ${escapeHtml(paramId)}">${paramExcludeIconSvg}</button></span>`;
        });
        html += "</div>";
      }
      if (excludedList.length > 0) {
        html += "<div class=\"params-to-send-row params-to-send-excluded-row\"><span class=\"params-to-send-title\">Excluidos (no se envían):</span>";
        excludedList.forEach((paramId) => {
          html += `<span class="params-to-send-chip params-to-send-chip-excluded">${escapeHtml(specLabel(paramId))}<button type="button" class="params-to-send-btn params-to-send-include" data-param-id="${escapeHtml(paramId)}" title="Incluir en el envío" aria-label="Incluir ${escapeHtml(paramId)}">${paramIncludeIconSvg}</button></span>`;
        });
        html += "</div>";
      }
      html += "</div>";
    }
    el.paramsToSendContainer.innerHTML = html;
    el.paramsToSendContainer.querySelectorAll(".params-to-send-exclude").forEach((btn) => {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-param-id");
        if (id) getParamsExcludedFromSendSet().add(id);
        renderParamsToSend();
        debouncedSaveParams();
      });
    });
    el.paramsToSendContainer.querySelectorAll(".params-to-send-include").forEach((btn) => {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-param-id");
        if (id) getParamsExcludedFromSendSet().delete(id);
        renderParamsToSend();
        debouncedSaveParams();
      });
    });
  }

  function mapApiMessage(m) {
    return {
      role: m.role,
      content: m.content,
      id: m.id || null,
      parent_id: m.parent_id || null,
      debug_request: m.debug_request || null,
      debug_response: m.debug_response || null,
      ephemeral_debug: !!m.ephemeral_debug,
    };
  }

  function pathFromMessages(list, leafId) {
    if (!leafId) return [];
    const byId = new Map();
    list.forEach((m) => {
      if (m.id) byId.set(m.id, m);
    });
    const path = [];
    let current = byId.get(leafId);
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      path.push(current);
      seen.add(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : null;
    }
    path.reverse();
    return path;
  }

  function effectiveLeafId() {
    if (activeLeafId && allMessages.some((m) => m.id === activeLeafId && !m.inherited)) return activeLeafId;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].id && !allMessages[i].ephemeral_debug && !allMessages[i].inherited) {
        return allMessages[i].id;
      }
    }
    return null;
  }

  function syncVisibleMessages() {
    const ephemerals = messages.filter((m) => m.ephemeral_debug);
    const inherited = allMessages.filter((m) => m.inherited && !m.ephemeral_debug);
    const own = allMessages.filter((m) => !m.inherited && !m.ephemeral_debug);
    messages = inherited.concat(pathFromMessages(own, effectiveLeafId())).concat(ephemerals);
  }

  function applyConversationTree(conv) {
    const inherited = (conv.inherited_messages || []).map((m) => ({
      ...mapApiMessage(m),
      inherited: true,
    }));
    const own = (conv.messages || []).map(mapApiMessage);
    allMessages = inherited.concat(own);
    const ownWithId = own.filter((m) => m.id);
    activeLeafId = conv.active_leaf_message_id || (ownWithId.length ? ownWithId[ownWithId.length - 1].id : null);
    syncVisibleMessages();
  }

  function resetConversationTree() {
    allMessages = [];
    activeLeafId = null;
    messages = [];
  }

  function updateStoredMessageContent(messageId, content) {
    allMessages.forEach((m) => {
      if (m.id === messageId) m.content = content;
    });
    messages.forEach((m) => {
      if (m.id === messageId) m.content = content;
    });
  }

  function ensureComposerOpen() {
    const expandBtn = document.getElementById("btn-expand-composer");
    if (expandBtn && !expandBtn.hidden) expandBtn.click();
  }

  async function forkConversationFromMessage(messageId) {
    if (!messageId || !currentConversationId) return;
    try {
      const conv = await fetchJson(`${API}/conversations/${currentConversationId}/fork`, {
        method: "POST",
        body: JSON.stringify({ message_id: messageId }),
      });
      await setCurrentConversation(conv);
      ensureComposerOpen();
      if (el.messageInput) el.messageInput.focus();
      showNotice("Conversación nueva. El historial se toma del mensaje original.");
    } catch (e) {
      showError("No se pudo crear la conversación: " + e.message);
    }
  }

  async function setCurrentConversation(conv) {
    const previousConvId = currentConversationId;
    if (previousConvId && (!conv || conv.id !== previousConvId)) {
      const payload = {};
      if (el.instructionOverride) {
        payload.instruction_override = (el.instructionOverride.value || "").trim() || null;
      }
      if (el.conversationTitle) {
        payload.title = el.conversationTitle.value.trim() || getDefaultConversationTitle();
      }
      if (Object.keys(payload).length > 0) {
        fetchJson(`${API}/conversations/${previousConvId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    }
    currentConversationId = conv ? conv.id : null;
    saveLastConversationId(currentConversationId);
    if (el.instructionOverride) {
      el.instructionOverride.value = (conv && conv.instruction_override != null) ? conv.instruction_override : "";
    }
    if (conv) {
      if (el.conversationTitle) el.conversationTitle.value = conv.title;
      currentProvider = conv.provider || "ollama";
      if (el.providerSelect) el.providerSelect.value = currentProvider;
      await loadModels(false);
      if (el.modelSelect) {
        el.modelSelect.value = conv.model_id;
        refreshModelSelectUI();
      }
      rules = normalizeRulesFromApi(conv.system_instructions, conv.system_instruction_global);
      await loadParamsForProvider(currentProvider);
      if (conv.model_params && typeof conv.model_params === "object" && Object.keys(conv.model_params).length > 0) {
        await ensureParamsBaselineForCurrentModel();
        applyUserParamsToControls(conv.model_params);
        const savedParamIds = new Set(Object.keys(conv.model_params));
        const allParamIds = Object.keys(paramsConfig.params || {});
        paramsExcludedFromSendByConv[conv.id] = new Set(allParamIds.filter((id) => !savedParamIds.has(id)));
        paramsSource = "user";
      } else {
        paramsExcludedFromSendByConv[conv.id] = new Set();
        try {
          const data = await fetchJson(`${API}/providers/${currentProvider}/presets`);
          const presets = data.presets || {};
          const preset = presets[conv.model_id];
          if (preset) {
            applyPresetToControls(preset);
            setParamsBaselineFromPreset(preset);
            paramsSource = "preset";
          } else {
            paramsSource = "default";
          }
        } catch (_) {
          paramsSource = "default";
        }
      }
      applyConversationTree(conv);
      expandedMessageKeys.clear();
      const turns = conv.history_turns != null && conv.history_turns >= 0 ? conv.history_turns : 5;
      if (el.historyTurnsInput) el.historyTurnsInput.value = String(Math.min(100, Math.max(0, turns)));
    } else {
      if (el.conversationTitle) el.conversationTitle.value = "Nueva conversación";
      currentProvider = providers[0] || "ollama";
      if (el.providerSelect) el.providerSelect.value = currentProvider;
      if (el.modelSelect) {
        el.modelSelect.value = models[0] || "";
        refreshModelSelectUI();
      }
      rules = [];
      await loadParamsForProvider(currentProvider);
      await ensureParamsBaselineForCurrentModel();
      paramsSource = "default";
      resetConversationTree();
      expandedMessageKeys.clear();
      if (el.historyTurnsInput) el.historyTurnsInput.value = "5";
    }
    renderRules();
    renderParamsSourceLabel();
    renderParamsToSend();
    renderMessages();
    loadConversations();
    lastUsage = null;
    await loadContextLength();
    // Si el panel Reglas está abierto, refrescar el selector para mostrar todas las reglas de la biblioteca (incl. creadas en otras conversaciones).
    const reglasPanel = document.getElementById("tab-reglas");
    if (reglasPanel && reglasPanel.classList.contains("is-open")) loadLibraryRules();
  }

  let saveRulesDebounceTimer = null;
  const SAVE_RULES_DEBOUNCE_MS = 600;

  function saveRulesToConversation() {
    if (!currentConversationId) return;
    fetchJson(`${API}/conversations/${currentConversationId}`, {
      method: "PUT",
      body: JSON.stringify({ system_instructions: rules }),
    }).catch(() => {});
  }

  function debouncedSaveRules() {
    if (saveRulesDebounceTimer) clearTimeout(saveRulesDebounceTimer);
    saveRulesDebounceTimer = setTimeout(function () {
      saveRulesDebounceTimer = null;
      saveRulesToConversation();
    }, SAVE_RULES_DEBOUNCE_MS);
  }

  let saveHistoryTurnsDebounceTimer = null;
  let instructionOverrideDebounceTimer = null;

  function saveInstructionOverrideToConversation() {
    if (!currentConversationId || !el.instructionOverride) return;
    const value = (el.instructionOverride.value || "").trim() || null;
    fetchJson(`${API}/conversations/${currentConversationId}`, {
      method: "PUT",
      body: JSON.stringify({ instruction_override: value }),
    }).catch(() => {});
  }

  function debouncedSaveInstructionOverride() {
    if (instructionOverrideDebounceTimer) clearTimeout(instructionOverrideDebounceTimer);
    instructionOverrideDebounceTimer = setTimeout(function () {
      instructionOverrideDebounceTimer = null;
      saveInstructionOverrideToConversation();
    }, 400);
  }

  function saveHistoryTurnsToConversation() {
    if (!currentConversationId || !el.historyTurnsInput) return;
    const v = parseInt(el.historyTurnsInput.value, 10);
    const turns = (Number.isFinite(v) && v >= 0 && v <= 100) ? v : 5;
    fetchJson(`${API}/conversations/${currentConversationId}`, {
      method: "PUT",
      body: JSON.stringify({ history_turns: turns }),
    }).catch(() => {});
  }
  function debouncedSaveHistoryTurns() {
    if (saveHistoryTurnsDebounceTimer) clearTimeout(saveHistoryTurnsDebounceTimer);
    saveHistoryTurnsDebounceTimer = setTimeout(function () {
      saveHistoryTurnsDebounceTimer = null;
      saveHistoryTurnsToConversation();
    }, 400);
  }

  /** Convierte system_instructions de la API a lista de reglas para la UI. Solo reglas reales (biblioteca o inline); no se mezcla system_instruction_global como regla. */
  function normalizeRulesFromApi(apiRules, _legacyGlobalUnused) {
    if (Array.isArray(apiRules) && apiRules.length > 0) {
      return apiRules.map(function (r, i) {
        if (typeof r === "string") return { title: "Regla " + (i + 1), content: r };
        const item = {
          title: (r && r.title != null ? String(r.title) : "") || "Regla " + (i + 1),
          content: (r && r.content != null ? String(r.content) : "") || "",
        };
        if (r && r.rule_id) item.rule_id = String(r.rule_id);
        return item;
      });
    }
    return [];
  }

  function getRulesTextForSystem() {
    return concatRuleContents(rules);
  }

  function concatRuleContents(items) {
    return (items || [])
      .map(function (r) { return (r && r.content) ? r.content.trim() : ""; })
      .filter(Boolean)
      .join(" ");
  }

  function getPlannerRulesTextForSystem() {
    return concatRuleContents(plannerRules);
  }

  function serializeRuleItems(items) {
    return (items || []).map(function (r) {
      const item = {
        title: (r && r.title) || "",
        content: (r && r.content) || "",
      };
      if (r && r.rule_id) item.rule_id = r.rule_id;
      return item;
    });
  }

  function normalizePlannerRulesFromPrefs(raw) {
    if (typeof raw === "string") {
      const text = raw.trim();
      return text ? [{ title: "Instrucciones", content: text }] : [];
    }
    return normalizeRulesFromApi(raw);
  }

  let ruleEditIndex = -1;
  let ruleEditKind = "chat";

  function openRuleEditModal(index, kind) {
    ruleEditKind = kind === "planner" ? "planner" : "chat";
    const list = ruleEditKind === "planner" ? plannerRules : rules;
    if (index < 0 || index >= list.length) return;
    ruleEditIndex = index;
    const r = list[index];
    if (el.ruleEditTitle) el.ruleEditTitle.value = (r && r.title != null ? r.title : "") || "";
    if (el.ruleEditContent) el.ruleEditContent.value = (r && r.content != null ? r.content : "") || "";
    if (el.ruleEditModal) {
      el.ruleEditModal.hidden = false;
      el.ruleEditTitle && el.ruleEditTitle.focus();
    }
  }

  function closeRuleEditModal() {
    ruleEditIndex = -1;
    if (el.ruleEditModal) el.ruleEditModal.hidden = true;
  }

  function renderRuleTags(listEl, items) {
    if (!listEl) return;
    listEl.innerHTML = (items || [])
      .map((rule, index) => {
        const title = (rule && rule.title != null ? rule.title : "") || "";
        const displayTitle = title.trim() || "Sin título";
        return `<span class="rule-tag" role="listitem" data-rule-index="${index}">
          <span class="rule-tag-drag" draggable="true" role="button" title="Arrastrar para reordenar" aria-label="Arrastrar para reordenar" data-rule-index="${index}"></span>
          <span class="rule-tag-label" tabindex="0" role="button" title="Editar regla" data-rule-index="${index}">${escapeHtml(displayTitle)}</span>
          <button type="button" class="rule-tag-remove" title="Eliminar regla" aria-label="Eliminar regla" data-rule-index="${index}">×</button>
        </span>`;
      })
      .join("");
  }

  function renderRules() {
    renderRuleTags(el.rulesList, rules);
  }

  function renderPlannerRules() {
    renderRuleTags(el.plannerRulesList, plannerRules);
  }

  function bindRuleTagList(listEl, kind) {
    if (!listEl) return;
    let dragSourceIndex = -1;
    function getList() {
      return kind === "planner" ? plannerRules : rules;
    }
    function setList(next) {
      if (kind === "planner") plannerRules = next;
      else rules = next;
    }
    function afterChange(forceImmediate) {
      if (kind === "planner") {
        renderPlannerRules();
        persistImagesPanel();
        return;
      }
      renderRules();
      if (forceImmediate) {
        if (saveRulesDebounceTimer) {
          clearTimeout(saveRulesDebounceTimer);
          saveRulesDebounceTimer = null;
        }
        saveRulesToConversation();
      } else {
        debouncedSaveRules();
      }
    }
    listEl.addEventListener("dragstart", function (e) {
      const handle = e.target.closest(".rule-tag-drag");
      if (!handle) return;
      const tag = handle.closest(".rule-tag");
      if (!tag) return;
      const items = getList();
      const idx = parseInt(tag.getAttribute("data-rule-index"), 10);
      if (Number.isNaN(idx) || idx < 0 || idx >= items.length) return;
      dragSourceIndex = idx;
      e.dataTransfer.setData("text/plain", String(idx));
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(tag, 0, 0);
      tag.classList.add("rule-tag-dragging");
    });
    listEl.addEventListener("dragend", function (e) {
      dragSourceIndex = -1;
      e.target.closest(".rule-tag")?.classList.remove("rule-tag-dragging");
      listEl.querySelectorAll(".rule-tag-drag-over").forEach((n) => n.classList.remove("rule-tag-drag-over"));
    });
    listEl.addEventListener("dragover", function (e) {
      const tag = e.target.closest(".rule-tag");
      if (!tag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      listEl.querySelectorAll(".rule-tag-drag-over").forEach((n) => n.classList.remove("rule-tag-drag-over"));
      tag.classList.add("rule-tag-drag-over");
    });
    listEl.addEventListener("dragleave", function (e) {
      if (!listEl.contains(e.relatedTarget)) {
        listEl.querySelectorAll(".rule-tag-drag-over").forEach((n) => n.classList.remove("rule-tag-drag-over"));
      }
    });
    listEl.addEventListener("drop", function (e) {
      const tag = e.target.closest(".rule-tag");
      if (!tag) return;
      e.preventDefault();
      tag.classList.remove("rule-tag-drag-over");
      const items = getList();
      const from = dragSourceIndex >= 0 ? dragSourceIndex : parseInt(e.dataTransfer.getData("text/plain"), 10);
      const to = parseInt(tag.getAttribute("data-rule-index"), 10);
      if (Number.isNaN(from) || Number.isNaN(to) || from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return;
      const arr = items.slice();
      const [item] = arr.splice(from, 1);
      const insertAt = Math.min(to, arr.length);
      arr.splice(insertAt, 0, item);
      setList(arr);
      afterChange(false);
    });
    listEl.addEventListener("click", function (e) {
      const removeBtn = e.target.closest(".rule-tag-remove");
      const tag = e.target.closest(".rule-tag");
      const items = getList();
      if (removeBtn && tag) {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(tag.getAttribute("data-rule-index"), 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < items.length) {
          const next = items.slice();
          next.splice(idx, 1);
          setList(next);
          afterChange(next.length === 0);
        }
        return;
      }
      const label = e.target.closest(".rule-tag-label");
      if (label && tag) {
        e.preventDefault();
        const idx = parseInt(tag.getAttribute("data-rule-index"), 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < items.length) openRuleEditModal(idx, kind);
      }
    });
    listEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const label = e.target.closest(".rule-tag-label");
      const tag = e.target.closest(".rule-tag");
      const items = getList();
      if (label && tag) {
        e.preventDefault();
        const idx = parseInt(tag.getAttribute("data-rule-index"), 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < items.length) openRuleEditModal(idx, kind);
      }
    });
  }

  bindRuleTagList(el.rulesList, "chat");
  bindRuleTagList(el.plannerRulesList, "planner");

  async function openConversation(id, options) {
    setChatPanelVisible(true);
    if (isGalleryPanelVisible()) {
      galleryUserChoseAll = false;
      galleryScopeAll = false;
      galleryMessageId = null;
    }
    try {
      const conv = await fetchJson(`${API}/conversations/${id}`);
      await setCurrentConversation(conv);
      if (isGalleryPanelVisible()) {
        galleryOffset = 0;
        await refreshGalleryAfterScopeChange();
      }
    } catch (e) {
      showError("Error al abrir conversación: " + e.message);
    }
  }

  async function newConversation() {
    setChatPanelVisible(true);
    try {
      const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama";
      const model = (el.modelSelect && el.modelSelect.value) || (models[0] || "");
      const typedTitle = (el.conversationTitle && el.conversationTitle.value.trim()) || "";
      const title = (!currentConversationId && typedTitle) ? typedTitle : getDefaultConversationTitle();
      const conv = await fetchJson(`${API}/conversations`, {
        method: "POST",
        body: JSON.stringify({
          title: title,
          model_id: model,
          provider: provider,
          system_instructions: rules.length ? rules : null,
        }),
      });
      await setCurrentConversation(conv);
    } catch (e) {
      showError("Error al crear conversación: " + e.message);
    }
  }

  async function commitConversationTitle() {
    if (!el.conversationTitle) return;
    const title = el.conversationTitle.value.trim() || getDefaultConversationTitle();
    if (el.conversationTitle.value !== title) el.conversationTitle.value = title;
    if (!currentConversationId) return;
    try {
      await fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({ title }),
      });
      loadConversations();
    } catch (e) {
      showError("Error al guardar el título: " + e.message);
    }
  }

  async function saveConversation() {
    if (!currentConversationId) {
      showError("Crea o abre una conversación antes de guardar.");
      return;
    }
    try {
      const conv = await fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: (el.conversationTitle && el.conversationTitle.value.trim()) || getDefaultConversationTitle(),
          model_id: (el.modelSelect && el.modelSelect.value) || "",
          provider: (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama",
          system_instructions: rules,
          model_params: buildModelParams(),
          history_turns: (function () {
            const v = el.historyTurnsInput ? parseInt(el.historyTurnsInput.value, 10) : 5;
            return (Number.isFinite(v) && v >= 0 && v <= 100) ? v : 5;
          })(),
          instruction_override: (el.instructionOverride && el.instructionOverride.value.trim()) || null,
        }),
      });
      await setCurrentConversation(conv);
    } catch (e) {
      showError("Error al guardar: " + e.message);
    }
  }

  async function deleteMessageFromHistory(conversationId, messageId) {
    try {
      const res = await fetch(`${API}/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      const deleted = allMessages.find((m) => m.id === messageId);
      allMessages.forEach((m) => {
        if (m.parent_id === messageId) m.parent_id = deleted ? deleted.parent_id : null;
      });
      allMessages = allMessages.filter((m) => m.id !== messageId);
      if (activeLeafId === messageId) activeLeafId = deleted ? deleted.parent_id : null;
      syncVisibleMessages();
      renderMessages();
      loadConversations();
      showNotice("Mensaje eliminado del historial.");
    } catch (e) {
      showError("Error al eliminar: " + e.message);
    }
  }

  function copyMessageToClipboard(content) {
    navigator.clipboard.writeText(content).then(
      () => showNotice("Copiado al portapapeles."),
      () => showError("No se pudo copiar.")
    );
  }

  function isShowDebugMode() {
    const el = document.getElementById("show-debug-mode");
    return el && el.checked;
  }

  /** Devuelve si el usuario quiere scroll automático al final mientras se genera la respuesta. Por defecto true. */
  function isAutoScrollDuringGeneration() {
    return !el.autoScrollDuringGenerationCheck || el.autoScrollDuringGenerationCheck.checked;
  }

  /** Hace scroll al final del panel de mensajes solo si la opción "Auto-scroll al generar" está activa. */
  function scrollToBottomIfEnabled() {
    if (isAutoScrollDuringGeneration() && el.messagesContainer) {
      el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
    }
  }

  function renderMessages() {
    if (!el.messagesContainer) return;
    if (messages.length === 0) {
      el.messagesContainer.innerHTML = '<div class="empty-state chat-empty-state"><div class="empty-state-inner"><img src="/static/img/logo_256.png" alt="" class="empty-state-logo" /><p class="empty-state-text">Empieza escribiendo una orden. El agente mantendrá el contexto técnico y el tono estable.</p></div></div>';
      return;
    }
    const showDebug = isShowDebugMode();
    el.messagesContainer.innerHTML = messages
      .map(
        (m, idx) => {
          const hasContent = m.content && m.content.trim();
          const isEphemeralDebug = !!m.ephemeral_debug;
          const toInputBtn = hasContent && !isEphemeralDebug
            ? `<button type="button" class="msg-action-btn msg-to-input-btn" data-msg-index="${idx}" title="Enviar texto al cuadro de mensaje">${msgToInputIconSvg}</button>`
            : "";
          const isInherited = !!m.inherited;
          const deleteCopyBtns = m.id && !isEphemeralDebug
            ? `${isInherited ? "" : `<button type="button" class="msg-action-btn msg-delete-btn" data-msg-id="${escapeHtml(m.id)}" title="Eliminar del historial">${msgDeleteIconSvg}</button>`}
                <button type="button" class="msg-action-btn msg-copy-btn" data-msg-id="${escapeHtml(m.id)}" title="Copiar">${msgCopyIconSvg}</button>`
            : "";
          const illustrating = m.id && illustratingMessageIds.has(m.id);
          const illustrateBtn =
            !isInherited && !isEphemeralDebug && m.role === "assistant" && m.id && hasContent
              ? `<button type="button" class="msg-action-btn msg-illustrate-btn${illustrating ? " is-busy" : ""}" data-msg-id="${escapeHtml(m.id)}" title="Generar imágenes para esta respuesta" aria-label="Generar imágenes" ${illustrating ? "disabled" : ""}>${msgIllustrateIconSvg}</button>`
              : "";
          const readBtn =
            !isEphemeralDebug && m.role === "assistant" && hasContent
              ? `<button type="button" class="msg-action-btn msg-read-btn" data-msg-index="${idx}" title="Modo lectura a pantalla completa" aria-label="Modo lectura">${msgReadIconSvg}</button>`
              : "";
          const illustrationItems =
            !isInherited && m.role === "assistant" && hasContent
              ? `<button type="button" class="msg-context-item" role="menuitem" data-action="clear-photos" data-msg-id="${escapeHtml(m.id)}">Borrar todas las fotos</button>
                    <button type="button" class="msg-context-item" role="menuitem" data-action="prune-orphans" data-msg-id="${escapeHtml(m.id)}">Eliminar anclas huérfanas</button>
                    <button type="button" class="msg-context-item" role="menuitem" data-action="generate-remaining" data-msg-id="${escapeHtml(m.id)}">Generar imágenes restantes</button>`
              : "";
          const moreMenu =
            !isEphemeralDebug && m.id
              ? `<div class="msg-more-wrap">
                  <button type="button" class="msg-action-btn msg-more-btn" data-msg-id="${escapeHtml(m.id)}" title="Más acciones" aria-label="Más acciones" aria-haspopup="menu" aria-expanded="false">${msgMoreIconSvg}</button>
                  <div class="msg-context-menu" role="menu" hidden>
                    <button type="button" class="msg-context-item" role="menuitem" data-action="fork-conversation" data-msg-id="${escapeHtml(m.id)}">Nueva conversación desde aquí</button>
                    ${illustrationItems}
                  </div>
                </div>`
              : "";
          const footerBtns = (toInputBtn || deleteCopyBtns || illustrateBtn || readBtn || moreMenu)
            ? `<div class="message-footer"><div class="message-footer-actions">${toInputBtn}${deleteCopyBtns}${illustrateBtn}${readBtn}${moreMenu}</div></div>`
            : "";
          let debugHtml = "";
          if (showDebug && m.role === "assistant" && (m.debug_request || m.debug_response)) {
            if (m.debug_request) {
              debugHtml += `<div class="message-debug-block"><div class="debug-label-text">Request al LLM:</div>${escapeHtml(m.debug_request)}</div>`;
            }
            if (m.debug_response) {
              debugHtml += `<div class="message-debug-block"><div class="debug-label-text">Response metadata:</div>${escapeHtml(m.debug_response)}</div>`;
            }
          }
          const isUser = m.role === "user";
          const rowClass = `${isUser ? "message-row user-row" : "message-row"}${isInherited ? " message-row-inherited" : ""}`;
          const inheritedSplit = isInherited && (!messages[idx + 1] || messages[idx + 1].inherited !== true)
            ? `<div class="message-inherited-split">Historial de la conversación original</div>`
            : "";
          const bubbleClass = isUser ? "message-bubble user" : "message-bubble assistant";
          const collapseKey = messageCollapseKey(m, idx);
          let bodyHtml;
          if (!isUser && !isEphemeralDebug && hasContent) {
            bodyHtml = buildCollapsibleMessageHtml(
              m.content || "",
              collapseKey,
              expandedMessageKeys.has(collapseKey)
            );
          } else {
            bodyHtml = `<div class="message-content">${formatMessageHtml(m.content || "")}</div>`;
          }
          return `<div class="${rowClass}" data-msg-id="${m.id ? escapeHtml(m.id) : ""}">
            <div style="max-width: ${isUser ? "70%" : "100%"}; flex: 1; min-width: 0;">
              <div class="${bubbleClass}">${bodyHtml}</div>
              ${debugHtml}
              ${footerBtns}
            </div>
          </div>${inheritedSplit}`;
        }
      )
      .join("");
    el.messagesContainer.querySelectorAll(".msg-collapse-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const wrap = btn.closest(".message-body-collapsible");
        if (!wrap) return;
        const key = wrap.getAttribute("data-collapse-key");
        if (!key) return;
        const willExpand = wrap.classList.contains("is-collapsed");
        if (willExpand) {
          expandedMessageKeys.add(key);
          wrap.classList.remove("is-collapsed");
          btn.setAttribute("aria-expanded", "true");
          btn.textContent = "Show less";
          kickLazyIllustrations(wrap);
        } else {
          expandedMessageKeys.delete(key);
          wrap.classList.add("is-collapsed");
          btn.setAttribute("aria-expanded", "false");
          btn.textContent = "Show more";
        }
      });
    });
    el.messagesContainer.querySelectorAll(".msg-to-input-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const msgId = btn.dataset.msgId;
        const msgIndex = btn.dataset.msgIndex != null ? parseInt(btn.dataset.msgIndex, 10) : -1;
        const msg = msgId ? messages.find((m) => m.id === msgId) : msgIndex >= 0 ? messages[msgIndex] : null;
        if (msg && msg.content && el.messageInput) {
          el.messageInput.value = msg.content;
          el.messageInput.focus();
          showNotice("Texto del mensaje copiado al cuadro de mensaje.");
        }
      });
    });
    el.messagesContainer.querySelectorAll(".msg-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const msgId = btn.dataset.msgId;
        if (msgId && currentConversationId) deleteMessageFromHistory(currentConversationId, msgId);
      });
    });
    el.messagesContainer.querySelectorAll(".msg-copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const msgId = btn.dataset.msgId;
        const msg = msgId ? messages.find((m) => m.id === msgId) : null;
        if (msg && msg.content) copyMessageToClipboard(msg.content);
      });
    });
    el.messagesContainer.querySelectorAll(".msg-illustrate-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const msgId = btn.dataset.msgId;
        if (msgId) maybeIllustrateAssistantMessage(msgId, { force: true });
      });
    });
    el.messagesContainer.querySelectorAll(".msg-read-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const msgIndex = btn.dataset.msgIndex != null ? parseInt(btn.dataset.msgIndex, 10) : -1;
        if (msgIndex >= 0) openReadingMode(msgIndex);
      });
    });
    bindMessageContextMenus();
    enhanceIllustrationFrames(el.messagesContainer);
    scrollToBottomIfEnabled();
  }

  function closeAllMessageContextMenus() {
    if (!el.messagesContainer) return;
    el.messagesContainer.querySelectorAll(".msg-context-menu").forEach((menu) => {
      menu.hidden = true;
    });
    el.messagesContainer.querySelectorAll(".msg-more-btn").forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function bindMessageContextMenus() {
    if (!el.messagesContainer) return;
    el.messagesContainer.querySelectorAll(".msg-more-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wrap = btn.closest(".msg-more-wrap");
        const menu = wrap && wrap.querySelector(".msg-context-menu");
        if (!menu) return;
        const willOpen = menu.hidden;
        closeAllMessageContextMenus();
        if (willOpen) {
          menu.hidden = false;
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });
    el.messagesContainer.querySelectorAll(".msg-context-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const action = item.getAttribute("data-action");
        const msgId = item.getAttribute("data-msg-id");
        closeAllMessageContextMenus();
        if (!action || !msgId) return;
        if (action === "fork-conversation") {
          forkConversationFromMessage(msgId);
          return;
        }
        if (action === "generate-remaining") {
          generateRemainingImages(msgId);
          return;
        }
        runMessageIllustrationAction(action, msgId);
      });
    });
  }

  async function runMessageIllustrationAction(action, messageId) {
    if (!currentConversationId || !messageId) return;
    const path =
      action === "clear-photos"
        ? "clear-photos"
        : action === "prune-orphans"
          ? "prune-orphans"
          : null;
    if (!path) return;
    try {
      const data = await fetchJson(
        `${API}/conversations/${currentConversationId}/messages/${messageId}/illustrations/${path}`,
        { method: "POST" }
      );
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx >= 0 && data && data.content != null) {
        updateStoredMessageContent(messageId, data.content);
        renderMessages();
      }
      if (action === "clear-photos") {
        const n = (data && data.deleted_files) || 0;
        showNotice(
          n
            ? `Fotos borradas (${n} archivo${n === 1 ? "" : "s"}).`
            : "No había fotos que borrar."
        );
      } else {
        showNotice("Anclas huérfanas eliminadas.");
      }
    } catch (err) {
      showError(
        (action === "clear-photos" ? "Error al borrar fotos: " : "Error al limpiar anclas: ") +
          err.message
      );
    }
  }

  async function sendMessage() {
    if (currentAbortController) return;
    const content = (el.messageInput && el.messageInput.value.trim()) || "";
    if (!content) return;
    const instructionOverride = (el.instructionOverride && el.instructionOverride.value.trim()) || null;

    if (!currentConversationId) {
      await newConversation();
      if (!currentConversationId) return;
    }

    const parentId = (activeLeafId
      && !String(activeLeafId).startsWith("tmp-")
      && allMessages.some((m) => m.id === activeLeafId && !m.inherited))
      ? activeLeafId
      : null;
    const tempUserId = "tmp-" + Date.now();
    let resolvedUserId = tempUserId;
    allMessages.push({ role: "user", content, id: tempUserId, parent_id: parentId });
    activeLeafId = tempUserId;
    syncVisibleMessages();
    if (el.messageInput) el.messageInput.value = "";
    // La instrucción solo para este mensaje se mantiene hasta que el usuario la borre.
    renderMessages();

    const msgEl = document.createElement("div");
    msgEl.className = "message-row";
    const showDebug = isShowDebugMode();
    msgEl.innerHTML = '<div style="max-width: 100%; flex: 1; min-width: 0;"><div class="message-bubble assistant"><span class="content"></span></div><div class="message-debug-stream"></div></div>';
    if (el.messagesContainer) el.messagesContainer.appendChild(msgEl);
    const contentEl = msgEl.querySelector(".content");
    const debugStreamEl = msgEl.querySelector(".message-debug-stream");
    debugStreamEl.style.display = showDebug ? "block" : "none";
    currentStreamingMsgEl = msgEl;
    currentStreamingDebugEl = debugStreamEl;
    scrollToBottomIfEnabled();

    let analyzingDotsInterval = null;
    let analyzingDotsCount = 0;
    contentEl.textContent = "Analizando";
    analyzingDotsInterval = setInterval(function () {
      analyzingDotsCount = (analyzingDotsCount + 1) % 4;
      contentEl.textContent = "Analizando" + ".".repeat(analyzingDotsCount);
    }, 400);

    function clearAnalyzingDots() {
      if (analyzingDotsInterval) {
        clearInterval(analyzingDotsInterval);
        analyzingDotsInterval = null;
      }
    }

    const chatStatusId = appStatus.push("chat", "chat.preparing");
    currentAbortController = new AbortController();
    setComposerPrimaryActionState();
    try {
      appStatus.update(chatStatusId, "chat.sending");
      const systemInstructionGlobal = getRulesTextForSystem();
      const saveToChromadb = (el.saveToChromadbSelect && el.saveToChromadbSelect.value) ? el.saveToChromadbSelect.value : "user";
      const modelParams = buildModelParams();
      const bodyPayload = {
        content,
        instruction_override: instructionOverride,
        system_instruction_global: systemInstructionGlobal,
        save_to_chromadb: saveToChromadb,
      };
      if (parentId) bodyPayload.parent_message_id = parentId;
      if (Object.keys(modelParams).length > 0) bodyPayload.model_params = modelParams;
      const res = await fetch(`${API}/conversations/${currentConversationId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: currentAbortController.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      appStatus.update(chatStatusId, "chat.awaiting_response");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let debugRequest = null;
      const debugMetaLines = []; // Solo metadata (sin los chunks de content)
      let receivedFirstToken = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            // Solo guardar en debug las líneas que NO son chunks de contenido
            const isContentChunk = data.content !== undefined && Object.keys(data).length === 1;
            if (!isContentChunk) {
              debugMetaLines.push(line);
              if (debugStreamEl) {
                debugStreamEl.innerHTML = `<div class="message-debug-block"><div class="debug-label-text">Request al LLM:</div>${debugRequest ? escapeHtml(debugRequest) : "(cargando...)"}</div><div class="message-debug-block"><div class="debug-label-text">Response metadata:</div>${escapeHtml(debugMetaLines.join("\n"))}</div>`;
              }
            }
            if (data.debug_request) {
              debugRequest = data.debug_request;
              if (debugStreamEl) {
                debugStreamEl.innerHTML = `<div class="message-debug-block"><div class="debug-label-text">Request al LLM:</div>${escapeHtml(debugRequest)}</div><div class="message-debug-block"><div class="debug-label-text">Response metadata:</div>${escapeHtml(debugMetaLines.join("\n"))}</div>`;
              }
            }
            if (data.mcp_contexts) {
              appStatus.update(chatStatusId, "chat.receiving_context");
            }
            if (data.error) {
              clearAnalyzingDots();
              fullContent += `[Error: ${data.error}]`;
              contentEl.innerHTML = escapeHtml(fullContent).replace(/\n/g, "<br>");
              appStatus.update(chatStatusId, "chat.error");
            }
            if (data.user_message_id) {
              allMessages.forEach((m) => {
                if (m.id === resolvedUserId) m.id = data.user_message_id;
              });
              messages.forEach((m) => {
                if (m.id === resolvedUserId) m.id = data.user_message_id;
              });
              resolvedUserId = data.user_message_id;
              activeLeafId = data.user_message_id;
            }
            if (data.content !== undefined) {
              clearAnalyzingDots();
              if (!receivedFirstToken) {
                receivedFirstToken = true;
                appStatus.update(chatStatusId, "chat.streaming");
              }
              fullContent += data.content;
              contentEl.innerHTML = escapeHtml(fullContent).replace(/\n/g, "<br>");
              scrollToBottomIfEnabled();
            }
            if (data.stream_metadata && data.stream_metadata.usage) {
              lastUsage = {
                prompt_tokens: data.stream_metadata.usage.prompt_tokens ?? 0,
                completion_tokens: data.stream_metadata.usage.completion_tokens ?? 0,
              };
              renderContextUsageBar();
            }
            if (data.done) {
              clearAnalyzingDots();
              appStatus.update(chatStatusId, "chat.finalizing");
              currentStreamingMsgEl = null;
              currentStreamingDebugEl = null;
              msgEl.remove();
              const assistantMsg = {
                role: "assistant",
                content: fullContent,
                id: data.id || null,
                parent_id: resolvedUserId,
                debug_request: debugRequest || null,
                debug_response: debugMetaLines.length > 0 ? debugMetaLines.join("\n") : null,
              };
              allMessages.push(assistantMsg);
              if (assistantMsg.id) activeLeafId = assistantMsg.id;
              syncVisibleMessages();
              renderMessages();
              loadConversations();
              if (assistantMsg.id) {
                maybeIllustrateAssistantMessage(assistantMsg.id);
              }
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      clearAnalyzingDots();
      currentStreamingMsgEl = null;
      currentStreamingDebugEl = null;
      currentAbortController = null;
      setComposerPrimaryActionState();
      appStatus.pop(chatStatusId);
    } catch (e) {
      clearAnalyzingDots();
      currentStreamingMsgEl = null;
      currentStreamingDebugEl = null;
      if (e.name === "AbortError") {
        appStatus.update(chatStatusId, "chat.cancelled");
        allMessages = allMessages.filter((m) => m.id !== tempUserId && m.id !== resolvedUserId);
        activeLeafId = parentId || null;
        syncVisibleMessages();
        messages.push({ role: "assistant", content: "Cancelado", ephemeral_debug: true });
        renderMessages();
        if (currentConversationId) {
          fetch(`${API}/conversations/${currentConversationId}/messages/last`, { method: "DELETE" }).catch(() => {});
        }
        showNotice("Mensaje anulado.");
      } else {
        appStatus.update(chatStatusId, "chat.error");
        allMessages = allMessages.filter((m) => m.id !== tempUserId && m.id !== resolvedUserId);
        activeLeafId = parentId || null;
        syncVisibleMessages();
        messages.push({ role: "assistant", content: "Error al enviar: " + e.message, ephemeral_debug: true });
        renderMessages();
        showError("Error al enviar: " + e.message);
      }
      currentAbortController = null;
      setComposerPrimaryActionState();
      appStatus.pop(chatStatusId);
    }
  }

  function cancelLastMessage() {
    if (!currentAbortController) return;
    currentAbortController.abort();
  }

  function onComposerPrimaryClick() {
    if (currentAbortController) {
      cancelLastMessage();
      return;
    }
    sendMessage();
  }

  async function clearMemory() {
    if (currentAbortController) currentAbortController.abort();
    try {
      const data = await fetchJson(`${API}/ollama/clear-memory`, { method: "POST" });
      const n = (data && data.unloaded && data.unloaded.length) || 0;
      showNotice(n ? `Memoria limpiada: ${n} modelo(s) descargado(s) de VRAM/RAM.` : "No había modelos cargados en memoria.");
    } catch (e) {
      showError("Error al limpiar memoria: " + e.message);
    }
  }

  async function clearCurrentConversation() {
    if (currentAbortController) currentAbortController.abort();
    if (currentConversationId) {
      await deleteConversation(currentConversationId);
    } else {
      await setCurrentConversation(null);
    }
  }

  async function onModelChange() {
    const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama";
    let ollamaActive = false;
    if (provider === "ollama") {
      try {
        await fetchJson(`${API}/providers/ollama/validate`);
        ollamaActive = true;
      } catch (_) {
        // Ollama no está activo: no llamar a clear-memory
      }
    }
    if (ollamaActive) {
      try {
        await fetchJson(`${API}/ollama/clear-memory`, { method: "POST" });
      } catch (e) {
        showError("Error al limpiar memoria de Ollama: " + (e.message || "desconocido"));
        return;
      }
    }
    if (currentConversationId) {
      fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({
          model_id: (el.modelSelect && el.modelSelect.value) || "",
          model_params: buildModelParams(),
        }),
      }).catch(() => {});
    }
    lastUsage = null;
    await loadContextLength();
    await ensureParamsBaselineForCurrentModel();
    renderParamsToSend();
    syncHeaderProviderModel();
  }

  function setComposerPrimaryActionState() {
    if (!el.btnSend) return;
    const stopping = Boolean(currentAbortController);
    el.btnSend.classList.toggle("is-stop", stopping);
    el.btnSend.dataset.composerAction = stopping ? "stop" : "send";
    el.btnSend.title = stopping ? "Detener" : "Enviar";
    el.btnSend.setAttribute("aria-label", stopping ? "Detener respuesta" : "Enviar mensaje");
  }

  setComposerPrimaryActionState();

  if (el.btnNewChat) el.btnNewChat.addEventListener("click", newConversation);
  if (el.btnSave) el.btnSave.addEventListener("click", saveConversation);
  if (el.conversationTitle) {
    el.conversationTitle.addEventListener("change", commitConversationTitle);
    el.conversationTitle.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        el.conversationTitle.blur();
      }
    });
  }
  if (el.btnSend) el.btnSend.addEventListener("click", onComposerPrimaryClick);
  function onShowDebugModeChange(checked) {
    if (currentAbortController && currentStreamingDebugEl) {
      currentStreamingDebugEl.style.display = checked ? "block" : "none";
    }
    renderMessages();
  }
  var debugCheckbox = document.getElementById("show-debug-mode");
  if (debugCheckbox) {
    debugCheckbox.addEventListener("change", function () {
      onShowDebugModeChange(this.checked);
    });
  }
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "show-debug-mode") {
      onShowDebugModeChange(e.target.checked);
    }
  });
  if (el.btnFontSizeDecrease) {
    el.btnFontSizeDecrease.addEventListener("click", function () {
      if (!this.disabled) setConversationFontSize(-0.05);
    });
  }
  if (el.btnFontSizeIncrease) {
    el.btnFontSizeIncrease.addEventListener("click", function () {
      if (!this.disabled) setConversationFontSize(0.05);
    });
  }
  if (el.btnCollapseAllMessages) {
    el.btnCollapseAllMessages.addEventListener("click", function () {
      collapseAllMessages();
    });
  }
  const AUTO_SCROLL_STORAGE_KEY = "autoScrollDuringGeneration";
  function initAutoScrollDuringGeneration() {
    if (!el.autoScrollDuringGenerationCheck) return;
    try {
      const stored = localStorage.getItem(AUTO_SCROLL_STORAGE_KEY);
      el.autoScrollDuringGenerationCheck.checked = stored !== "false";
    } catch (_) {
      el.autoScrollDuringGenerationCheck.checked = true;
    }
  }
  initAutoScrollDuringGeneration();
  if (el.autoScrollDuringGenerationCheck) el.autoScrollDuringGenerationCheck.addEventListener("change", function () {
    try {
      localStorage.setItem(AUTO_SCROLL_STORAGE_KEY, el.autoScrollDuringGenerationCheck.checked ? "true" : "false");
    } catch (_) {}
  });
  if (el.btnClearMemory) el.btnClearMemory.addEventListener("click", clearCurrentConversation);
  const onResetParams = async function () {
    await resetParamsToDefaults();
    renderParamsSourceLabel();
    if (currentConversationId) {
      fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({ model_params: buildModelParams() }),
      }).catch(() => {});
    }
  };
  if (el.btnResetParams) el.btnResetParams.addEventListener("click", onResetParams);
  if (el.btnResetParamsFooter) el.btnResetParamsFooter.addEventListener("click", onResetParams);
  document.querySelectorAll("[data-control-id]").forEach(function (control) {
    control.addEventListener("change", debouncedSaveParams);
    control.addEventListener("input", debouncedSaveParams);
  });
  let libraryRules = [];
  let plannerLibraryRules = [];

  function fillLibrarySelect(selectEl, items) {
    if (!selectEl) return;
    const selected = selectEl.value;
    const list = Array.isArray(items) ? items : [];
    selectEl.innerHTML = "<option value=\"\">-- Elegir regla --</option>" +
      list.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml((r.title || "").trim() || "Sin título")}</option>`).join("");
    if (selected && list.some((r) => r.id === selected)) {
      selectEl.value = selected;
    } else {
      selectEl.value = "";
    }
  }

  function prependLibraryOption(selectEl, rule) {
    if (!selectEl || !rule) return;
    const opt = document.createElement("option");
    opt.value = rule.id;
    opt.textContent = (rule.title || "").trim() || "Sin título";
    selectEl.insertBefore(opt, selectEl.options[1] || null);
  }

  async function loadLibraryRules() {
    try {
      libraryRules = await fetchJson(`${API}/rules?scope=chat`);
      if (!Array.isArray(libraryRules)) libraryRules = [];
    } catch (_) {
      libraryRules = [];
    }
    fillLibrarySelect(el.ruleLibrarySelect, libraryRules);
  }

  async function loadPlannerLibraryRules() {
    try {
      plannerLibraryRules = await fetchJson(`${API}/rules?scope=planner`);
      if (!Array.isArray(plannerLibraryRules)) plannerLibraryRules = [];
    } catch (_) {
      plannerLibraryRules = [];
    }
    fillLibrarySelect(el.plannerRuleLibrarySelect, plannerLibraryRules);
  }

  function getEditRuleList() {
    return ruleEditKind === "planner" ? plannerRules : rules;
  }

  function afterActiveRuleListChanged(forceImmediate) {
    if (ruleEditKind === "planner") {
      renderPlannerRules();
      persistImagesPanel();
      return;
    }
    renderRules();
    if (forceImmediate) {
      if (saveRulesDebounceTimer) {
        clearTimeout(saveRulesDebounceTimer);
        saveRulesDebounceTimer = null;
      }
      saveRulesToConversation();
    } else {
      debouncedSaveRules();
    }
  }

  if (el.ruleLibrarySelect) {
    el.ruleLibrarySelect.addEventListener("focus", function () {
      loadLibraryRules();
    });
  }
  if (el.plannerRuleLibrarySelect) {
    el.plannerRuleLibrarySelect.addEventListener("focus", function () {
      loadPlannerLibraryRules();
    });
  }

  if (el.btnAddRule && el.ruleNewInput) {
    el.btnAddRule.addEventListener("click", async function () {
      const content = (el.ruleNewInput.value || "").trim();
      const title = (el.ruleNewTitle && el.ruleNewTitle.value ? el.ruleNewTitle.value.trim() : "") || "Regla " + (rules.length + 1);
      if (!content) return;
      try {
        const newRule = await fetchJson(`${API}/rules`, {
          method: "POST",
          body: JSON.stringify({ title: title || "Regla " + (rules.length + 1), content: content, scope: "chat" }),
        });
        rules.push({ rule_id: newRule.id, title: newRule.title || "", content: newRule.content || "" });
        libraryRules.unshift(newRule);
        prependLibraryOption(el.ruleLibrarySelect, newRule);
      } catch (_) {
        showError("Error al crear la regla en la biblioteca");
        return;
      }
      if (el.ruleNewTitle) el.ruleNewTitle.value = "";
      el.ruleNewInput.value = "";
      renderRules();
      debouncedSaveRules();
    });
  }
  if (el.btnAddPlannerRule && el.plannerRuleNewInput) {
    el.btnAddPlannerRule.addEventListener("click", async function () {
      const content = (el.plannerRuleNewInput.value || "").trim();
      const title = (el.plannerRuleNewTitle && el.plannerRuleNewTitle.value ? el.plannerRuleNewTitle.value.trim() : "") || "Regla " + (plannerRules.length + 1);
      if (!content) return;
      try {
        const newRule = await fetchJson(`${API}/rules`, {
          method: "POST",
          body: JSON.stringify({ title: title || "Regla " + (plannerRules.length + 1), content: content, scope: "planner" }),
        });
        plannerRules.push({ rule_id: newRule.id, title: newRule.title || "", content: newRule.content || "" });
        plannerLibraryRules.unshift(newRule);
        prependLibraryOption(el.plannerRuleLibrarySelect, newRule);
      } catch (_) {
        showError("Error al crear la regla del planificador");
        return;
      }
      if (el.plannerRuleNewTitle) el.plannerRuleNewTitle.value = "";
      el.plannerRuleNewInput.value = "";
      renderPlannerRules();
      persistImagesPanel();
    });
  }
  if (el.btnAddLibraryRule && el.ruleLibrarySelect) {
    el.btnAddLibraryRule.addEventListener("click", async function () {
      const id = (el.ruleLibrarySelect.value || "").trim();
      if (!id) return;
      let rule = libraryRules.find((r) => r.id === id);
      if (!rule) {
        try {
          rule = await fetchJson(`${API}/rules/${id}`);
        } catch (_) {
          showError("Regla no encontrada");
          return;
        }
      }
      rules.push({ rule_id: rule.id, title: rule.title || "", content: rule.content || "" });
      renderRules();
      debouncedSaveRules();
    });
  }
  if (el.btnAddPlannerLibraryRule && el.plannerRuleLibrarySelect) {
    el.btnAddPlannerLibraryRule.addEventListener("click", async function () {
      const id = (el.plannerRuleLibrarySelect.value || "").trim();
      if (!id) return;
      let rule = plannerLibraryRules.find((r) => r.id === id);
      if (!rule) {
        try {
          rule = await fetchJson(`${API}/rules/${id}`);
        } catch (_) {
          showError("Regla no encontrada");
          return;
        }
      }
      plannerRules.push({ rule_id: rule.id, title: rule.title || "", content: rule.content || "" });
      renderPlannerRules();
      persistImagesPanel();
    });
  }
  if (el.ruleEditBtnDelete) {
    el.ruleEditBtnDelete.addEventListener("click", async function () {
      const list = getEditRuleList();
      if (ruleEditIndex < 0 || ruleEditIndex >= list.length) return;
      const r = list[ruleEditIndex];
      const ruleId = r && r.rule_id;
      if (ruleId) {
        try {
          await fetchJson(`${API}/rules/${ruleId}`, { method: "DELETE" });
        } catch (e) {
          showError("Error al eliminar la regla de la biblioteca: " + e.message);
          return;
        }
      }
      list.splice(ruleEditIndex, 1);
      afterActiveRuleListChanged(list.length === 0);
      closeRuleEditModal();
    });
  }
  if (el.ruleEditBtnSave) {
    el.ruleEditBtnSave.addEventListener("click", async function () {
      const list = getEditRuleList();
      if (ruleEditIndex < 0 || ruleEditIndex >= list.length) return;
      const title = (el.ruleEditTitle && el.ruleEditTitle.value ? el.ruleEditTitle.value.trim() : "") || "";
      const content = (el.ruleEditContent && el.ruleEditContent.value ? el.ruleEditContent.value : "") || "";
      const r = list[ruleEditIndex];
      if (r.rule_id) {
        try {
          await fetchJson(`${API}/rules/${r.rule_id}`, { method: "PUT", body: JSON.stringify({ title: title || r.title, content: content || r.content }) });
        } catch (_) {
          showError("Error al actualizar la regla");
          return;
        }
      }
      list[ruleEditIndex] = Object.assign({}, r, { title: title || r.title, content: content || r.content });
      if (r.rule_id) list[ruleEditIndex].rule_id = r.rule_id;
      afterActiveRuleListChanged(false);
      closeRuleEditModal();
    });
  }
  if (el.ruleEditBtnSaveNew) {
    el.ruleEditBtnSaveNew.addEventListener("click", async function () {
      const list = getEditRuleList();
      if (ruleEditIndex < 0 || ruleEditIndex >= list.length) return;
      const title = (el.ruleEditTitle && el.ruleEditTitle.value ? el.ruleEditTitle.value.trim() : "") || "";
      const content = (el.ruleEditContent && el.ruleEditContent.value ? el.ruleEditContent.value : "") || "";
      const scope = ruleEditKind === "planner" ? "planner" : "chat";
      try {
        const newRule = await fetchJson(`${API}/rules`, {
          method: "POST",
          body: JSON.stringify({ title: title || "Nueva regla", content: content || "", scope: scope }),
        });
        list.splice(ruleEditIndex, 1, { rule_id: newRule.id, title: newRule.title || "", content: newRule.content || "" });
        afterActiveRuleListChanged(false);
        if (ruleEditKind === "planner") {
          plannerLibraryRules.unshift(newRule);
          prependLibraryOption(el.plannerRuleLibrarySelect, newRule);
        } else {
          libraryRules.unshift(newRule);
          prependLibraryOption(el.ruleLibrarySelect, newRule);
        }
      } catch (_) {
        showError("Error al crear la regla");
        return;
      }
      closeRuleEditModal();
    });
  }
  if (el.ruleEditModal) {
    el.ruleEditModal.addEventListener("click", function (e) {
      if (e.target === el.ruleEditModal) closeRuleEditModal();
    });
  }
  if (el.btnModelInfo) el.btnModelInfo.addEventListener("click", openModelInfoModal);
  if (el.modelInfoModalClose) el.modelInfoModalClose.addEventListener("click", closeModelInfoModal);
  if (el.modelInfoModal) {
    el.modelInfoModal.addEventListener("click", (e) => {
      if (e.target === el.modelInfoModal) closeModelInfoModal();
    });
  }
  if (el.btnModelInfoSave) el.btnModelInfoSave.addEventListener("click", saveModelInfo);
  if (el.btnModelInfoRefresh) el.btnModelInfoRefresh.addEventListener("click", refreshModelInfoProvider);
  if (el.btnAddInstruction) {
    el.btnAddInstruction.addEventListener("click", () => {
      if (!el.modelInfoInstructionsList) return;
      const idx = el.modelInfoInstructionsList.querySelectorAll(".model-info-instruction-row").length;
      const row = document.createElement("div");
      row.className = "model-info-instruction-row";
      row.setAttribute("data-index", String(idx));
      row.innerHTML = `<input type="text" value="" data-instruction placeholder="Nueva instrucción" /><button type="button" class="btn-icon model-info-instruction-remove" title="Quitar">×</button>`;
      row.querySelector(".model-info-instruction-remove").addEventListener("click", () => row.remove());
      el.modelInfoInstructionsList.appendChild(row);
    });
  }
  if (el.modelInfoTagsInput) {
    el.modelInfoTagsInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = (el.modelInfoTagsInput.value || "").trim();
        if (v) addModelInfoTag(v);
      }
    });
    el.modelInfoTagsInput.addEventListener("input", () => showModelInfoTagsSuggestions(el.modelInfoTagsInput.value));
    el.modelInfoTagsInput.addEventListener("focus", () => loadAllTags().then(() => showModelInfoTagsSuggestions(el.modelInfoTagsInput.value)));
  }
  if (el.btnRefreshModels) el.btnRefreshModels.addEventListener("click", refreshModels);
  if (el.providerSelect) el.providerSelect.addEventListener("change", onProviderChange);
  if (el.modelSelect) el.modelSelect.addEventListener("change", onModelChange);
  let modelSelectListHideTimer = null;
  if (el.modelSelectInput && el.modelSelectList) {
    el.modelSelectInput.addEventListener("input", function () {
      if (modelSelectListHideTimer) clearTimeout(modelSelectListHideTimer);
      filterAndShowModelSelectList(el.modelSelectInput.value);
    });
    el.modelSelectInput.addEventListener("focus", function () {
      if (modelSelectListHideTimer) clearTimeout(modelSelectListHideTimer);
      // Al abrir el desplegable mostrar todas las opciones; si se filtra por el valor actual solo se ve una
      filterAndShowModelSelectList("");
    });
    el.modelSelectInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        el.modelSelectInput.blur();
        if (el.modelSelectList) el.modelSelectList.setAttribute("aria-hidden", "true");
        if (el.modelSelectInput) el.modelSelectInput.setAttribute("aria-expanded", "false");
        return;
      }
      const selectedText = el.modelSelect.selectedOptions[0] ? el.modelSelect.selectedOptions[0].text : "";
      const isPrintableKey = !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1;
      if (isPrintableKey && el.modelSelectInput.value === selectedText) {
        el.modelSelectInput.value = "";
      }
    });
    el.modelSelectInput.addEventListener("blur", function () {
      modelSelectListHideTimer = setTimeout(function () {
        modelSelectListHideTimer = null;
        if (el.modelSelectList) {
          el.modelSelectList.setAttribute("aria-hidden", "true");
          if (el.modelSelectInput) el.modelSelectInput.setAttribute("aria-expanded", "false");
        }
        refreshModelSelectUI();
      }, 200);
    });
  }
  if (el.historyTurnsInput) {
    el.historyTurnsInput.addEventListener("change", debouncedSaveHistoryTurns);
    el.historyTurnsInput.addEventListener("input", debouncedSaveHistoryTurns);
  }
  if (el.instructionOverride) {
    el.instructionOverride.addEventListener("input", debouncedSaveInstructionOverride);
    el.instructionOverride.addEventListener("blur", saveInstructionOverrideToConversation);
    window.addEventListener("beforeunload", function () {
      if (instructionOverrideDebounceTimer) {
        clearTimeout(instructionOverrideDebounceTimer);
        instructionOverrideDebounceTimer = null;
        saveInstructionOverrideToConversation();
      }
    });
  }
  if (el.messageInput) {
    el.messageInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  /** Ayuda de parámetros: JSON por control id y tooltip tras 2s de hover */
  let paramsHelpData = null;
  let paramHelpTimeout = null;
  const PARAM_HELP_DELAY_MS = 2000;

  async function loadParamsHelp() {
    try {
      const res = await fetch("/static/data/llm-params-help.json");
      if (res.ok) paramsHelpData = await res.json();
    } catch (_) {
      paramsHelpData = {};
    }
  }

  function buildParamHelpHtml(entry) {
    if (!entry || typeof entry !== "object") return "";
    const parts = [];
    if (entry.nombre) {
      parts.push(`<div class="help-block"><div class="help-title">${escapeHtml(entry.nombre)}</div></div>`);
    }
    if (entry.definicion) {
      parts.push(`<div class="help-block"><div class="help-label">Definición</div><div class="help-text">${escapeHtml(entry.definicion)}</div></div>`);
    }
    if (entry.rango) {
      parts.push(`<div class="help-block"><div class="help-label">Rango / defaults</div><div class="help-text">${escapeHtml(entry.rango)}</div></div>`);
    }
    if (entry.efecto) {
      parts.push(`<div class="help-block"><div class="help-label">Efecto</div><div class="help-text">${escapeHtml(entry.efecto)}</div></div>`);
    }
    if (entry.ejemplos) {
      parts.push(`<div class="help-block"><div class="help-label">Ejemplos</div><div class="help-text">${escapeHtml(entry.ejemplos)}</div></div>`);
    }
    if (entry.casos_recomendados) {
      parts.push(`<div class="help-block"><div class="help-label">Casos recomendados</div><div class="help-text">${escapeHtml(entry.casos_recomendados)}</div></div>`);
    }
    if (entry.riesgos) {
      parts.push(`<div class="help-block"><div class="help-label">Riesgos</div><div class="help-text">${escapeHtml(entry.riesgos)}</div></div>`);
    }
    if (entry.compatibilidad) {
      parts.push(`<div class="help-block"><div class="help-label">Compatibilidad (API)</div><div class="help-text">${escapeHtml(entry.compatibilidad)}</div></div>`);
    }
    return parts.length ? parts.join("") : "<div class=\"help-text\">Sin información.</div>";
  }

  function showParamHelpTooltip(controlEl, controlId) {
    const tooltip = document.getElementById("param-help-tooltip");
    if (!tooltip || !paramsHelpData) return;
    const entry = paramsHelpData[controlId];
    tooltip.innerHTML = buildParamHelpHtml(entry);
    const rect = controlEl.getBoundingClientRect();
    const padding = 8;
    let left = rect.right + padding;
    let top = rect.top;
    if (left + 320 > window.innerWidth) {
      left = rect.left - 320 - padding;
    }
    if (left < padding) left = padding;
    if (top + 400 > window.innerHeight) top = window.innerHeight - 400 - padding;
    if (top < padding) top = padding;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
    tooltip.classList.add("is-visible");
  }

  function hideParamHelpTooltip() {
    const tooltip = document.getElementById("param-help-tooltip");
    if (tooltip) tooltip.classList.remove("is-visible");
    if (paramHelpTimeout) {
      clearTimeout(paramHelpTimeout);
      paramHelpTimeout = null;
    }
  }

  function initParamHelpTooltip() {
    const tooltipEl = document.createElement("div");
    tooltipEl.id = "param-help-tooltip";
    tooltipEl.className = "param-help-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    tooltipEl.setAttribute("aria-live", "polite");
    document.body.appendChild(tooltipEl);

    document.querySelectorAll("[data-control-id]").forEach((el) => {
      el.addEventListener("mouseenter", function () {
        hideParamHelpTooltip();
        const controlId = this.getAttribute("data-control-id");
        if (!controlId) return;
        paramHelpTimeout = setTimeout(function () {
          paramHelpTimeout = null;
          showParamHelpTooltip(el, controlId);
        }, PARAM_HELP_DELAY_MS);
      });
      el.addEventListener("mouseleave", function () {
        hideParamHelpTooltip();
      });
    });
  }

  const ACCORDION_STORAGE_KEY = "chatbot_sidebar_accordion";
  const SIDEBAR_TAB_STORAGE_KEY = "chatbot_sidebar_tab";
  const SIDEBAR_MAIN_SECTION_IDS = ["reglas", "parametros", "imagenes"];
  const LAST_CONVERSATION_STORAGE_KEY = "chatbot_last_conversation_id";
  const FONT_SIZE_STORAGE_KEY = "chatbot_conversation_font_size_rem";
  const FONT_SIZE_DEFAULT = 0.8;
  const FONT_SIZE_MIN = 0.65;
  const FONT_SIZE_MAX = 1.3;
  const FONT_SIZE_STEP = 0.05;
  const IMAGE_SIZE_STORAGE_KEY = "chatbot_conversation_image_size";
  const IMAGE_SIZE_DEFAULT = 1;
  const IMAGE_SIZE_MIN = 0.4;
  const IMAGE_SIZE_MAX = 1;
  const IMAGE_SIZE_STEP = 0.1;
  const READING_WIDTH_STORAGE_KEY = "chatbot_reading_mode_width_px";
  const READING_WIDTH_DEFAULT_PX = 832; // ~52rem @ 16px
  const READING_WIDTH_MIN_PX = 320;
  const READING_WIDTH_SIDE_GUTTER_PX = 24;
  const READING_WIDTH_KEYBOARD_STEP_PX = 32;

  function getStoredFontSize() {
    try {
      const raw = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (raw == null) return FONT_SIZE_DEFAULT;
      const n = parseFloat(raw, 10);
      if (Number.isFinite(n)) return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, n));
    } catch (_) {}
    return FONT_SIZE_DEFAULT;
  }

  function setStoredFontSize(rem) {
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(rem));
    } catch (_) {}
  }

  function applyConversationFontSize(rem) {
    var wrap = document.querySelector(".chat-stream-wrap");
    if (wrap) wrap.style.setProperty("--chat-font-size", rem + "rem");
    var readingBody = document.getElementById("reading-mode-body");
    if (readingBody) readingBody.style.setProperty("--chat-font-size", rem + "rem");
  }

  function syncFontSizeButtons(rem) {
    const ids = [
      "btn-font-size-decrease",
      "btn-font-size-increase",
      "reading-font-decrease",
      "reading-font-increase",
    ];
    const decreaseIds = new Set(["btn-font-size-decrease", "reading-font-decrease"]);
    ids.forEach(function (id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = decreaseIds.has(id) ? rem <= FONT_SIZE_MIN : rem >= FONT_SIZE_MAX;
    });
  }

  function initConversationFontSize() {
    const rem = getStoredFontSize();
    applyConversationFontSize(rem);
    syncFontSizeButtons(rem);
  }

  /**
   * Mensajes (.message-row) que intersectan el viewport del stream,
   * aunque solo se vean parcialmente.
   */
  function getPartiallyVisibleMessageRows(container) {
    if (!container) return [];
    const rows = Array.from(container.querySelectorAll(".message-row"));
    if (!rows.length) return [];
    const cRect = container.getBoundingClientRect();
    return rows.filter((row) => {
      const r = row.getBoundingClientRect();
      return r.bottom > cRect.top + 0.5 && r.top < cRect.bottom - 0.5;
    });
  }

  /** Posición Y del elemento respecto al contenido scrolleable del contenedor. */
  function messageOffsetInContainer(container, messageEl) {
    const cRect = container.getBoundingClientRect();
    const mRect = messageEl.getBoundingClientRect();
    return mRect.top - cRect.top + container.scrollTop;
  }

  /** Alinea el top del mensaje con el top del panel de scroll. */
  function scrollMessageStartIntoView(container, messageEl) {
    if (!container || !messageEl) return;
    const top = messageOffsetInContainer(container, messageEl);
    container.scrollTop = Math.max(0, top);
    requestAnimationFrame(function () {
      const residual =
        messageEl.getBoundingClientRect().top - container.getBoundingClientRect().top;
      if (Math.abs(residual) > 0.5) container.scrollTop += residual;
    });
  }

  /** Alinea el bottom del mensaje con el bottom del panel de scroll. */
  function scrollMessageEndIntoView(container, messageEl) {
    if (!container || !messageEl) return;
    const top = messageOffsetInContainer(container, messageEl);
    const height = messageEl.getBoundingClientRect().height;
    container.scrollTop = Math.max(0, top + height - container.clientHeight);
    // Segunda pasada: en flex/overflow el primer scrollTop a veces se queda corto.
    requestAnimationFrame(function () {
      const residual =
        messageEl.getBoundingClientRect().bottom - container.getBoundingClientRect().bottom;
      if (Math.abs(residual) > 0.5) container.scrollTop += residual;
    });
  }

  function scrollToFirstVisibleMessageStart() {
    const container = el.messagesContainer;
    const visible = getPartiallyVisibleMessageRows(container);
    if (!visible.length) return;
    scrollMessageStartIntoView(container, visible[0]);
  }

  function scrollToLastVisibleMessageEnd() {
    const container = el.messagesContainer;
    const visible = getPartiallyVisibleMessageRows(container);
    if (!visible.length) return;
    scrollMessageEndIntoView(container, visible[visible.length - 1]);
  }

  /**
   * Rail flotante ↑/↓ a media altura: aparece al mover el ratón por el stream,
   * se oculta en idle salvo si el puntero está sobre el rail.
   */
  function initConversationScrollNav() {
    const wrap = document.querySelector(".chat-stream-wrap");
    const nav = document.getElementById("chat-scroll-nav");
    const btnUp = document.getElementById("btn-scroll-msg-up");
    const btnDown = document.getElementById("btn-scroll-msg-down");
    if (!wrap || !nav || !btnUp || !btnDown) return;

    const IDLE_HIDE_MS = 1200;
    let hideTimer = null;
    let pointerOverNav = false;

    function setVisible(visible) {
      nav.classList.toggle("is-visible", visible);
      nav.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    function clearHideTimer() {
      if (hideTimer != null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function scheduleHide() {
      clearHideTimer();
      hideTimer = setTimeout(function () {
        hideTimer = null;
        if (!pointerOverNav) setVisible(false);
      }, IDLE_HIDE_MS);
    }

    function revealFromActivity() {
      setVisible(true);
      if (!pointerOverNav) scheduleHide();
      else clearHideTimer();
    }

    wrap.addEventListener("mousemove", revealFromActivity);
    wrap.addEventListener("mouseleave", function () {
      pointerOverNav = false;
      clearHideTimer();
      setVisible(false);
    });

    nav.addEventListener("mouseenter", function () {
      pointerOverNav = true;
      clearHideTimer();
      setVisible(true);
    });
    nav.addEventListener("mouseleave", function () {
      pointerOverNav = false;
      scheduleHide();
    });

    btnUp.addEventListener("click", function (e) {
      e.preventDefault();
      scrollToFirstVisibleMessageStart();
      revealFromActivity();
    });
    btnDown.addEventListener("click", function (e) {
      e.preventDefault();
      scrollToLastVisibleMessageEnd();
      revealFromActivity();
    });
  }

  function setConversationFontSize(delta) {
    const current = getStoredFontSize();
    let next = Math.round((current + delta) / FONT_SIZE_STEP) * FONT_SIZE_STEP;
    next = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, next));
    next = Math.round(next * 100) / 100;
    setStoredFontSize(next);
    applyConversationFontSize(next);
    syncFontSizeButtons(next);
  }
  window.__chatBotFontSizeDelta = function (delta) {
    setConversationFontSize(delta);
  };

  function getStoredImageSize() {
    try {
      const raw = localStorage.getItem(IMAGE_SIZE_STORAGE_KEY);
      if (raw == null) return IMAGE_SIZE_DEFAULT;
      const n = parseFloat(raw, 10);
      if (Number.isFinite(n)) return Math.max(IMAGE_SIZE_MIN, Math.min(IMAGE_SIZE_MAX, n));
    } catch (_) {}
    return IMAGE_SIZE_DEFAULT;
  }

  function setStoredImageSize(factor) {
    try {
      localStorage.setItem(IMAGE_SIZE_STORAGE_KEY, String(factor));
    } catch (_) {}
  }

  function applyConversationImageSize(factor) {
    const pct = Math.round(factor * 100) + "%";
    document.documentElement.style.setProperty("--chat-image-max-width", pct);
    const reading = document.getElementById("reading-mode");
    if (reading) reading.style.setProperty("--chat-image-max-width", pct);
    const wrap = document.querySelector(".chat-stream-wrap");
    if (wrap) wrap.style.setProperty("--chat-image-max-width", pct);
  }

  function syncImageSizeButtons(factor) {
    const dec = document.getElementById("reading-image-decrease");
    const inc = document.getElementById("reading-image-increase");
    if (dec) dec.disabled = factor <= IMAGE_SIZE_MIN;
    if (inc) inc.disabled = factor >= IMAGE_SIZE_MAX;
  }

  function initConversationImageSize() {
    const factor = getStoredImageSize();
    applyConversationImageSize(factor);
    syncImageSizeButtons(factor);
  }

  function setConversationImageSize(delta) {
    const current = getStoredImageSize();
    let next = Math.round((current + delta) / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP;
    next = Math.max(IMAGE_SIZE_MIN, Math.min(IMAGE_SIZE_MAX, next));
    next = Math.round(next * 100) / 100;
    setStoredImageSize(next);
    applyConversationImageSize(next);
    syncImageSizeButtons(next);
  }

  function isReadingModeOpen() {
    const overlay = document.getElementById("reading-mode");
    return !!(overlay && !overlay.hidden);
  }

  /** Ancho máximo del panel centrado (deja margen para ver/arrastrar bordes). */
  function getReadingPanelMaxWidthPx() {
    return Math.max(READING_WIDTH_MIN_PX, window.innerWidth - READING_WIDTH_SIDE_GUTTER_PX * 2);
  }

  /**
   * Ancho simétrico al arrastrar un borde: el panel está centrado, así que
   * cada px de movimiento del asa implica 2px de cambio de ancho total.
   */
  function computeSymmetricReadingWidth(startWidthPx, startX, clientX, edge) {
    const delta = edge === "right" ? clientX - startX : startX - clientX;
    return startWidthPx + delta * 2;
  }

  function clampReadingPanelWidthPx(px) {
    const n = Number(px);
    if (!Number.isFinite(n)) return READING_WIDTH_DEFAULT_PX;
    return Math.max(READING_WIDTH_MIN_PX, Math.min(getReadingPanelMaxWidthPx(), Math.round(n)));
  }

  function getStoredReadingPanelWidthPx() {
    try {
      const raw = localStorage.getItem(READING_WIDTH_STORAGE_KEY);
      if (raw == null) return READING_WIDTH_DEFAULT_PX;
      return clampReadingPanelWidthPx(raw);
    } catch (_) {
      return READING_WIDTH_DEFAULT_PX;
    }
  }

  function saveReadingPanelWidthPx(px) {
    try {
      localStorage.setItem(READING_WIDTH_STORAGE_KEY, String(clampReadingPanelWidthPx(px)));
    } catch (_) {}
  }

  function applyReadingPanelWidth(px) {
    const panel = document.getElementById("reading-mode-panel");
    if (!panel) return;
    const width = clampReadingPanelWidthPx(px);
    panel.style.setProperty("--reading-panel-width", width + "px");
    panel.style.width = width + "px";
    return width;
  }

  function initReadingPanelResize() {
    const panel = document.getElementById("reading-mode-panel");
    if (!panel) return;
    applyReadingPanelWidth(getStoredReadingPanelWidthPx());

    let drag = null;

    function endDrag() {
      if (!drag) return;
      const width = applyReadingPanelWidth(panel.getBoundingClientRect().width);
      saveReadingPanelWidthPx(width);
      drag = null;
      document.body.classList.remove("reading-mode-resizing");
    }

    panel.querySelectorAll(".reading-mode-resize").forEach(function (handle) {
      handle.addEventListener("pointerdown", function (e) {
        if (e.button != null && e.button !== 0) return;
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        drag = {
          edge: handle.getAttribute("data-edge") === "left" ? "left" : "right",
          startX: e.clientX,
          startWidth: panel.getBoundingClientRect().width,
        };
        document.body.classList.add("reading-mode-resizing");
      });

      handle.addEventListener("pointermove", function (e) {
        if (!drag) return;
        applyReadingPanelWidth(
          computeSymmetricReadingWidth(drag.startWidth, drag.startX, e.clientX, drag.edge)
        );
      });

      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);

      handle.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const edge = handle.getAttribute("data-edge") === "left" ? "left" : "right";
        const current = panel.getBoundingClientRect().width;
        const outward =
          (edge === "right" && e.key === "ArrowRight") ||
          (edge === "left" && e.key === "ArrowLeft");
        const next = current + (outward ? READING_WIDTH_KEYBOARD_STEP_PX : -READING_WIDTH_KEYBOARD_STEP_PX);
        saveReadingPanelWidthPx(applyReadingPanelWidth(next));
      });
    });

    window.addEventListener("resize", function () {
      if (!isReadingModeOpen()) return;
      applyReadingPanelWidth(getStoredReadingPanelWidthPx());
    });
  }

  function openReadingMode(msgIndex) {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== "assistant" || !(msg.content && msg.content.trim())) return;
    const overlay = document.getElementById("reading-mode");
    const body = document.getElementById("reading-mode-body");
    if (!overlay || !body) return;
    readingModeMessageIndex = msgIndex;
    body.innerHTML = formatMessageHtml(msg.content || "");
    enhanceIllustrationFrames(body);
    applyConversationFontSize(getStoredFontSize());
    applyConversationImageSize(getStoredImageSize());
    syncFontSizeButtons(getStoredFontSize());
    syncImageSizeButtons(getStoredImageSize());
    applyReadingPanelWidth(getStoredReadingPanelWidthPx());
    overlay.hidden = false;
    document.body.classList.add("reading-mode-open");
    body.scrollTop = 0;
    const closeBtn = document.getElementById("reading-mode-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeReadingMode() {
    const overlay = document.getElementById("reading-mode");
    const body = document.getElementById("reading-mode-body");
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("reading-mode-open");
    document.body.classList.remove("reading-mode-resizing");
    readingModeMessageIndex = null;
    if (body) body.innerHTML = "";
  }

  function initReadingMode() {
    initConversationImageSize();
    initReadingPanelResize();
    const closeBtn = document.getElementById("reading-mode-close");
    const fontDec = document.getElementById("reading-font-decrease");
    const fontInc = document.getElementById("reading-font-increase");
    const imgDec = document.getElementById("reading-image-decrease");
    const imgInc = document.getElementById("reading-image-increase");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeReadingMode();
      });
    }
    if (fontDec) {
      fontDec.addEventListener("click", function () {
        if (!this.disabled) setConversationFontSize(-FONT_SIZE_STEP);
      });
    }
    if (fontInc) {
      fontInc.addEventListener("click", function () {
        if (!this.disabled) setConversationFontSize(FONT_SIZE_STEP);
      });
    }
    if (imgDec) {
      imgDec.addEventListener("click", function () {
        if (!this.disabled) setConversationImageSize(-IMAGE_SIZE_STEP);
      });
    }
    if (imgInc) {
      imgInc.addEventListener("click", function () {
        if (!this.disabled) setConversationImageSize(IMAGE_SIZE_STEP);
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isReadingModeOpen()) {
        e.preventDefault();
        closeReadingMode();
      }
    });
  }

  function getAccordionState() {
    try {
      const raw = localStorage.getItem(ACCORDION_STORAGE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (state && typeof state === "object") return state;
    } catch (_) {}
    return null;
  }

  function saveAccordionState() {
    const state = {};
    document.querySelectorAll(".accordion-section[data-accordion-section]").forEach((section) => {
      const id = section.dataset.accordionSection;
      if (id) state[id] = section.classList.contains("is-open");
    });
    try {
      localStorage.setItem(ACCORDION_STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function getSiblingAccordionSections(section) {
    if (!section.parentElement) return [];
    return Array.from(section.parentElement.children).filter((el) =>
      el.classList.contains("accordion-section")
    );
  }

  function setAccordionSectionOpen(section, isOpen) {
    section.classList.toggle("is-open", isOpen);
    const btn = section.querySelector(":scope > .accordion-header");
    if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  function onSidebarMainSectionOpened(sectionId) {
    if (sectionId === "reglas") loadLibraryRules();
    if (sectionId === "imagenes") {
      ensureImagesPromptSelects();
      loadPlannerLibraryRules();
    }
  }

  function migrateSidebarTabToAccordionState(state) {
    try {
      const t = localStorage.getItem(SIDEBAR_TAB_STORAGE_KEY);
      if (!t) return state;
      const tabId = SIDEBAR_MAIN_SECTION_IDS.includes(t) ? t : t === "conversaciones" ? "reglas" : null;
      if (!tabId) return state;
      const next = Object.assign({}, state || {});
      SIDEBAR_MAIN_SECTION_IDS.forEach((id) => {
        next[id] = id === tabId;
      });
      localStorage.removeItem(SIDEBAR_TAB_STORAGE_KEY);
      return next;
    } catch (_) {
      return state;
    }
  }

  function ensureExclusiveMainAccordion(state) {
    const next = Object.assign({}, state || {});
    const openMain = SIDEBAR_MAIN_SECTION_IDS.filter((id) => next[id] === true);
    if (openMain.length === 0) {
      next.reglas = true;
      SIDEBAR_MAIN_SECTION_IDS.filter((id) => id !== "reglas").forEach((id) => {
        next[id] = false;
      });
      return next;
    }
    if (openMain.length > 1) {
      const keep = openMain[0];
      SIDEBAR_MAIN_SECTION_IDS.forEach((id) => {
        next[id] = id === keep;
      });
    }
    return next;
  }

  function initAccordionState() {
    let state = getAccordionState();
    state = migrateSidebarTabToAccordionState(state);
    state = ensureExclusiveMainAccordion(state);
    document.querySelectorAll(".accordion-section[data-accordion-section]").forEach((section) => {
      const id = section.dataset.accordionSection;
      const isOpen = state && typeof state[id] === "boolean" ? state[id] : section.classList.contains("is-open");
      setAccordionSectionOpen(section, !!isOpen);
    });
    saveAccordionState();
    const openMain = document.querySelector(
      ".sidebar-main-accordion > .accordion-section.is-open[data-accordion-section]"
    );
    if (openMain) onSidebarMainSectionOpened(openMain.dataset.accordionSection);
  }

  const IMAGES_PREFS_KEY = "chatbot_images_prefs";

  function initSidebarAccordion() {
    initAccordionState();
    document.querySelectorAll(".accordion-header").forEach((btn) => {
      btn.addEventListener("click", () => {
        const section = btn.closest(".accordion-section");
        if (!section) return;
        const wasOpen = section.classList.contains("is-open");
        if (!wasOpen) {
          getSiblingAccordionSections(section).forEach((s) => {
            if (s !== section) setAccordionSectionOpen(s, false);
          });
        }
        setAccordionSectionOpen(section, !wasOpen);
        saveAccordionState();
        if (!wasOpen && section.closest(".sidebar-main-accordion") === section.parentElement) {
          onSidebarMainSectionOpened(section.dataset.accordionSection);
        }
      });
    });
  }

  initSidebarAccordion();
  initConversationFontSize();
  initConversationScrollNav();
  initIllustrationMetaModal();
  document.addEventListener("click", function () {
    closeAllMessageContextMenus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllMessageContextMenus();
  });
  initReadingMode();

  function loadImagesPrefs() {
    try {
      return JSON.parse(localStorage.getItem(IMAGES_PREFS_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function saveImagesPrefs(partial) {
    const prefs = Object.assign(loadImagesPrefs(), partial || {});
    try {
      localStorage.setItem(IMAGES_PREFS_KEY, JSON.stringify(prefs));
    } catch (_) {}
    return prefs;
  }

  function isImagesEnabled() {
    const elEnabled = document.getElementById("images-enabled");
    return !!(elEnabled && elEnabled.checked);
  }

  function isImagesDebugMode() {
    const elDbg = document.getElementById("images-debug-mode");
    return !!(elDbg && elDbg.checked);
  }

  /** Buffer del log de imágenes: se acumula aunque la ventana esté cerrada. */
  const imagesDebugLogLines = [];

  function appendImagesDebugLog(line) {
    const ts = new Date().toISOString().slice(11, 19);
    imagesDebugLogLines.push(`[${ts}] ${line}`);
    if (!isImagesDebugMode()) return;
    const pre = document.getElementById("images-debug-log");
    const win = document.getElementById("images-debug-window");
    if (!pre || !win) return;
    win.hidden = false;
    pre.textContent += imagesDebugLogLines[imagesDebugLogLines.length - 1] + "\n";
    pre.scrollTop = pre.scrollHeight;
  }

  function syncImagesDebugWindow() {
    const pre = document.getElementById("images-debug-log");
    const win = document.getElementById("images-debug-window");
    if (!pre || !win) return;
    if (isImagesDebugMode()) {
      win.hidden = false;
      pre.textContent = imagesDebugLogLines.length
        ? imagesDebugLogLines.join("\n") + "\n"
        : "";
      pre.scrollTop = pre.scrollHeight;
    } else {
      win.hidden = true;
    }
  }

  async function ensureImagesPromptSelects() {
    const providerSel = document.getElementById("images-prompt-provider");
    const modelSel = document.getElementById("images-prompt-model");
    if (!providerSel || !modelSel) return;
    const prefs = loadImagesPrefs();
    try {
      const providers = await fetchJson(`${API}/providers`);
      const list = (Array.isArray(providers) ? providers : []).map((p) => (typeof p === "string" ? p : p.name)).filter(Boolean);
      providerSel.innerHTML = list.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
      if (prefs.prompt_provider && list.includes(prefs.prompt_provider)) {
        providerSel.value = prefs.prompt_provider;
      } else if (el.providerSelect && el.providerSelect.value) {
        providerSel.value = el.providerSelect.value;
      }
      await loadImagesPromptModels();
    } catch (e) {
      providerSel.innerHTML = "";
    }
  }

  async function loadImagesPromptModels() {
    const providerSel = document.getElementById("images-prompt-provider");
    const modelSel = document.getElementById("images-prompt-model");
    if (!providerSel || !modelSel) return;
    const provider = providerSel.value;
    const prefs = loadImagesPrefs();
    try {
      const models = await fetchJson(`${API}/providers/${encodeURIComponent(provider)}/models`);
      const names = (models || []).map((m) => m.name || m.id || m).filter(Boolean);
      modelSel.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
      if (prefs.prompt_model && names.includes(prefs.prompt_model)) {
        modelSel.value = prefs.prompt_model;
      } else if (el.modelSelect && el.modelSelect.value && names.includes(el.modelSelect.value)) {
        modelSel.value = el.modelSelect.value;
      }
    } catch (_) {
      modelSel.innerHTML = "";
    }
  }

  function readOptionalIntInput(el) {
    if (!el || el.value === "" || el.value == null) return null;
    const n = parseInt(el.value, 10);
    return Number.isFinite(n) ? n : null;
  }

  function readForgePanelParams() {
    return {
      steps: readOptionalIntInput(document.getElementById("images-forge-steps")),
      width: readOptionalIntInput(document.getElementById("images-forge-width")),
      height: readOptionalIntInput(document.getElementById("images-forge-height")),
      seed: readOptionalIntInput(document.getElementById("images-forge-seed")),
    };
  }

  function applyForgePanelParams(params) {
    if (!params || typeof params !== "object") return;
    const map = [
      ["images-forge-steps", "steps"],
      ["images-forge-width", "width"],
      ["images-forge-height", "height"],
      ["images-forge-seed", "seed"],
    ];
    map.forEach(function ([id, key]) {
      const el = document.getElementById(id);
      if (!el) return;
      if (params[key] == null || params[key] === "") {
        el.value = "";
        return;
      }
      el.value = String(params[key]);
    });
  }

  function collectImagesSnapshot() {
    const enabled = document.getElementById("images-enabled");
    const useChatConfig = document.getElementById("images-use-chat-config");
    const per = document.getElementById("images-per-response");
    const batchSize = document.getElementById("images-batch-size");
    const retries = document.getElementById("images-retries");
    const promptEl = document.getElementById("images-prompt");
    const providerSel = document.getElementById("images-prompt-provider");
    const modelSel = document.getElementById("images-prompt-model");
    const forge = readForgePanelParams();
    return {
      enabled: !!(enabled && enabled.checked),
      use_chat_config: !!(useChatConfig && useChatConfig.checked),
      images_per_response: per ? parseInt(per.value, 10) || 2 : 2,
      batch_size: batchSize ? parseInt(batchSize.value, 10) || 10 : 10,
      retries: retries ? parseInt(retries.value, 10) || 0 : 0,
      prompt: promptEl ? String(promptEl.value || "") : "",
      prompt_system_instructions: serializeRuleItems(plannerRules),
      prompt_provider: providerSel ? providerSel.value : "",
      prompt_model: modelSel ? modelSel.value : "",
      steps: forge.steps,
      width: forge.width,
      height: forge.height,
      seed: forge.seed,
    };
  }

  function fillImagesPanelFromPrefs(prefs) {
    const enabled = document.getElementById("images-enabled");
    const useChatConfig = document.getElementById("images-use-chat-config");
    const per = document.getElementById("images-per-response");
    const batchSize = document.getElementById("images-batch-size");
    const retries = document.getElementById("images-retries");
    const promptEl = document.getElementById("images-prompt");
    const dbg = document.getElementById("images-debug-mode");
    if (enabled) enabled.checked = !!prefs.enabled;
    if (useChatConfig) useChatConfig.checked = !!prefs.use_chat_config;
    if (per && prefs.images_per_response != null) per.value = prefs.images_per_response;
    if (batchSize && prefs.batch_size != null) batchSize.value = prefs.batch_size;
    if (retries && prefs.retries != null) retries.value = prefs.retries;
    if (promptEl && prefs.prompt != null) promptEl.value = prefs.prompt;
    plannerRules = normalizePlannerRulesFromPrefs(prefs.prompt_system_instructions);
    renderPlannerRules();
    if (dbg && prefs.debug != null) dbg.checked = !!prefs.debug;
    if (
      prefs.steps != null ||
      prefs.width != null ||
      prefs.height != null ||
      prefs.seed != null
    ) {
      applyForgePanelParams(prefs);
    }
  }

  function syncImagesChatConfigDisabled() {
    const useChatConfig = document.getElementById("images-use-chat-config");
    const on = !!(useChatConfig && useChatConfig.checked);
    document.querySelectorAll("[data-images-chat-config-control]").forEach(function (row) {
      row.classList.toggle("is-disabled-by-chat-config", on);
      row.querySelectorAll("input, select, textarea").forEach(function (ctrl) {
        ctrl.disabled = on;
      });
    });
  }

  function persistImagesPanel() {
    const snap = collectImagesSnapshot();
    snap.debug = isImagesDebugMode();
    saveImagesPrefs(snap);
    syncImagesDebugWindow();
    syncImagesChatConfigDisabled();
  }

  async function fetchForgeLastGenerationParams() {
    const data = await fetchJson(`${API}/forge/last-generation-params`);
    if (!data || !data.available) {
      const detail = (data && data.detail) || "No hay último gen disponible";
      const err = new Error(detail);
      err.unavailable = true;
      throw err;
    }
    return data;
  }

  function persistForgePanelParamsFromDom() {
    const forgeParams = readForgePanelParams();
    return saveImagesPrefs({
      steps: forgeParams.steps,
      width: forgeParams.width,
      height: forgeParams.height,
      seed: forgeParams.seed,
    });
  }

  async function reloadForgeParamsFromLastGen(options) {
    const notify = !!(options && options.notify);
    const btn = document.getElementById("btn-images-forge-reload-params");
    if (btn) btn.disabled = true;
    try {
      const data = await fetchForgeLastGenerationParams();
      applyForgePanelParams(data);
      persistForgePanelParamsFromDom();
      if (notify) {
        const parts = [];
        if (data.steps != null) parts.push(`steps=${data.steps}`);
        if (data.width != null && data.height != null) {
          parts.push(`${data.width}×${data.height}`);
        }
        if (data.seed != null) parts.push(`seed=${data.seed}`);
        showNotice(
          parts.length
            ? `Parámetros Forge recargados (${parts.join(", ")}).`
            : "Parámetros Forge recargados."
        );
      }
      return data;
    } catch (e) {
      if (notify) {
        showNotice(
          e && e.unavailable
            ? `No se pudo recargar desde Forge: ${e.message}`
            : `Error al recargar params de Forge: ${(e && e.message) || e}`
        );
      }
      throw e;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function autofillForgeParamsFromLastGen(prefs) {
    const hasStored =
      prefs &&
      (prefs.steps != null || prefs.width != null || prefs.height != null || prefs.seed != null);
    if (hasStored) {
      applyForgePanelParams(prefs);
      return;
    }
    try {
      await reloadForgeParamsFromLastGen({ notify: false });
    } catch (_) {}
  }

  async function applyImagesSnapshot(images) {
    const incoming = images && typeof images === "object" ? images : {};
    const next = Object.assign({}, loadImagesPrefs(), incoming);
    delete next.debug;
    saveImagesPrefs(next);
    fillImagesPanelFromPrefs(loadImagesPrefs());
    syncImagesChatConfigDisabled();
    await ensureImagesPromptSelects();
    const providerSel = document.getElementById("images-prompt-provider");
    const modelSel = document.getElementById("images-prompt-model");
    if (providerSel && incoming.prompt_provider) {
      providerSel.value = incoming.prompt_provider;
      await loadImagesPromptModels();
    }
    if (modelSel && incoming.prompt_model) modelSel.value = incoming.prompt_model;
    persistImagesPanel();
  }

  const GALLERY_PAGE_SIZE = 24;
  let galleryItems = [];
  let galleryTotal = 0;
  let galleryOffset = 0;
  let galleryLightboxIndex = -1;
  let galleryPromptTimer = null;
  let galleryScopeAll = true;
  let galleryUserChoseAll = false;
  let galleryMessageId = null;

  function isGalleryPanelVisible() {
    return document.documentElement.getAttribute("data-center-gallery") === "on";
  }

  function isChatPanelVisible() {
    return document.documentElement.getAttribute("data-center-chat") !== "off";
  }

  function isGalleryView() {
    return isGalleryPanelVisible();
  }

  function applyCenterPanels() {
    const chatOn = isChatPanelVisible();
    const galleryOn = isGalleryPanelVisible();
    const chatCol = document.getElementById("chat-column") || document.querySelector(".chat-column");
    const panel = document.getElementById("image-gallery-panel");
    const chatBtn = document.getElementById("btn-center-chat");
    const galBtn = document.getElementById("btn-image-gallery");
    if (chatCol) chatCol.hidden = !chatOn;
    if (panel) panel.hidden = !galleryOn;
    if (chatBtn) chatBtn.setAttribute("aria-pressed", chatOn ? "true" : "false");
    if (galBtn) galBtn.setAttribute("aria-pressed", galleryOn ? "true" : "false");
    if (!galleryOn) closeGalleryLightbox();
    const empty = document.getElementById("center-panels-empty");
    if (empty) empty.hidden = chatOn || galleryOn;
  }

  function setChatPanelVisible(on) {
    if (on) document.documentElement.removeAttribute("data-center-chat");
    else document.documentElement.setAttribute("data-center-chat", "off");
    try {
      localStorage.setItem("centerChatVisible", on ? "true" : "false");
    } catch (err) {}
    applyCenterPanels();
  }

  function setGalleryPanelVisible(on) {
    const was = isGalleryPanelVisible();
    if (on) document.documentElement.setAttribute("data-center-gallery", "on");
    else document.documentElement.removeAttribute("data-center-gallery");
    try {
      localStorage.setItem("centerGalleryVisible", on ? "true" : "false");
    } catch (err) {}
    applyCenterPanels();
    if (on && !was) {
      if (currentConversationId && !galleryUserChoseAll) {
        galleryScopeAll = false;
      }
      galleryOffset = 0;
      refreshGalleryAfterScopeChange();
    }
  }

  function exitGalleryView() {
    setGalleryPanelVisible(false);
  }

  function enterGalleryView() {
    setGalleryPanelVisible(true);
  }

  function galleryFilterValue(id) {
    const node = document.getElementById(id);
    return node ? String(node.value || "") : "";
  }

  function galleryScopedConversationId() {
    if (galleryScopeAll || !currentConversationId) return "";
    return currentConversationId;
  }

  function applyGalleryScopeToParams(params) {
    const convId = galleryScopedConversationId();
    if (convId) params.set("conversation_id", convId);
    if (galleryMessageId) params.set("message_id", galleryMessageId);
  }

  function renderGalleryScopeBar() {
    const allBtn = document.getElementById("gallery-scope-all");
    const label = document.getElementById("gallery-scope-conv-label");
    const convId = galleryScopedConversationId();
    if (allBtn) allBtn.setAttribute("aria-pressed", convId ? "false" : "true");
    if (!label) return;
    if (!convId) {
      label.hidden = true;
      label.textContent = "";
      return;
    }
    const title =
      (el.conversationTitle && el.conversationTitle.value.trim()) || "Conversación";
    label.hidden = false;
    label.textContent = title;
  }

  function renderGalleryMessageChips(items) {
    const wrap = document.getElementById("image-gallery-messages");
    if (!wrap) return;
    if (!galleryScopedConversationId()) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    wrap.hidden = false;
    const allActive = !galleryMessageId ? " is-active" : "";
    const chips = [
      '<button type="button" class="image-gallery-msg-chip' +
        allActive +
        '" data-gallery-message="">Toda la conversación</button>',
    ];
    (items || []).forEach(function (item) {
      const active = item.message_id === galleryMessageId ? " is-active" : "";
      const count = item.image_count != null ? item.image_count : 0;
      chips.push(
        '<button type="button" class="image-gallery-msg-chip' +
          active +
          '" data-gallery-message="' +
          escapeHtml(item.message_id) +
          '" title="' +
          escapeHtml(item.excerpt || "") +
          '"><span class="image-gallery-msg-chip-text">' +
          escapeHtml(item.excerpt || "(sin texto)") +
          '</span><span class="image-gallery-msg-chip-count">' +
          String(count) +
          "</span></button>"
      );
    });
    wrap.innerHTML = chips.join("");
  }

  async function loadGalleryMessageChips() {
    const convId = galleryScopedConversationId();
    if (!convId) {
      renderGalleryMessageChips([]);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set("conversation_id", convId);
      const data = await fetchJson(`${API}/illustrated-images/messages?${params}`);
      renderGalleryMessageChips(data.items || []);
    } catch (err) {
      renderGalleryMessageChips([]);
    }
  }

  async function refreshGalleryAfterScopeChange() {
    renderGalleryScopeBar();
    await Promise.all([loadGalleryFacets(), loadGalleryMessageChips()]);
    await loadGalleryPage();
  }

  function buildGalleryQuery(offset) {
    const params = new URLSearchParams();
    applyGalleryScopeToParams(params);
    const model = galleryFilterValue("gallery-filter-prompt-model");
    if (model === "__none__") params.set("prompt_model", "");
    else if (model) params.set("prompt_model", model);
    const provider = galleryFilterValue("gallery-filter-prompt-provider");
    if (provider === "__none__") params.set("prompt_provider", "");
    else if (provider) params.set("prompt_provider", provider);
    const forge = galleryFilterValue("gallery-filter-forge-model");
    if (forge) params.set("forge_model", forge);
    const steps = galleryFilterValue("gallery-filter-steps");
    if (steps) params.set("steps", steps);
    const size = galleryFilterValue("gallery-filter-size");
    if (size) params.set("size", size);
    const mode = galleryFilterValue("gallery-filter-mode");
    if (mode) params.set("mode", mode);
    const q = galleryFilterValue("gallery-filter-prompt-q").trim();
    if (q) params.set("prompt_q", q);
    params.set("limit", String(GALLERY_PAGE_SIZE));
    params.set("offset", String(offset));
    return params;
  }

  function fillGallerySelect(selectId, values, extraNoneLabel) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Todos</option>';
    if (extraNoneLabel) {
      const none = document.createElement("option");
      none.value = "__none__";
      none.textContent = extraNoneLabel;
      sel.appendChild(none);
    }
    (values || []).forEach(function (value) {
      const opt = document.createElement("option");
      opt.value = String(value);
      opt.textContent = String(value);
      sel.appendChild(opt);
    });
    if ([].some.call(sel.options, function (opt) { return opt.value === current; })) {
      sel.value = current;
    }
  }

  async function loadGalleryFacets() {
    try {
      const params = new URLSearchParams();
      applyGalleryScopeToParams(params);
      const qs = params.toString();
      const data = await fetchJson(
        `${API}/illustrated-images/facets${qs ? "?" + qs : ""}`
      );
      fillGallerySelect(
        "gallery-filter-prompt-model",
        data.prompt_models,
        data.has_missing_prompt_llm ? "Sin LLM" : ""
      );
      fillGallerySelect("gallery-filter-prompt-provider", data.prompt_providers, "");
      fillGallerySelect("gallery-filter-forge-model", data.forge_models, "");
      fillGallerySelect("gallery-filter-steps", data.steps, "");
      fillGallerySelect("gallery-filter-size", data.sizes, "");
      fillGallerySelect("gallery-filter-mode", data.modes, "");
    } catch (err) {
      showError("No se pudieron cargar los filtros de la galería: " + err.message);
    }
  }

  function formatGalleryDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
  }

  function galleryLlmLabel(item) {
    const bits = [item && item.prompt_provider, item && item.prompt_model].filter(Boolean);
    return bits.length ? bits.join(" · ") : "Sin LLM";
  }

  function renderGalleryGrid() {
    const grid = document.getElementById("image-gallery-grid");
    const pager = document.getElementById("image-gallery-pager");
    if (!grid) return;
    if (!galleryItems.length) {
      grid.innerHTML = '<p class="image-gallery-empty">No hay imágenes con estos filtros.</p>';
      if (pager) pager.innerHTML = "";
      return;
    }
    grid.innerHTML = galleryItems
      .map(function (item, index) {
        const size =
          item.width != null && item.height != null ? item.width + "×" + item.height : "";
        const meta = [
          item.steps != null ? item.steps + " steps" : null,
          size,
          item.forge_model,
          galleryLlmLabel(item),
        ]
          .filter(Boolean)
          .join(" · ");
        const prompt = (item.prompt || "").trim() || "(sin prompt)";
        const when = formatGalleryDate(item.created_at);
        return (
          '<button type="button" class="image-gallery-card" data-gallery-index="' +
          index +
          '">' +
          '<img src="' +
          escapeHtml(item.url) +
          '" alt="" loading="lazy" />' +
          '<div class="image-gallery-card-body">' +
          '<p class="image-gallery-card-prompt">' +
          escapeHtml(prompt) +
          "</p>" +
          '<p class="image-gallery-card-meta">' +
          escapeHtml(meta) +
          (when ? " · " + escapeHtml(when) : "") +
          "</p>" +
          '<p class="image-gallery-card-conv">' +
          escapeHtml(item.conversation_title || "Conversación") +
          "</p>" +
          "</div></button>"
        );
      })
      .join("");
    grid.querySelectorAll(".image-gallery-card").forEach(function (card) {
      card.addEventListener("click", function () {
        const idx = parseInt(card.getAttribute("data-gallery-index"), 10);
        if (Number.isFinite(idx)) openGalleryLightbox(idx);
      });
    });
    if (!pager) return;
    const from = galleryOffset + 1;
    const to = galleryOffset + galleryItems.length;
    const prevDisabled = galleryOffset <= 0 ? " disabled" : "";
    const nextDisabled = galleryOffset + galleryItems.length >= galleryTotal ? " disabled" : "";
    pager.innerHTML =
      '<button type="button" class="btn btn-secondary btn-small" id="gallery-page-prev"' +
      prevDisabled +
      ">Anterior</button>" +
      "<span>" +
      from +
      "–" +
      to +
      " de " +
      galleryTotal +
      "</span>" +
      '<button type="button" class="btn btn-secondary btn-small" id="gallery-page-next"' +
      nextDisabled +
      ">Siguiente</button>";
    const prev = document.getElementById("gallery-page-prev");
    const next = document.getElementById("gallery-page-next");
    if (prev) {
      prev.addEventListener("click", function () {
        galleryOffset = Math.max(0, galleryOffset - GALLERY_PAGE_SIZE);
        loadGalleryPage();
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        galleryOffset += GALLERY_PAGE_SIZE;
        loadGalleryPage();
      });
    }
  }

  async function loadGalleryPage() {
    const grid = document.getElementById("image-gallery-grid");
    if (grid) {
      grid.innerHTML = '<p class="image-gallery-empty">Cargando…</p>';
    }
    try {
      const data = await fetchJson(`${API}/illustrated-images?${buildGalleryQuery(galleryOffset)}`);
      galleryItems = data.items || [];
      galleryTotal = data.total || 0;
      galleryOffset = data.offset || 0;
      renderGalleryGrid();
    } catch (err) {
      galleryItems = [];
      galleryTotal = 0;
      if (grid) {
        grid.innerHTML =
          '<p class="image-gallery-empty">No se pudo cargar la galería.</p>';
      }
      showError("Error al cargar la galería: " + err.message);
    }
  }

  function closeGalleryLightbox() {
    const modal = document.getElementById("image-gallery-lightbox");
    if (modal) modal.hidden = true;
    galleryLightboxIndex = -1;
  }

  function renderGalleryLightbox() {
    const item = galleryItems[galleryLightboxIndex];
    const img = document.getElementById("image-gallery-lightbox-img");
    const meta = document.getElementById("image-gallery-lightbox-meta");
    const prev = document.getElementById("image-gallery-lightbox-prev");
    const next = document.getElementById("image-gallery-lightbox-next");
    if (!item || !img || !meta) return;
    img.src = item.url;
    img.alt = (item.prompt || "").slice(0, 180);
    if (prev) prev.hidden = galleryItems.length < 2;
    if (next) next.hidden = galleryItems.length < 2;
    const convLabel = item.conversation_title || "Conversación";
    const goBtn =
      '<p class="image-gallery-lightbox-link">' +
      '<button type="button" class="btn btn-primary btn-small" id="gallery-open-message">' +
      "Ir al mensaje</button> " +
      '<span class="image-gallery-card-meta">' +
      escapeHtml(convLabel) +
      (item.created_at ? " · " + escapeHtml(formatGalleryDate(item.created_at)) : "") +
      "</span></p>";
    const llmBlock =
      '<p class="image-gallery-card-meta" style="margin:0 0 8px">LLM del prompt: ' +
      escapeHtml(galleryLlmLabel(item)) +
      "</p>";
    meta.innerHTML =
      goBtn +
      llmBlock +
      renderIllustrationMetaBody({
        mode: item.mode,
        params: item.params || {},
        scene_id: item.scene_id,
        filename: item.filename,
        prompt_model: item.prompt_model,
        prompt_provider: item.prompt_provider,
      });
    const go = document.getElementById("gallery-open-message");
    if (go) {
      go.addEventListener("click", function () {
        openConversationAtMessage(item.conversation_id, item.message_id);
      });
    }
  }

  function openGalleryLightbox(index) {
    if (index < 0 || index >= galleryItems.length) return;
    galleryLightboxIndex = index;
    const modal = document.getElementById("image-gallery-lightbox");
    if (modal) modal.hidden = false;
    renderGalleryLightbox();
  }

  function stepGalleryLightbox(delta) {
    if (galleryLightboxIndex < 0 || galleryItems.length < 2) return;
    const next = (galleryLightboxIndex + delta + galleryItems.length) % galleryItems.length;
    openGalleryLightbox(next);
  }

  function scrollAndHighlightMessage(messageId) {
    if (!el.messagesContainer || !messageId) return;
    const row = el.messagesContainer.querySelector('[data-msg-id="' + CSS.escape(messageId) + '"]');
    if (!row) {
      showNotice("El mensaje no está en el intento visible.");
      return;
    }
    const toggle = row.querySelector(".msg-collapse-toggle");
    const collapsed = row.querySelector(".message-body-collapsible.is-collapsed");
    if (collapsed && toggle) toggle.click();
    scrollMessageStartIntoView(el.messagesContainer, row);
    row.classList.add("message-row-highlight");
    window.setTimeout(function () {
      row.classList.remove("message-row-highlight");
    }, 2200);
  }

  async function openConversationAtMessage(conversationId, messageId) {
    closeGalleryLightbox();
    try {
      await openConversation(conversationId);
      const visible = messages.some(function (m) {
        return m.id === messageId;
      });
      if (!visible) {
        await fetchJson(`${API}/conversations/${conversationId}`, {
          method: "PUT",
          body: JSON.stringify({ active_leaf_message_id: messageId }),
        });
        await openConversation(conversationId);
      }
      scrollAndHighlightMessage(messageId);
    } catch (err) {
      showError("No se pudo abrir el mensaje: " + err.message);
    }
  }

  function initImageGallery() {
    applyCenterPanels();
    if (isGalleryPanelVisible()) {
      refreshGalleryAfterScopeChange();
    }
    const chatBtn = document.getElementById("btn-center-chat");
    if (chatBtn) {
      chatBtn.addEventListener("click", function () {
        setChatPanelVisible(!isChatPanelVisible());
      });
    }
    const btn = document.getElementById("btn-image-gallery");
    if (btn) {
      btn.addEventListener("click", function () {
        setGalleryPanelVisible(!isGalleryPanelVisible());
      });
    }
    if (el.messagesContainer) {
      el.messagesContainer.addEventListener("click", function (e) {
        if (!isGalleryPanelVisible()) return;
        if (e.target.closest("button, a, textarea, input")) return;
        const row = e.target.closest(".message-row");
        if (!row || !el.messagesContainer.contains(row)) return;
        const msgId = row.getAttribute("data-msg-id");
        if (!msgId) return;
        galleryScopeAll = false;
        galleryMessageId = msgId;
        galleryOffset = 0;
        refreshGalleryAfterScopeChange();
      });
    }
    [
      "gallery-filter-prompt-model",
      "gallery-filter-prompt-provider",
      "gallery-filter-forge-model",
      "gallery-filter-steps",
      "gallery-filter-size",
      "gallery-filter-mode",
    ].forEach(function (id) {
      const node = document.getElementById(id);
      if (!node) return;
      node.addEventListener("change", function () {
        galleryOffset = 0;
        loadGalleryPage();
      });
    });
    const scopeAll = document.getElementById("gallery-scope-all");
    if (scopeAll) {
      scopeAll.addEventListener("click", function () {
        galleryScopeAll = true;
        galleryUserChoseAll = true;
        galleryMessageId = null;
        galleryOffset = 0;
        refreshGalleryAfterScopeChange();
      });
    }
    const msgWrap = document.getElementById("image-gallery-messages");
    if (msgWrap) {
      msgWrap.addEventListener("click", function (e) {
        const btn = e.target.closest("[data-gallery-message]");
        if (!btn || !msgWrap.contains(btn)) return;
        const next = btn.getAttribute("data-gallery-message") || "";
        galleryMessageId = next || null;
        galleryOffset = 0;
        refreshGalleryAfterScopeChange();
      });
    }
    const promptQ = document.getElementById("gallery-filter-prompt-q");
    if (promptQ) {
      promptQ.addEventListener("input", function () {
        if (galleryPromptTimer) window.clearTimeout(galleryPromptTimer);
        galleryPromptTimer = window.setTimeout(function () {
          galleryOffset = 0;
          loadGalleryPage();
        }, 280);
      });
    }
    const lightbox = document.getElementById("image-gallery-lightbox");
    const closeBtn = document.getElementById("image-gallery-lightbox-close");
    const prev = document.getElementById("image-gallery-lightbox-prev");
    const next = document.getElementById("image-gallery-lightbox-next");
    if (closeBtn) {
      closeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        closeGalleryLightbox();
      });
    }
    if (lightbox) {
      lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox) closeGalleryLightbox();
      });
    }
    if (prev) {
      prev.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        stepGalleryLightbox(-1);
      });
    }
    if (next) {
      next.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        stepGalleryLightbox(1);
      });
    }
    document.addEventListener("keydown", function (e) {
      const modal = document.getElementById("image-gallery-lightbox");
      if (!modal || modal.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeGalleryLightbox();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepGalleryLightbox(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepGalleryLightbox(1);
      }
    });
  }

  function initImagesPanel() {
    const prefs = loadImagesPrefs();
    const enabled = document.getElementById("images-enabled");
    const useChatConfig = document.getElementById("images-use-chat-config");
    const per = document.getElementById("images-per-response");
    const batchSize = document.getElementById("images-batch-size");
    const retries = document.getElementById("images-retries");
    const promptEl = document.getElementById("images-prompt");
    const providerSel = document.getElementById("images-prompt-provider");
    const modelSel = document.getElementById("images-prompt-model");
    const forgeSteps = document.getElementById("images-forge-steps");
    const forgeWidth = document.getElementById("images-forge-width");
    const forgeHeight = document.getElementById("images-forge-height");
    const forgeSeed = document.getElementById("images-forge-seed");
    const reloadForgeBtn = document.getElementById("btn-images-forge-reload-params");
    const dbg = document.getElementById("images-debug-mode");
    const closeBtn = document.getElementById("images-debug-close");
    const stopBtn = document.getElementById("images-debug-stop");
    const win = document.getElementById("images-debug-window");
    fillImagesPanelFromPrefs(prefs);

    const forgeParamInputs = [forgeSteps, forgeWidth, forgeHeight, forgeSeed];
    [enabled, useChatConfig, per, batchSize, retries, promptEl, providerSel, modelSel, dbg]
      .concat(forgeParamInputs)
      .forEach((node) => {
      if (!node) return;
      const evt = node === promptEl ? "input" : "change";
      node.addEventListener(evt, function () {
        if (node === providerSel) loadImagesPromptModels().then(persistImagesPanel);
        else persistImagesPanel();
      });
    });
    if (reloadForgeBtn) {
      reloadForgeBtn.addEventListener("click", function () {
        reloadForgeParamsFromLastGen({ notify: true }).catch(function () {});
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener("click", function () {
        abortAllIllustrations();
      });
    }
    if (closeBtn && win) {
      closeBtn.addEventListener("click", function () {
        win.hidden = true;
        if (dbg) dbg.checked = false;
        persistImagesPanel();
      });
    }
    syncImagesChatConfigDisabled();
    syncImagesDebugWindow();
    ensureImagesPromptSelects();
    autofillForgeParamsFromLastGen(prefs).then(function () {
      persistImagesPanel();
    });
  }

  initImagesPanel();
  initImageGallery();

  let workspaceProfiles = [];
  let currentWorkspaceProfileId = "";

  function collectWorkspaceSnapshot() {
    const turnsRaw = el.historyTurnsInput ? parseInt(el.historyTurnsInput.value, 10) : 5;
    const historyTurns = Number.isFinite(turnsRaw) ? Math.min(100, Math.max(0, turnsRaw)) : 5;
    return {
      provider: (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama",
      model_id: (el.modelSelect && el.modelSelect.value) || "",
      model_params: buildModelParamsRaw(),
      params_excluded: Array.from(getParamsExcludedFromSendSet()),
      history_turns: historyTurns,
      system_instructions: rules.map(function (r) {
        const item = {
          title: (r && r.title) || "",
          content: (r && r.content) || "",
        };
        if (r && r.rule_id) item.rule_id = r.rule_id;
        return item;
      }),
      images: collectImagesSnapshot(),
    };
  }

  async function persistWorkspaceToConversation() {
    if (!currentConversationId) return;
    const snap = collectWorkspaceSnapshot();
    await fetchJson(`${API}/conversations/${currentConversationId}`, {
      method: "PUT",
      body: JSON.stringify({
        provider: snap.provider,
        model_id: snap.model_id,
        model_params: buildModelParams(),
        history_turns: snap.history_turns,
        system_instructions: snap.system_instructions,
      }),
    });
  }

  async function applyWorkspaceSnapshot(snapshot) {
    const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
    const provider = snap.provider || "ollama";
    currentProvider = provider;
    if (el.providerSelect) el.providerSelect.value = provider;
    await loadModels(false);
    const modelId = snap.model_id || "";
    if (el.modelSelect && modelId) {
      if (![...el.modelSelect.options].some((opt) => opt.value === modelId)) {
        const opt = document.createElement("option");
        opt.value = modelId;
        opt.textContent = modelId;
        el.modelSelect.appendChild(opt);
      }
      el.modelSelect.value = modelId;
      refreshModelSelectUI();
    }
    await loadParamsForProvider(currentProvider);
    await ensureParamsBaselineForCurrentModel();
    if (snap.model_params && typeof snap.model_params === "object") {
      applyUserParamsToControls(snap.model_params);
    }
    const excluded = new Set(Array.isArray(snap.params_excluded) ? snap.params_excluded : []);
    paramsExcludedFromSendByConv[currentConversationId || "_new"] = excluded;
    paramsSource = "user";
    rules = normalizeRulesFromApi(snap.system_instructions);
    renderRules();
    if (el.historyTurnsInput) {
      const turns = snap.history_turns != null ? Number(snap.history_turns) : 5;
      el.historyTurnsInput.value = String(Number.isFinite(turns) ? Math.min(100, Math.max(0, turns)) : 5);
    }
    await applyImagesSnapshot(snap.images || {});
    renderParamsSourceLabel();
    renderParamsToSend();
    syncHeaderProviderModel();
    await persistWorkspaceToConversation();
    await loadContextLength();
  }

  function renderWorkspaceProfileList() {
    const list = document.getElementById("workspace-profile-list");
    const empty = document.getElementById("workspace-profile-empty");
    if (!list) return;
    if (currentWorkspaceProfileId && !workspaceProfiles.some((p) => p.id === currentWorkspaceProfileId)) {
      currentWorkspaceProfileId = "";
    }
    list.innerHTML = workspaceProfiles.map(function (p) {
      const active = p.id === currentWorkspaceProfileId ? " is-active" : "";
      return (
        `<li class="workspace-profile-item${active}" data-id="${escapeHtml(p.id)}">` +
        `<button type="button" class="workspace-profile-load" data-action="load">${escapeHtml(p.name)}</button>` +
        `<button type="button" class="workspace-profile-delete" data-action="delete" title="Eliminar perfil" aria-label="Eliminar ${escapeHtml(p.name)}">×</button>` +
        `</li>`
      );
    }).join("");
    if (empty) empty.hidden = workspaceProfiles.length > 0;
  }

  async function refreshWorkspaceProfiles() {
    try {
      const list = await fetchJson(`${API}/workspace-profiles`);
      workspaceProfiles = Array.isArray(list) ? list : [];
    } catch (e) {
      workspaceProfiles = [];
      renderWorkspaceProfileList();
      showError("No se pudieron cargar los perfiles: " + (e.message || e));
      return;
    }
    renderWorkspaceProfileList();
  }

  function promptWorkspaceProfileName(defaultName) {
    const modal = document.getElementById("workspace-profile-name-modal");
    const input = document.getElementById("workspace-profile-name-input");
    const confirmBtn = document.getElementById("workspace-profile-name-confirm");
    const cancelBtn = document.getElementById("workspace-profile-name-cancel");
    if (!modal || !input || !confirmBtn || !cancelBtn) {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      let settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        modal.hidden = true;
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);
        input.removeEventListener("keydown", onKey);
        resolve(value);
      }
      function onConfirm() {
        finish(input.value.trim() || null);
      }
      function onCancel() {
        finish(null);
      }
      function onKey(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          onConfirm();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }
      input.value = defaultName || "";
      modal.hidden = false;
      confirmBtn.addEventListener("click", onConfirm);
      cancelBtn.addEventListener("click", onCancel);
      input.addEventListener("keydown", onKey);
      input.focus();
      input.select();
    });
  }

  async function saveWorkspaceProfile(asNew) {
    const snapshot = collectWorkspaceSnapshot();
    if (!snapshot.model_id) {
      showError("Elige un modelo antes de guardar el perfil.");
      return;
    }
    let name = "";
    let profileId = asNew ? "" : currentWorkspaceProfileId;
    if (profileId) {
      const current = workspaceProfiles.find((p) => p.id === profileId);
      name = current ? current.name : "";
    }
    if (!name) {
      name = await promptWorkspaceProfileName("");
      if (!name) return;
      profileId = "";
    }
    try {
      const saved = profileId
        ? await fetchJson(`${API}/workspace-profiles/${encodeURIComponent(profileId)}`, {
            method: "PUT",
            body: JSON.stringify({ snapshot }),
          })
        : await fetchJson(`${API}/workspace-profiles`, {
            method: "POST",
            body: JSON.stringify({ name, snapshot }),
          });
      currentWorkspaceProfileId = saved.id;
      await refreshWorkspaceProfiles();
      if (saved && saved.id && !workspaceProfiles.some((p) => p.id === saved.id)) {
        workspaceProfiles = workspaceProfiles.concat([saved]);
        workspaceProfiles.sort(function (a, b) {
          return (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" });
        });
        renderWorkspaceProfileList();
      }
      showNotice(profileId ? "Perfil actualizado." : "Perfil guardado.");
    } catch (e) {
      showError("No se pudo guardar el perfil: " + (e.message || e));
    }
  }

  async function loadWorkspaceProfile(profileId) {
    if (!profileId) return;
    let profile = workspaceProfiles.find((p) => p.id === profileId);
    if (!profile) {
      try {
        profile = await fetchJson(`${API}/workspace-profiles/${encodeURIComponent(profileId)}`);
      } catch (e) {
        showError("No se pudo cargar el perfil: " + (e.message || e));
        return;
      }
    }
    try {
      await applyWorkspaceSnapshot(profile.snapshot || {});
      currentWorkspaceProfileId = profile.id;
      renderWorkspaceProfileList();
      showNotice("Perfil «" + profile.name + "» cargado.");
    } catch (e) {
      showError("No se pudo aplicar el perfil: " + (e.message || e));
    }
  }

  async function deleteWorkspaceProfile(profileId) {
    if (!profileId) return;
    const current = workspaceProfiles.find((p) => p.id === profileId);
    const label = current ? current.name : "este perfil";
    if (!window.confirm("¿Eliminar el perfil «" + label + "»?")) return;
    try {
      await fetchJson(`${API}/workspace-profiles/${encodeURIComponent(profileId)}`, {
        method: "DELETE",
      });
      if (currentWorkspaceProfileId === profileId) currentWorkspaceProfileId = "";
      await refreshWorkspaceProfiles();
      showNotice("Perfil eliminado.");
    } catch (e) {
      showError("No se pudo eliminar el perfil: " + (e.message || e));
    }
  }

  function initWorkspaceProfiles() {
    const saveBtn = document.getElementById("btn-workspace-profile-save");
    const saveAsBtn = document.getElementById("btn-workspace-profile-save-as");
    const list = document.getElementById("workspace-profile-list");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        saveWorkspaceProfile(false);
      });
    }
    if (saveAsBtn) {
      saveAsBtn.addEventListener("click", function () {
        saveWorkspaceProfile(true);
      });
    }
    if (list) {
      list.addEventListener("click", function (e) {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const item = btn.closest("[data-id]");
        if (!item) return;
        const id = item.getAttribute("data-id");
        const action = btn.getAttribute("data-action");
        if (action === "load") loadWorkspaceProfile(id);
        if (action === "delete") deleteWorkspaceProfile(id);
      });
    }
    refreshWorkspaceProfiles();
  }

  initWorkspaceProfiles();


  function abortAllIllustrations() {
    const n = illustrateAbortControllers.size;
    illustrateAbortControllers.forEach(function (ctrl) {
      try {
        ctrl.abort();
      } catch (_) {}
    });
    illustrateAbortControllers.clear();
    illustratingMessageIds.clear();
    appStatus.clearSource("images");
    if (n) {
      const cancelId = appStatus.push("images", "images.cancelled");
      setTimeout(function () {
        appStatus.pop(cancelId);
      }, 1200);
    }
    appendImagesDebugLog(
      n ? `Abortadas ${n} generación(es) de imágenes.` : "No hay generaciones activas."
    );
    renderMessages();
    if (n) showNotice("Generación de imágenes abortada.");
  }

  async function maybeIllustrateAssistantMessage(messageId, options) {
    const force = !!(options && options.force);
    if ((!force && !isImagesEnabled()) || !currentConversationId || !messageId) return;
    if (illustratingMessageIds.has(messageId)) return;
    const providerSel = document.getElementById("images-prompt-provider");
    const modelSel = document.getElementById("images-prompt-model");
    const per = document.getElementById("images-per-response");
    const batchSize = document.getElementById("images-batch-size");
    const retries = document.getElementById("images-retries");
    const promptEl = document.getElementById("images-prompt");
    const useChatConfig = document.getElementById("images-use-chat-config");
    const useChat = !!(useChatConfig && useChatConfig.checked);
    const promptModel = modelSel && modelSel.value;
    if (!useChat && !promptModel) {
      showNotice("Imágenes: elige un modelo LLM de prompts en la pestaña Imágenes.");
      return;
    }
    await runIllustrationStream({
      messageId,
      url: `${API}/conversations/${currentConversationId}/messages/${messageId}/illustrate`,
      body: {
        images_per_response: per ? parseInt(per.value, 10) || 2 : 2,
        batch_size: batchSize ? parseInt(batchSize.value, 10) || 10 : 10,
        prompt_provider: (providerSel && providerSel.value) || "ollama",
        prompt_model: promptModel || "",
        retries: retries ? parseInt(retries.value, 10) || 0 : 0,
        prompt: promptEl ? String(promptEl.value || "").trim() : "",
        prompt_system_instructions: getPlannerRulesTextForSystem(),
        use_chat_config: useChat,
        include_prompt_debug: isShowDebugMode(),
        debug: true,
        ...readForgePanelParams(),
      },
      debugLabel: `Iniciando illustrate message=${messageId}${force ? " (manual)" : ""}`,
      doneNotice: force ? "Ilustración terminada." : null,
      errorPrefix: "Ilustración: ",
    });
  }

  async function generateRemainingImages(messageId) {
    if (!currentConversationId || !messageId) return;
    if (illustratingMessageIds.has(messageId)) return;
    const retries = document.getElementById("images-retries");
    const batchSize = document.getElementById("images-batch-size");
    await runIllustrationStream({
      messageId,
      url: `${API}/conversations/${currentConversationId}/messages/${messageId}/illustrations/generate-remaining`,
      body: {
        retries: retries ? parseInt(retries.value, 10) || 0 : 0,
        batch_size: batchSize ? parseInt(batchSize.value, 10) || 10 : 10,
        debug: true,
        ...readForgePanelParams(),
      },
      debugLabel: `Iniciando generate-remaining message=${messageId}`,
      doneNotice: "Imágenes restantes terminadas.",
      errorPrefix: "Imágenes restantes: ",
    });
  }

  async function runIllustrationStream(opts) {
    const messageId = opts.messageId;
    const abortCtrl = new AbortController();
    illustrateAbortControllers.add(abortCtrl);
    illustratingMessageIds.add(messageId);
    renderMessages();
    const imgStatusId = appStatus.push("images", "images.starting");
    appendImagesDebugLog(opts.debugLabel || `Iniciando stream message=${messageId}`);
    try {
      const res = await fetch(opts.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortCtrl.signal,
        body: JSON.stringify(opts.body || {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let data;
          try {
            data = JSON.parse(line);
          } catch (_) {
            continue;
          }
          if (data.type === "status") {
            const code = (data.data && data.data.code) || "images.starting";
            appStatus.update(imgStatusId, code, data.message || "", data.data || {});
          }
          if (data.type === "log") {
            appendImagesDebugLog(data.message || JSON.stringify(data));
          }
          if (data.type === "llm_debug" && isShowDebugMode()) {
            const label =
              (data.data && data.data.label) ||
              (data.scene_id ? `Prompt escena ${data.scene_id}` : "Planificador de prompts");
            const promptText = data.message || "";
            messages.push({
              role: "assistant",
              content: promptText
                ? `${label}\n\n${promptText}`
                : label,
              id: null,
              ephemeral_debug: true,
              debug_request: (data.data && data.data.debug_request) || null,
              debug_response: (data.data && data.data.debug_response) || null,
            });
            renderMessages();
            scrollToBottomIfEnabled();
          }
            if (data.content != null) {
            const idx = messages.findIndex((m) => m.id === messageId);
            if (idx >= 0) {
              updateStoredMessageContent(messageId, data.content);
              renderMessages();
              scrollToBottomIfEnabled();
            }
          }
        }
      }
      appendImagesDebugLog("Stream de ilustración terminado");
      if (opts.doneNotice) showNotice(opts.doneNotice);
    } catch (e) {
      if (e && (e.name === "AbortError" || e.message === "The user aborted a request.")) {
        appStatus.update(imgStatusId, "images.cancelled");
        appendImagesDebugLog(`Stream abortado message=${messageId}`);
      } else {
        appStatus.update(imgStatusId, "images.error", e.message || "");
        appendImagesDebugLog("Error: " + e.message);
        showError((opts.errorPrefix || "Ilustración: ") + e.message);
      }
    } finally {
      illustrateAbortControllers.delete(abortCtrl);
      illustratingMessageIds.delete(messageId);
      appStatus.pop(imgStatusId);
      renderMessages();
    }
  }

  (function initDarkMode() {
    var checkbox = document.getElementById("dark-mode-toggle");
    if (!checkbox) return;
    checkbox.checked = localStorage.getItem("darkMode") === "true";
    checkbox.addEventListener("change", function () {
      var dark = checkbox.checked;
      localStorage.setItem("darkMode", dark ? "true" : "false");
      if (dark) document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
    });
  })();

  (function initLeftSidebarCollapse() {
    var KEY = "leftSidebarCollapsed";
    var collapseBtn = document.getElementById("btn-collapse-left");
    var expandBtn = document.getElementById("btn-expand-left");
    var aside = document.getElementById("column-left");
    if (!collapseBtn || !expandBtn || !aside) return;

    function apply(collapsed) {
      document.documentElement.setAttribute("data-sidebar-left", collapsed ? "collapsed" : "open");
      var appEl = document.getElementById("app");
      if (appEl) appEl.classList.toggle("sidebar-left-collapsed", collapsed);
      aside.setAttribute("aria-hidden", collapsed ? "true" : "false");
      collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      expandBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      expandBtn.hidden = !collapsed;
      try {
        localStorage.setItem(KEY, collapsed ? "true" : "false");
      } catch (_) {}
    }

    apply(localStorage.getItem(KEY) === "true");
    collapseBtn.addEventListener("click", function () {
      apply(true);
    });
    expandBtn.addEventListener("click", function () {
      apply(false);
    });
  })();

  (function initChatFullscreen() {
    var btn = document.getElementById("btn-chat-fullscreen");
    if (!btn) return;
    var iconEnter = btn.querySelector(".chat-fs-icon-enter");
    var iconExit = btn.querySelector(".chat-fs-icon-exit");
    var layoutBeforeFullscreen = null;
    var chatFullscreenActive = false;

    function currentFullscreenElement() {
      return (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        null
      );
    }

    function requestBrowserFullscreen() {
      var root = document.documentElement;
      var req =
        root.requestFullscreen ||
        root.webkitRequestFullscreen ||
        root.msRequestFullscreen;
      if (!req) return Promise.reject(new Error("Fullscreen no soportado"));
      return Promise.resolve(req.call(root));
    }

    function exitBrowserFullscreen() {
      var exit =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.msExitFullscreen;
      if (!exit || !currentFullscreenElement()) return Promise.resolve();
      return Promise.resolve(exit.call(document));
    }

    function captureLayoutSnapshot() {
      return {
        sidebarLeft: document.documentElement.getAttribute("data-sidebar-left") || "open",
        composer: document.documentElement.getAttribute("data-composer") || "open",
      };
    }

    function restoreLayoutSnapshot(snapshot) {
      if (!snapshot) return;
      var sidebarCollapsed = snapshot.sidebarLeft === "collapsed";
      var composerCollapsed = snapshot.composer === "collapsed";
      document.documentElement.setAttribute(
        "data-sidebar-left",
        sidebarCollapsed ? "collapsed" : "open"
      );
      document.documentElement.setAttribute(
        "data-composer",
        composerCollapsed ? "collapsed" : "open"
      );
      var appEl = document.getElementById("app");
      if (appEl) {
        appEl.classList.toggle("sidebar-left-collapsed", sidebarCollapsed);
        appEl.classList.toggle("composer-collapsed", composerCollapsed);
      }
      var leftAside = document.getElementById("column-left");
      var expandLeft = document.getElementById("btn-expand-left");
      var collapseLeft = document.getElementById("btn-collapse-left");
      if (leftAside) leftAside.setAttribute("aria-hidden", sidebarCollapsed ? "true" : "false");
      if (expandLeft) {
        expandLeft.hidden = !sidebarCollapsed;
        expandLeft.setAttribute("aria-expanded", sidebarCollapsed ? "false" : "true");
      }
      if (collapseLeft) {
        collapseLeft.setAttribute("aria-expanded", sidebarCollapsed ? "false" : "true");
      }
      var composerPanel = document.getElementById("composer-panel");
      var expandComposer = document.getElementById("btn-expand-composer");
      var collapseComposer = document.getElementById("btn-collapse-composer");
      if (composerPanel) {
        composerPanel.setAttribute("aria-hidden", composerCollapsed ? "true" : "false");
      }
      if (expandComposer) {
        expandComposer.hidden = !composerCollapsed;
        expandComposer.setAttribute("aria-expanded", composerCollapsed ? "false" : "true");
      }
      if (collapseComposer) {
        collapseComposer.setAttribute("aria-expanded", composerCollapsed ? "false" : "true");
      }
    }

    function setChatFullscreenLayout(on) {
      chatFullscreenActive = !!on;
      document.documentElement.setAttribute("data-chat-fullscreen", on ? "on" : "off");
      var appEl = document.getElementById("app");
      if (appEl) appEl.classList.toggle("chat-fullscreen", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = on ? "Salir de pantalla completa" : "Pantalla completa";
      btn.setAttribute("aria-label", btn.title);
      if (iconEnter) iconEnter.hidden = !!on;
      if (iconExit) iconExit.hidden = !on;
    }

    function leaveChatFullscreen() {
      setChatFullscreenLayout(false);
      restoreLayoutSnapshot(layoutBeforeFullscreen);
      layoutBeforeFullscreen = null;
    }

    function enterChatFullscreen() {
      if (chatFullscreenActive) return;
      layoutBeforeFullscreen = captureLayoutSnapshot();
      setChatFullscreenLayout(true);
      requestBrowserFullscreen().catch(function () {
        leaveChatFullscreen();
      });
    }

    btn.addEventListener("click", function () {
      if (chatFullscreenActive || currentFullscreenElement()) {
        exitBrowserFullscreen().then(function () {
          if (chatFullscreenActive) leaveChatFullscreen();
        });
      } else {
        enterChatFullscreen();
      }
    });

    document.addEventListener("fullscreenchange", function () {
      if (!currentFullscreenElement() && chatFullscreenActive) {
        leaveChatFullscreen();
      }
    });
    document.addEventListener("webkitfullscreenchange", function () {
      if (!currentFullscreenElement() && chatFullscreenActive) {
        leaveChatFullscreen();
      }
    });
  })();

  (function initComposerCollapse() {
    var KEY = "composerCollapsed";
    var collapseBtn = document.getElementById("btn-collapse-composer");
    var expandBtn = document.getElementById("btn-expand-composer");
    var panel = document.getElementById("composer-panel");
    if (!collapseBtn || !expandBtn || !panel) return;

    function apply(collapsed) {
      document.documentElement.setAttribute("data-composer", collapsed ? "collapsed" : "open");
      var appEl = document.getElementById("app");
      if (appEl) appEl.classList.toggle("composer-collapsed", collapsed);
      panel.setAttribute("aria-hidden", collapsed ? "true" : "false");
      collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      expandBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      expandBtn.hidden = !collapsed;
      try {
        localStorage.setItem(KEY, collapsed ? "true" : "false");
      } catch (_) {}
      if (!collapsed && el.messageInput) {
        try {
          el.messageInput.focus();
        } catch (_) {}
      }
    }

    apply(localStorage.getItem(KEY) === "true");
    collapseBtn.addEventListener("click", function () {
      apply(true);
    });
    expandBtn.addEventListener("click", function () {
      apply(false);
    });
  })();

  /* Fluent ToggleSwitch: checkboxes nativos estilizados en CSS; no hace falta sync YES/NO */

  // Cargar proveedores; si uno falla al cargar modelos, probar el siguiente
  async function initLoad() {
    await loadProviders();
    let loaded = false;
    for (const p of providers) {
      if (await tryLoadModelsForProvider(p)) {
        loaded = true;
        break;
      }
    }
    if (!loaded && providers.length > 0) {
      showError("No se pudo cargar modelos de ningún proveedor. Comprueba Ollama/Mancer.");
      if (el.modelSelect) {
        el.modelSelect.innerHTML = "";
        refreshModelSelectUI();
      }
    }
    await loadParamsForProvider(currentProvider);
    await loadConversations();
    const storedId = (function () {
      try {
        return localStorage.getItem(LAST_CONVERSATION_STORAGE_KEY);
      } catch (_) {
        return null;
      }
    })();
    if (storedId) {
      try {
        await openConversation(storedId);
      } catch (_) {
        saveLastConversationId(null);
      }
    }
    await loadContextLength();
  }
  renderParamsSourceLabel();
  initLoad();
  loadParamsHelp().then(function () {
    initParamHelpTooltip();
  });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
