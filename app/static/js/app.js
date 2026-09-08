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
  let currentConversationKind = "chat";
  let currentAutoTitle = false;
  let messages = [];
  let allMessages = [];
  let activeLeafId = null;
  let leftHistoryMode = "conversations";
  let consultaAssistantId = null;
  let messageHistoryItems = [];
  let messageHistoryTotal = 0;
  let messageHistoryLoadSeq = 0;
  let messageHistorySearchTimer = null;
  let messageHistorySearchIn = null;
  let providers = [];
  let models = [];
  let currentProvider = "ollama";
  let currentAbortController = null;
  let currentStreamingMsgEl = null;
  /** Parámetros del proveedor actual: { provider, params: { paramId: { type, default, min, max, api_key } } } */
  let paramsConfig = { provider: "", params: {} };
  /** Origen de los parámetros mostrados: "user" | "preset" | "default" */
  let paramsSource = "default";
  /** Valores de referencia para no enviar un param si coincide (preset del modelo o default del provider). */
  let paramsBaseline = {};
  /** Parámetros que el usuario ha marcado como "no enviar" (por conversación). Clave: conversationId o "_new". */
  let paramsExcludedFromSendByConv = {};
  /** Contrato efectivo del modelo actual (GET .../contract). null si no hay o falló. */
  let currentContract = null;
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
    leftHistorySortSelect: document.getElementById("left-history-sort-select"),
    messageHistorySearchWrap: document.getElementById("message-history-search-wrap"),
    messageHistorySearch: document.getElementById("message-history-search"),
    messageHistoryPager: document.getElementById("message-history-pager"),
    conversationsTrash: document.getElementById("conversations-trash"),
    conversationsTrashList: document.getElementById("conversations-trash-list"),
    conversationTitle: document.getElementById("conversation-title"),
    conversationAutoTitle: document.getElementById("conversation-auto-title"),
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
    autoScrollDuringGenerationCheck: document.getElementById("auto-scroll-during-generation"),
    messagesContainer: document.getElementById("messages-container"),
    instructionOverride: document.getElementById("instruction-override"),
    messageInput: document.getElementById("message-input"),
    btnNewChat: document.getElementById("btn-new-chat"),
    btnPromptGenerator: document.getElementById("btn-prompt-generator"),
    btnGeneratePrompt: document.getElementById("btn-generate-prompt"),
    btnHistoryMessages: document.getElementById("btn-history-messages"),
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

  const DEBUG_LOG_SIZE_STORAGE_KEY = "chatbot_debug_log_size";
  const DEBUG_LOG_SIZE_DEFAULT = 100;
  const DEBUG_LOG_SIZE_MIN = 20;
  const DEBUG_LOG_SIZE_MAX = 500;
  const DEBUG_LOG_SIZE_STEP = 20;

  function getStoredDebugLogSize() {
    try {
      const raw = localStorage.getItem(DEBUG_LOG_SIZE_STORAGE_KEY);
      if (raw == null) return DEBUG_LOG_SIZE_DEFAULT;
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) {
        return Math.max(DEBUG_LOG_SIZE_MIN, Math.min(DEBUG_LOG_SIZE_MAX, n));
      }
    } catch (_) {}
    return DEBUG_LOG_SIZE_DEFAULT;
  }

  function setStoredDebugLogSize(n) {
    try {
      localStorage.setItem(DEBUG_LOG_SIZE_STORAGE_KEY, String(n));
    } catch (_) {}
  }

  function createDebugLogBuffer(getMaxSize) {
    const items = [];
    function maxSize() {
      const n = typeof getMaxSize === "function" ? getMaxSize() : getMaxSize;
      const parsed = parseInt(n, 10);
      return Math.max(1, Number.isFinite(parsed) ? parsed : 1);
    }
    function trim() {
      const max = maxSize();
      while (items.length > max) items.shift();
    }
    function push(entry) {
      items.push(entry);
      trim();
      return entry;
    }
    function list() {
      return items.slice();
    }
    return { push: push, list: list, trim: trim };
  }

  const chatDebugBuffer = createDebugLogBuffer(getStoredDebugLogSize);
  const imagesDebugBuffer = createDebugLogBuffer(getStoredDebugLogSize);
  let chatDebugSeq = 0;
  let imagesDebugSeq = 0;
  let openDebugPanel = null;
  const imageQueueDebugSeen = {};
  const DEBUG_STATUS_LABELS = {
    sending: "Enviando",
    waiting: "Esperando respuesta",
    streaming: "Recibiendo",
    done: "Completado",
    error: "Error",
    cancelled: "Cancelado",
    pending: "Encolada",
    generating: "Generándose",
    completed: "Generada",
    failed: "Fallida",
    info: "Log",
  };

  function isDebugPanelOpen(which) {
    return openDebugPanel === which;
  }

  function formatDebugPayload(value) {
    if (value == null || value === "") return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }

  function debugEntryShouldExpand(entry) {
    return (
      entry.status === "sending" ||
      entry.status === "waiting" ||
      entry.status === "streaming" ||
      entry.status === "generating"
    );
  }

  function debugEntryBodyHtml(entry) {
    const parts = [];
    if (entry.request) {
      parts.push("<pre>" + escapeHtml("Request:\n" + formatDebugPayload(entry.request)) + "</pre>");
    }
    if (entry.response) {
      parts.push("<pre>" + escapeHtml("Response:\n" + formatDebugPayload(entry.response)) + "</pre>");
    }
    if (entry.details) {
      parts.push("<pre>" + escapeHtml(formatDebugPayload(entry.details)) + "</pre>");
    }
    if (entry.imageLink) {
      const link = entry.imageLink;
      const label = link.filename || link.sceneId || "imagen";
      parts.push(
        '<a href="#" class="debug-image-link"' +
          ' data-conversation-id="' + escapeHtml(link.conversationId || "") + '"' +
          ' data-message-id="' + escapeHtml(link.messageId || "") + '"' +
          ' data-filename="' + escapeHtml(link.filename || "") + '"' +
          ' data-scene-id="' + escapeHtml(link.sceneId || "") + '">' +
          escapeHtml("Ver en la conversación: " + label) +
          "</a>"
      );
    }
    return parts.join("");
  }

  function debugEntryHtml(entry) {
    const expanded = debugEntryShouldExpand(entry);
    const status = DEBUG_STATUS_LABELS[entry.status] || entry.status || "";
    const body = debugEntryBodyHtml(entry);
    return (
      '<article class="debug-entry" data-debug-id="' + escapeHtml(entry.id) + '">' +
        '<button type="button" class="debug-entry-toggle" aria-expanded="' +
        (expanded ? "true" : "false") +
        '">' +
          '<span class="debug-entry-time">' + escapeHtml(entry.ts || "") + "</span>" +
          '<span class="debug-entry-status">' + escapeHtml(status) + "</span>" +
          '<span class="debug-entry-title">' + escapeHtml(entry.title || "") + "</span>" +
        "</button>" +
        (body
          ? '<div class="debug-entry-body"' + (expanded ? "" : " hidden") + ">" + body + "</div>"
          : "") +
      "</article>"
    );
  }

  function renderDebugLog(logId, buffer) {
    const log = document.getElementById(logId);
    if (!log) return;
    const items = buffer.list();
    log.innerHTML = items.length
      ? items.map(debugEntryHtml).join("")
      : '<p class="debug-log-empty">Sin eventos todavía.</p>';
    log.scrollTop = log.scrollHeight;
  }

  function renderChatDebugLog() {
    if (!isDebugPanelOpen("chat")) return;
    renderDebugLog("chat-debug-log", chatDebugBuffer);
  }

  function renderImagesDebugLog() {
    if (!isDebugPanelOpen("images")) return;
    renderDebugLog("images-debug-log", imagesDebugBuffer);
  }

  function pushChatDebugEntry(partial) {
    const entry = Object.assign(
      {
        id: "chat-" + (++chatDebugSeq),
        ts: new Date().toISOString().slice(11, 19),
        kind: "llm",
        title: "LLM chat",
        status: "sending",
        request: null,
        response: null,
        details: null,
      },
      partial || {}
    );
    chatDebugBuffer.push(entry);
    renderChatDebugLog();
    return entry;
  }

  function updateChatDebugEntry(id, patch) {
    const entry = chatDebugBuffer.list().find(function (item) {
      return item.id === id;
    });
    if (!entry) return;
    Object.assign(entry, patch || {});
    renderChatDebugLog();
  }

  function pushImagesDebugEntry(partial) {
    const entry = Object.assign(
      {
        id: "img-" + (++imagesDebugSeq),
        ts: new Date().toISOString().slice(11, 19),
        kind: "log",
        title: "",
        status: "info",
        request: null,
        response: null,
        details: null,
        imageLink: null,
      },
      partial || {}
    );
    imagesDebugBuffer.push(entry);
    renderImagesDebugLog();
    return entry;
  }

  function appendImagesDebugLog(line) {
    pushImagesDebugEntry({
      kind: "log",
      title: String(line || ""),
      status: "info",
    });
  }

  function setDebugPanelOpen(which) {
    const next = openDebugPanel === which ? null : which || null;
    openDebugPanel = next;
    const column = document.getElementById("column-right");
    if (column) column.classList.toggle("is-debug-expanded", !!next);
    ["chat", "images"].forEach(function (id) {
      const section = document.getElementById("debug-accordion-" + id);
      const toggle = document.getElementById("debug-" + id + "-toggle");
      const body = document.getElementById("debug-" + id + "-body");
      const open = next === id;
      if (section) section.classList.toggle("is-open", open);
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (body) body.hidden = !open;
    });
    if (next === "chat") renderChatDebugLog();
    if (next === "images") {
      renderImagesDebugLog();
      loadImageQueueForDebug();
    } else {
      maybeStopImageQueuePoll();
    }
  }

  function syncDebugLogSizeControl(size) {
    const decreaseBtn = document.getElementById("pref-debug-log-decrease");
    const increaseBtn = document.getElementById("pref-debug-log-increase");
    const valueEl = document.getElementById("pref-debug-log-value");
    if (decreaseBtn) decreaseBtn.disabled = size <= DEBUG_LOG_SIZE_MIN;
    if (increaseBtn) increaseBtn.disabled = size >= DEBUG_LOG_SIZE_MAX;
    if (valueEl) valueEl.textContent = String(size);
  }

  function setDebugLogSize(delta) {
    const current = getStoredDebugLogSize();
    let next = Math.round((current + (delta || 0)) / DEBUG_LOG_SIZE_STEP) * DEBUG_LOG_SIZE_STEP;
    next = Math.max(DEBUG_LOG_SIZE_MIN, Math.min(DEBUG_LOG_SIZE_MAX, next));
    setStoredDebugLogSize(next);
    chatDebugBuffer.trim();
    imagesDebugBuffer.trim();
    syncDebugLogSizeControl(next);
    renderChatDebugLog();
    renderImagesDebugLog();
  }

  function ingestQueueItemsForDebug(items) {
    (items || []).forEach(function (item) {
      if (!item || !item.id) return;
      const prev = imageQueueDebugSeen[item.id];
      if (prev === item.status) return;
      imageQueueDebugSeen[item.id] = item.status;
      if (prev == null && item.status !== "pending" && item.status !== "generating") {
        return;
      }
      const entry = {
        kind: "queue",
        title: item.scene_id ? "Escena " + item.scene_id : "Job " + item.id,
        status: item.status,
        details: {
          job_id: item.id,
          scene_id: item.scene_id,
          message_id: item.message_id,
          conversation_id: item.conversation_id,
          error: item.error_message || null,
          filename: item.result_filename || null,
        },
      };
      if (item.status === "completed") {
        entry.title = "Imagen generada · " + (item.result_filename || item.scene_id || item.id);
        entry.imageLink = {
          conversationId: item.conversation_id,
          messageId: item.message_id,
          filename: item.result_filename || "",
          sceneId: item.scene_id || "",
        };
      } else if (item.status === "failed") {
        entry.title = "Imagen fallida · " + (item.scene_id || item.id);
      } else if (item.status === "generating") {
        entry.title = "Generando imagen · " + (item.scene_id || item.id);
      } else if (item.status === "pending") {
        entry.title = "Encolada · " + (item.scene_id || item.id);
      }
      pushImagesDebugEntry(entry);
    });
  }

  function initDebugDock() {
    syncDebugLogSizeControl(getStoredDebugLogSize());
    const chatToggle = document.getElementById("debug-chat-toggle");
    const imagesToggle = document.getElementById("debug-images-toggle");
    if (chatToggle) {
      chatToggle.addEventListener("click", function () {
        setDebugPanelOpen("chat");
      });
    }
    if (imagesToggle) {
      imagesToggle.addEventListener("click", function () {
        setDebugPanelOpen("images");
      });
    }
    const stopBtn = document.getElementById("images-debug-stop");
    if (stopBtn) {
      stopBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        abortAllIllustrations();
      });
    }
    const prefDec = document.getElementById("pref-debug-log-decrease");
    const prefInc = document.getElementById("pref-debug-log-increase");
    if (prefDec) {
      prefDec.addEventListener("click", function () {
        if (!this.disabled) setDebugLogSize(-DEBUG_LOG_SIZE_STEP);
      });
    }
    if (prefInc) {
      prefInc.addEventListener("click", function () {
        if (!this.disabled) setDebugLogSize(DEBUG_LOG_SIZE_STEP);
      });
    }
    const dock = document.getElementById("debug-dock");
    if (dock) {
      dock.addEventListener("click", function (e) {
        const toggle = e.target.closest(".debug-entry-toggle");
        if (toggle && dock.contains(toggle)) {
          const body = toggle.parentElement && toggle.parentElement.querySelector(".debug-entry-body");
          if (!body) return;
          const open = body.hidden;
          body.hidden = !open;
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
          return;
        }
        const link = e.target.closest("a.debug-image-link");
        if (!link || !dock.contains(link)) return;
        e.preventDefault();
        openConversationAtIllustration(
          link.getAttribute("data-conversation-id"),
          link.getAttribute("data-message-id"),
          link.getAttribute("data-filename"),
          link.getAttribute("data-scene-id")
        );
      });
    }
  }

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

  function thinkOptionLabel(value) {
    const v = String(value);
    if (v === "false") return "Apagado";
    if (v === "true") return "Pensando";
    if (v === "low") return "Bajo";
    if (v === "medium") return "Medio";
    if (v === "high") return "Alto";
    if (v === "max") return "Máximo";
    return v;
  }

  function thinkSelectValue(value) {
    if (value === true || value === "true") return "true";
    if (value === false || value === "false") return "false";
    return value != null ? String(value) : "";
  }

  /** Etiqueta corta de ventana (p. ej. 262144 → 256K, 1048576 → 1M). */
  function formatContextWindowLabel(maxTokens) {
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

  /**
   * Cromos de capacidad desde el contrato (sin nombres de modelo).
   * Orden fijo: visión → thinking → tools → ventana.
   */
  function capabilityBadgesFromContract(contract) {
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

  function fillCapabilityBadgeHost(host, badges) {
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

  function renderCapabilityBadges() {
    const badges = capabilityBadgesFromContract(currentContract);
    fillCapabilityBadgeHost(document.getElementById("status-model-capabilities"), badges);
    fillCapabilityBadgeHost(document.getElementById("settings-model-capabilities"), badges);
  }

  function fillThinkOptions(control, thinking) {
    let values = Array.isArray(thinking.values) && thinking.values.length
      ? thinking.values.slice()
      : (thinking.kind === "boolean" ? ["false", "true"] : []);
    if (!thinking.can_disable) {
      values = values.filter((v) => v !== "false" && v !== false);
    }
    control.innerHTML = values
      .map((v) => `<option value="${thinkSelectValue(v)}">${thinkOptionLabel(v)}</option>`)
      .join("");
  }

  function syncContractParamBaselines() {
    if (!currentContract || !currentContract.params || typeof currentContract.params !== "object") return;
    Object.keys(currentContract.params).forEach((paramId) => {
      const spec = currentContract.params[paramId];
      if (spec && spec.default !== undefined) paramsBaseline[paramId] = spec.default;
    });
  }

  /** Aplica defaults del contrato a controles (temperature, num_ctx, think…). No usar si origen es user. */
  function applyContractParamDefaults() {
    if (!currentContract || !currentContract.params || typeof currentContract.params !== "object") return;
    syncContractParamBaselines();
    const defaults = {};
    Object.keys(currentContract.params).forEach((paramId) => {
      const spec = currentContract.params[paramId];
      if (spec && spec.default !== undefined) defaults[paramId] = spec.default;
    });
    applyUserParamsToControls(defaults);
  }

  const RECIPE_PARAM_ORDER = ["think", "temperature", "top_p", "top_k", "min_p", "num_ctx"];
  const RECIPE_PARAM_LABELS = {
    think: "Thinking",
    temperature: "Temperatura",
    top_p: "Top-p",
    top_k: "Top-k",
    min_p: "Min-p",
    num_ctx: "Ventana de contexto",
  };

  function currentRecipes() {
    return (currentContract && Array.isArray(currentContract.recipes)) ? currentContract.recipes : [];
  }

  function getCanonicalParamControl(paramId) {
    const nodes = document.querySelectorAll(`[data-control-id="${paramId}"]`);
    return Array.from(nodes).find((el) => {
      const tag = el.tagName;
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    }) || null;
  }

  function setControlValueIfChanged(control, value) {
    if (!control) return;
    const next = value === null || value === undefined ? "" : String(value);
    if (control.value !== next) control.value = next;
  }

  function readControlValue(control) {
    if (!control) return null;
    if (control.tagName === "INPUT" && control.type === "number") {
      return control.value === "" ? null : Number(control.value);
    }
    if (control.tagName === "TEXTAREA") return control.value;
    return control.value;
  }

  function paramValuesEqual(paramId, a, b) {
    if (paramId === "think") return thinkSelectValue(a) === thinkSelectValue(b);
    if (a === b) return true;
    if (a === null || a === undefined || a === "" || b === null || b === undefined || b === "") {
      return a === b || (a === "" && (b === null || b === undefined)) || (b === "" && (a === null || a === undefined));
    }
    if (typeof a === "number" || typeof b === "number" || (typeof a === "string" && a !== "" && !Number.isNaN(Number(a)) && typeof b === "string" && b !== "" && !Number.isNaN(Number(b)))) {
      return Number(a) === Number(b);
    }
    return String(a) === String(b);
  }

  function recipeIdsFromContract(contract) {
    const ids = [];
    const recipes = (contract && Array.isArray(contract.recipes)) ? contract.recipes : [];
    recipes.forEach((recipe) => {
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

  function recipeParamIds() {
    return recipeIdsFromContract(currentContract);
  }

  function recipeParamLabel(paramId) {
    const spec = paramsConfig.params && paramsConfig.params[paramId];
    return (spec && spec.label) || RECIPE_PARAM_LABELS[paramId] || paramId;
  }

  function recipeMatchesCurrentParams(recipe) {
    const params = (recipe && recipe.params) || {};
    return Object.keys(params).every((paramId) => {
      const control = getCanonicalParamControl(paramId);
      if (!control || control.disabled) return false;
      return paramValuesEqual(paramId, readControlValue(control), params[paramId]);
    });
  }

  function fillRecipeChipHost(host, recipes, applyFn) {
    if (!host) return;
    const list = Array.isArray(recipes) ? recipes : [];
    const apply = applyFn || applyModelRecipe;
    host.hidden = list.length === 0;
    host.innerHTML = "";
    list.forEach((recipe) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "composer-recipe-chip";
      btn.dataset.recipeId = recipe.id || "";
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = recipe.label || recipe.id;
      btn.addEventListener("click", () => apply(recipe));
      host.appendChild(btn);
    });
  }

  function syncRecipeChipSelection() {
    const recipes = currentRecipes();
    const active = recipes.find((recipe) => recipeMatchesCurrentParams(recipe));
    const activeId = active && active.id;
    document.querySelectorAll("#composer-recipes .composer-recipe-chip, #settings-recipes .composer-recipe-chip").forEach((btn) => {
      const on = Boolean(activeId && btn.dataset.recipeId === activeId);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const owned = (active && active.params) ? Object.keys(active.params) : [];
    document.querySelectorAll("#settings-recipe-params .settings-recipe-param").forEach((row) => {
      row.classList.toggle("is-owned", owned.includes(row.dataset.paramId));
    });
  }

  function writeMirrorToCanonical(mirror) {
    const paramId = mirror && mirror.getAttribute("data-recipe-param-id");
    const canonical = paramId ? getCanonicalParamControl(paramId) : null;
    if (!canonical || canonical.disabled) return;
    setControlValueIfChanged(canonical, mirror.value);
    canonical.dispatchEvent(new Event("input", { bubbles: true }));
    canonical.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function rebuildRecipeParamInspector() {
    const host = document.getElementById("settings-recipe-params");
    if (!host) return;
    const ids = recipeParamIds().filter((id) => id !== "think" && getCanonicalParamControl(id));
    host.innerHTML = "";
    if (!ids.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    ids.forEach((paramId) => {
      const canonical = getCanonicalParamControl(paramId);
      const row = document.createElement("div");
      row.className = "settings-recipe-param";
      row.dataset.paramId = paramId;
      const label = document.createElement("label");
      label.className = "settings-recipe-param-label";
      const controlId = "settings-recipe-param-" + paramId;
      label.setAttribute("for", controlId);
      label.textContent = recipeParamLabel(paramId);
      const mirror = canonical.cloneNode(true);
      mirror.removeAttribute("data-control-id");
      mirror.id = controlId;
      mirror.classList.add("param-control");
      mirror.setAttribute("data-recipe-param-id", paramId);
      mirror.addEventListener("input", () => writeMirrorToCanonical(mirror));
      mirror.addEventListener("change", () => writeMirrorToCanonical(mirror));
      row.appendChild(label);
      row.appendChild(mirror);
      host.appendChild(row);
    });
  }

  function syncSettingsPresetsMirrors() {
    const canonicalThink = document.getElementById("param-think");
    const settingsThink = document.getElementById("settings-think");
    if (canonicalThink && settingsThink) {
      if (settingsThink.innerHTML !== canonicalThink.innerHTML) {
        settingsThink.innerHTML = canonicalThink.innerHTML;
      }
      settingsThink.disabled = canonicalThink.disabled;
      settingsThink.classList.toggle("control-disabled", canonicalThink.classList.contains("control-disabled"));
      setControlValueIfChanged(settingsThink, canonicalThink.value);
    }
    document.querySelectorAll("[data-recipe-param-id]").forEach((mirror) => {
      const canonical = getCanonicalParamControl(mirror.getAttribute("data-recipe-param-id"));
      if (!canonical) return;
      mirror.disabled = canonical.disabled;
      mirror.classList.toggle("control-disabled", canonical.classList.contains("control-disabled"));
      ["min", "max", "step", "placeholder"].forEach((attr) => {
        if (canonical.hasAttribute(attr)) mirror.setAttribute(attr, canonical.getAttribute(attr));
      });
      setControlValueIfChanged(mirror, canonical.value);
    });
    syncRecipeChipSelection();
  }

  function applyThinkAndRecipesFromContract(opts) {
    const applyParamDefaults = Boolean(opts && opts.applyParamDefaults);
    const row = document.getElementById("composer-model-row");
    const wrap = document.getElementById("composer-think-wrap");
    const control = document.getElementById("param-think");
    const settingsWrap = document.getElementById("settings-think-wrap");
    const settingsThink = document.getElementById("settings-think");
    const settingsRow = document.getElementById("settings-presets-controls");
    const emptyEl = document.getElementById("settings-presets-empty");
    const thinking = currentContract && currentContract.capabilities && currentContract.capabilities.thinking;
    const recipes = currentRecipes();
    const showThink = Boolean(thinking && thinking.kind && thinking.kind !== "none");
    const showRecipes = recipes.length > 0;
    if (row) row.hidden = !showThink && !showRecipes;
    if (settingsRow) settingsRow.hidden = !showThink && !showRecipes;
    if (emptyEl) emptyEl.hidden = showRecipes;
    if (wrap) wrap.hidden = !showThink;
    if (settingsWrap) settingsWrap.hidden = !showThink;
    if (control) {
      if (showThink) {
        fillThinkOptions(control, thinking);
        const spec = (currentContract.params && currentContract.params.think) || {
          api_key: "think",
          type: thinking.kind === "levels" ? "enum" : "boolean",
          default: thinking.default,
        };
        paramsConfig.params.think = spec;
        control.disabled = false;
        control.classList.remove("control-disabled");
        const def = spec.default !== undefined ? spec.default : thinking.default;
        if (def !== undefined && def !== null) paramsBaseline.think = def;
        const allowed = Array.from(control.options).map((o) => o.value);
        if (applyParamDefaults && def !== undefined && def !== null) {
          control.value = thinkSelectValue(def);
        } else if (!allowed.includes(control.value) && def !== undefined && def !== null) {
          control.value = thinkSelectValue(def);
        }
      } else {
        control.disabled = true;
        control.classList.add("control-disabled");
        control.innerHTML = "";
        if (paramsConfig.params) delete paramsConfig.params.think;
      }
    }
    if (settingsThink) {
      if (showThink && control) {
        settingsThink.innerHTML = control.innerHTML;
        settingsThink.disabled = false;
        settingsThink.classList.remove("control-disabled");
        setControlValueIfChanged(settingsThink, control.value);
      } else {
        settingsThink.disabled = true;
        settingsThink.classList.add("control-disabled");
        settingsThink.innerHTML = "";
      }
    }
    fillRecipeChipHost(document.getElementById("composer-recipes"), recipes);
    fillRecipeChipHost(document.getElementById("settings-recipes"), recipes);
    const numCtx = document.getElementById("param-num-ctx");
    const ctxSpec = currentContract && currentContract.params && currentContract.params.num_ctx;
    if (numCtx && ctxSpec && ctxSpec.max != null) {
      numCtx.setAttribute("max", String(ctxSpec.max));
    }
    syncContractParamBaselines();
    if (applyParamDefaults) applyContractParamDefaults();
    renderCapabilityBadges();
    rebuildRecipeParamInspector();
    syncSettingsPresetsMirrors();
  }

  async function loadModelContract(opts) {
    const applyParamDefaults = Boolean(opts && opts.applyParamDefaults);
    const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "";
    const modelId = (el.modelSelect && el.modelSelect.value) || "";
    if (!provider || !modelId) {
      currentContract = null;
      applyThinkAndRecipesFromContract({ applyParamDefaults: false });
      return;
    }
    try {
      currentContract = await fetchJson(
        `${API}/providers/${encodeURIComponent(provider)}/models/${encodeURIComponent(modelId)}/contract`
      );
      if (currentContract && currentContract.params && typeof currentContract.params === "object") {
        paramsConfig.params = { ...paramsConfig.params, ...currentContract.params };
      }
    } catch (_) {
      currentContract = null;
    }
    applyThinkAndRecipesFromContract({ applyParamDefaults });
  }

  function applyModelRecipe(recipe) {
    if (!recipe || typeof recipe !== "object") return;
    if (paramsSource === "user") {
      const label = recipe.label || recipe.id || "esta receta";
      const ok = window.confirm(
        `Esto sustituye los ajustes de esta conversación por la receta «${label}». ¿Continuar?`
      );
      if (!ok) return;
    }
    applyUserParamsToControls(recipe.params || {});
    paramsSource = "user";
    renderParamsSourceLabel();
    renderParamsToSend();
    syncSettingsPresetsMirrors();
    if (currentConversationId) {
      fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({ model_params: buildModelParams() }),
      }).catch(() => {});
    }
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
          await loadModelContract({ applyParamDefaults: false });
          showNotice("Parámetros restaurados al preset del modelo.");
          return;
        }
      } catch (_) {}
    }
    applyParamsConfig();
    paramsSource = "default";
    await loadModelContract({ applyParamDefaults: true });
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
    syncSettingsPresetsMirrors();
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
    syncSettingsPresetsMirrors();
  }
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
    syncSettingsPresetsMirrors();
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

  function collectAllModelParams() {
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
      out[paramId] = current;
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
    await loadModelContract({ applyParamDefaults: paramsSource !== "user" });
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
      const sort = readStoredConversationSort();
      const list = await fetchJson(`${API}/conversations?sort=${encodeURIComponent(sort)}`);
      renderConversationsList(list);
      if (currentAutoTitle && currentConversationId && el.conversationTitle) {
        const item = (list || []).find(function (c) { return c.id === currentConversationId; });
        if (item && item.title) el.conversationTitle.value = item.title;
      }
      await loadDeletedConversations();
    } catch (e) {
      showError("Error al cargar conversaciones: " + e.message);
    }
  }

  const LEFT_HISTORY_MODE_KEY = "leftHistoryMode";
  const LEFT_HISTORY_SORT_CONVERSATIONS_KEY = "leftHistorySortConversations";
  const LEFT_HISTORY_SORT_MESSAGES_KEY = "leftHistorySortMessages";
  const CONV_SORT_OPTIONS = [
    { value: "activity", label: "Actividad" },
    { value: "created_at", label: "Creación" },
  ];
  const MSG_SORT_OPTIONS = [
    { value: "message", label: "Mensaje" },
    { value: "image", label: "Imagen" },
  ];
  const MESSAGE_HISTORY_PAGE_SIZE = 50;
  const MESSAGE_HISTORY_SEARCH_DEBOUNCE_MS = 280;

  function currentMessageHistoryQuery() {
    return ((el.messageHistorySearch && el.messageHistorySearch.value) || "").trim();
  }

  function mergeMessageHistoryItems(existing, incoming) {
    const seen = {};
    const out = [];
    (existing || []).concat(incoming || []).forEach(function (item) {
      if (!item || !item.id || seen[item.id]) return;
      seen[item.id] = true;
      out.push(item);
    });
    return out;
  }

  function onMessageHistorySearchInput() {
    if (messageHistorySearchTimer) clearTimeout(messageHistorySearchTimer);
    messageHistorySearchTimer = setTimeout(function () {
      messageHistorySearchTimer = null;
      if (!isMessagesHistoryMode()) return;
      loadMessageHistory();
    }, MESSAGE_HISTORY_SEARCH_DEBOUNCE_MS);
  }

  function isMessagesHistoryMode() {
    return leftHistoryMode === "messages";
  }

  function readStoredConversationSort() {
    try {
      return localStorage.getItem(LEFT_HISTORY_SORT_CONVERSATIONS_KEY) === "created_at"
        ? "created_at"
        : "activity";
    } catch (_) {
      return "activity";
    }
  }

  function persistConversationSort(sort) {
    try {
      localStorage.setItem(
        LEFT_HISTORY_SORT_CONVERSATIONS_KEY,
        sort === "created_at" ? "created_at" : "activity"
      );
    } catch (_) {}
  }

  function readStoredMessageSort() {
    try {
      return localStorage.getItem(LEFT_HISTORY_SORT_MESSAGES_KEY) === "image" ? "image" : "message";
    } catch (_) {
      return "message";
    }
  }

  function persistMessageSort(sort) {
    try {
      localStorage.setItem(
        LEFT_HISTORY_SORT_MESSAGES_KEY,
        sort === "image" ? "image" : "message"
      );
    } catch (_) {}
  }

  function currentLeftHistorySort() {
    return isMessagesHistoryMode() ? readStoredMessageSort() : readStoredConversationSort();
  }

  function syncLeftHistorySortControl() {
    const select = el.leftHistorySortSelect;
    if (!select) return;
    const options = isMessagesHistoryMode() ? MSG_SORT_OPTIONS : CONV_SORT_OPTIONS;
    const current = currentLeftHistorySort();
    select.innerHTML = options
      .map(function (o) {
        return `<option value="${o.value}">${o.label}</option>`;
      })
      .join("");
    select.value = current;
  }

  function onLeftHistorySortChange() {
    const value = el.leftHistorySortSelect && el.leftHistorySortSelect.value;
    if (isMessagesHistoryMode()) {
      persistMessageSort(value === "image" ? "image" : "message");
    } else {
      persistConversationSort(value === "created_at" ? "created_at" : "activity");
    }
    refreshLeftHistory();
  }

  function readStoredLeftHistoryMode() {
    try {
      return localStorage.getItem(LEFT_HISTORY_MODE_KEY) === "messages" ? "messages" : "conversations";
    } catch (_) {
      return "conversations";
    }
  }

  function persistLeftHistoryMode(mode) {
    try {
      localStorage.setItem(LEFT_HISTORY_MODE_KEY, mode);
    } catch (_) {}
  }

  function isConsultaChromeActive() {
    return isMessagesHistoryMode() || Boolean(consultaAssistantId);
  }

  function applyConsultaChrome() {
    if (isConsultaChromeActive()) {
      document.documentElement.setAttribute("data-history-consulta", "on");
    } else {
      document.documentElement.removeAttribute("data-history-consulta");
    }
    if (el.btnHistoryMessages) {
      el.btnHistoryMessages.setAttribute("aria-pressed", isMessagesHistoryMode() ? "true" : "false");
    }
    syncMessageHistoryChrome();
  }

  function syncMessageHistoryChrome() {
    const show = isMessagesHistoryMode();
    if (el.messageHistorySearchWrap) el.messageHistorySearchWrap.hidden = !show;
    if (!show && el.messageHistoryPager) {
      el.messageHistoryPager.hidden = true;
      el.messageHistoryPager.innerHTML = "";
    }
  }

  function messagesForDisplay() {
    if (!consultaAssistantId) return messages;
    const assistant = messages.find(function (m) { return m.id === consultaAssistantId; });
    if (!assistant) return messages;
    const parent = assistant.parent_id
      ? messages.find(function (m) { return m.id === assistant.parent_id; })
      : null;
    return parent ? [parent, assistant] : [assistant];
  }

  function syncMessageHistoryActiveItem() {
    if (!el.conversationsList) return;
    el.conversationsList.querySelectorAll(".message-history-item").forEach(function (node) {
      node.classList.toggle("active", node.dataset.id === consultaAssistantId);
    });
  }

  async function refreshLeftHistory() {
    syncLeftHistorySortControl();
    if (isMessagesHistoryMode()) return loadMessageHistory();
    return loadConversations();
  }

  async function loadMessageHistory(options) {
    const append = !!(options && options.append);
    if (el.conversationsTrash) el.conversationsTrash.hidden = true;
    syncMessageHistoryChrome();
    if (!append) {
      messageHistoryItems = [];
      messageHistoryTotal = 0;
      messageHistorySearchIn = null;
    }
    const seq = ++messageHistoryLoadSeq;
    const sort = readStoredMessageSort();
    const params = new URLSearchParams();
    params.set("sort", sort);
    params.set("limit", String(MESSAGE_HISTORY_PAGE_SIZE));
    params.set("offset", String(append ? messageHistoryItems.length : 0));
    const q = currentMessageHistoryQuery();
    if (q) params.set("q", q);
    try {
      const data = await fetchJson(`${API}/messages?${params.toString()}`);
      if (seq !== messageHistoryLoadSeq) return;
      const incoming = (data && data.items) || [];
      messageHistoryTotal = data && typeof data.total === "number" ? data.total : incoming.length;
      messageHistorySearchIn = data && data.search_in ? data.search_in : null;
      messageHistoryItems = append
        ? mergeMessageHistoryItems(messageHistoryItems, incoming)
        : incoming;
      renderMessageHistoryList(messageHistoryItems);
    } catch (e) {
      if (seq !== messageHistoryLoadSeq) return;
      showError("Error al cargar mensajes: " + e.message);
    }
  }

  async function setLeftHistoryMode(mode) {
    leftHistoryMode = mode === "messages" ? "messages" : "conversations";
    persistLeftHistoryMode(leftHistoryMode);
    applyConsultaChrome();
    syncLeftHistorySortControl();
    await refreshLeftHistory();
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
      await refreshLeftHistory();
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

  function conversationWhenIso(c, sort) {
    if (sort === "created_at") return c.created_at;
    return c.last_message_at || c.updated_at;
  }

  function conversationGroupTs(c, childrenByParent, sort) {
    if (sort === "created_at") return new Date(c.created_at || 0).getTime();
    return conversationActivityTs(c, childrenByParent);
  }

  function buildConversationForest(list, sort) {
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
        (a, b) => conversationGroupTs(b, childrenByParent, sort) - conversationGroupTs(a, childrenByParent, sort)
      );
    });
    const roots = list.filter(
      (c) => !c.forked_from_conversation_id || !byId.has(c.forked_from_conversation_id)
    );
    return { roots, childrenByParent };
  }

  function renderConversationsList(list) {
    if (!el.conversationsList) return;
    const sort = readStoredConversationSort();
    const { roots, childrenByParent } = buildConversationForest(list || [], sort);
    const groups = { hoy: [], ayer: [], semana: [], anteriores: [] };
    roots.forEach((c) => {
      const g = getConversationGroup(new Date(conversationGroupTs(c, childrenByParent, sort)));
      groups[g].push(c);
    });
    const order = ["hoy", "ayer", "semana", "anteriores"];
    const renderItem = (c, depth) => {
      const when = formatDate(conversationWhenIso(c, sort));
      const meta = `${c.provider || "ollama"}/${c.model_id} · ${when}`;
      const kids = childrenByParent.get(c.id) || [];
      const item = `<div class="conversation-item ${c.id === currentConversationId ? "active" : ""} ${depth ? "conversation-item-fork" : ""}" data-id="${escapeHtml(c.id)}" data-depth="${depth}" title="${escapeHtml(meta)}" style="padding-left: ${8 + depth * 14}px">
                <div class="conv-row">
                  <span class="conv-title">${c.kind === "prompt_generator" ? '<span class="conv-kind-badge" title="Prompt generator">txt2img</span> ' : ""}${escapeHtml(c.title)}</span>
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

  function messageHistoryWhenIso(item, sort) {
    if (sort === "image" && item.latest_image_at) return item.latest_image_at;
    return item.created_at;
  }

  function renderMessageHistoryList(list) {
    if (!el.conversationsList) return;
    const items = list || [];
    const q = currentMessageHistoryQuery();
    if (items.length === 0) {
      el.conversationsList.innerHTML = q
        ? '<p class="conv-group-label">Sin resultados.</p>'
        : '<p class="conv-group-label">No hay respuestas todavía.</p>';
      renderMessageHistoryPager();
      return;
    }
    const sort = readStoredMessageSort();
    const groups = { hoy: [], ayer: [], semana: [], anteriores: [] };
    items.forEach(function (item) {
      groups[getConversationGroup(messageHistoryWhenIso(item, sort))].push(item);
    });
    const order = ["hoy", "ayer", "semana", "anteriores"];
    el.conversationsList.innerHTML = order
      .filter(function (key) { return groups[key].length > 0; })
      .map(function (key) {
        const header = `<div class="conv-group-label" aria-hidden="true">${escapeHtml(CONV_GROUP_LABELS[key])}</div>`;
        const rows = groups[key]
          .map(function (item) {
            const created = formatDateTime(item.created_at);
            const preview = item.content_preview || "(sin texto)";
            const convTitle = item.conversation_title || "Conversación";
            const active = item.id === consultaAssistantId ? " active" : "";
            const createdAttr = item.created_at ? escapeHtml(item.created_at) : "";
            return `<div class="conversation-item message-history-item${active}" data-id="${escapeHtml(item.id)}" data-conversation-id="${escapeHtml(item.conversation_id)}" title="${escapeHtml(convTitle + " · " + created)}">
                <div class="conv-row">
                  <span class="conv-title">${escapeHtml(preview)}</span>
                </div>
                <time class="conv-meta message-history-created" datetime="${createdAttr}">${escapeHtml(created)}</time>
              </div>`;
          })
          .join("");
        return header + rows;
      })
      .join("");
    el.conversationsList.querySelectorAll(".message-history-item").forEach(function (node) {
      node.addEventListener("click", function () {
        openConsultaTurn(node.dataset.conversationId, node.dataset.id);
      });
    });
    renderMessageHistoryPager();
  }

  function renderMessageHistoryPager() {
    const pager = el.messageHistoryPager;
    if (!pager) return;
    if (!isMessagesHistoryMode()) {
      pager.hidden = true;
      pager.innerHTML = "";
      return;
    }
    const loaded = messageHistoryItems.length;
    const total = messageHistoryTotal;
    const q = currentMessageHistoryQuery();
    let html = "";
    if (q && messageHistorySearchIn === "content" && loaded > 0) {
      html += '<p class="message-history-search-hint">Sin coincidencias en el título; resultados en el texto.</p>';
    }
    if (loaded > 0) {
      html += '<span class="message-history-page-meta">' + loaded + " / " + total + "</span>";
    }
    if (loaded < total) {
      html +=
        '<button type="button" class="btn btn-secondary btn-small message-history-load-more" id="message-history-load-more">Cargar más</button>';
    }
    pager.innerHTML = html;
    pager.hidden = html === "";
    const more = document.getElementById("message-history-load-more");
    if (more) {
      more.addEventListener("click", function () {
        loadMessageHistory({ append: true });
      });
    }
  }

  async function deleteConversation(id) {
    try {
      const res = await fetch(`${API}/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      if (currentConversationId === id) setCurrentConversation(null);
      refreshLeftHistory();
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

  function formatDateTime(iso) {
    try {
      const d = new Date(iso);
      const sameYear = d.getFullYear() === new Date().getFullYear();
      return d.toLocaleString("es", {
        day: "numeric",
        month: "short",
        year: sameYear ? undefined : "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
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
  function formatMessageHtml(content, paragraphStart) {
    const startIndex = paragraphStart == null ? 0 : paragraphStart;
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
      const plain = tokens.map((tok) => tok.v).join("");
      return wrapNarrativeParagraphs(plain, startIndex);
    }
    return layoutIllustratedHtml(tokens, startIndex);
  }

  function stripIllustrationArtifactsClient(text) {
    return String(text || "")
      .replace(/<img\b[^>]*class="[^"]*chat-illustration[^"]*"[^>]*>/gi, "")
      .replace(
        /<span\b[^>]*class="[^"]*chat-illustration-(?:error|placeholder)[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
        ""
      )
      .replace(/⟦img:[^⟧]+⟧/g, "");
  }

  function countNarrativeParagraphs(content) {
    return splitIllustrationParagraphs(stripIllustrationArtifactsClient(content)).length;
  }

  function narrativeParagraphHtml(text, index, className) {
    return (
      `<div class="${className} chat-paragraph" data-paragraph-index="${index}">` +
      `${escapeHtml(text).replace(/\n/g, "<br>")}</div>`
    );
  }

  function wrapNarrativeParagraphs(text, startIndex) {
    const paras = splitIllustrationParagraphs(text);
    if (!paras.length) {
      const raw = String(text || "");
      if (!raw.trim()) return "";
      return narrativeParagraphHtml(raw, startIndex, "illustration-lead");
    }
    return paras
      .map((p, i) => narrativeParagraphHtml(p, startIndex + i, "illustration-lead"))
      .join("");
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
  function layoutIllustratedHtml(tokens, paragraphStart) {
    const startIndex = paragraphStart == null ? 0 : paragraphStart;
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
    let paraIndex = startIndex;
    while (i < items.length) {
      const item = items[i];
      if (item.kind === "para") {
        out.push(narrativeParagraphHtml(item.v, paraIndex, "illustration-lead"));
        paraIndex += 1;
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
      const ownerIndex = paraIndex > 0 ? paraIndex - 1 : Math.max(0, startIndex - 1);
      const wrapHtml = wrapParas
        .map((p) => {
          const html = narrativeParagraphHtml(p.v, paraIndex, "illustration-wrap");
          paraIndex += 1;
          return html;
        })
        .join("");
      out.push(
        `<div class="illustration-unit" data-owner-paragraph-index="${ownerIndex}">${item.v}${wrapHtml}</div>`
      );
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

  /** Claves de mensajes assistant que el usuario ha plegado. El resto colapsable permanece abierto. */
  const collapsedMessageKeys = new Set();

  function collapseAllMessages() {
    messages.forEach((m, idx) => {
      if (m.role === "user" || m.ephemeral_debug) return;
      if (!(m.content && String(m.content).trim())) return;
      if (!splitFirstParagraph(m.content).collapsible) return;
      collapsedMessageKeys.add(messageCollapseKey(m, idx));
    });
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
      img.addEventListener("error", function () {
        frame.classList.add("chat-illustration-missing");
      });
      if (img.complete && img.naturalWidth === 0) {
        frame.classList.add("chat-illustration-missing");
      }
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
    applyIllustrationFilterToRoot(root);
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

  function buildCollapsibleMessageHtml(content, key, collapsed) {
    const parts = splitFirstParagraph(content);
    if (!parts.collapsible) {
      return `<div class="message-content">${formatMessageHtml(content || "", 0)}</div>`;
    }
    const toggleLabel = collapsed ? "Show more" : "Show less";
    const restOffset = countNarrativeParagraphs(parts.first);
    return `<div class="message-body-collapsible${collapsed ? " is-collapsed" : ""}" data-collapse-key="${escapeHtml(key)}">
      <div class="message-content-preview">${formatMessageHtml(parts.first, 0)}</div>
      <div class="message-content-rest">${formatMessageHtml(parts.rest, restOffset)}</div>
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
      if (isMessagesHistoryMode()) await setLeftHistoryMode("conversations");
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

  async function setCurrentConversation(conv, options) {
    const preserveView = !!(options && options.preserveView);
    if (!(options && options.keepConsulta)) {
      consultaAssistantId = null;
    }
    applyConsultaChrome();
    const previousConvId = currentConversationId;
    if (previousConvId && (!conv || conv.id !== previousConvId)) {
      const payload = {};
      if (el.instructionOverride) {
        payload.instruction_override = (el.instructionOverride.value || "").trim() || null;
      }
      if (el.conversationTitle && !currentAutoTitle) {
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
    currentConversationKind = (conv && conv.kind) ? conv.kind : "chat";
    updatePromptGeneratorComposerUi();
    saveLastConversationId(currentConversationId);
    if (el.instructionOverride) {
      el.instructionOverride.value = (conv && conv.instruction_override != null) ? conv.instruction_override : "";
    }
    if (conv) {
      if (el.conversationTitle) el.conversationTitle.value = conv.title;
      applyAutoTitleUi(Boolean(conv.auto_title));
      currentProvider = conv.provider || "ollama";
      if (el.providerSelect) el.providerSelect.value = currentProvider;
      await loadModels(false);
      if (el.modelSelect) {
        el.modelSelect.value = conv.model_id;
        refreshModelSelectUI();
      }
      rules = normalizeRulesFromApi(conv.system_instructions, conv.system_instruction_global);
      await loadParamsForProvider(currentProvider);
      await loadModelContract({ applyParamDefaults: false });
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
            applyContractParamDefaults();
          }
        } catch (_) {
          paramsSource = "default";
          applyContractParamDefaults();
        }
      }
      applyConversationTree(conv);
      if (!preserveView) collapsedMessageKeys.clear();
      const turns = conv.history_turns != null && conv.history_turns >= 0 ? conv.history_turns : 5;
      if (el.historyTurnsInput) el.historyTurnsInput.value = String(Math.min(100, Math.max(0, turns)));
      if (conv.images && typeof conv.images === "object") {
        await applyImagesSnapshot(conv.images);
      } else {
        persistImagesToConversation();
      }
    } else {
      if (el.conversationTitle) el.conversationTitle.value = "Nueva conversación";
      applyAutoTitleUi(false);
      currentProvider = providers[0] || "ollama";
      if (el.providerSelect) el.providerSelect.value = currentProvider;
      if (el.modelSelect) {
        el.modelSelect.value = models[0] || "";
        refreshModelSelectUI();
      }
      rules = [];
      await loadParamsForProvider(currentProvider);
      await loadModelContract({ applyParamDefaults: true });
      await ensureParamsBaselineForCurrentModel();
      paramsSource = "default";
      resetConversationTree();
      collapsedMessageKeys.clear();
      if (el.historyTurnsInput) el.historyTurnsInput.value = "5";
    }
    renderRules();
    renderParamsSourceLabel();
    renderParamsToSend();
    renderMessages();
    if (options && options.keepConsulta) {
      if (conv) scheduleScrollMessagesToTop();
      syncMessageHistoryActiveItem();
    } else {
      if (conv && !preserveView) scheduleScrollMessagesToBottom();
      refreshLeftHistory();
    }
    lastUsage = null;
    await loadContextLength();
    // Si el panel Reglas está abierto, refrescar el selector para mostrar todas las reglas de la biblioteca (incl. creadas en otras conversaciones).
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
    consultaAssistantId = null;
    applyConsultaChrome();
    setChatPanelVisible(true);
    if (isGalleryPanelVisible()) {
      galleryUserChoseAll = false;
      galleryScopeAll = false;
      galleryMessageId = null;
    }
    try {
      const conv = await fetchJson(`${API}/conversations/${id}`);
      await setCurrentConversation(conv, options);
      if (isGalleryPanelVisible()) {
        galleryOffset = 0;
        await refreshGalleryAfterScopeChange();
      }
    } catch (e) {
      showError("Error al abrir conversación: " + e.message);
    }
  }

  async function openConsultaTurn(conversationId, assistantId) {
    if (!conversationId || !assistantId) return;
    setChatPanelVisible(true);
    consultaAssistantId = assistantId;
    applyConsultaChrome();
    try {
      const conv = await fetchJson(`${API}/conversations/${conversationId}`);
      await setCurrentConversation(conv, { preserveView: true, keepConsulta: true });
    } catch (e) {
      showError("Error al abrir el mensaje: " + e.message);
    }
  }

  function updatePromptGeneratorComposerUi() {
    const isPg = currentConversationKind === "prompt_generator";
    if (el.btnGeneratePrompt) el.btnGeneratePrompt.hidden = !isPg;
  }

  function splitTxt2imgPrompt(content) {
    const re = /```txt2img-prompt\n([\s\S]*?)\n```/;
    const raw = content || "";
    const m = raw.match(re);
    if (!m) return { text: raw, prompt: null };
    return { text: raw.replace(re, "").trim(), prompt: m[1].trim() };
  }

  function bindTxt2imgPromptCopyButtons(root) {
    (root || document).querySelectorAll(".txt2img-prompt-copy").forEach((btn) => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const block = btn.closest(".txt2img-prompt-block");
        const pre = block && block.querySelector("pre");
        const value = pre ? pre.textContent : "";
        try {
          await navigator.clipboard.writeText(value);
          const prev = btn.textContent;
          btn.textContent = "Copiado";
          setTimeout(() => { btn.textContent = prev; }, 1200);
        } catch (err) {
          showError("No se pudo copiar: " + (err && err.message ? err.message : err));
        }
      });
    });
  }

  async function newPromptGeneratorConversation() {
    if (isMessagesHistoryMode()) await setLeftHistoryMode("conversations");
    consultaAssistantId = null;
    applyConsultaChrome();
    setChatPanelVisible(true);
    try {
      const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama";
      const model = (el.modelSelect && el.modelSelect.value) || (models[0] || "");
      const conv = await fetchJson(`${API}/conversations`, {
        method: "POST",
        body: JSON.stringify({
          kind: "prompt_generator",
          model_id: model,
          provider: provider,
          images: imagesSnapshotForConversation(),
        }),
      });
      await setCurrentConversation(conv);
    } catch (e) {
      showError("Error al crear prompt generator: " + e.message);
    }
  }

  async function sendPromptGeneratorTurn(options) {
    if (isConsultaChromeActive()) return;
    if (currentAbortController) return;
    const force = !!(options && options.force);
    const content = force ? ((el.messageInput && el.messageInput.value.trim()) || "") : ((el.messageInput && el.messageInput.value.trim()) || "");
    if (!force && !content) return;

    if (!currentConversationId || currentConversationKind !== "prompt_generator") {
      await newPromptGeneratorConversation();
      if (!currentConversationId) return;
    }

    if (el.messageInput) el.messageInput.value = "";
    const chatStatusId = appStatus.push("chat", "chat.preparing");
    currentAbortController = new AbortController();
    setComposerPrimaryActionState();
    try {
      appStatus.update(chatStatusId, "chat.sending");
      const body = { force: force };
      if (content) body.message = content;
      await fetchJson(`${API}/conversations/${currentConversationId}/prompt-generator/turn`, {
        method: "POST",
        body: JSON.stringify(body),
        signal: currentAbortController.signal,
      });
      await openConversation(currentConversationId, { preserveView: true });
      appStatus.update(chatStatusId, "chat.finalizing");
    } catch (e) {
      if (e && e.name === "AbortError") {
        appStatus.update(chatStatusId, "chat.cancelled");
      } else {
        appStatus.update(chatStatusId, "chat.error");
        showError("Error en prompt generator: " + (e && e.message ? e.message : e));
      }
    } finally {
      appStatus.pop(chatStatusId);
      currentAbortController = null;
      setComposerPrimaryActionState();
    }
  }

  async function newConversation() {
    if (isMessagesHistoryMode()) await setLeftHistoryMode("conversations");
    consultaAssistantId = null;
    applyConsultaChrome();
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
          auto_title: Boolean(el.conversationAutoTitle && el.conversationAutoTitle.checked),
          model_id: model,
          provider: provider,
          system_instructions: rules.length ? rules : null,
          images: imagesSnapshotForConversation(),
        }),
      });
      await setCurrentConversation(conv);
    } catch (e) {
      showError("Error al crear conversación: " + e.message);
    }
  }

  function applyAutoTitleUi(enabled) {
    currentAutoTitle = Boolean(enabled);
    if (el.conversationAutoTitle) el.conversationAutoTitle.checked = currentAutoTitle;
    if (el.conversationTitle) el.conversationTitle.readOnly = currentAutoTitle;
  }

  async function commitAutoTitleFlag() {
    if (!el.conversationAutoTitle) return;
    applyAutoTitleUi(el.conversationAutoTitle.checked);
    if (!currentConversationId) return;
    try {
      const conv = await fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({ auto_title: currentAutoTitle }),
      });
      if (el.conversationTitle && conv && conv.title) el.conversationTitle.value = conv.title;
      refreshLeftHistory();
    } catch (e) {
      showError("Error al guardar el título automático: " + e.message);
    }
  }

  async function commitConversationTitle() {
    if (!el.conversationTitle || currentAutoTitle) return;
    const title = el.conversationTitle.value.trim() || getDefaultConversationTitle();
    if (el.conversationTitle.value !== title) el.conversationTitle.value = title;
    if (!currentConversationId) return;
    try {
      await fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({ title }),
      });
      refreshLeftHistory();
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
          title: currentAutoTitle
            ? undefined
            : ((el.conversationTitle && el.conversationTitle.value.trim()) || getDefaultConversationTitle()),
          auto_title: currentAutoTitle,
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
      await setCurrentConversation(conv, { preserveView: true });
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
      if (consultaAssistantId === messageId) {
        consultaAssistantId = null;
        applyConsultaChrome();
      }
      syncVisibleMessages();
      renderMessages();
      refreshLeftHistory();
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

  function isMessagesScrolledToBottom(threshold) {
    const container = el.messagesContainer;
    if (!container) return true;
    const slack = threshold == null ? 64 : threshold;
    return container.scrollTop + container.clientHeight >= container.scrollHeight - slack;
  }

  function isMessagesScrolledToTop(threshold) {
    const container = el.messagesContainer;
    if (!container) return true;
    const slack = threshold == null ? 64 : threshold;
    return container.scrollTop <= slack;
  }

  function scrollMessagesToBottom() {
    if (!el.messagesContainer) return;
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
  }

  function scrollMessagesToTop() {
    if (!el.messagesContainer) return;
    el.messagesContainer.scrollTop = 0;
  }

  let scrollToBottomGeneration = 0;

  function cancelScheduledScrollToBottom() {
    scrollToBottomGeneration += 1;
  }

  /** Scroll al final al abrir una conversación; se anula si el usuario navega a un mensaje concreto. */
  function scheduleScrollMessagesToBottom() {
    const generation = ++scrollToBottomGeneration;
    const run = function () {
      if (generation !== scrollToBottomGeneration) return;
      scrollMessagesToBottom();
    };
    const followLayout = function () {
      if (generation !== scrollToBottomGeneration) return;
      if (isMessagesScrolledToBottom(96)) scrollMessagesToBottom();
    };
    run();
    requestAnimationFrame(function () {
      run();
      requestAnimationFrame(run);
    });
    window.setTimeout(followLayout, 120);
    window.setTimeout(followLayout, 400);
  }

  /** Scroll al inicio al abrir una consulta; se anula si el usuario ya se alejó del top. */
  function scheduleScrollMessagesToTop() {
    const generation = ++scrollToBottomGeneration;
    const run = function () {
      if (generation !== scrollToBottomGeneration) return;
      scrollMessagesToTop();
    };
    const followLayout = function () {
      if (generation !== scrollToBottomGeneration) return;
      if (isMessagesScrolledToTop(96)) scrollMessagesToTop();
    };
    run();
    requestAnimationFrame(function () {
      run();
      requestAnimationFrame(run);
    });
    window.setTimeout(followLayout, 120);
    window.setTimeout(followLayout, 400);
  }

  function renderMessages() {
    if (!el.messagesContainer) return;
    const displayMessages = messagesForDisplay();
    if (displayMessages.length === 0) {
      el.messagesContainer.innerHTML = '<div class="empty-state chat-empty-state"><div class="empty-state-inner"><img src="/static/img/logo_256.png" alt="" class="empty-state-logo" /><p class="empty-state-text">Empieza escribiendo una orden. El agente mantendrá el contexto técnico y el tono estable.</p></div></div>';
      return;
    }
    const prevScrollTop = el.messagesContainer.scrollTop;
    const consulta = Boolean(consultaAssistantId);
    el.messagesContainer.innerHTML = displayMessages
      .map(
        (m, displayIdx) => {
          const idx = (function () {
            const found = messages.findIndex((x) => x === m || (m.id && x.id === m.id));
            return found >= 0 ? found : displayIdx;
          })();
          const hasContent = m.content && m.content.trim();
          const isEphemeralDebug = !!m.ephemeral_debug;
          const toInputBtn = hasContent && !isEphemeralDebug && !consulta
            ? `<button type="button" class="msg-action-btn msg-to-input-btn" data-msg-index="${idx}" title="Enviar texto al cuadro de mensaje">${msgToInputIconSvg}</button>`
            : "";
          const isInherited = !!m.inherited;
          const deleteCopyBtns = m.id && !isEphemeralDebug
            ? `${isInherited ? "" : `<button type="button" class="msg-action-btn msg-delete-btn" data-msg-id="${escapeHtml(m.id)}" title="Eliminar del historial">${msgDeleteIconSvg}</button>`}
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
          const illustrationItems =
            m.role === "assistant" && hasContent
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
          const isUser = m.role === "user";
          const rowClass = `${isUser ? "message-row user-row" : "message-row"}${isInherited ? " message-row-inherited" : ""}`;
          const inheritedSplit = isInherited && (!displayMessages[displayIdx + 1] || displayMessages[displayIdx + 1].inherited !== true)
            ? `<div class="message-inherited-split">Historial de la conversación original</div>`
            : "";
          const bubbleClass = isUser ? "message-bubble user" : "message-bubble assistant";
          const collapseKey = messageCollapseKey(m, idx);
          let bodyHtml;
          const splitPg = (!isUser && hasContent) ? splitTxt2imgPrompt(m.content || "") : null;
          if (splitPg && splitPg.prompt) {
            const prose = splitPg.text
              ? `<div class="message-content">${formatMessageHtml(splitPg.text, 0)}</div>`
              : "";
            bodyHtml = `${prose}<div class="txt2img-prompt-block"><div class="txt2img-prompt-toolbar"><span class="txt2img-prompt-label">Prompt</span><button type="button" class="txt2img-prompt-copy">Copiar</button></div><pre class="txt2img-prompt-text">${escapeHtml(splitPg.prompt)}</pre></div>`;
          } else if (!isUser && !isEphemeralDebug && hasContent) {
            bodyHtml = buildCollapsibleMessageHtml(
              m.content || "",
              collapseKey,
              collapsedMessageKeys.has(collapseKey)
            );
          } else {
            bodyHtml = `<div class="message-content">${formatMessageHtml(m.content || "", 0)}</div>`;
          }
          return `<div class="${rowClass}" data-msg-id="${m.id ? escapeHtml(m.id) : ""}">
            <div style="max-width: ${isUser ? "70%" : "100%"}; flex: 1; min-width: 0;">
              <div class="${bubbleClass}">${bodyHtml}</div>
              ${footerBtns}
            </div>
          </div>${inheritedSplit}`;
        }
      )
      .join("");
    bindTxt2imgPromptCopyButtons(el.messagesContainer);
    el.messagesContainer.querySelectorAll(".msg-collapse-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const wrap = btn.closest(".message-body-collapsible");
        if (!wrap) return;
        const key = wrap.getAttribute("data-collapse-key");
        if (!key) return;
        const willExpand = wrap.classList.contains("is-collapsed");
        if (willExpand) {
          collapsedMessageKeys.delete(key);
          wrap.classList.remove("is-collapsed");
          btn.setAttribute("aria-expanded", "true");
          btn.textContent = "Show less";
          kickLazyIllustrations(wrap);
        } else {
          collapsedMessageKeys.add(key);
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
    scheduleConversationImageFilter();
    if (consulta) {
      el.messagesContainer.scrollTop = prevScrollTop;
    } else if (isAutoScrollDuringGeneration()) {
      el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
    } else {
      el.messagesContainer.scrollTop = prevScrollTop;
    }
  }

  function closeAllMessageContextMenus() {
    if (!el.messagesContainer) return;
    el.messagesContainer.querySelectorAll(".msg-context-menu").forEach((menu) => {
      menu.hidden = true;
    });
    el.messagesContainer.querySelectorAll(".msg-more-btn").forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
    });
    closeTextContextMenu();
  }

  let textContextPending = null;
  let textContextIgnoreClickUntil = 0;

  function getTextContextMenu() {
    return document.getElementById("msg-text-context-menu");
  }

  function closeTextContextMenu() {
    const menu = getTextContextMenu();
    if (menu) menu.hidden = true;
    textContextPending = null;
  }

  function paragraphIndexFromEventTarget(target, messageRoot) {
    if (!target || !messageRoot) return 0;
    const para = target.closest("[data-paragraph-index]");
    if (para && messageRoot.contains(para)) {
      const n = parseInt(para.getAttribute("data-paragraph-index"), 10);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
    const unit = target.closest(".illustration-unit");
    if (unit && messageRoot.contains(unit)) {
      const owner = parseInt(unit.getAttribute("data-owner-paragraph-index"), 10);
      if (!Number.isNaN(owner) && owner >= 0) return owner;
    }
    const all = messageRoot.querySelectorAll("[data-paragraph-index]");
    if (!all.length) return 0;
    const last = all[all.length - 1].getAttribute("data-paragraph-index");
    const n = parseInt(last, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function selectedExcerptIn(root) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return "";
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const elNode = node.nodeType === 1 ? node : node.parentElement;
    if (!elNode || !root.contains(elNode)) return "";
    return String(sel.toString() || "").replace(/\s+/g, " ").trim().slice(0, 500);
  }

  function bindMessageTextContextMenu() {
    if (!el.messagesContainer || el.messagesContainer.dataset.textCtxBound === "1") return;
    el.messagesContainer.dataset.textCtxBound = "1";
    el.messagesContainer.addEventListener("contextmenu", function (e) {
      const bubble = e.target.closest(".message-bubble.assistant");
      if (!bubble || !el.messagesContainer.contains(bubble)) return;
      if (e.target.closest("button, a, textarea, input, .message-footer")) return;
      const row = bubble.closest(".message-row");
      const msgId = row && row.getAttribute("data-msg-id");
      if (!msgId) return;
      const msg = messages.find((m) => m.id === msgId);
      if (!msg || msg.role !== "assistant" || msg.ephemeral_debug) return;
      const body =
        bubble.querySelector(".message-content, .message-body-collapsible") || bubble;
      e.preventDefault();
      e.stopPropagation();
      closeAllMessageContextMenus();
      const excerpt = selectedExcerptIn(body);
      textContextPending = {
        messageId: msgId,
        paragraphIndex: paragraphIndexFromEventTarget(e.target, body),
        excerpt: excerpt,
      };
      const menu = getTextContextMenu();
      if (!menu) return;
      const copyBtn = document.getElementById("msg-text-copy");
      if (copyBtn) copyBtn.hidden = !excerpt;
      menu.hidden = false;
      const pad = 8;
      let x = e.clientX;
      let y = e.clientY;
      menu.style.left = x + "px";
      menu.style.top = y + "px";
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth - pad) {
        x = Math.max(pad, window.innerWidth - rect.width - pad);
      }
      if (rect.bottom > window.innerHeight - pad) {
        y = Math.max(pad, window.innerHeight - rect.height - pad);
      }
      menu.style.left = x + "px";
      menu.style.top = y + "px";
      textContextIgnoreClickUntil = Date.now() + 400;
    });
    const menu = getTextContextMenu();
    if (menu) {
      menu.addEventListener("click", function (e) {
        e.stopPropagation();
        const action = e.target.closest("[data-action]");
        if (!action) return;
        const pending = textContextPending;
        const kind = action.getAttribute("data-action");
        closeTextContextMenu();
        if (!pending) return;
        if (kind === "illustrate-at") {
          illustrateAtParagraph(pending.messageId, pending.paragraphIndex, pending.excerpt);
          return;
        }
        if (kind === "copy-selection" && pending.excerpt) {
          copyMessageToClipboard(pending.excerpt);
        }
      });
    }
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
    if (isConsultaChromeActive()) return;
    if (currentAbortController) return;
    if (currentConversationKind === "prompt_generator") {
      await sendPromptGeneratorTurn({ force: false });
      return;
    }
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
    msgEl.innerHTML = '<div style="max-width: 100%; flex: 1; min-width: 0;"><div class="message-bubble assistant"><span class="content"></span></div></div>';
    if (el.messagesContainer) el.messagesContainer.appendChild(msgEl);
    const contentEl = msgEl.querySelector(".content");
    currentStreamingMsgEl = msgEl;
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
    let chatDebugEntry = null;
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
      chatDebugEntry = pushChatDebugEntry({
        title: "Petición al LLM de chat",
        status: "sending",
        details: {
          conversation_id: currentConversationId,
          model: (el.modelSelect && el.modelSelect.value) || "",
          provider: currentProvider,
          params: modelParams,
        },
      });
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
      updateChatDebugEntry(chatDebugEntry.id, { status: "waiting" });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let debugRequest = null;
      const debugMetaLines = [];
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
              updateChatDebugEntry(chatDebugEntry.id, {
                request: debugRequest,
                response: debugMetaLines.join("\n"),
              });
            }
            if (data.debug_request) {
              debugRequest = data.debug_request;
              updateChatDebugEntry(chatDebugEntry.id, {
                request: debugRequest,
                response: debugMetaLines.join("\n"),
                status: "waiting",
              });
            }
            if (data.mcp_contexts) {
              appStatus.update(chatStatusId, "chat.receiving_context");
            }
            if (data.error) {
              clearAnalyzingDots();
              fullContent += `[Error: ${data.error}]`;
              contentEl.innerHTML = escapeHtml(fullContent).replace(/\n/g, "<br>");
              appStatus.update(chatStatusId, "chat.error");
              updateChatDebugEntry(chatDebugEntry.id, {
                status: "error",
                response: debugMetaLines.join("\n"),
                details: data.error,
              });
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
                updateChatDebugEntry(chatDebugEntry.id, { status: "streaming" });
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
              msgEl.remove();
              const assistantMsg = {
                role: "assistant",
                content: fullContent,
                id: data.id || null,
                parent_id: resolvedUserId,
                debug_request: debugRequest || null,
                debug_response: debugMetaLines.length > 0 ? debugMetaLines.join("\n") : null,
              };
              updateChatDebugEntry(chatDebugEntry.id, {
                status: "done",
                request: debugRequest,
                response: debugMetaLines.join("\n"),
                details: fullContent,
              });
              allMessages.push(assistantMsg);
              if (assistantMsg.id) activeLeafId = assistantMsg.id;
              syncVisibleMessages();
              renderMessages();
              refreshLeftHistory();
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
      currentAbortController = null;
      setComposerPrimaryActionState();
      appStatus.pop(chatStatusId);
    } catch (e) {
      clearAnalyzingDots();
      currentStreamingMsgEl = null;
      if (chatDebugEntry) {
        updateChatDebugEntry(chatDebugEntry.id, {
          status: e.name === "AbortError" ? "cancelled" : "error",
          details: e.message || e.name,
        });
      }
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
    lastUsage = null;
    await loadModelContract({ applyParamDefaults: paramsSource !== "user" });
    if (currentConversationId) {
      fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({
          model_id: (el.modelSelect && el.modelSelect.value) || "",
          model_params: buildModelParams(),
        }),
      }).catch(() => {});
    }
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
  if (el.btnPromptGenerator) el.btnPromptGenerator.addEventListener("click", newPromptGeneratorConversation);
  if (el.btnGeneratePrompt) el.btnGeneratePrompt.addEventListener("click", function () { sendPromptGeneratorTurn({ force: true }); });
  updatePromptGeneratorComposerUi();
  if (el.btnHistoryMessages) {
    el.btnHistoryMessages.addEventListener("click", function () {
      setLeftHistoryMode(isMessagesHistoryMode() ? "conversations" : "messages");
    });
  }
  if (el.leftHistorySortSelect) {
    el.leftHistorySortSelect.addEventListener("change", onLeftHistorySortChange);
  }
  if (el.messageHistorySearch) {
    el.messageHistorySearch.addEventListener("input", onMessageHistorySearchInput);
    el.messageHistorySearch.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (messageHistorySearchTimer) {
        clearTimeout(messageHistorySearchTimer);
        messageHistorySearchTimer = null;
      }
      if (isMessagesHistoryMode()) loadMessageHistory();
    });
  }
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
  if (el.conversationAutoTitle) {
    el.conversationAutoTitle.addEventListener("change", commitAutoTitleFlag);
  }
  if (el.btnSend) el.btnSend.addEventListener("click", onComposerPrimaryClick);
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
  const prefFontDecrease = document.getElementById("pref-font-decrease");
  const prefFontIncrease = document.getElementById("pref-font-increase");
  if (prefFontDecrease) {
    prefFontDecrease.addEventListener("click", function () {
      if (!this.disabled) setConversationFontSize(-FONT_SIZE_STEP);
    });
  }
  if (prefFontIncrease) {
    prefFontIncrease.addEventListener("click", function () {
      if (!this.disabled) setConversationFontSize(FONT_SIZE_STEP);
    });
  }
  function bindSidebarFontScaleStepper(side) {
    const prefix = side === "left" ? "pref-font-left" : "pref-font-right";
    const decreaseBtn = document.getElementById(prefix + "-decrease");
    const increaseBtn = document.getElementById(prefix + "-increase");
    if (decreaseBtn) {
      decreaseBtn.addEventListener("click", function () {
        if (!this.disabled) setSidebarFontScale(side, -SIDEBAR_FONT_SCALE_STEP);
      });
    }
    if (increaseBtn) {
      increaseBtn.addEventListener("click", function () {
        if (!this.disabled) setSidebarFontScale(side, SIDEBAR_FONT_SCALE_STEP);
      });
    }
  }
  bindSidebarFontScaleStepper("left");
  bindSidebarFontScaleStepper("right");
  const prefFontBaseDecrease = document.getElementById("pref-font-base-decrease");
  const prefFontBaseIncrease = document.getElementById("pref-font-base-increase");
  if (prefFontBaseDecrease) {
    prefFontBaseDecrease.addEventListener("click", function () {
      if (!this.disabled) setUiBaseFontScale(-UI_BASE_FONT_SCALE_STEP);
    });
  }
  if (prefFontBaseIncrease) {
    prefFontBaseIncrease.addEventListener("click", function () {
      if (!this.disabled) setUiBaseFontScale(UI_BASE_FONT_SCALE_STEP);
    });
  }
  const prefCollapseAll = document.getElementById("pref-collapse-all-messages");
  if (prefCollapseAll) {
    prefCollapseAll.addEventListener("click", function () {
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
  const settingsThink = document.getElementById("settings-think");
  if (settingsThink) {
    settingsThink.addEventListener("change", function () {
      const canonical = document.getElementById("param-think");
      if (!canonical || canonical.disabled) return;
      setControlValueIfChanged(canonical, settingsThink.value);
      canonical.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  let libraryRules = [];
  let plannerLibraryRules = [];

  function fillLibrarySelect(selectEl, items) {
    if (!selectEl) return;
    const selected = selectEl.value;
    const list = Array.isArray(items) ? items : [];
    selectEl.innerHTML = "<option value=\"\">Elegir regla</option>" +
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
    if (hydratePlannerRulesFromLibrary()) {
      renderPlannerRules();
      persistImagesPanel();
    }
  }

  function hydratePlannerRulesFromLibrary() {
    if (!Array.isArray(plannerLibraryRules) || !plannerLibraryRules.length) return false;
    let changed = false;
    plannerRules = (plannerRules || []).map(function (item) {
      if (!item || !item.rule_id) return item;
      const lib = plannerLibraryRules.find(function (r) { return r.id === item.rule_id; });
      if (!lib) return item;
      const title = lib.title || "";
      const content = lib.content || "";
      if ((item.title || "") === title && (item.content || "") === content) return item;
      changed = true;
      return Object.assign({}, item, { title: title, content: content });
    });
    return changed;
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
  const SIDEBAR_MAIN_SECTION_IDS = ["reglas", "parametros", "imagenes", "preferencias"];
  const LAST_CONVERSATION_STORAGE_KEY = "chatbot_last_conversation_id";
  const FONT_SIZE_STORAGE_KEY = "chatbot_conversation_font_size_rem";
  const FONT_SIZE_DEFAULT = 0.8;
  const FONT_SIZE_MIN = 0.65;
  const FONT_SIZE_MAX = 5;
  const FONT_SIZE_STEP = 0.05;
  const UI_BASE_FONT_SCALE_STORAGE_KEY = "uiBaseFontScale";
  const UI_BASE_FONT_SCALE_DEFAULT = 1;
  const UI_BASE_FONT_SCALE_MIN = 0.8;
  const UI_BASE_FONT_SCALE_MAX = 5;
  const UI_BASE_FONT_SCALE_STEP = 0.05;
  const UI_BASE_FONT_SCALE_CSS = "--ui-base-font-scale";
  const SIDEBAR_FONT_SCALE_DEFAULT = 1;
  const SIDEBAR_FONT_SCALE_MIN = 0.8;
  const SIDEBAR_FONT_SCALE_MAX = 5;
  const SIDEBAR_FONT_SCALE_STEP = 0.05;
  const SIDEBAR_FONT_SCALE_STORAGE = {
    left: "sidebarLeftFontScale",
    right: "sidebarRightFontScale",
  };
  const SIDEBAR_FONT_SCALE_CSS = {
    left: "--sidebar-left-font-scale",
    right: "--sidebar-right-font-scale",
  };
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

  function formatFontSizeLabel(rem) {
    return Math.round(rem * 100) + "%";
  }

  function syncFontSizeButtons(rem) {
    const ids = [
      "btn-font-size-decrease",
      "btn-font-size-increase",
      "pref-font-decrease",
      "pref-font-increase",
      "reading-font-decrease",
      "reading-font-increase",
    ];
    const decreaseIds = new Set(["btn-font-size-decrease", "pref-font-decrease", "reading-font-decrease"]);
    ids.forEach(function (id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = decreaseIds.has(id) ? rem <= FONT_SIZE_MIN : rem >= FONT_SIZE_MAX;
    });
    const valueEl = document.getElementById("pref-font-value");
    if (valueEl) valueEl.textContent = formatFontSizeLabel(rem);
  }

  function initConversationFontSize() {
    const rem = getStoredFontSize();
    applyConversationFontSize(rem);
    syncFontSizeButtons(rem);
  }

  function getStoredUiBaseFontScale() {
    try {
      const raw = localStorage.getItem(UI_BASE_FONT_SCALE_STORAGE_KEY);
      if (raw == null) return UI_BASE_FONT_SCALE_DEFAULT;
      const n = parseFloat(raw, 10);
      if (Number.isFinite(n)) {
        return Math.max(UI_BASE_FONT_SCALE_MIN, Math.min(UI_BASE_FONT_SCALE_MAX, n));
      }
    } catch (_) {}
    return UI_BASE_FONT_SCALE_DEFAULT;
  }

  function setStoredUiBaseFontScale(scale) {
    try {
      localStorage.setItem(UI_BASE_FONT_SCALE_STORAGE_KEY, String(scale));
    } catch (_) {}
  }

  function applyUiBaseFontScale(scale) {
    document.documentElement.style.setProperty(UI_BASE_FONT_SCALE_CSS, String(scale));
  }

  function syncUiBaseFontScaleControl(scale) {
    const decreaseBtn = document.getElementById("pref-font-base-decrease");
    const increaseBtn = document.getElementById("pref-font-base-increase");
    const valueEl = document.getElementById("pref-font-base-value");
    if (decreaseBtn) decreaseBtn.disabled = scale <= UI_BASE_FONT_SCALE_MIN;
    if (increaseBtn) increaseBtn.disabled = scale >= UI_BASE_FONT_SCALE_MAX;
    if (valueEl) valueEl.textContent = formatFontSizeLabel(scale);
  }

  function setUiBaseFontScale(delta) {
    const current = getStoredUiBaseFontScale();
    let next = Math.round((current + delta) / UI_BASE_FONT_SCALE_STEP) * UI_BASE_FONT_SCALE_STEP;
    next = Math.max(UI_BASE_FONT_SCALE_MIN, Math.min(UI_BASE_FONT_SCALE_MAX, next));
    next = Math.round(next * 100) / 100;
    setStoredUiBaseFontScale(next);
    applyUiBaseFontScale(next);
    syncUiBaseFontScaleControl(next);
  }

  function initUiBaseFontScale() {
    const scale = getStoredUiBaseFontScale();
    applyUiBaseFontScale(scale);
    syncUiBaseFontScaleControl(scale);
  }

  function getStoredSidebarFontScale(side) {
    try {
      const raw = localStorage.getItem(SIDEBAR_FONT_SCALE_STORAGE[side]);
      if (raw == null) return SIDEBAR_FONT_SCALE_DEFAULT;
      const n = parseFloat(raw, 10);
      if (Number.isFinite(n)) {
        return Math.max(SIDEBAR_FONT_SCALE_MIN, Math.min(SIDEBAR_FONT_SCALE_MAX, n));
      }
    } catch (_) {}
    return SIDEBAR_FONT_SCALE_DEFAULT;
  }

  function setStoredSidebarFontScale(side, scale) {
    try {
      localStorage.setItem(SIDEBAR_FONT_SCALE_STORAGE[side], String(scale));
    } catch (_) {}
  }

  function applySidebarFontScale(side, scale) {
    document.documentElement.style.setProperty(SIDEBAR_FONT_SCALE_CSS[side], String(scale));
  }

  function syncSidebarFontScaleControl(side, scale) {
    const prefix = side === "left" ? "pref-font-left" : "pref-font-right";
    const decreaseBtn = document.getElementById(prefix + "-decrease");
    const increaseBtn = document.getElementById(prefix + "-increase");
    const valueEl = document.getElementById(prefix + "-value");
    if (decreaseBtn) decreaseBtn.disabled = scale <= SIDEBAR_FONT_SCALE_MIN;
    if (increaseBtn) increaseBtn.disabled = scale >= SIDEBAR_FONT_SCALE_MAX;
    if (valueEl) valueEl.textContent = formatFontSizeLabel(scale);
  }

  function setSidebarFontScale(side, delta) {
    const current = getStoredSidebarFontScale(side);
    let next = Math.round((current + delta) / SIDEBAR_FONT_SCALE_STEP) * SIDEBAR_FONT_SCALE_STEP;
    next = Math.max(SIDEBAR_FONT_SCALE_MIN, Math.min(SIDEBAR_FONT_SCALE_MAX, next));
    next = Math.round(next * 100) / 100;
    setStoredSidebarFontScale(side, next);
    applySidebarFontScale(side, next);
    syncSidebarFontScaleControl(side, next);
  }

  function initSidebarFontScales() {
    ["left", "right"].forEach(function (side) {
      const scale = getStoredSidebarFontScale(side);
      applySidebarFontScale(side, scale);
      syncSidebarFontScaleControl(side, scale);
    });
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
   * Scrollbar vertical que aparece al mover el ratón (mismo ritmo que chat-scroll-nav).
   */
  function bindScrollReveal(activityRoot, scrollEl, idleMs) {
    if (!activityRoot || !scrollEl) return;
    const hideDelay = typeof idleMs === "number" ? idleMs : 1200;
    let hideTimer = null;
    let pointerInside = false;

    function setScrollbarVisible(visible) {
      scrollEl.classList.toggle("is-scrollbar-visible", visible);
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
        if (!pointerInside) setScrollbarVisible(false);
      }, hideDelay);
    }

    function revealFromActivity() {
      setScrollbarVisible(true);
      if (!pointerInside) scheduleHide();
      else clearHideTimer();
    }

    activityRoot.addEventListener("mousemove", revealFromActivity);
    activityRoot.addEventListener("mouseenter", function () {
      pointerInside = true;
      revealFromActivity();
    });
    activityRoot.addEventListener("mouseleave", function () {
      pointerInside = false;
      clearHideTimer();
      setScrollbarVisible(false);
    });
    scrollEl.addEventListener("scroll", revealFromActivity, { passive: true });
  }

  /**
   * Rail flotante ↑/↓ a media altura: aparece al mover el ratón por el stream,
   * se oculta en idle salvo si el puntero está sobre el rail.
   */
  function initConversationScrollNav() {
    const wrap = document.querySelector(".chat-stream-wrap");
    const stream = document.getElementById("messages-container");
    const nav = document.getElementById("chat-scroll-nav");
    const btnUp = document.getElementById("btn-scroll-msg-up");
    const btnDown = document.getElementById("btn-scroll-msg-down");
    if (!wrap || !nav || !btnUp || !btnDown) return;

    bindScrollReveal(wrap, stream);

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
    const ids = [
      "reading-image-decrease",
      "reading-image-increase",
      "pref-image-decrease",
      "pref-image-increase",
    ];
    const decreaseIds = new Set(["reading-image-decrease", "pref-image-decrease"]);
    ids.forEach(function (id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = decreaseIds.has(id) ? factor <= IMAGE_SIZE_MIN : factor >= IMAGE_SIZE_MAX;
    });
    const valueEl = document.getElementById("pref-image-value");
    if (valueEl) valueEl.textContent = Math.round(factor * 100) + "%";
  }

  function initConversationImageSize() {
    const factor = getStoredImageSize();
    applyConversationImageSize(factor);
    syncImageSizeButtons(factor);
    const prefDec = document.getElementById("pref-image-decrease");
    const prefInc = document.getElementById("pref-image-increase");
    if (prefDec) {
      prefDec.addEventListener("click", function () {
        if (!this.disabled) setConversationImageSize(-IMAGE_SIZE_STEP);
      });
    }
    if (prefInc) {
      prefInc.addEventListener("click", function () {
        if (!this.disabled) setConversationImageSize(IMAGE_SIZE_STEP);
      });
    }
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

  function scrollReadingBodyToStart() {
    const body = document.getElementById("reading-mode-body");
    if (!body) return;
    const pin = function () {
      body.scrollTop = 0;
    };
    const followLayout = function () {
      if (body.scrollTop <= 96) pin();
    };
    pin();
    requestAnimationFrame(function () {
      pin();
      requestAnimationFrame(pin);
    });
    window.setTimeout(followLayout, 120);
    window.setTimeout(followLayout, 400);
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
    const closeBtn = document.getElementById("reading-mode-close");
    if (closeBtn) closeBtn.focus();
    scrollReadingBodyToStart();
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
      ensureImagesPromptSelects().then(loadPlannerContract);
      loadPlannerLibraryRules();
    }
  }

  function resolveSidebarTabId() {
    try {
      const stored = localStorage.getItem(SIDEBAR_TAB_STORAGE_KEY);
      if (SIDEBAR_MAIN_SECTION_IDS.includes(stored)) return stored;
      if (stored === "conversaciones") return "reglas";
    } catch (_) {}
    const acc = getAccordionState();
    if (acc) {
      const fromAccordion = SIDEBAR_MAIN_SECTION_IDS.find((id) => acc[id] === true);
      if (fromAccordion) return fromAccordion;
    }
    return "reglas";
  }

  function setSidebarTab(tabId) {
    const id = SIDEBAR_MAIN_SECTION_IDS.includes(tabId) ? tabId : "reglas";
    document.querySelectorAll(".sidebar-tab-rail [role='tab']").forEach((tab) => {
      const selected = tab.dataset.sidebarTab === id;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".sidebar-tab-panel").forEach((panel) => {
      const selected = panel.dataset.sidebarPanel === id;
      panel.classList.toggle("is-active", selected);
      panel.hidden = !selected;
    });
    try {
      localStorage.setItem(SIDEBAR_TAB_STORAGE_KEY, id);
    } catch (_) {}
    onSidebarMainSectionOpened(id);
  }

  function initSidebarTabs() {
    setSidebarTab(resolveSidebarTabId());
    const tabs = Array.from(document.querySelectorAll(".sidebar-tab-rail [role='tab']"));
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setSidebarTab(tab.dataset.sidebarTab);
      });
      tab.addEventListener("keydown", (e) => {
        const i = tabs.indexOf(tab);
        let next = -1;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next < 0) return;
        e.preventDefault();
        tabs[next].focus();
        setSidebarTab(tabs[next].dataset.sidebarTab);
      });
    });
  }

  function initAccordionState() {
    const state = getAccordionState();
    document.querySelectorAll(".accordion-section[data-accordion-section]").forEach((section) => {
      const id = section.dataset.accordionSection;
      if (SIDEBAR_MAIN_SECTION_IDS.includes(id)) return;
      const isOpen = state && typeof state[id] === "boolean" ? state[id] : section.classList.contains("is-open");
      setAccordionSectionOpen(section, !!isOpen);
    });
    document.querySelectorAll(".accordion-list").forEach((list) => {
      const first = list.querySelector(":scope > .accordion-section.is-open");
      if (!first) return;
      getSiblingAccordionSections(first).forEach((s) => {
        if (s !== first) setAccordionSectionOpen(s, false);
      });
    });
    saveAccordionState();
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
      });
    });
  }

  initSidebarTabs();
  initSidebarAccordion();
  initConversationFontSize();
  initUiBaseFontScale();
  initSidebarFontScales();
  initConversationScrollNav();
  initIllustrationMetaModal();
  bindMessageTextContextMenu();
  document.addEventListener("click", function () {
    if (Date.now() < textContextIgnoreClickUntil) return;
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

  function isVisualConsistencyEnabled() {
    const el = document.getElementById("images-visual-consistency");
    return !el || !!el.checked;
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

  let plannerContract = null;
  let plannerModelParams = {};

  function plannerRecipes() {
    return plannerContract && Array.isArray(plannerContract.recipes) ? plannerContract.recipes : [];
  }

  function plannerParamSpec(paramId) {
    return (plannerContract && plannerContract.params && plannerContract.params[paramId]) || null;
  }

  function plannerPresetsUseChatConfig() {
    const node = document.getElementById("images-use-chat-config");
    return !!(node && node.checked);
  }

  function coercePlannerParamValue(paramId, raw) {
    if (raw === null || raw === undefined || raw === "") return null;
    if (paramId === "think") {
      if (raw === true || raw === "true") return true;
      if (raw === false || raw === "false") return false;
      return raw;
    }
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    const n = Number(raw);
    if (Number.isFinite(n) && String(raw).trim() !== "") return n;
    return raw;
  }

  function collectPlannerModelParams() {
    const out = {};
    Object.keys(plannerModelParams).forEach((key) => {
      const value = plannerModelParams[key];
      if (value !== null && value !== undefined && value !== "") out[key] = value;
    });
    return out;
  }

  function plannerRecipeMatches(recipe) {
    const params = (recipe && recipe.params) || {};
    return Object.keys(params).every((paramId) => {
      if (!Object.prototype.hasOwnProperty.call(plannerModelParams, paramId)) return false;
      return paramValuesEqual(paramId, plannerModelParams[paramId], params[paramId]);
    });
  }

  function plannerParamLabel(paramId) {
    const spec = plannerParamSpec(paramId);
    return (spec && spec.label) || RECIPE_PARAM_LABELS[paramId] || paramId;
  }

  function syncPlannerRecipeChipSelection() {
    const recipes = plannerRecipes();
    const active = recipes.find((recipe) => plannerRecipeMatches(recipe));
    const activeId = active && active.id;
    document.querySelectorAll("#planner-recipes .composer-recipe-chip").forEach((btn) => {
      const on = Boolean(activeId && btn.dataset.recipeId === activeId);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const owned = active && active.params ? Object.keys(active.params) : [];
    document.querySelectorAll("#planner-recipe-params .settings-recipe-param").forEach((row) => {
      row.classList.toggle("is-owned", owned.includes(row.dataset.paramId));
    });
  }

  function syncPlannerPresetsVisibility() {
    const onChat = plannerPresetsUseChatConfig();
    const hint = document.getElementById("planner-presets-chat-hint");
    const emptyEl = document.getElementById("planner-presets-empty");
    const controls = document.getElementById("planner-presets-controls");
    const inspector = document.getElementById("planner-recipe-params");
    const wrap = document.getElementById("planner-think-wrap");
    const thinkEl = document.getElementById("planner-think");
    if (hint) hint.hidden = !onChat;
    if (onChat) {
      if (emptyEl) emptyEl.hidden = true;
      if (controls) controls.hidden = true;
      if (inspector) inspector.hidden = true;
      return;
    }
    const recipes = plannerRecipes();
    const thinking = plannerContract && plannerContract.capabilities && plannerContract.capabilities.thinking;
    const showThink = Boolean(thinking && thinking.kind && thinking.kind !== "none");
    const showRecipes = recipes.length > 0;
    if (emptyEl) emptyEl.hidden = showRecipes;
    if (controls) controls.hidden = !showThink && !showRecipes;
    if (wrap) wrap.hidden = !showThink;
    if (thinkEl) thinkEl.disabled = !showThink;
    if (inspector) {
      const ids = recipeIdsFromContract(plannerContract).filter((id) => id !== "think");
      inspector.hidden = !ids.length;
    }
  }

  function createPlannerParamControl(paramId, spec) {
    const control = document.createElement("input");
    control.type = "number";
    control.className = "param-control";
    control.setAttribute("data-planner-param-id", paramId);
    if (paramId === "temperature" || paramId === "top_p" || paramId === "min_p") {
      control.step = "0.1";
      if (!control.min) control.min = "0";
      if (paramId === "temperature") control.max = "2";
      if (paramId === "top_p" || paramId === "min_p") control.max = "1";
    } else {
      control.step = "1";
    }
    if (spec) {
      if (spec.min != null) control.min = String(spec.min);
      if (spec.max != null) control.max = String(spec.max);
      if (spec.step != null) control.step = String(spec.step);
      if (spec.default != null) control.placeholder = String(spec.default);
    }
    if (paramId === "num_ctx" && !control.min) control.min = "512";
    return control;
  }

  function writePlannerParamFromControl(paramId, control) {
    const value = coercePlannerParamValue(paramId, control.value);
    if (value === null) delete plannerModelParams[paramId];
    else plannerModelParams[paramId] = value;
    syncPlannerRecipeChipSelection();
    persistImagesPanel();
  }

  function rebuildPlannerRecipeInspector() {
    const host = document.getElementById("planner-recipe-params");
    if (!host) return;
    const ids = recipeIdsFromContract(plannerContract).filter((id) => id !== "think");
    host.innerHTML = "";
    if (!ids.length || plannerPresetsUseChatConfig()) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    ids.forEach((paramId) => {
      const spec = plannerParamSpec(paramId) || {};
      const row = document.createElement("div");
      row.className = "settings-recipe-param";
      row.dataset.paramId = paramId;
      const label = document.createElement("label");
      label.className = "settings-recipe-param-label";
      const controlId = "planner-recipe-param-" + paramId;
      label.setAttribute("for", controlId);
      label.textContent = plannerParamLabel(paramId);
      const control = createPlannerParamControl(paramId, spec);
      control.id = controlId;
      const stored = plannerModelParams[paramId];
      const display = stored !== undefined && stored !== null ? stored : spec.default;
      if (display !== undefined && display !== null) control.value = String(display);
      control.addEventListener("input", () => writePlannerParamFromControl(paramId, control));
      control.addEventListener("change", () => writePlannerParamFromControl(paramId, control));
      row.appendChild(label);
      row.appendChild(control);
      host.appendChild(row);
    });
    syncPlannerRecipeChipSelection();
  }

  function applyPlannerRecipe(recipe) {
    if (!recipe || typeof recipe !== "object") return;
    plannerModelParams = Object.assign({}, recipe.params || {});
    renderPlannerRecipes();
    persistImagesPanel();
  }

  function renderPlannerRecipes() {
    const wrap = document.getElementById("planner-think-wrap");
    const thinkEl = document.getElementById("planner-think");
    const recipes = plannerRecipes();
    const thinking = plannerContract && plannerContract.capabilities && plannerContract.capabilities.thinking;
    const showThink = Boolean(thinking && thinking.kind && thinking.kind !== "none");
    if (wrap) wrap.hidden = !showThink;
    if (thinkEl) {
      if (showThink) {
        fillThinkOptions(thinkEl, thinking);
        thinkEl.disabled = plannerPresetsUseChatConfig();
        thinkEl.classList.remove("control-disabled");
        const spec = plannerParamSpec("think");
        const def = spec && spec.default !== undefined ? spec.default : thinking.default;
        const current = Object.prototype.hasOwnProperty.call(plannerModelParams, "think")
          ? plannerModelParams.think
          : def;
        if (current !== undefined && current !== null) thinkEl.value = thinkSelectValue(current);
      } else {
        thinkEl.disabled = true;
        thinkEl.classList.add("control-disabled");
        thinkEl.innerHTML = "";
      }
    }
    fillRecipeChipHost(document.getElementById("planner-recipes"), recipes, applyPlannerRecipe);
    rebuildPlannerRecipeInspector();
    syncPlannerPresetsVisibility();
    syncPlannerRecipeChipSelection();
  }

  async function loadPlannerContract() {
    const providerSel = document.getElementById("images-prompt-provider");
    const modelSel = document.getElementById("images-prompt-model");
    const provider = providerSel ? providerSel.value : "";
    const modelId = modelSel ? modelSel.value : "";
    const prefs = loadImagesPrefs();
    if (!provider || !modelId) {
      plannerContract = null;
      plannerModelParams = {};
      renderPlannerRecipes();
      return;
    }
    try {
      plannerContract = await fetchJson(
        `${API}/providers/${encodeURIComponent(provider)}/models/${encodeURIComponent(modelId)}/contract`
      );
    } catch (_) {
      plannerContract = null;
    }
    const sameTarget =
      prefs.prompt_provider === provider &&
      prefs.prompt_model === modelId &&
      prefs.prompt_model_params &&
      typeof prefs.prompt_model_params === "object";
    plannerModelParams = sameTarget ? Object.assign({}, prefs.prompt_model_params) : {};
    renderPlannerRecipes();
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

  let reactorEnvDefaults = null;

  const REACTOR_PANEL_FIELDS = [
    ["images-reactor-model", "model", "text"],
    ["images-reactor-source-faces-index", "source_faces_index", "text"],
    ["images-reactor-face-index", "face_index", "text"],
    ["images-reactor-upscaler", "upscaler", "text"],
    ["images-reactor-scale", "scale", "float"],
    ["images-reactor-upscale-visibility", "upscale_visibility", "float"],
    ["images-reactor-face-restorer", "face_restorer", "text"],
    ["images-reactor-restorer-visibility", "restorer_visibility", "float"],
    ["images-reactor-codeformer-weight", "codeformer_weight", "float"],
    ["images-reactor-restore-first", "restore_first", "int"],
    ["images-reactor-gender-source", "gender_source", "int"],
    ["images-reactor-gender-target", "gender_target", "int"],
    ["images-reactor-device", "device", "text"],
    ["images-reactor-mask-face", "mask_face", "int"],
    ["images-reactor-select-source", "select_source", "int"],
    ["images-reactor-face-model", "face_model", "text"],
    ["images-reactor-source-folder", "source_folder", "text"],
    ["images-reactor-random-image", "random_image", "int"],
    ["images-reactor-upscale-force", "upscale_force", "int"],
  ];

  function readOptionalFloatInput(el) {
    if (!el || el.value === "" || el.value == null) return null;
    const n = parseFloat(el.value);
    return Number.isFinite(n) ? n : null;
  }

  function applyReactorPlaceholders(defaults) {
    if (!defaults || typeof defaults !== "object") return;
    REACTOR_PANEL_FIELDS.forEach(function ([id, key]) {
      const el = document.getElementById(id);
      if (!el || el.value !== "") return;
      const val = defaults[key];
      if (val == null || val === "") return;
      el.placeholder = "Del .env: " + String(val);
    });
  }

  function syncReactorGenderInputs() {
    const femaleOn = document.getElementById("images-reactor-female-enabled");
    const femaleModel = document.getElementById("images-reactor-female-face-model");
    const maleOn = document.getElementById("images-reactor-male-enabled");
    const maleModel = document.getElementById("images-reactor-male-face-model");
    if (femaleModel) femaleModel.disabled = !(femaleOn && femaleOn.checked);
    if (maleModel) maleModel.disabled = !(maleOn && maleOn.checked);
  }

  function readReactorPanelSettings() {
    const enabled = document.getElementById("images-reactor-enabled");
    const femaleEnabled = document.getElementById("images-reactor-female-enabled");
    const femaleModel = document.getElementById("images-reactor-female-face-model");
    const maleEnabled = document.getElementById("images-reactor-male-enabled");
    const maleModel = document.getElementById("images-reactor-male-face-model");
    const out = {
      enabled: !!(enabled && enabled.checked),
      female_enabled: !!(femaleEnabled && femaleEnabled.checked),
      female_face_model: femaleModel ? String(femaleModel.value || "").trim() : "",
      male_enabled: !!(maleEnabled && maleEnabled.checked),
      male_face_model: maleModel ? String(maleModel.value || "").trim() : "",
    };
    REACTOR_PANEL_FIELDS.forEach(function ([id, key, kind]) {
      const el = document.getElementById(id);
      if (!el || el.value === "" || el.value == null) return;
      if (kind === "int") {
        const n = readOptionalIntInput(el);
        if (n != null) out[key] = n;
      } else if (kind === "float") {
        const n = readOptionalFloatInput(el);
        if (n != null) out[key] = n;
      } else {
        out[key] = String(el.value).trim();
      }
    });
    return out;
  }

  function applyReactorPanelSettings(reactorPrefs) {
    const prefs = reactorPrefs && typeof reactorPrefs === "object" ? reactorPrefs : {};
    const legacyEnabled = !!prefs.enabled || !!prefs.reactor_enabled;
    const enabled = document.getElementById("images-reactor-enabled");
    const femaleEnabled = document.getElementById("images-reactor-female-enabled");
    const femaleModel = document.getElementById("images-reactor-female-face-model");
    const maleEnabled = document.getElementById("images-reactor-male-enabled");
    const maleModel = document.getElementById("images-reactor-male-face-model");
    if (enabled) enabled.checked = legacyEnabled;
    if (femaleEnabled) femaleEnabled.checked = !!prefs.female_enabled;
    if (femaleModel && prefs.female_face_model != null) femaleModel.value = prefs.female_face_model;
    if (maleEnabled) maleEnabled.checked = !!prefs.male_enabled;
    if (maleModel && prefs.male_face_model != null) maleModel.value = prefs.male_face_model;
    REACTOR_PANEL_FIELDS.forEach(function ([id, key]) {
      const el = document.getElementById(id);
      if (!el) return;
      if (prefs[key] == null || prefs[key] === "") {
        el.value = "";
        return;
      }
      el.value = String(prefs[key]);
    });
    syncReactorGenderInputs();
    applyReactorPlaceholders(reactorEnvDefaults);
  }

  async function fetchForgeReactorDefaults() {
    try {
      const data = await fetchJson(`${API}/forge/reactor-defaults`);
      if (data && data.defaults) {
        reactorEnvDefaults = data.defaults;
        applyReactorPlaceholders(reactorEnvDefaults);
      }
    } catch (_) {}
  }

  function reactorPanelInputNodes() {
    const nodes = [
      document.getElementById("images-reactor-enabled"),
      document.getElementById("images-reactor-female-enabled"),
      document.getElementById("images-reactor-female-face-model"),
      document.getElementById("images-reactor-male-enabled"),
      document.getElementById("images-reactor-male-face-model"),
    ];
    REACTOR_PANEL_FIELDS.forEach(function ([id]) {
      nodes.push(document.getElementById(id));
    });
    return nodes.filter(Boolean);
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
      visual_consistency: isVisualConsistencyEnabled(),
      images_per_response: per ? parseInt(per.value, 10) || 2 : 2,
      batch_size: batchSize ? parseInt(batchSize.value, 10) || 10 : 10,
      retries: retries ? parseInt(retries.value, 10) || 0 : 0,
      prompt: promptEl ? String(promptEl.value || "") : "",
      prompt_system_instructions: serializeRuleItems(plannerRules),
      prompt_provider: providerSel ? providerSel.value : "",
      prompt_model: modelSel ? modelSel.value : "",
      prompt_model_params: collectPlannerModelParams(),
      steps: forge.steps,
      width: forge.width,
      height: forge.height,
      seed: forge.seed,
      reactor: readReactorPanelSettings(),
    };
  }

  function imagesSnapshotForConversation() {
    const snap = collectImagesSnapshot();
    const prev = loadImagesPrefs();
    if (!snap.prompt_provider && prev.prompt_provider) snap.prompt_provider = prev.prompt_provider;
    if (!snap.prompt_model && prev.prompt_model) snap.prompt_model = prev.prompt_model;
    delete snap.prompt_system_instructions;
    return snap;
  }

  function fillImagesPanelFromPrefs(prefs) {
    const enabled = document.getElementById("images-enabled");
    const useChatConfig = document.getElementById("images-use-chat-config");
    const visualConsistency = document.getElementById("images-visual-consistency");
    const per = document.getElementById("images-per-response");
    const batchSize = document.getElementById("images-batch-size");
    const retries = document.getElementById("images-retries");
    const promptEl = document.getElementById("images-prompt");
    if (enabled) enabled.checked = !!prefs.enabled;
    if (useChatConfig) useChatConfig.checked = !!prefs.use_chat_config;
    if (visualConsistency) visualConsistency.checked = prefs.visual_consistency !== false;
    if (per && prefs.images_per_response != null) per.value = prefs.images_per_response;
    if (batchSize && prefs.batch_size != null) batchSize.value = prefs.batch_size;
    if (retries && prefs.retries != null) retries.value = prefs.retries;
    if (promptEl && prefs.prompt != null) promptEl.value = prefs.prompt;
    plannerRules = normalizePlannerRulesFromPrefs(prefs.prompt_system_instructions);
    renderPlannerRules();
    applyReactorPanelSettings(prefs.reactor || (prefs.reactor_enabled ? { enabled: true } : {}));
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
    syncPlannerPresetsVisibility();
  }

  function persistImagesToConversation() {
    if (!currentConversationId) return;
    const snap = imagesSnapshotForConversation();
    fetchJson(`${API}/conversations/${currentConversationId}`, {
      method: "PUT",
      body: JSON.stringify({ images: snap }),
    }).catch(() => {});
  }

  let saveImagesToConvTimer = null;
  const SAVE_IMAGES_DEBOUNCE_MS = 600;

  function debouncedPersistImagesToConversation() {
    if (saveImagesToConvTimer) clearTimeout(saveImagesToConvTimer);
    saveImagesToConvTimer = setTimeout(function () {
      saveImagesToConvTimer = null;
      persistImagesToConversation();
    }, SAVE_IMAGES_DEBOUNCE_MS);
  }

  function persistImagesPanel() {
    const snap = collectImagesSnapshot();
    const prev = loadImagesPrefs();
    if (!snap.prompt_provider && prev.prompt_provider) snap.prompt_provider = prev.prompt_provider;
    if (!snap.prompt_model && prev.prompt_model) snap.prompt_model = prev.prompt_model;
    saveImagesPrefs(snap);
    syncImagesChatConfigDisabled();
    debouncedPersistImagesToConversation();
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
    const prefs = saveImagesPrefs({
      steps: forgeParams.steps,
      width: forgeParams.width,
      height: forgeParams.height,
      seed: forgeParams.seed,
    });
    persistImagesPanel();
    return prefs;
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

  async function applyImagesSnapshot(images, options) {
    const incoming = images && typeof images === "object" ? Object.assign({}, images) : {};
    if (!(options && options.includePlannerRules)) {
      delete incoming.prompt_system_instructions;
    }
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
    await loadPlannerContract();
    persistImagesPanel();
  }

  const GALLERY_PAGE_SIZE = 24;
  const CENTER_SHARE_STORAGE_KEY = "centerChatGalleryShare";
  const CENTER_SHARE_MIN = 0.28;
  const CENTER_SHARE_MAX = 0.72;
  const CENTER_SHARE_DEFAULT = 0.5;
  const CENTER_SHARE_KEYBOARD_STEP = 0.04;
  let galleryItems = [];
  let galleryTotal = 0;
  let galleryOffset = 0;
  let galleryLightboxIndex = -1;
  let galleryLightboxBusy = false;
  let galleryLoadSeq = 0;
  let galleryPromptTimer = null;
  let galleryScopeAll = true;
  let galleryUserChoseAll = false;
  let galleryMessageId = null;
  let conversationFilterFilenames = null;
  let conversationFilterPending = false;
  let conversationFilterSeq = 0;
  let conversationFilterTimer = null;
  let imageQueueItems = [];
  let imageQueueFilterStatus = "";
  let imageQueueExpandedId = null;
  let imageQueuePollTimer = null;
  let imageQueuePollBusy = false;
  let imageQueueKnownActive = 0;
  let imageQueuePaused = false;
  const imageQueueSelectedIds = new Set();
  let imageQueueSelectionAnchor = -1;
  const imageQueueLastStatusById = {};
  let imageQueueLastRenderKey = "";
  const IMAGE_QUEUE_POLL_MS = 2500;
  const GALLERY_TOOLBAR_FILTER_IDS = [
    "gallery-filter-prompt-model",
    "gallery-filter-prompt-provider",
    "gallery-filter-forge-model",
    "gallery-filter-steps",
    "gallery-filter-size",
    "gallery-filter-mode",
    "gallery-filter-seed",
  ];

  function isGalleryPanelVisible() {
    return document.documentElement.getAttribute("data-center-gallery") === "on";
  }

  function isQueuePanelVisible() {
    return document.documentElement.getAttribute("data-center-queue") === "on";
  }

  function isBottomPanelVisible() {
    return isGalleryPanelVisible() || isQueuePanelVisible();
  }

  function getVisibleBottomPanel() {
    if (isQueuePanelVisible()) return document.getElementById("image-queue-panel");
    if (isGalleryPanelVisible()) return document.getElementById("image-gallery-panel");
    return null;
  }

  function isChatPanelVisible() {
    return document.documentElement.getAttribute("data-center-chat") !== "off";
  }

  function isGalleryView() {
    return isGalleryPanelVisible();
  }

  function clampCenterPanelShare(share) {
    const n = typeof share === "number" ? share : parseFloat(share);
    if (!Number.isFinite(n)) return CENTER_SHARE_DEFAULT;
    return Math.max(CENTER_SHARE_MIN, Math.min(CENTER_SHARE_MAX, n));
  }

  function getStoredCenterPanelShare() {
    try {
      const raw = localStorage.getItem(CENTER_SHARE_STORAGE_KEY);
      if (raw == null || raw === "") return CENTER_SHARE_DEFAULT;
      return clampCenterPanelShare(raw);
    } catch (_) {
      return CENTER_SHARE_DEFAULT;
    }
  }

  function saveCenterPanelShare(share) {
    try {
      localStorage.setItem(CENTER_SHARE_STORAGE_KEY, String(clampCenterPanelShare(share)));
    } catch (_) {}
  }

  function applyCenterPanelShare(share) {
    const clamped = clampCenterPanelShare(share);
    document.documentElement.style.setProperty("--center-chat-share", String(clamped));
    document.documentElement.style.setProperty("--center-gallery-share", String(1 - clamped));
    const splitter = document.getElementById("center-panels-splitter");
    if (splitter) splitter.setAttribute("aria-valuenow", String(Math.round(clamped * 100)));
    return clamped;
  }

  function applyCenterPanels() {
    const chatOn = isChatPanelVisible();
    let galleryOn = isGalleryPanelVisible();
    let queueOn = isQueuePanelVisible();
    if (galleryOn && queueOn) {
      document.documentElement.removeAttribute("data-center-queue");
      try {
        localStorage.setItem("centerQueueVisible", "false");
      } catch (err) {}
      queueOn = false;
    }
    const bottomOn = galleryOn || queueOn;
    const chatCol = document.getElementById("chat-column") || document.querySelector(".chat-column");
    const galleryPanel = document.getElementById("image-gallery-panel");
    const queuePanel = document.getElementById("image-queue-panel");
    const splitter = document.getElementById("center-panels-splitter");
    const chatBtn = document.getElementById("btn-center-chat");
    const galBtn = document.getElementById("btn-image-gallery");
    const queueBtn = document.getElementById("btn-image-queue");
    if (chatCol) chatCol.hidden = !chatOn;
    if (galleryPanel) galleryPanel.hidden = !galleryOn;
    if (queuePanel) queuePanel.hidden = !queueOn;
    if (splitter) splitter.hidden = !(chatOn && bottomOn);
    if (chatBtn) chatBtn.setAttribute("aria-pressed", chatOn ? "true" : "false");
    if (galBtn) galBtn.setAttribute("aria-pressed", galleryOn ? "true" : "false");
    if (queueBtn) queueBtn.setAttribute("aria-pressed", queueOn ? "true" : "false");
    if (!galleryOn) closeGalleryLightbox();
    const empty = document.getElementById("center-panels-empty");
    if (empty) empty.hidden = chatOn || bottomOn;
  }

  function setChatPanelVisible(on) {
    if (on) document.documentElement.removeAttribute("data-center-chat");
    else document.documentElement.setAttribute("data-center-chat", "off");
    try {
      localStorage.setItem("centerChatVisible", on ? "true" : "false");
    } catch (err) {}
    applyCenterPanels();
  }

  function setGalleryPanelVisible(on, options) {
    const skipMutex = !!(options && options.skipMutex);
    if (on && !skipMutex && isQueuePanelVisible()) {
      setQueuePanelVisible(false, { skipMutex: true });
    }
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

  function setQueuePanelVisible(on, options) {
    const skipMutex = !!(options && options.skipMutex);
    if (on && !skipMutex && isGalleryPanelVisible()) {
      setGalleryPanelVisible(false, { skipMutex: true });
    }
    const was = isQueuePanelVisible();
    if (on) document.documentElement.setAttribute("data-center-queue", "on");
    else document.documentElement.removeAttribute("data-center-queue");
    try {
      localStorage.setItem("centerQueueVisible", on ? "true" : "false");
    } catch (err) {}
    applyCenterPanels();
    if (on && !was) {
      loadImageQueuePage();
      startImageQueuePoll();
    } else if (!on) {
      maybeStopImageQueuePoll();
    }
  }

  function exitGalleryView() {
    setGalleryPanelVisible(false);
  }

  function enterGalleryView() {
    setGalleryPanelVisible(true);
  }

  const IMAGE_QUEUE_STATUS_LABELS = {
    pending: "Pendiente",
    generating: "Generándose",
    completed: "Generada",
    failed: "Fallida",
  };

  function renderImageQueueDetailsBody(item) {
    const rules = (item && item.rules) || {};
    const rows = [
      ["Prompt Forge", item.forge_prompt || "—"],
      ["Modo", item.forge_mode || "—"],
      ["LLM del prompt", [item.prompt_provider, item.prompt_model].filter(Boolean).join(" · ") || "—"],
      ["Panel prompt", rules.panel_prompt || null],
      ["Reglas del planificador", rules.prompt_system_instructions || null],
      ["Párrafo", rules.paragraph_index != null ? String(rules.paragraph_index) : null],
      ["Extracto seleccionado", rules.selected_excerpt || null],
      ["Lote", item.batch_id || null],
      ["Escena", item.scene_id || null],
      ["Error", item.error_message || null],
      ["Archivo", item.result_filename || null],
    ].filter(function (pair) {
      return pair[1] != null && pair[1] !== "";
    });
    const overrides = rules.forge_overrides || {};
    Object.keys(overrides).forEach(function (key) {
      rows.push(["Override " + key, overrides[key]]);
    });
    if (rules.use_chat_config != null) {
      rows.push(["Usar config del chat", rules.use_chat_config ? "sí" : "no"]);
    }
    if (rules.visual_consistency != null) {
      rows.push(["Consistencia visual", rules.visual_consistency ? "sí" : "no"]);
    }
    if (rules.pass_name) rows.push(["Pase", rules.pass_name]);
    let html = '<dl class="illustration-meta-grid image-queue-details-grid">';
    rows.forEach(function (pair) {
      html +=
        "<div><dt>" +
        escapeHtml(pair[0]) +
        '</dt><dd class="image-queue-details-value">' +
        escapeHtml(String(pair[1])) +
        "</dd></div>";
    });
    html += "</dl>";
    return html;
  }

  function imageQueueListRenderKey() {
    const selected = Array.from(imageQueueSelectedIds).sort().join(",");
    const itemsKey = imageQueueItems
      .map(function (item) {
        return [
          item.id,
          item.status,
          item.result_filename || "",
          item.created_at || "",
          item.completed_at || "",
          item.conversation_title || "",
          item.message_excerpt || "",
          item.prompt_model || "",
          item.prompt_provider || "",
          item.error_message || "",
        ].join("\t");
      })
      .join("\n");
    return itemsKey + "\n#" + (imageQueueExpandedId || "") + "\n@" + selected;
  }

  function renderImageQueueThumb(item) {
    const filename = item && item.result_filename;
    if (item && item.status === "completed" && filename) {
      return (
        '<div class="image-queue-thumb">' +
        '<img class="image-queue-thumb-img" src="' +
        escapeHtml(API + "/illustrated-images/" + encodeURIComponent(filename)) +
        '" alt="' +
        escapeHtml(item.conversation_title || "Ilustración") +
        '" loading="lazy" decoding="async" />' +
        "</div>"
      );
    }
    return '<div class="image-queue-thumb image-queue-thumb--empty" aria-hidden="true"></div>';
  }

  function renderImageQueueDates(item) {
    const parts = [];
    if (item && item.created_at) {
      parts.push(
        '<time class="image-queue-date" datetime="' +
          escapeHtml(item.created_at) +
          '">En cola: ' +
          escapeHtml(formatDateTime(item.created_at)) +
          "</time>"
      );
    }
    if (item && item.status === "completed" && item.completed_at) {
      parts.push(
        '<time class="image-queue-date" datetime="' +
          escapeHtml(item.completed_at) +
          '">Generada: ' +
          escapeHtml(formatDateTime(item.completed_at)) +
          "</time>"
      );
    }
    if (!parts.length) return "";
    return '<div class="image-queue-row-dates">' + parts.join("") + "</div>";
  }

  function renderImageQueueList() {
    const list = document.getElementById("image-queue-list");
    if (!list) return;
    pruneImageQueueSelection();
    const renderKey = imageQueueListRenderKey();
    if (renderKey === imageQueueLastRenderKey) return;
    imageQueueLastRenderKey = renderKey;
    if (!imageQueueItems.length) {
      list.innerHTML = '<p class="image-queue-empty">No hay trabajos en la cola.</p>';
      return;
    }
    list.innerHTML = imageQueueItems
      .map(function (item, index) {
        const status = item.status || "pending";
        const statusLabel = IMAGE_QUEUE_STATUS_LABELS[status] || status;
        const llm = [item.prompt_provider, item.prompt_model].filter(Boolean).join(" · ") || "—";
        const expanded = imageQueueExpandedId === item.id;
        const selected = imageQueueSelectedIds.has(item.id);
        return (
          '<article class="image-queue-row image-queue-row--' +
          escapeHtml(status) +
          (selected ? " is-selected" : "") +
          '" data-queue-id="' +
          escapeHtml(item.id) +
          '" data-queue-index="' +
          String(index) +
          '">' +
          '<div class="image-queue-row-main" data-queue-selectable="true">' +
          '<span class="image-queue-status" data-status="' +
          escapeHtml(status) +
          '">' +
          escapeHtml(statusLabel) +
          "</span>" +
          renderImageQueueThumb(item) +
          '<div class="image-queue-row-body">' +
          '<div class="image-queue-row-title">' +
          escapeHtml(item.conversation_title || "Conversación") +
          "</div>" +
          '<div class="image-queue-row-excerpt">' +
          escapeHtml(item.message_excerpt || "(sin texto)") +
          "</div>" +
          '<div class="image-queue-row-meta">LLM: ' +
          escapeHtml(llm) +
          "</div>" +
          renderImageQueueDates(item) +
          "</div>" +
          '<div class="image-queue-row-actions">' +
          '<button type="button" class="btn btn-secondary btn-small image-queue-go-message" data-conversation-id="' +
          escapeHtml(item.conversation_id) +
          '" data-message-id="' +
          escapeHtml(item.message_id) +
          '">Ir al mensaje</button>' +
          '<button type="button" class="btn btn-secondary btn-small image-queue-details-btn" data-queue-id="' +
          escapeHtml(item.id) +
          '" aria-expanded="' +
          (expanded ? "true" : "false") +
          '">Detalles</button>' +
          '<button type="button" class="btn btn-secondary btn-small image-queue-delete-btn" data-queue-id="' +
          escapeHtml(item.id) +
          '" title="Eliminar de la cola" aria-label="Eliminar de la cola">Eliminar</button>' +
          "</div>" +
          "</div>" +
          (expanded
            ? '<div class="image-queue-details" id="image-queue-details-' +
              escapeHtml(item.id) +
              '">' +
              renderImageQueueDetailsBody(item) +
              "</div>"
            : "") +
          "</article>"
        );
      })
      .join("");
  }

  function pruneImageQueueSelection() {
    const known = new Set(imageQueueItems.map(function (item) {
      return item.id;
    }));
    Array.from(imageQueueSelectedIds).forEach(function (id) {
      if (!known.has(id)) imageQueueSelectedIds.delete(id);
    });
    if (
      imageQueueSelectionAnchor >= imageQueueItems.length ||
      (imageQueueSelectionAnchor >= 0 &&
        imageQueueItems[imageQueueSelectionAnchor] &&
        !imageQueueSelectedIds.has(imageQueueItems[imageQueueSelectionAnchor].id))
    ) {
      imageQueueSelectionAnchor = imageQueueItems.findIndex(function (item) {
        return imageQueueSelectedIds.has(item.id);
      });
    }
  }

  function clearImageQueueSelection() {
    imageQueueSelectedIds.clear();
    imageQueueSelectionAnchor = -1;
    closeImageQueueContextMenu();
    renderImageQueueList();
  }

  function selectImageQueueRange(fromIndex, toIndex) {
    const start = Math.max(0, Math.min(fromIndex, toIndex));
    const end = Math.min(imageQueueItems.length - 1, Math.max(fromIndex, toIndex));
    imageQueueSelectedIds.clear();
    for (let i = start; i <= end; i += 1) {
      if (imageQueueItems[i]) imageQueueSelectedIds.add(imageQueueItems[i].id);
    }
    renderImageQueueList();
  }

  function selectSingleImageQueueItem(index) {
    imageQueueSelectedIds.clear();
    if (index >= 0 && imageQueueItems[index]) {
      imageQueueSelectedIds.add(imageQueueItems[index].id);
      imageQueueSelectionAnchor = index;
    } else {
      imageQueueSelectionAnchor = -1;
    }
    renderImageQueueList();
  }

  function handleImageQueueRowSelect(index, shiftKey) {
    if (index < 0 || index >= imageQueueItems.length) return;
    if (shiftKey && imageQueueSelectionAnchor >= 0) {
      selectImageQueueRange(imageQueueSelectionAnchor, index);
      return;
    }
    selectSingleImageQueueItem(index);
  }

  function getImageQueueContextMenu() {
    return document.getElementById("image-queue-context-menu");
  }

  function closeImageQueueContextMenu() {
    const menu = getImageQueueContextMenu();
    if (menu) menu.hidden = true;
  }

  function openImageQueueContextMenu(clientX, clientY) {
    const menu = getImageQueueContextMenu();
    if (!menu || !imageQueueSelectedIds.size) return;
    menu.hidden = false;
    menu.style.left = Math.max(8, clientX) + "px";
    menu.style.top = Math.max(8, clientY) + "px";
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      menu.style.left = Math.max(8, window.innerWidth - rect.width - 8) + "px";
    }
    if (rect.bottom > window.innerHeight - 8) {
      menu.style.top = Math.max(8, window.innerHeight - rect.height - 8) + "px";
    }
  }

  async function deleteImageQueueJobs(ids) {
    const cleaned = Array.from(new Set((ids || []).filter(Boolean)));
    if (!cleaned.length) return;
    try {
      await fetchJson(`${API}/image-generation-queue/delete`, {
        method: "POST",
        body: JSON.stringify({ ids: cleaned }),
      });
      cleaned.forEach(function (id) {
        imageQueueSelectedIds.delete(id);
      });
      if (imageQueueExpandedId && cleaned.indexOf(imageQueueExpandedId) >= 0) {
        imageQueueExpandedId = null;
      }
      closeImageQueueContextMenu();
      await loadImageQueuePage();
      if (currentConversationId) await refreshCurrentConversationMessages();
    } catch (e) {
      showError("No se pudo eliminar de la cola: " + (e.message || e));
    }
  }

  async function deleteSelectedImageQueueJobs() {
    await deleteImageQueueJobs(Array.from(imageQueueSelectedIds));
  }

  async function cancelAllActiveImageQueueJobs() {
    if (!window.confirm("¿Cancelar todas las generaciones pendientes y en curso?")) return;
    try {
      await fetchJson(`${API}/image-generation-queue/cancel-active`, {
        method: "POST",
      });
      imageQueueSelectedIds.clear();
      imageQueueExpandedId = null;
      closeImageQueueContextMenu();
      await loadImageQueuePage();
      if (currentConversationId) await refreshCurrentConversationMessages();
    } catch (e) {
      showError("No se pudo cancelar la cola: " + (e.message || e));
    }
  }

  function syncImageQueuePauseUi() {
    const btn = document.getElementById("image-queue-pause-toggle");
    const label = document.getElementById("image-queue-paused-label");
    if (btn) {
      btn.textContent = imageQueuePaused ? "Reanudar" : "Pausar";
      btn.setAttribute("aria-pressed", imageQueuePaused ? "true" : "false");
      btn.title = imageQueuePaused
        ? "Reanudar la generación encolada"
        : "Pausar la generación encolada";
    }
    if (label) label.hidden = !imageQueuePaused;
  }

  async function toggleImageQueuePaused() {
    const endpoint = imageQueuePaused ? "resume" : "pause";
    try {
      const data = await fetchJson(`${API}/image-generation-queue/${endpoint}`, {
        method: "POST",
      });
      imageQueuePaused = Boolean(data.paused);
      syncImageQueuePauseUi();
      if (!imageQueuePaused) startImageQueuePoll();
    } catch (e) {
      showError("No se pudo cambiar el estado de la cola: " + (e.message || e));
    }
  }

  function syncImageQueueActiveCount(activeCount) {
    const node = document.getElementById("image-queue-active-count");
    if (!node) return;
    const n = typeof activeCount === "number" ? activeCount : 0;
    node.textContent = n > 0 ? n + " en curso" : "";
    node.hidden = n <= 0;
  }

  function shouldWatchImageQueue() {
    return isQueuePanelVisible() || imageQueueKnownActive > 0;
  }

  function maybeStopImageQueuePoll() {
    if (!shouldWatchImageQueue()) stopImageQueuePoll();
  }

  async function loadImageQueueForDebug() {
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      const data = await fetchJson(`${API}/image-generation-queue?${params}`);
      imageQueuePaused = Boolean(data.paused);
      imageQueueKnownActive = data.active_count || 0;
      syncImageQueueActiveCount(data.active_count);
      syncImageQueuePauseUi();
      ingestQueueItemsForDebug(data.items);
      if (shouldWatchImageQueue()) startImageQueuePoll();
      else maybeStopImageQueuePoll();
    } catch (_) {}
  }

  async function loadImageQueuePage() {
    const params = new URLSearchParams();
    if (imageQueueFilterStatus) params.set("status", imageQueueFilterStatus);
    params.set("limit", "100");
    try {
      const data = await fetchJson(`${API}/image-generation-queue?${params}`);
      imageQueueItems = data.items || [];
      imageQueuePaused = Boolean(data.paused);
      syncImageQueueActiveCount(data.active_count);
      syncImageQueuePauseUi();
      imageQueueKnownActive = data.active_count || 0;
      ingestQueueItemsForDebug(imageQueueItems);
      renderImageQueueList();
    } catch (e) {
      const list = document.getElementById("image-queue-list");
      if (list) list.innerHTML = '<p class="image-queue-empty">Error al cargar la cola.</p>';
    }
  }

  function takeNewlySettledQueueJobs(items) {
    const settled = [];
    (items || []).forEach(function (item) {
      if (!item || !item.id) return;
      const prev = imageQueueLastStatusById[item.id] || imageQueueDebugSeen[item.id];
      const now = item.status;
      imageQueueLastStatusById[item.id] = now;
      if (
        (now === "completed" || now === "failed") &&
        prev &&
        prev !== now
      ) {
        settled.push(item);
      }
    });
    return settled;
  }

  function syncReadingModeContentPreservingScroll() {
    if (!isReadingModeOpen() || readingModeMessageIndex == null) return;
    const msg = messages[readingModeMessageIndex];
    const body = document.getElementById("reading-mode-body");
    if (!msg || !body) return;
    const prevScrollTop = body.scrollTop;
    body.innerHTML = formatMessageHtml(msg.content || "");
    enhanceIllustrationFrames(body);
    applyConversationFontSize(getStoredFontSize());
    applyConversationImageSize(getStoredImageSize());
    body.scrollTop = prevScrollTop;
  }

  function applyIllustrationContentToOpenView(conv) {
    if (!conv || conv.id !== currentConversationId) return;
    const byId = {};
    []
      .concat(conv.inherited_messages || [])
      .concat(conv.messages || [])
      .forEach(function (raw) {
        const mapped = mapApiMessage(raw);
        if (mapped.id) byId[mapped.id] = mapped;
      });
    let changed = false;
    function patchList(list) {
      list.forEach(function (m) {
        const src = m.id && byId[m.id];
        if (!src || src.content === m.content) return;
        m.content = src.content;
        changed = true;
      });
    }
    patchList(allMessages);
    patchList(messages);
    if (!changed) return;
    renderMessages();
    syncReadingModeContentPreservingScroll();
  }

  async function refreshCurrentConversationMessages() {
    if (!currentConversationId) return;
    try {
      const conv = await fetchJson(`${API}/conversations/${currentConversationId}`);
      applyIllustrationContentToOpenView(conv);
    } catch (_) {}
  }

  async function pollImageQueue() {
    if (imageQueuePollBusy) return;
    imageQueuePollBusy = true;
    try {
      const params = new URLSearchParams();
      if (isQueuePanelVisible() && imageQueueFilterStatus) params.set("status", imageQueueFilterStatus);
      params.set("limit", "100");
      const data = await fetchJson(`${API}/image-generation-queue?${params}`);
      imageQueuePaused = Boolean(data.paused);
      imageQueueKnownActive = data.active_count || 0;
      syncImageQueueActiveCount(data.active_count);
      syncImageQueuePauseUi();
      if (isQueuePanelVisible()) {
        imageQueueItems = data.items || [];
        renderImageQueueList();
      }
      const newlySettled = takeNewlySettledQueueJobs(data.items);
      ingestQueueItemsForDebug(data.items);
      const settledHere = newlySettled.some(function (item) {
        return item.conversation_id === currentConversationId;
      });
      if (settledHere) {
        await refreshCurrentConversationMessages();
      }
      maybeStopImageQueuePoll();
    } catch (_) {
    } finally {
      imageQueuePollBusy = false;
    }
  }

  function startImageQueuePoll() {
    stopImageQueuePoll();
    imageQueuePollTimer = window.setInterval(pollImageQueue, IMAGE_QUEUE_POLL_MS);
  }

  function stopImageQueuePoll() {
    if (imageQueuePollTimer) {
      window.clearInterval(imageQueuePollTimer);
      imageQueuePollTimer = null;
    }
  }

  function initImageQueuePanel() {
    document.querySelectorAll(".image-queue-filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".image-queue-filter-btn").forEach(function (node) {
          node.classList.remove("is-active");
        });
        btn.classList.add("is-active");
        imageQueueFilterStatus = btn.getAttribute("data-queue-status") || "";
        loadImageQueuePage();
      });
    });
    const pauseBtn = document.getElementById("image-queue-pause-toggle");
    if (pauseBtn) {
      pauseBtn.addEventListener("click", function () {
        toggleImageQueuePaused();
      });
    }
    const cancelAllBtn = document.getElementById("image-queue-cancel-all");
    if (cancelAllBtn) {
      cancelAllBtn.addEventListener("click", function () {
        cancelAllActiveImageQueueJobs();
      });
    }
    const list = document.getElementById("image-queue-list");
    if (list) {
      list.addEventListener("click", function (e) {
        const deleteBtn = e.target.closest(".image-queue-delete-btn");
        if (deleteBtn && list.contains(deleteBtn)) {
          e.preventDefault();
          e.stopPropagation();
          const id = deleteBtn.getAttribute("data-queue-id");
          if (id) deleteImageQueueJobs([id]);
          return;
        }
        const goBtn = e.target.closest(".image-queue-go-message");
        if (goBtn && list.contains(goBtn)) {
          const convId = goBtn.getAttribute("data-conversation-id");
          const msgId = goBtn.getAttribute("data-message-id");
          if (convId && msgId) openConversationAtMessage(convId, msgId);
          return;
        }
        const detailsBtn = e.target.closest(".image-queue-details-btn");
        if (detailsBtn && list.contains(detailsBtn)) {
          const id = detailsBtn.getAttribute("data-queue-id");
          imageQueueExpandedId = imageQueueExpandedId === id ? null : id;
          renderImageQueueList();
          return;
        }
        const row = e.target.closest(".image-queue-row");
        const selectable = e.target.closest("[data-queue-selectable]");
        if (row && selectable && list.contains(row)) {
          const index = parseInt(row.getAttribute("data-queue-index"), 10);
          if (!Number.isNaN(index)) {
            handleImageQueueRowSelect(index, e.shiftKey);
          }
        }
      });
      list.addEventListener("contextmenu", function (e) {
        const row = e.target.closest(".image-queue-row");
        if (!row || !list.contains(row)) return;
        if (e.target.closest("button, a, textarea, input")) return;
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(row.getAttribute("data-queue-index"), 10);
        if (!Number.isNaN(index)) {
          const id = row.getAttribute("data-queue-id");
          if (id && !imageQueueSelectedIds.has(id)) {
            selectSingleImageQueueItem(index);
          }
        }
        if (!imageQueueSelectedIds.size) return;
        openImageQueueContextMenu(e.clientX, e.clientY);
      });
    }
    const queueMenu = getImageQueueContextMenu();
    if (queueMenu) {
      queueMenu.addEventListener("click", function (e) {
        const item = e.target.closest("[data-action]");
        if (!item || !queueMenu.contains(item)) return;
        if (item.getAttribute("data-action") === "delete") {
          deleteSelectedImageQueueJobs();
        }
      });
    }
    document.addEventListener("click", function (e) {
      if (Date.now() < textContextIgnoreClickUntil) return;
      if (e.target.closest("#image-queue-context-menu")) return;
      closeImageQueueContextMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeImageQueueContextMenu();
    });
    if (isQueuePanelVisible()) {
      loadImageQueuePage();
      startImageQueuePoll();
    }
    const queuePanel = document.getElementById("image-queue-panel");
    const queueList = document.getElementById("image-queue-list");
    bindScrollReveal(queuePanel || queueList, queueList);
  }

  function galleryFilterValue(id) {
    const node = document.getElementById(id);
    return node ? String(node.value || "") : "";
  }

  function appendGalleryToolbarFilters(params) {
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
    const seed = galleryFilterValue("gallery-filter-seed");
    if (seed) params.set("seed", seed);
    const q = galleryFilterValue("gallery-filter-prompt-q").trim();
    if (q) params.set("prompt_q", q);
  }

  function hasActiveGalleryToolbarFilters() {
    if (GALLERY_TOOLBAR_FILTER_IDS.some(function (id) {
      return Boolean(galleryFilterValue(id));
    })) {
      return true;
    }
    return Boolean(galleryFilterValue("gallery-filter-prompt-q").trim());
  }

  function clearGalleryToolbarFilters() {
    GALLERY_TOOLBAR_FILTER_IDS.forEach(function (id) {
      const node = document.getElementById(id);
      if (node) node.value = "";
    });
    const promptQ = document.getElementById("gallery-filter-prompt-q");
    if (promptQ) promptQ.value = "";
    if (galleryPromptTimer) {
      window.clearTimeout(galleryPromptTimer);
      galleryPromptTimer = null;
    }
    onGalleryToolbarFilterChange();
  }

  function syncImageFilterNotice() {
    const notice = document.getElementById("conversation-image-filter-notice");
    if (!notice) return;
    notice.hidden = !hasActiveGalleryToolbarFilters();
  }

  function applyIllustrationFilterToRoot(root) {
    if (!root) return;
    const active = hasActiveGalleryToolbarFilters();
    root.querySelectorAll(".chat-illustration-frame").forEach(function (frame) {
      if (!active || (!conversationFilterPending && conversationFilterFilenames == null)) {
        frame.classList.remove("is-gallery-filter-hidden");
        return;
      }
      if (conversationFilterPending) {
        frame.classList.add("is-gallery-filter-hidden");
        return;
      }
      const img = frame.querySelector("img.chat-illustration");
      const filename = img
        ? img.getAttribute("data-filename") || filenameFromIllustratedSrc(img.getAttribute("src"))
        : "";
      frame.classList.toggle(
        "is-gallery-filter-hidden",
        !conversationFilterFilenames.has(filename)
      );
    });
  }

  function applyIllustrationFilterToVisibleRoots() {
    applyIllustrationFilterToRoot(el.messagesContainer);
    applyIllustrationFilterToRoot(document.getElementById("reading-mode-body"));
  }

  async function refreshConversationImageFilter() {
    const seq = ++conversationFilterSeq;
    syncImageFilterNotice();
    if (!hasActiveGalleryToolbarFilters() || !currentConversationId) {
      conversationFilterFilenames = null;
      conversationFilterPending = false;
      applyIllustrationFilterToVisibleRoots();
      return;
    }
    conversationFilterPending = true;
    conversationFilterFilenames = null;
    applyIllustrationFilterToVisibleRoots();
    try {
      const params = new URLSearchParams();
      params.set("conversation_id", currentConversationId);
      appendGalleryToolbarFilters(params);
      const data = await fetchJson(
        `${API}/illustrated-images/matching-filenames?${params}`
      );
      if (seq !== conversationFilterSeq) return;
      conversationFilterFilenames = new Set(data.filenames || []);
      conversationFilterPending = false;
      applyIllustrationFilterToVisibleRoots();
    } catch (err) {
      if (seq !== conversationFilterSeq) return;
      conversationFilterFilenames = null;
      conversationFilterPending = false;
      applyIllustrationFilterToVisibleRoots();
      showError("No se pudieron aplicar los filtros de imágenes al chat: " + err.message);
    }
  }

  function scheduleConversationImageFilter() {
    if (conversationFilterTimer) window.clearTimeout(conversationFilterTimer);
    conversationFilterTimer = window.setTimeout(function () {
      conversationFilterTimer = null;
      refreshConversationImageFilter();
    }, 80);
  }

  function onGalleryToolbarFilterChange() {
    galleryOffset = 0;
    if (isGalleryPanelVisible()) loadGalleryPage();
    refreshConversationImageFilter();
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

  async function purgeOrphanIllustratedFiles() {
    const btn = document.getElementById("gallery-purge-orphans");
    try {
      if (btn) btn.disabled = true;
      const preview = await fetchJson(`${API}/illustrated-images/orphans`);
      const count = preview.count || 0;
      if (!count) {
        showNotice("No hay archivos huérfanos.");
        return;
      }
      const noun = count === 1 ? "archivo" : "archivos";
      if (
        !window.confirm(
          "Se eliminarán " +
            count +
            " " +
            noun +
            " no incrustados en ningún mensaje. ¿Continuar?"
        )
      ) {
        return;
      }
      const result = await fetchJson(`${API}/illustrated-images/orphans/purge`, {
        method: "POST",
      });
      showNotice("Eliminados " + (result.deleted_files || 0) + " archivos huérfanos.");
      await refreshGalleryAfterScopeChange();
    } catch (e) {
      showError("No se pudieron eliminar archivos huérfanos: " + (e.message || e));
    } finally {
      if (btn) btn.disabled = false;
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
    appendGalleryToolbarFilters(params);
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
      fillGallerySelect("gallery-filter-seed", data.seeds, "");
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
          item.seed != null ? "seed " + item.seed : null,
          item.forge_model,
          galleryLlmLabel(item),
        ]
          .filter(Boolean)
          .join(" · ");
        const prompt = (item.prompt || "").trim() || "(sin prompt)";
        const when = formatGalleryDate(item.created_at);
        const sizeAttrs =
          item.width > 0 && item.height > 0
            ? ' width="' +
              item.width +
              '" height="' +
              item.height +
              '" style="aspect-ratio: ' +
              item.width +
              " / " +
              item.height +
              '"'
            : "";
        return (
          '<button type="button" class="image-gallery-card" data-gallery-index="' +
          index +
          '">' +
          '<img src="' +
          escapeHtml(item.url) +
          '" alt="" loading="lazy"' +
          sizeAttrs +
          " />" +
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

  function galleryPageOffsetForAbsolute(absoluteIndex) {
    if (!Number.isFinite(absoluteIndex) || absoluteIndex < 0) return 0;
    return Math.floor(absoluteIndex / GALLERY_PAGE_SIZE) * GALLERY_PAGE_SIZE;
  }

  async function loadGalleryPage(options) {
    const silent = !!(options && options.silent);
    const requestedOffset =
      options && Number.isFinite(options.offset) ? options.offset : galleryOffset;
    const seq = ++galleryLoadSeq;
    if (!silent) closeGalleryLightbox();
    const grid = document.getElementById("image-gallery-grid");
    if (grid && !silent) {
      grid.innerHTML = '<p class="image-gallery-empty">Cargando…</p>';
    }
    try {
      const data = await fetchJson(
        `${API}/illustrated-images?${buildGalleryQuery(requestedOffset)}`
      );
      if (seq !== galleryLoadSeq) return false;
      galleryItems = data.items || [];
      galleryTotal = data.total || 0;
      galleryOffset = typeof data.offset === "number" ? data.offset : requestedOffset;
      renderGalleryGrid();
      return true;
    } catch (err) {
      if (seq !== galleryLoadSeq) return false;
      if (!silent) {
        galleryItems = [];
        galleryTotal = 0;
        if (grid) {
          grid.innerHTML =
            '<p class="image-gallery-empty">No se pudo cargar la galería.</p>';
        }
      }
      showError("Error al cargar la galería: " + err.message);
      return false;
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
    const abs = galleryOffset + galleryLightboxIndex;
    const showNav = galleryTotal > 1;
    if (prev) {
      prev.hidden = !showNav;
      prev.disabled = abs <= 0;
    }
    if (next) {
      next.hidden = !showNav;
      next.disabled = abs >= galleryTotal - 1;
    }
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
        const stayHere =
          currentConversationId &&
          messages.some(function (m) {
            return m.id === item.message_id;
          });
        openConversationAtMessage(
          stayHere ? currentConversationId : item.conversation_id,
          item.message_id
        );
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

  async function stepGalleryLightbox(delta) {
    if (galleryLightboxIndex < 0 || galleryTotal < 2 || galleryLightboxBusy) return;
    const target = galleryOffset + galleryLightboxIndex + delta;
    if (target < 0 || target >= galleryTotal) return;
    const pageOffset = galleryPageOffsetForAbsolute(target);
    if (pageOffset === galleryOffset) {
      openGalleryLightbox(target - galleryOffset);
      return;
    }
    galleryLightboxBusy = true;
    try {
      const ok = await loadGalleryPage({ silent: true, offset: pageOffset });
      if (!ok || galleryLightboxIndex < 0) return;
      const idx = target - galleryOffset;
      if (idx < 0 || idx >= galleryItems.length) {
        closeGalleryLightbox();
        return;
      }
      openGalleryLightbox(idx);
    } finally {
      galleryLightboxBusy = false;
    }
  }

  function highlightIllustrationInConversation(filename, sceneId) {
    const root = el.messagesContainer;
    if (!root) return;
    let img = null;
    if (filename) {
      try {
        img = root.querySelector('img.chat-illustration[data-filename="' + CSS.escape(filename) + '"]');
      } catch (_) {}
    }
    if (!img && filename) {
      root.querySelectorAll("img.chat-illustration").forEach(function (node) {
        if (img) return;
        const src = node.getAttribute("src") || "";
        const data = node.getAttribute("data-filename") || filenameFromIllustratedSrc(src);
        if (data === filename || src.indexOf(filename) >= 0) img = node;
      });
    }
    if (!img && sceneId) {
      try {
        img = root.querySelector('[data-scene="' + CSS.escape(sceneId) + '"]');
      } catch (_) {}
    }
    const target = (img && (img.closest(".chat-illustration-frame") || img)) || img;
    if (!target) {
      showNotice("No se encontró la imagen en la conversación.");
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.classList.add("illustration-debug-highlight");
    window.setTimeout(function () {
      target.classList.remove("illustration-debug-highlight");
    }, 2200);
  }

  async function openConversationAtIllustration(conversationId, messageId, filename, sceneId) {
    if (conversationId && messageId) {
      await openConversationAtMessage(conversationId, messageId);
    }
    highlightIllustrationInConversation(filename, sceneId);
  }

  function scrollAndHighlightMessage(messageId) {
    if (!el.messagesContainer || !messageId) return;
    cancelScheduledScrollToBottom();
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

  function initCenterPanelSplit() {
    const splitter = document.getElementById("center-panels-splitter");
    if (!splitter) return;
    let lastShare = applyCenterPanelShare(getStoredCenterPanelShare());
    let drag = false;

    function shareFromClientY(clientY) {
      const chat = document.getElementById("chat-column") || document.querySelector(".chat-column");
      const bottom = getVisibleBottomPanel();
      if (!chat || !bottom) return lastShare;
      const top = chat.getBoundingClientRect().top;
      const total = bottom.getBoundingClientRect().bottom - top;
      if (total <= 0) return lastShare;
      return clampCenterPanelShare((clientY - top) / total);
    }

    function endDrag() {
      if (!drag) return;
      saveCenterPanelShare(lastShare);
      drag = false;
      document.body.classList.remove("center-panels-resizing");
    }

    splitter.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      if (splitter.hidden) return;
      e.preventDefault();
      splitter.setPointerCapture(e.pointerId);
      drag = true;
      document.body.classList.add("center-panels-resizing");
      lastShare = applyCenterPanelShare(shareFromClientY(e.clientY));
    });
    splitter.addEventListener("pointermove", function (e) {
      if (!drag) return;
      lastShare = applyCenterPanelShare(shareFromClientY(e.clientY));
    });
    splitter.addEventListener("pointerup", endDrag);
    splitter.addEventListener("pointercancel", endDrag);
    splitter.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? CENTER_SHARE_KEYBOARD_STEP : -CENTER_SHARE_KEYBOARD_STEP;
      lastShare = applyCenterPanelShare(lastShare + delta);
      saveCenterPanelShare(lastShare);
    });
  }

  function initImageGallery() {
    applyCenterPanels();
    initCenterPanelSplit();
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
    const queueBtn = document.getElementById("btn-image-queue");
    if (queueBtn) {
      queueBtn.addEventListener("click", function () {
        setQueuePanelVisible(!isQueuePanelVisible());
      });
    }
    initImageQueuePanel();
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
      "gallery-filter-seed",
    ].forEach(function (id) {
      const node = document.getElementById(id);
      if (!node) return;
      node.addEventListener("change", onGalleryToolbarFilterChange);
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
    const purgeOrphansBtn = document.getElementById("gallery-purge-orphans");
    if (purgeOrphansBtn) {
      purgeOrphansBtn.addEventListener("click", function () {
        purgeOrphanIllustratedFiles();
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
          onGalleryToolbarFilterChange();
        }, 280);
      });
    }
    const filterNotice = document.getElementById("conversation-image-filter-notice");
    if (filterNotice) {
      const openBtn = filterNotice.querySelector(".chat-image-filter-notice-open");
      if (openBtn) {
        openBtn.addEventListener("click", function () {
          setGalleryPanelVisible(true);
        });
      }
      const dismissBtn = document.getElementById("conversation-image-filter-notice-dismiss");
      if (dismissBtn) {
        dismissBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          clearGalleryToolbarFilters();
        });
      }
    }
    syncImageFilterNotice();
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

  async function initImagesPanel() {
    const prefs = loadImagesPrefs();
    const enabled = document.getElementById("images-enabled");
    const useChatConfig = document.getElementById("images-use-chat-config");
    const visualConsistency = document.getElementById("images-visual-consistency");
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
    fillImagesPanelFromPrefs(prefs);
    await fetchForgeReactorDefaults();

    const forgeParamInputs = [forgeSteps, forgeWidth, forgeHeight, forgeSeed];
    [enabled, useChatConfig, visualConsistency, per, batchSize, retries, promptEl, providerSel, modelSel]
      .concat(forgeParamInputs)
      .concat(reactorPanelInputNodes())
      .forEach((node) => {
      if (!node) return;
      const evt =
        node === promptEl ||
        node.id === "images-reactor-female-face-model" ||
        node.id === "images-reactor-male-face-model" ||
        (node.id && node.id.indexOf("images-reactor-") === 0 && node.type === "text")
          ? "input"
          : "change";
      node.addEventListener(evt, function () {
        if (node.id === "images-reactor-female-enabled" || node.id === "images-reactor-male-enabled") {
          syncReactorGenderInputs();
        }
        if (node === providerSel) {
          loadImagesPromptModels()
            .then(function () {
              return loadPlannerContract();
            })
            .then(persistImagesPanel);
        } else if (node === modelSel) {
          loadPlannerContract().then(persistImagesPanel);
        } else persistImagesPanel();
      });
    });
    syncReactorGenderInputs();
    if (reloadForgeBtn) {
      reloadForgeBtn.addEventListener("click", function () {
        reloadForgeParamsFromLastGen({ notify: true }).catch(function () {});
      });
    }
    const plannerThink = document.getElementById("planner-think");
    if (plannerThink) {
      plannerThink.addEventListener("change", function () {
        const value = coercePlannerParamValue("think", plannerThink.value);
        if (value === null) delete plannerModelParams.think;
        else plannerModelParams.think = value;
        syncPlannerRecipeChipSelection();
        persistImagesPanel();
      });
    }
    syncImagesChatConfigDisabled();
    await ensureImagesPromptSelects();
    await loadPlannerContract();
    loadPlannerLibraryRules();
    await autofillForgeParamsFromLastGen(prefs);
    persistImagesPanel();
  }

  initDebugDock();
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
      model_params: collectAllModelParams(),
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
    const images = imagesSnapshotForConversation();
    await fetchJson(`${API}/conversations/${currentConversationId}`, {
      method: "PUT",
      body: JSON.stringify({
        provider: snap.provider,
        model_id: snap.model_id,
        model_params: buildModelParams(),
        history_turns: snap.history_turns,
        system_instructions: snap.system_instructions,
        images: images,
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
    await loadModelContract({ applyParamDefaults: false });
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
    await applyImagesSnapshot(snap.images || {}, { includePlannerRules: true });
    renderParamsSourceLabel();
    renderParamsToSend();
    syncHeaderProviderModel();
    await persistWorkspaceToConversation();
    await loadContextLength();
  }

  function getSelectedWorkspaceProfileId() {
    const select = document.getElementById("workspace-profile-select");
    return select && select.value ? select.value : "";
  }

  function syncWorkspaceProfileActions() {
    const has = !!getSelectedWorkspaceProfileId();
    ["btn-workspace-profile-apply", "btn-workspace-profile-save", "btn-workspace-profile-delete"].forEach(function (id) {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !has;
    });
  }

  function renderWorkspaceProfileSelect() {
    const select = document.getElementById("workspace-profile-select");
    if (!select) return;
    const previous = currentWorkspaceProfileId || select.value;
    if (currentWorkspaceProfileId && !workspaceProfiles.some((p) => p.id === currentWorkspaceProfileId)) {
      currentWorkspaceProfileId = "";
    }
    const placeholder = workspaceProfiles.length ? "Elegir perfil" : "No hay perfiles";
    select.innerHTML =
      `<option value="">${placeholder}</option>` +
      workspaceProfiles
        .map(function (p) {
          return `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`;
        })
        .join("");
    if (previous && workspaceProfiles.some((p) => p.id === previous)) {
      select.value = previous;
    } else {
      select.value = "";
    }
    syncWorkspaceProfileActions();
  }

  async function refreshWorkspaceProfiles() {
    try {
      const list = await fetchJson(`${API}/workspace-profiles`);
      workspaceProfiles = Array.isArray(list) ? list : [];
    } catch (e) {
      workspaceProfiles = [];
      renderWorkspaceProfileSelect();
      showError("No se pudieron cargar los perfiles: " + (e.message || e));
      return;
    }
    renderWorkspaceProfileSelect();
  }

  function promptWorkspaceProfileName(defaultName, meta) {
    const modal = document.getElementById("workspace-profile-name-modal");
    const input = document.getElementById("workspace-profile-name-input");
    const confirmBtn = document.getElementById("workspace-profile-name-confirm");
    const cancelBtn = document.getElementById("workspace-profile-name-cancel");
    const titleEl = document.getElementById("workspace-profile-name-title");
    const labelEl = document.getElementById("workspace-profile-name-label");
    if (!modal || !input || !confirmBtn || !cancelBtn) {
      return Promise.resolve(null);
    }
    if (titleEl) titleEl.textContent = (meta && meta.title) || "Nombre del perfil";
    if (labelEl) labelEl.textContent = (meta && meta.label) || "Cómo se llama este rig";
    if (input) input.placeholder = (meta && meta.placeholder) || "Relato · faro";
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
    let profileId = asNew ? "" : getSelectedWorkspaceProfileId();
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
      const select = document.getElementById("workspace-profile-select");
      if (select && saved && saved.id) select.value = saved.id;
      if (saved && saved.id && !workspaceProfiles.some((p) => p.id === saved.id)) {
        workspaceProfiles = workspaceProfiles.concat([saved]);
        renderWorkspaceProfileSelect();
        if (select) select.value = saved.id;
      }
      syncWorkspaceProfileActions();
      showNotice(profileId ? "Perfil actualizado." : "Perfil guardado.");
    } catch (e) {
      showError("No se pudo guardar el perfil: " + (e.message || e));
    }
  }

  async function applySelectedWorkspaceProfile() {
    const profileId = getSelectedWorkspaceProfileId();
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
      const select = document.getElementById("workspace-profile-select");
      if (select) select.value = profile.id;
      syncWorkspaceProfileActions();
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
    const select = document.getElementById("workspace-profile-select");
    const applyBtn = document.getElementById("btn-workspace-profile-apply");
    const saveBtn = document.getElementById("btn-workspace-profile-save");
    const saveAsBtn = document.getElementById("btn-workspace-profile-save-as");
    const deleteBtn = document.getElementById("btn-workspace-profile-delete");
    if (select) {
      select.addEventListener("change", syncWorkspaceProfileActions);
    }
    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        applySelectedWorkspaceProfile();
      });
    }
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
    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        deleteWorkspaceProfile(getSelectedWorkspaceProfileId());
      });
    }
    syncWorkspaceProfileActions();
    refreshWorkspaceProfiles();
  }

  initWorkspaceProfiles();

  let plannerRulePresets = [];
  let currentPlannerRulePresetId = "";
  const PLANNER_RULE_PRESET_NAME_META = {
    title: "Nombre del preset",
    label: "Cómo se llama este conjunto de reglas",
    placeholder: "Flux · nocturno",
  };

  function collectPlannerRulePresetSnapshot() {
    return { rules: serializeRuleItems(plannerRules) };
  }

  function applyPlannerRulePresetSnapshot(snapshot) {
    const rules = snapshot && typeof snapshot === "object" ? snapshot.rules : snapshot;
    plannerRules = normalizePlannerRulesFromPrefs(rules);
    hydratePlannerRulesFromLibrary();
    renderPlannerRules();
    persistImagesPanel();
  }

  function getSelectedPlannerRulePresetId() {
    const select = document.getElementById("planner-rule-preset-select");
    return select && select.value ? select.value : "";
  }

  function syncPlannerRulePresetActions() {
    const has = !!getSelectedPlannerRulePresetId();
    ["btn-planner-rule-preset-apply", "btn-planner-rule-preset-save", "btn-planner-rule-preset-delete"].forEach(
      function (id) {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !has;
      }
    );
  }

  function renderPlannerRulePresetSelect() {
    const select = document.getElementById("planner-rule-preset-select");
    if (!select) return;
    const previous = currentPlannerRulePresetId || select.value;
    if (currentPlannerRulePresetId && !plannerRulePresets.some((p) => p.id === currentPlannerRulePresetId)) {
      currentPlannerRulePresetId = "";
    }
    const placeholder = plannerRulePresets.length ? "Elegir preset" : "No hay presets";
    select.innerHTML =
      `<option value="">${placeholder}</option>` +
      plannerRulePresets
        .map(function (p) {
          return `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`;
        })
        .join("");
    const keep = previous && plannerRulePresets.some((p) => p.id === previous) ? previous : currentPlannerRulePresetId;
    if (keep) select.value = keep;
    syncPlannerRulePresetActions();
  }

  async function refreshPlannerRulePresets() {
    try {
      const list = await fetchJson(`${API}/planner-rule-presets`);
      plannerRulePresets = Array.isArray(list) ? list : [];
      renderPlannerRulePresetSelect();
    } catch (e) {
      showError("No se pudieron cargar los presets de reglas: " + (e.message || e));
      renderPlannerRulePresetSelect();
    }
  }

  async function savePlannerRulePreset(asNew) {
    const snapshot = collectPlannerRulePresetSnapshot();
    let name = "";
    let presetId = asNew ? "" : getSelectedPlannerRulePresetId();
    if (presetId) {
      const current = plannerRulePresets.find((p) => p.id === presetId);
      name = current ? current.name : "";
    }
    if (!name) {
      name = await promptWorkspaceProfileName("", PLANNER_RULE_PRESET_NAME_META);
      if (!name) return;
      presetId = "";
    }
    try {
      const saved = presetId
        ? await fetchJson(`${API}/planner-rule-presets/${encodeURIComponent(presetId)}`, {
            method: "PUT",
            body: JSON.stringify({ snapshot }),
          })
        : await fetchJson(`${API}/planner-rule-presets`, {
            method: "POST",
            body: JSON.stringify({ name, snapshot }),
          });
      currentPlannerRulePresetId = saved.id;
      await refreshPlannerRulePresets();
      const select = document.getElementById("planner-rule-preset-select");
      if (select && saved && saved.id) select.value = saved.id;
      if (saved && saved.id && !plannerRulePresets.some((p) => p.id === saved.id)) {
        plannerRulePresets = plannerRulePresets.concat([saved]);
        renderPlannerRulePresetSelect();
        if (select) select.value = saved.id;
      }
      syncPlannerRulePresetActions();
      showNotice(presetId ? "Preset de reglas actualizado." : "Preset de reglas guardado.");
    } catch (e) {
      showError("No se pudo guardar el preset: " + (e.message || e));
    }
  }

  async function applySelectedPlannerRulePreset() {
    const presetId = getSelectedPlannerRulePresetId();
    if (!presetId) return;
    let preset = plannerRulePresets.find((p) => p.id === presetId);
    if (!preset) {
      try {
        preset = await fetchJson(`${API}/planner-rule-presets/${encodeURIComponent(presetId)}`);
      } catch (e) {
        showError("No se pudo cargar el preset: " + (e.message || e));
        return;
      }
    }
    try {
      applyPlannerRulePresetSnapshot(preset.snapshot || {});
      currentPlannerRulePresetId = preset.id;
      const select = document.getElementById("planner-rule-preset-select");
      if (select) select.value = preset.id;
      syncPlannerRulePresetActions();
      showNotice("Preset «" + preset.name + "» cargado.");
    } catch (e) {
      showError("No se pudo aplicar el preset: " + (e.message || e));
    }
  }

  async function deletePlannerRulePreset(presetId) {
    if (!presetId) return;
    const current = plannerRulePresets.find((p) => p.id === presetId);
    const label = current ? current.name : "este preset";
    if (!window.confirm("¿Eliminar el preset «" + label + "»?")) return;
    try {
      await fetchJson(`${API}/planner-rule-presets/${encodeURIComponent(presetId)}`, {
        method: "DELETE",
      });
      if (currentPlannerRulePresetId === presetId) currentPlannerRulePresetId = "";
      await refreshPlannerRulePresets();
      showNotice("Preset de reglas eliminado.");
    } catch (e) {
      showError("No se pudo eliminar el preset: " + (e.message || e));
    }
  }

  function initPlannerRulePresets() {
    const select = document.getElementById("planner-rule-preset-select");
    const applyBtn = document.getElementById("btn-planner-rule-preset-apply");
    const saveBtn = document.getElementById("btn-planner-rule-preset-save");
    const saveAsBtn = document.getElementById("btn-planner-rule-preset-save-as");
    const deleteBtn = document.getElementById("btn-planner-rule-preset-delete");
    if (select) {
      select.addEventListener("change", syncPlannerRulePresetActions);
    }
    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        applySelectedPlannerRulePreset();
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        savePlannerRulePreset(false);
      });
    }
    if (saveAsBtn) {
      saveAsBtn.addEventListener("click", function () {
        savePlannerRulePreset(true);
      });
    }
    if (deleteBtn) {
      deleteBtn.addEventListener("click", function () {
        deletePlannerRulePreset(getSelectedPlannerRulePresetId());
      });
    }
    syncPlannerRulePresetActions();
    refreshPlannerRulePresets();
  }

  initPlannerRulePresets();


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
        visual_consistency: isVisualConsistencyEnabled(),
        prompt_model_params: useChat ? {} : collectPlannerModelParams(),
        include_prompt_debug: true,
        debug: true,
        reactor: readReactorPanelSettings(),
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
        reactor: readReactorPanelSettings(),
        debug: true,
        ...readForgePanelParams(),
      },
      debugLabel: `Iniciando generate-remaining message=${messageId}`,
      doneNotice: "Imágenes restantes terminadas.",
      errorPrefix: "Imágenes restantes: ",
    });
  }

  async function illustrateAtParagraph(messageId, paragraphIndex, excerpt) {
    if (!currentConversationId || !messageId) return;
    if (illustratingMessageIds.has(messageId)) return;
    const idx = paragraphIndex == null ? 0 : parseInt(paragraphIndex, 10);
    if (Number.isNaN(idx) || idx < 0) {
      showNotice("No se pudo localizar el párrafo.");
      return;
    }
    const providerSel = document.getElementById("images-prompt-provider");
    const modelSel = document.getElementById("images-prompt-model");
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
      url: `${API}/conversations/${currentConversationId}/messages/${messageId}/illustrations/illustrate-at`,
      body: {
        images_per_response: 1,
        prompt_provider: (providerSel && providerSel.value) || "ollama",
        prompt_model: promptModel || "",
        retries: retries ? parseInt(retries.value, 10) || 0 : 0,
        prompt: promptEl ? String(promptEl.value || "").trim() : "",
        prompt_system_instructions: getPlannerRulesTextForSystem(),
        use_chat_config: useChat,
        visual_consistency: isVisualConsistencyEnabled(),
        prompt_model_params: useChat ? {} : collectPlannerModelParams(),
        include_prompt_debug: true,
        debug: true,
        reactor: readReactorPanelSettings(),
        paragraph_index: idx,
        selected_excerpt: excerpt ? String(excerpt).trim() : "",
        ...readForgePanelParams(),
      },
      debugLabel: `Iniciando illustrate-at message=${messageId} párrafo=${idx}`,
      doneNotice: "Imagen del párrafo terminada.",
      errorPrefix: "Ilustración: ",
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
    let queuedAny = false;
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
          if (data.type === "queued") {
            queuedAny = true;
            const jobId = data.data && data.data.job_id;
            if (jobId && imageQueueDebugSeen[jobId]) {
              // ya registrado por la cola
            } else {
              if (jobId) imageQueueDebugSeen[jobId] = "pending";
              pushImagesDebugEntry({
                kind: "queue",
                title: "Encolada · " + (data.scene_id || jobId || "job"),
                status: "pending",
                details: data.data || data,
              });
            }
          }
          if (data.type === "llm_debug") {
            const label =
              (data.data && data.data.label) ||
              (data.scene_id ? "Planificador escena " + data.scene_id : "Planificador de prompts");
            pushImagesDebugEntry({
              kind: "llm",
              title: label,
              status: "done",
              request: (data.data && data.data.debug_request) || null,
              response: (data.data && data.data.debug_response) || data.message || null,
            });
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
      if (queuedAny) {
        startImageQueuePoll();
        if (isQueuePanelVisible()) loadImageQueuePage();
        if (!opts.doneNotice) showNotice("Imágenes encoladas para generación.");
      }
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

  (function initSidePanelResize() {
    var LEFT_KEY = "sidebarLeftWidthPx";
    var RIGHT_KEY = "sidebarRightWidthPx";
    var LEFT_DEFAULT = 188;
    var RIGHT_DEFAULT = 284;
    var LEFT_MIN = 180;
    var LEFT_MAX = 420;
    var RIGHT_MIN = 260;
    var RIGHT_MAX = 480;
    var CENTER_MIN = 360;
    var STEP = 16;
    var leftAside = document.getElementById("column-left");
    var rightAside = document.getElementById("column-right");
    var leftHandle = document.getElementById("sidebar-left-splitter");
    var rightHandle = document.getElementById("sidebar-right-splitter");
    if (!leftAside || !rightAside || !leftHandle || !rightHandle) return;
    var leftWidth = LEFT_DEFAULT;
    var rightWidth = RIGHT_DEFAULT;

    function isLeftCollapsed() {
      return document.documentElement.getAttribute("data-sidebar-left") === "collapsed";
    }

    function isChatFullscreen() {
      return document.documentElement.getAttribute("data-chat-fullscreen") === "on";
    }

    function readStored(key, fallback, min, max) {
      try {
        var raw = parseInt(localStorage.getItem(key), 10);
        if (Number.isFinite(raw)) return Math.max(min, Math.min(max, raw));
      } catch (_) {}
      return fallback;
    }

    function save(key, px) {
      try {
        localStorage.setItem(key, String(px));
      } catch (_) {}
    }

    function shellWidth() {
      var shell = document.getElementById("app");
      return shell ? shell.getBoundingClientRect().width : window.innerWidth;
    }

    function visibleLeftWidth() {
      if (isLeftCollapsed() || isChatFullscreen()) return 0;
      return leftWidth;
    }

    function visibleRightWidth() {
      if (isChatFullscreen() || rightAside.offsetParent === null) return 0;
      return rightWidth;
    }

    function clampLeft(px) {
      var n = Math.round(Number(px));
      if (!Number.isFinite(n)) n = LEFT_DEFAULT;
      n = Math.max(LEFT_MIN, Math.min(LEFT_MAX, n));
      var maxAvail = shellWidth() - CENTER_MIN - visibleRightWidth();
      if (maxAvail >= LEFT_MIN) n = Math.min(n, maxAvail);
      return n;
    }

    function clampRight(px) {
      var n = Math.round(Number(px));
      if (!Number.isFinite(n)) n = RIGHT_DEFAULT;
      n = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, n));
      var maxAvail = shellWidth() - CENTER_MIN - visibleLeftWidth();
      if (maxAvail >= RIGHT_MIN) n = Math.min(n, maxAvail);
      return n;
    }

    function applyLeft(px, persist) {
      leftWidth = clampLeft(px);
      document.documentElement.style.setProperty("--sidebar-left-width", leftWidth + "px");
      leftHandle.setAttribute("aria-valuenow", String(leftWidth));
      if (persist) save(LEFT_KEY, leftWidth);
      return leftWidth;
    }

    function applyRight(px, persist) {
      rightWidth = clampRight(px);
      document.documentElement.style.setProperty("--sidebar-right-width", rightWidth + "px");
      rightHandle.setAttribute("aria-valuenow", String(rightWidth));
      if (persist) save(RIGHT_KEY, rightWidth);
      return rightWidth;
    }

    function applyStored() {
      applyLeft(readStored(LEFT_KEY, LEFT_DEFAULT, LEFT_MIN, LEFT_MAX), false);
      applyRight(readStored(RIGHT_KEY, RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX), false);
      applyLeft(readStored(LEFT_KEY, LEFT_DEFAULT, LEFT_MIN, LEFT_MAX), false);
    }

    applyStored();

    function bindHandle(handle, opts) {
      var drag = null;

      function endDrag() {
        if (!drag) return;
        opts.apply(opts.currentWidth(), true);
        drag = null;
        document.body.classList.remove("side-panels-resizing");
      }

      handle.addEventListener("pointerdown", function (e) {
        if (e.button != null && e.button !== 0) return;
        if (opts.disabled()) return;
        e.preventDefault();
        try {
          handle.setPointerCapture(e.pointerId);
        } catch (_) {}
        drag = { startX: e.clientX, startWidth: opts.currentWidth() };
        document.body.classList.add("side-panels-resizing");
      });
      handle.addEventListener("pointermove", function (e) {
        if (!drag) return;
        opts.apply(drag.startWidth + (e.clientX - drag.startX) * opts.sign, false);
      });
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);
      handle.addEventListener("dblclick", function (e) {
        e.preventDefault();
        opts.apply(opts.defaultWidth, true);
      });
      handle.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        if (opts.disabled()) return;
        e.preventDefault();
        var dir = e.key === "ArrowRight" ? 1 : -1;
        opts.apply(opts.currentWidth() + dir * opts.sign * STEP, true);
      });
    }

    bindHandle(leftHandle, {
      sign: 1,
      defaultWidth: LEFT_DEFAULT,
      currentWidth: function () {
        return leftWidth;
      },
      apply: applyLeft,
      disabled: function () {
        return isLeftCollapsed() || isChatFullscreen();
      },
    });
    bindHandle(rightHandle, {
      sign: -1,
      defaultWidth: RIGHT_DEFAULT,
      currentWidth: function () {
        return rightWidth;
      },
      apply: applyRight,
      disabled: function () {
        return isChatFullscreen();
      },
    });

    window.addEventListener("resize", function () {
      if (isChatFullscreen()) return;
      applyStored();
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
    await loadModelContract({ applyParamDefaults: true });
    leftHistoryMode = readStoredLeftHistoryMode();
    applyConsultaChrome();
    await refreshLeftHistory();
    if (!isMessagesHistoryMode()) {
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
