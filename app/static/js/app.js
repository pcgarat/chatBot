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

  const el = {
    conversationsList: document.getElementById("conversations-list"),
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
    btnCancelMessage: document.getElementById("btn-cancel-message"),
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

  const msgDeleteIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 6h18\"/><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"/><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/></svg>";
  const msgCopyIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\" ry=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1\"/></svg>";
  const msgToInputIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 10L4 15 9 20\"/><path d=\"M20 4v11a4 4 0 01-4 4H4\"/></svg>";
  const msgIllustrateIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/><path d=\"M21 15l-5-5L5 21\"/></svg>";
  const msgReadIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\"/><path d=\"M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\"/></svg>";
  const msgMoreIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"currentColor\" stroke=\"none\"><circle cx=\"12\" cy=\"5\" r=\"1.75\"/><circle cx=\"12\" cy=\"12\" r=\"1.75\"/><circle cx=\"12\" cy=\"19\" r=\"1.75\"/></svg>";
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
    const hasUsage = lastUsage && (lastUsage.prompt_tokens > 0 || lastUsage.completion_tokens > 0);
    const pt = (lastUsage && lastUsage.prompt_tokens) || 0;
    const ct = (lastUsage && lastUsage.completion_tokens) || 0;
    if (!hasUsage) {
      if (textEl) textEl.textContent = "—";
      if (badgeEl) badgeEl.textContent = "—";
      if (barWrap) barWrap.hidden = true;
      if (bar) bar.setAttribute("aria-valuenow", "0");
      return;
    }
    const total = pt + ct;
    const fmt = function (n) { return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n); };
    if (textEl) {
      if (contextLength != null) {
        textEl.textContent = `Prompt: ${pt} · Respuesta: ${ct} / ${contextLength} tokens`;
      } else {
        textEl.textContent = `Prompt: ${pt} · Respuesta: ${ct} tokens`;
      }
    }
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
      el.headerProviderName.textContent = opt ? opt.text : "";
    }
    if (el.headerModelName && el.modelSelect) {
      const opt = el.modelSelect.selectedOptions[0];
      el.headerModelName.textContent = opt ? opt.text : "";
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
    } catch (e) {
      showError("Error al cargar conversaciones: " + e.message);
    }
  }

  const convIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/></svg>";
  const clearHistoryIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 20H7L3 16l10-10 4 4-6 6h9l4-4\"/></svg>";

  const CONV_GROUP_LABELS = { hoy: "Hoy", ayer: "Ayer", semana: "La semana pasada", anteriores: "Anteriores" };

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

  function renderConversationsList(list) {
    if (!el.conversationsList) return;
    const groups = { hoy: [], ayer: [], semana: [], anteriores: [] };
    const lastActivity = (c) => c.last_message_at || c.updated_at;
    list.forEach((c) => {
      const g = getConversationGroup(lastActivity(c));
      groups[g].push(c);
    });
    const order = ["hoy", "ayer", "semana", "anteriores"];
    const html = order
      .filter((key) => groups[key].length > 0)
      .map((key) => {
        const header = `<div class="conv-group-label" aria-hidden="true">${escapeHtml(CONV_GROUP_LABELS[key])}</div>`;
        const items = groups[key]
          .map(
            (c) =>
              `<div class="conversation-item ${c.id === currentConversationId ? "active" : ""}" data-id="${escapeHtml(c.id)}">
                <div class="conv-row">
                  <span class="conv-icon" aria-hidden="true">${convIconSvg}</span>
                  <span class="conv-title">${escapeHtml(c.title)}</span>
                  ${c.id === currentConversationId ? `<button type="button" class="conv-clear-btn" data-id="${escapeHtml(c.id)}" title="Limpiar historial de mensajes" aria-label="Limpiar historial">${clearHistoryIconSvg}</button>` : ""}
                </div>
                <div class="conv-meta">${escapeHtml(c.provider || "ollama")}/${escapeHtml(c.model_id)} · ${formatDate(lastActivity(c))}</div>
              </div>`
          )
          .join("");
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
      showNotice("Conversación eliminada.");
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
        messages = [];
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
    return tokens
      .map((tok) => (tok.t === "html" ? tok.v : escapeHtml(tok.v).replace(/\n/g, "<br>")))
      .join("");
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

  function buildCollapsibleMessageHtml(content, key, expanded) {
    const parts = splitFirstParagraph(content);
    if (!parts.collapsible) {
      return `<span>${formatMessageHtml(content || "")}</span>`;
    }
    const collapsed = !expanded;
    const toggleLabel = collapsed ? "Show more" : "Show less";
    return `<div class="message-body-collapsible${collapsed ? " is-collapsed" : ""}" data-collapse-key="${escapeHtml(key)}">
      <span class="message-content-preview">${formatMessageHtml(parts.first)}</span>
      <span class="message-content-rest">${formatMessageHtml(parts.rest)}</span>
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

  async function setCurrentConversation(conv) {
    const previousConvId = currentConversationId;
    if (previousConvId && conv && conv.id !== previousConvId && el.instructionOverride) {
      const instructionOverride = (el.instructionOverride.value || "").trim() || null;
      fetchJson(`${API}/conversations/${previousConvId}`, {
        method: "PUT",
        body: JSON.stringify({ instruction_override: instructionOverride }),
      }).catch(() => {});
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
      messages = (conv.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        id: m.id || null,
        debug_request: m.debug_request || null,
        debug_response: m.debug_response || null,
      }));
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
      messages = [];
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
    // Si el panel Reglas está visible, refrescar el selector para mostrar todas las reglas de la biblioteca (incl. creadas en otras conversaciones).
    const reglasPanel = document.getElementById("tab-reglas");
    if (reglasPanel && !reglasPanel.hidden) loadLibraryRules();
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
    return rules
      .map(function (r) { return (r && r.content) ? r.content.trim() : ""; })
      .filter(Boolean)
      .join(" ");
  }

  let ruleEditIndex = -1;

  function openRuleEditModal(index) {
    if (index < 0 || index >= rules.length) return;
    ruleEditIndex = index;
    const r = rules[index];
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

  function renderRules() {
    if (!el.rulesList) return;
    el.rulesList.innerHTML = rules
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

  /** Reordenar reglas por arrastre: dragstart en el asa, dragover/drop en la lista. */
  if (el.rulesList) {
    let ruleDragSourceIndex = -1;
    el.rulesList.addEventListener("dragstart", function (e) {
      const handle = e.target.closest(".rule-tag-drag");
      if (!handle) return;
      const tag = handle.closest(".rule-tag");
      if (!tag) return;
      const idx = parseInt(tag.getAttribute("data-rule-index"), 10);
      if (Number.isNaN(idx) || idx < 0 || idx >= rules.length) return;
      ruleDragSourceIndex = idx;
      e.dataTransfer.setData("text/plain", String(idx));
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(tag, 0, 0);
      tag.classList.add("rule-tag-dragging");
    });
    el.rulesList.addEventListener("dragend", function (e) {
      ruleDragSourceIndex = -1;
      e.target.closest(".rule-tag")?.classList.remove("rule-tag-dragging");
      el.rulesList.querySelectorAll(".rule-tag-drag-over").forEach((n) => n.classList.remove("rule-tag-drag-over"));
    });
    el.rulesList.addEventListener("dragover", function (e) {
      const tag = e.target.closest(".rule-tag");
      if (!tag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.rulesList.querySelectorAll(".rule-tag-drag-over").forEach((n) => n.classList.remove("rule-tag-drag-over"));
      tag.classList.add("rule-tag-drag-over");
    });
    el.rulesList.addEventListener("dragleave", function (e) {
      if (!el.rulesList.contains(e.relatedTarget)) {
        el.rulesList.querySelectorAll(".rule-tag-drag-over").forEach((n) => n.classList.remove("rule-tag-drag-over"));
      }
    });
    el.rulesList.addEventListener("drop", function (e) {
      const tag = e.target.closest(".rule-tag");
      if (!tag) return;
      e.preventDefault();
      tag.classList.remove("rule-tag-drag-over");
      const from = ruleDragSourceIndex >= 0 ? ruleDragSourceIndex : parseInt(e.dataTransfer.getData("text/plain"), 10);
      const to = parseInt(tag.getAttribute("data-rule-index"), 10);
      if (Number.isNaN(from) || Number.isNaN(to) || from === to || from < 0 || from >= rules.length || to < 0 || to >= rules.length) return;
      const arr = rules.slice();
      const [item] = arr.splice(from, 1);
      const insertAt = Math.min(to, arr.length);
      arr.splice(insertAt, 0, item);
      rules = arr;
      renderRules();
      debouncedSaveRules();
    });
  }

  /** Delegación en la lista de reglas: eliminar por la cruz o abrir edición por el título. Así el botón × se detecta bien aunque solo quede una regla. */
  if (el.rulesList) {
    el.rulesList.addEventListener("click", function (e) {
      const removeBtn = e.target.closest(".rule-tag-remove");
      const tag = e.target.closest(".rule-tag");
      if (removeBtn && tag) {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(tag.getAttribute("data-rule-index"), 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < rules.length) {
          rules.splice(idx, 1);
          renderRules();
          if (rules.length === 0) {
            if (saveRulesDebounceTimer) {
              clearTimeout(saveRulesDebounceTimer);
              saveRulesDebounceTimer = null;
            }
            saveRulesToConversation();
          } else {
            debouncedSaveRules();
          }
        }
        return;
      }
      const label = e.target.closest(".rule-tag-label");
      if (label && tag) {
        e.preventDefault();
        const idx = parseInt(tag.getAttribute("data-rule-index"), 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < rules.length) openRuleEditModal(idx);
      }
    });
    el.rulesList.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const label = e.target.closest(".rule-tag-label");
      const tag = e.target.closest(".rule-tag");
      if (label && tag) {
        e.preventDefault();
        const idx = parseInt(tag.getAttribute("data-rule-index"), 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < rules.length) openRuleEditModal(idx);
      }
    });
  }

  async function openConversation(id) {
    try {
      const conv = await fetchJson(`${API}/conversations/${id}`);
      setCurrentConversation(conv);
    } catch (e) {
      showError("Error al abrir conversación: " + e.message);
    }
  }

  async function newConversation() {
    try {
      const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama";
      const model = (el.modelSelect && el.modelSelect.value) || (models[0] || "");
      const conv = await fetchJson(`${API}/conversations`, {
        method: "POST",
        body: JSON.stringify({
          title: getDefaultConversationTitle(),
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
      messages = messages.filter((m) => m.id !== messageId);
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
          const deleteCopyBtns = m.id && !isEphemeralDebug
            ? `<button type="button" class="msg-action-btn msg-delete-btn" data-msg-id="${escapeHtml(m.id)}" title="Eliminar del historial">${msgDeleteIconSvg}</button>
                <button type="button" class="msg-action-btn msg-copy-btn" data-msg-id="${escapeHtml(m.id)}" title="Copiar">${msgCopyIconSvg}</button>`
            : "";
          const illustrating = m.id && illustratingMessageIds.has(m.id);
          const illustrateBtn =
            !isEphemeralDebug && m.role === "assistant" && m.id && hasContent
              ? `<button type="button" class="msg-action-btn msg-illustrate-btn${illustrating ? " is-busy" : ""}" data-msg-id="${escapeHtml(m.id)}" title="Generar imágenes para esta respuesta" aria-label="Generar imágenes" ${illustrating ? "disabled" : ""}>${msgIllustrateIconSvg}</button>`
              : "";
          const readBtn =
            !isEphemeralDebug && m.role === "assistant" && hasContent
              ? `<button type="button" class="msg-action-btn msg-read-btn" data-msg-index="${idx}" title="Modo lectura a pantalla completa" aria-label="Modo lectura">${msgReadIconSvg}</button>`
              : "";
          const moreMenu =
            !isEphemeralDebug && m.role === "assistant" && m.id && hasContent
              ? `<div class="msg-more-wrap">
                  <button type="button" class="msg-action-btn msg-more-btn" data-msg-id="${escapeHtml(m.id)}" title="Más acciones" aria-label="Más acciones" aria-haspopup="menu" aria-expanded="false">${msgMoreIconSvg}</button>
                  <div class="msg-context-menu" role="menu" hidden>
                    <button type="button" class="msg-context-item" role="menuitem" data-action="clear-photos" data-msg-id="${escapeHtml(m.id)}">Borrar todas las fotos</button>
                    <button type="button" class="msg-context-item" role="menuitem" data-action="prune-orphans" data-msg-id="${escapeHtml(m.id)}">Eliminar anclas huérfanas</button>
                  </div>
                </div>`
              : "";
          const footerBtns = (toInputBtn || deleteCopyBtns || illustrateBtn || readBtn || moreMenu)
            ? `<div class="message-footer">${toInputBtn}${deleteCopyBtns}${illustrateBtn}${readBtn}${moreMenu}</div>`
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
          const rowClass = isUser ? "message-row user-row" : "message-row";
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
            bodyHtml = `<span>${formatMessageHtml(m.content || "")}</span>`;
          }
          return `<div class="${rowClass}" data-msg-id="${m.id ? escapeHtml(m.id) : ""}">
            <div style="max-width: ${isUser ? "70%" : "100%"}; flex: 1; min-width: 0;">
              <div class="${bubbleClass}">${bodyHtml}</div>
              ${debugHtml}
              ${footerBtns}
            </div>
          </div>`;
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
        if (action && msgId) runMessageIllustrationAction(action, msgId);
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
        messages[idx].content = data.content;
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
    const content = (el.messageInput && el.messageInput.value.trim()) || "";
    if (!content) return;
    const instructionOverride = (el.instructionOverride && el.instructionOverride.value.trim()) || null;

    if (!currentConversationId) {
      await newConversation();
      if (!currentConversationId) return;
    }

    messages.push({ role: "user", content });
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
    setCancelButtonState();
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
            if (data.user_message_id && messages.length > 0) {
              messages[messages.length - 1].id = data.user_message_id;
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
                debug_request: debugRequest || null,
                debug_response: debugMetaLines.length > 0 ? debugMetaLines.join("\n") : null,
              };
              messages.push(assistantMsg);
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
      setCancelButtonState();
      appStatus.pop(chatStatusId);
    } catch (e) {
      clearAnalyzingDots();
      currentStreamingMsgEl = null;
      currentStreamingDebugEl = null;
      if (e.name === "AbortError") {
        appStatus.update(chatStatusId, "chat.cancelled");
        messages.push({ role: "assistant", content: "Cancelado" });
        renderMessages();
        if (currentConversationId) {
          fetch(`${API}/conversations/${currentConversationId}/messages/last`, { method: "DELETE" }).catch(() => {});
        }
        showNotice("Mensaje anulado.");
      } else {
        appStatus.update(chatStatusId, "chat.error");
        messages.push({ role: "assistant", content: "Error al enviar: " + e.message });
        renderMessages();
        showError("Error al enviar: " + e.message);
      }
      currentAbortController = null;
      setCancelButtonState();
      appStatus.pop(chatStatusId);
    }
  }

  function cancelLastMessage() {
    if (!currentAbortController) return;
    currentAbortController.abort();
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

  if (el.btnCancelMessage) el.btnCancelMessage.disabled = true;

  function setCancelButtonState() {
    if (el.btnCancelMessage) el.btnCancelMessage.disabled = !currentAbortController;
  }

  if (el.btnNewChat) el.btnNewChat.addEventListener("click", newConversation);
  if (el.btnSave) el.btnSave.addEventListener("click", saveConversation);
  if (el.btnSend) el.btnSend.addEventListener("click", sendMessage);
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
  if (el.btnCancelMessage) el.btnCancelMessage.addEventListener("click", cancelLastMessage);
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

  /** Carga TODAS las reglas de la biblioteca (GET /api/rules) para el selector. No depende de la conversación actual. */
  async function loadLibraryRules() {
    try {
      libraryRules = await fetchJson(`${API}/rules`);
      if (!Array.isArray(libraryRules)) libraryRules = [];
    } catch (_) {
      libraryRules = [];
    }
    if (el.ruleLibrarySelect) {
      const selected = el.ruleLibrarySelect.value;
      el.ruleLibrarySelect.innerHTML = "<option value=\"\">-- Elegir regla --</option>" +
        libraryRules.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml((r.title || "").trim() || "Sin título")}</option>`).join("");
      // Solo restaurar la selección si esa regla sigue existiendo en la biblioteca (evita opciones fantasma).
      if (selected && libraryRules.some((r) => r.id === selected)) {
        el.ruleLibrarySelect.value = selected;
      } else {
        el.ruleLibrarySelect.value = "";
      }
    }
  }

  /** Al abrir el selector, refrescar lista para no mostrar reglas ya eliminadas de la biblioteca. */
  if (el.ruleLibrarySelect) {
    el.ruleLibrarySelect.addEventListener("focus", function () {
      loadLibraryRules();
    });
  }

  if (el.btnAddRule && el.ruleNewInput) {
    el.btnAddRule.addEventListener("click", async function () {
      const content = (el.ruleNewInput.value || "").trim();
      const title = (el.ruleNewTitle && el.ruleNewTitle.value ? el.ruleNewTitle.value.trim() : "") || "Regla " + (rules.length + 1);
      if (!content) return;
      try {
        const newRule = await fetchJson(`${API}/rules`, { method: "POST", body: JSON.stringify({ title: title || "Regla " + (rules.length + 1), content: content }) });
        rules.push({ rule_id: newRule.id, title: newRule.title || "", content: newRule.content || "" });
        libraryRules.unshift(newRule);
        if (el.ruleLibrarySelect) {
          const opt = document.createElement("option");
          opt.value = newRule.id;
          opt.textContent = (newRule.title || "").trim() || "Sin título";
          el.ruleLibrarySelect.insertBefore(opt, el.ruleLibrarySelect.options[1] || null);
        }
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
  if (el.ruleEditBtnDelete) {
    el.ruleEditBtnDelete.addEventListener("click", async function () {
      if (ruleEditIndex < 0 || ruleEditIndex >= rules.length) return;
      const r = rules[ruleEditIndex];
      const ruleId = r && r.rule_id;
      if (ruleId) {
        try {
          await fetchJson(`${API}/rules/${ruleId}`, { method: "DELETE" });
        } catch (e) {
          showError("Error al eliminar la regla de la biblioteca: " + e.message);
          return;
        }
      }
      rules.splice(ruleEditIndex, 1);
      renderRules();
      if (rules.length === 0) {
        if (saveRulesDebounceTimer) {
          clearTimeout(saveRulesDebounceTimer);
          saveRulesDebounceTimer = null;
        }
        saveRulesToConversation();
      } else {
        debouncedSaveRules();
      }
      closeRuleEditModal();
    });
  }
  if (el.ruleEditBtnSave) {
    el.ruleEditBtnSave.addEventListener("click", async function () {
      if (ruleEditIndex < 0 || ruleEditIndex >= rules.length) return;
      const title = (el.ruleEditTitle && el.ruleEditTitle.value ? el.ruleEditTitle.value.trim() : "") || "";
      const content = (el.ruleEditContent && el.ruleEditContent.value ? el.ruleEditContent.value : "") || "";
      const r = rules[ruleEditIndex];
      if (r.rule_id) {
        try {
          await fetchJson(`${API}/rules/${r.rule_id}`, { method: "PUT", body: JSON.stringify({ title: title || r.title, content: content || r.content }) });
        } catch (_) {
          showError("Error al actualizar la regla");
          return;
        }
      }
      rules[ruleEditIndex] = Object.assign({}, r, { title: title || r.title, content: content || r.content });
      if (r.rule_id) rules[ruleEditIndex].rule_id = r.rule_id;
      renderRules();
      debouncedSaveRules();
      closeRuleEditModal();
    });
  }
  if (el.ruleEditBtnSaveNew) {
    el.ruleEditBtnSaveNew.addEventListener("click", async function () {
      if (ruleEditIndex < 0 || ruleEditIndex >= rules.length) return;
      const title = (el.ruleEditTitle && el.ruleEditTitle.value ? el.ruleEditTitle.value.trim() : "") || "";
      const content = (el.ruleEditContent && el.ruleEditContent.value ? el.ruleEditContent.value : "") || "";
      try {
        const newRule = await fetchJson(`${API}/rules`, { method: "POST", body: JSON.stringify({ title: title || "Nueva regla", content: content || "" }) });
        rules.splice(ruleEditIndex, 1);
        rules.splice(ruleEditIndex, 0, { rule_id: newRule.id, title: newRule.title || "", content: newRule.content || "" });
        renderRules();
        debouncedSaveRules();
        libraryRules.unshift(newRule);
        if (el.ruleLibrarySelect) {
          const opt = document.createElement("option");
          opt.value = newRule.id;
          opt.textContent = (newRule.title || "").trim() || "Sin título";
          el.ruleLibrarySelect.insertBefore(opt, el.ruleLibrarySelect.options[1] || null);
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
  const LAST_CONVERSATION_STORAGE_KEY = "chatbot_last_conversation_id";
  const FONT_SIZE_STORAGE_KEY = "chatbot_conversation_font_size_rem";
  const FONT_SIZE_DEFAULT = 0.95;
  const FONT_SIZE_MIN = 0.75;
  const FONT_SIZE_MAX = 1.4;
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

  function initAccordionState() {
    const state = getAccordionState();
    if (!state) return;
    document.querySelectorAll(".accordion-section[data-accordion-section]").forEach((section) => {
      const id = section.dataset.accordionSection;
      const isOpen = state[id];
      if (typeof isOpen === "boolean") {
        if (isOpen) {
          section.classList.add("is-open");
          const btn = section.querySelector(".accordion-header");
          if (btn) btn.setAttribute("aria-expanded", "true");
        } else {
          section.classList.remove("is-open");
          const btn = section.querySelector(".accordion-header");
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  const SIDEBAR_TAB_IDS = ["reglas", "parametros", "imagenes"];
  const IMAGES_PREFS_KEY = "chatbot_images_prefs";

  function getStoredSidebarTab() {
    try {
      const t = localStorage.getItem(SIDEBAR_TAB_STORAGE_KEY);
      if (t && SIDEBAR_TAB_IDS.includes(t)) return t;
      if (t === "conversaciones") return "reglas";
    } catch (_) {}
    return "reglas";
  }

  function switchSidebarTab(tabId) {
    if (!SIDEBAR_TAB_IDS.includes(tabId)) return;
    try {
      localStorage.setItem(SIDEBAR_TAB_STORAGE_KEY, tabId);
    } catch (_) {}
    document.querySelectorAll(".sidebar-tabs [role=\"tab\"]").forEach((tab) => {
      const id = tab.getAttribute("data-tab");
      const selected = id === tabId;
      tab.setAttribute("aria-selected", selected);
      tab.classList.toggle("active", selected);
    });
    document.querySelectorAll(".sidebar-tabpanel").forEach((panel) => {
      const panelId = panel.id;
      const active =
        (tabId === "reglas" && panelId === "tab-reglas") ||
        (tabId === "parametros" && panelId === "tab-parametros") ||
        (tabId === "imagenes" && panelId === "tab-imagenes");
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
      if (active && panelId === "tab-reglas") loadLibraryRules();
      if (active && panelId === "tab-imagenes") ensureImagesPromptSelects();
    });
  }

  function initSidebarTabs() {
    switchSidebarTab(getStoredSidebarTab());
    document.querySelectorAll(".sidebar-tabs [role=\"tab\"]").forEach((tab) => {
      tab.addEventListener("click", function () {
        const tabId = tab.getAttribute("data-tab");
        if (tabId) switchSidebarTab(tabId);
      });
      tab.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const tabs = Array.from(document.querySelectorAll(".sidebar-tabs [role=\"tab\"]"));
        const idx = tabs.indexOf(tab);
        if (e.key === "ArrowLeft" && idx > 0) switchSidebarTab(tabs[idx - 1].getAttribute("data-tab"));
        if (e.key === "ArrowRight" && idx < tabs.length - 1) switchSidebarTab(tabs[idx + 1].getAttribute("data-tab"));
      });
    });
  }

  initAccordionState();
  initSidebarTabs();
  initConversationFontSize();
  document.addEventListener("click", function () {
    closeAllMessageContextMenus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllMessageContextMenus();
  });
  initReadingMode();
  initImagesPanel();

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

  function appendImagesDebugLog(line) {
    const pre = document.getElementById("images-debug-log");
    const win = document.getElementById("images-debug-window");
    if (!pre || !win) return;
    win.hidden = false;
    const ts = new Date().toISOString().slice(11, 19);
    pre.textContent += `[${ts}] ${line}\n`;
    pre.scrollTop = pre.scrollHeight;
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

  function initImagesPanel() {
    const prefs = loadImagesPrefs();
    const enabled = document.getElementById("images-enabled");
    const useChatConfig = document.getElementById("images-use-chat-config");
    const per = document.getElementById("images-per-response");
    const retries = document.getElementById("images-retries");
    const promptEl = document.getElementById("images-prompt");
    const promptSystemEl = document.getElementById("images-prompt-system");
    const providerSel = document.getElementById("images-prompt-provider");
    const modelSel = document.getElementById("images-prompt-model");
    const dbg = document.getElementById("images-debug-mode");
    const closeBtn = document.getElementById("images-debug-close");
    const stopBtn = document.getElementById("images-debug-stop");
    const win = document.getElementById("images-debug-window");
    if (enabled) enabled.checked = !!prefs.enabled;
    if (useChatConfig) useChatConfig.checked = !!prefs.use_chat_config;
    if (per && prefs.images_per_response != null) per.value = prefs.images_per_response;
    if (retries && prefs.retries != null) retries.value = prefs.retries;
    if (promptEl && prefs.prompt != null) promptEl.value = prefs.prompt;
    if (promptSystemEl && prefs.prompt_system_instructions != null) {
      promptSystemEl.value = prefs.prompt_system_instructions;
    }
    if (dbg) dbg.checked = !!prefs.debug;

    function syncChatConfigControlsDisabled() {
      const on = !!(useChatConfig && useChatConfig.checked);
      document.querySelectorAll("[data-images-chat-config-control]").forEach(function (row) {
        row.classList.toggle("is-disabled-by-chat-config", on);
        row.querySelectorAll("input, select, textarea").forEach(function (ctrl) {
          ctrl.disabled = on;
        });
      });
    }

    function persist() {
      saveImagesPrefs({
        enabled: !!(enabled && enabled.checked),
        use_chat_config: !!(useChatConfig && useChatConfig.checked),
        images_per_response: per ? parseInt(per.value, 10) || 2 : 2,
        retries: retries ? parseInt(retries.value, 10) || 0 : 0,
        prompt: promptEl ? String(promptEl.value || "") : "",
        prompt_system_instructions: promptSystemEl ? String(promptSystemEl.value || "") : "",
        prompt_provider: providerSel ? providerSel.value : "",
        prompt_model: modelSel ? modelSel.value : "",
        debug: !!(dbg && dbg.checked),
      });
      if (dbg && win) {
        if (dbg.checked) win.hidden = false;
        else win.hidden = true;
      }
      syncChatConfigControlsDisabled();
    }
    [enabled, useChatConfig, per, retries, promptEl, promptSystemEl, providerSel, modelSel, dbg].forEach((node) => {
      if (!node) return;
      const evt = node === promptEl || node === promptSystemEl ? "input" : "change";
      node.addEventListener(evt, function () {
        if (node === providerSel) loadImagesPromptModels().then(persist);
        else persist();
      });
    });
    if (stopBtn) {
      stopBtn.addEventListener("click", function () {
        abortAllIllustrations();
      });
    }
    if (closeBtn && win) {
      closeBtn.addEventListener("click", function () {
        win.hidden = true;
        if (dbg) dbg.checked = false;
        persist();
        // sync segmented toggle if present
        var row = document.querySelector('.segmented-toggle-row[data-checkbox-id="images-debug-mode"]');
        if (row) {
          row.querySelectorAll(".segmented-toggle-btn").forEach(function (btn) {
            var on = btn.getAttribute("data-value") === "no";
            btn.setAttribute("aria-pressed", on ? "true" : "false");
          });
        }
      });
    }
    syncChatConfigControlsDisabled();
    ensureImagesPromptSelects();
  }

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
    if (isImagesDebugMode()) {
      appendImagesDebugLog(
        n ? `Abortadas ${n} generación(es) de imágenes.` : "No hay generaciones activas."
      );
    }
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
    const retries = document.getElementById("images-retries");
    const promptEl = document.getElementById("images-prompt");
    const promptSystemEl = document.getElementById("images-prompt-system");
    const useChatConfig = document.getElementById("images-use-chat-config");
    const useChat = !!(useChatConfig && useChatConfig.checked);
    const promptModel = modelSel && modelSel.value;
    if (!useChat && !promptModel) {
      showNotice("Imágenes: elige un modelo LLM de prompts en la pestaña Imágenes.");
      return;
    }
    const abortCtrl = new AbortController();
    illustrateAbortControllers.add(abortCtrl);
    illustratingMessageIds.add(messageId);
    renderMessages();
    const imgStatusId = appStatus.push("images", "images.starting");
    if (isImagesDebugMode()) {
      appendImagesDebugLog(`Iniciando illustrate message=${messageId}${force ? " (manual)" : ""}`);
    }
    try {
      const res = await fetch(
        `${API}/conversations/${currentConversationId}/messages/${messageId}/illustrate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortCtrl.signal,
          body: JSON.stringify({
            images_per_response: per ? parseInt(per.value, 10) || 2 : 2,
            prompt_provider: (providerSel && providerSel.value) || "ollama",
            prompt_model: promptModel || "",
            retries: retries ? parseInt(retries.value, 10) || 0 : 0,
            prompt: promptEl ? String(promptEl.value || "").trim() : "",
            prompt_system_instructions: promptSystemEl
              ? String(promptSystemEl.value || "").trim()
              : "",
            use_chat_config: useChat,
            include_prompt_debug: isShowDebugMode(),
            debug: isImagesDebugMode(),
          }),
        }
      );
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
          if (data.type === "log" && isImagesDebugMode()) {
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
              messages[idx].content = data.content;
              renderMessages();
              scrollToBottomIfEnabled();
            }
          }
        }
      }
      if (isImagesDebugMode()) appendImagesDebugLog("Illustrate terminado");
      if (force) showNotice("Ilustración terminada.");
    } catch (e) {
      if (e && (e.name === "AbortError" || e.message === "The user aborted a request.")) {
        appStatus.update(imgStatusId, "images.cancelled");
        if (isImagesDebugMode()) appendImagesDebugLog(`Illustrate abortado message=${messageId}`);
      } else {
        appStatus.update(imgStatusId, "images.error", e.message || "");
        if (isImagesDebugMode()) appendImagesDebugLog("Error: " + e.message);
        showError("Ilustración: " + e.message);
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

  (function initSegmentedToggles() {
    document.querySelectorAll(".segmented-toggle-row").forEach(function (row) {
      var checkboxId = row.getAttribute("data-checkbox-id");
      var checkbox = document.getElementById(checkboxId);
      var wrap = row.querySelector(".segmented-toggle-wrap");
      var buttons = row.querySelectorAll(".segmented-toggle-btn");
      if (!checkbox || !wrap || buttons.length !== 2) return;

      function setPressed(value) {
        buttons.forEach(function (btn) {
          btn.setAttribute("aria-pressed", btn.getAttribute("data-value") === value ? "true" : "false");
        });
      }

      function syncFromCheckbox() {
        setPressed(checkbox.checked ? "yes" : "no");
      }

      syncFromCheckbox();

      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var value = this.getAttribute("data-value");
          checkbox.checked = value === "yes";
          setPressed(value);
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
    });
  })();

  document.querySelectorAll(".accordion-header").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.closest(".accordion-section");
      if (!section) return;
      const wasOpen = section.classList.contains("is-open");
      if (!wasOpen) {
        section.parentElement.querySelectorAll(".accordion-section").forEach((s) => {
          s.classList.remove("is-open");
          const b = s.querySelector(".accordion-header");
          if (b) b.setAttribute("aria-expanded", "false");
        });
      }
      section.classList.toggle("is-open");
      const isOpen = section.classList.contains("is-open");
      btn.setAttribute("aria-expanded", isOpen);
      saveAccordionState();
    });
  });

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
