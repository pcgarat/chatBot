(function () {
  function init() {
  const API = "/api";
  let currentConversationId = null;
  let messages = [];
  let providers = [];
  let models = [];
  let currentProvider = "ollama";
  let currentAbortController = null;

  const el = {
    conversationsList: document.getElementById("conversations-list"),
    conversationTitle: document.getElementById("conversation-title"),
    providerSelect: document.getElementById("provider-select"),
    modelSelect: document.getElementById("model-select"),
    btnRefreshModels: document.getElementById("btn-refresh-models"),
    systemInstructionGlobal: document.getElementById("system-instruction-global"),
    saveToChromadbSelect: document.getElementById("save-to-chromadb-select"),
    showDebugModeCheck: document.getElementById("show-debug-mode"),
    messagesContainer: document.getElementById("messages-container"),
    instructionOverride: document.getElementById("instruction-override"),
    messageInput: document.getElementById("message-input"),
    btnNewChat: document.getElementById("btn-new-chat"),
    btnSave: document.getElementById("btn-save"),
    btnSend: document.getElementById("btn-send"),
    btnCancelMessage: document.getElementById("btn-cancel-message"),
    btnClearMemory: document.getElementById("btn-clear-memory"),
    btnLoadPreset: document.getElementById("btn-load-preset"),
    btnResetParams: document.getElementById("btn-reset-params"),
    presetModal: document.getElementById("preset-modal"),
    presetList: document.getElementById("preset-list"),
    presetModalClose: document.getElementById("preset-modal-close"),
    paramAleatoriedadMode: document.getElementById("param-aleatoriedad-mode"),
  };

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

  async function loadModels(preserveSelection = false) {
    const previousModel = preserveSelection && el.modelSelect ? el.modelSelect.value : null;
    const provider = (el.providerSelect && el.providerSelect.value) ? el.providerSelect.value : currentProvider || "ollama";
    try {
      const data = await fetchJson(`${API}/providers/${provider}/models`);
      models = data.map((m) => m.name);
      if (el.modelSelect) {
        el.modelSelect.innerHTML = models.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
        if (previousModel && models.includes(previousModel)) {
          el.modelSelect.value = previousModel;
        }
      }
      return models;
    } catch (e) {
      showError(`No se pudieron cargar los modelos de ${provider}: ` + e.message);
      models = [];
      if (el.modelSelect) el.modelSelect.innerHTML = "";
      return [];
    }
  }

  /** Intenta cargar modelos de un proveedor. Devuelve true si OK, false si falla (sin mostrar error). */
  async function tryLoadModelsForProvider(providerName) {
    try {
      const data = await fetchJson(`${API}/providers/${providerName}/models`);
      models = data.map((m) => m.name);
      currentProvider = providerName;
      if (el.providerSelect) el.providerSelect.value = providerName;
      if (el.modelSelect) {
        el.modelSelect.innerHTML = models.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
      }
      return true;
    } catch (_) {
      return false;
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
  }

  /** Pone un único control de parámetro en su valor por defecto (paramsConfig). Usado al cambiar temperature/top_p para no enviar ambos. */
  function setParamControlToDefault(paramId) {
    const spec = paramsConfig.params[paramId];
    if (!spec) return;
    const control = document.querySelector(`[data-control-id="${paramId}"]`);
    if (!control) return;
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
  }

  /** Restaura todos los controles de parámetros a los valores por defecto del proveedor (no se envía model_params). */
  function resetParamsToDefaults() {
    applyParamsConfig();
    showNotice("Parámetros restaurados a los valores por defecto.");
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

  let currentPresets = {};

  async function openPresetModal() {
    const provider = (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama";
    try {
      const data = await fetchJson(`${API}/providers/${provider}/presets`);
      currentPresets = data.presets || {};
      const names = Object.keys(currentPresets);
      if (names.length === 0) {
        showNotice("No hay presets para este proveedor.");
        return;
      }
      if (el.presetList) {
        el.presetList.innerHTML = names
          .map((name) => `<button type="button" class="preset-list-item" data-preset-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
          .join("");
        el.presetList.querySelectorAll(".preset-list-item").forEach((btn) => {
          btn.addEventListener("click", () => {
            const presetName = btn.getAttribute("data-preset-name");
            const presetData = currentPresets[presetName];
            if (presetData) {
              applyPresetToControls(presetData);
              if (el.modelSelect && models.includes(presetName)) {
                el.modelSelect.value = presetName;
              }
              showNotice("Preset \"" + presetName + "\" aplicado.");
            }
            closePresetModal();
          });
        });
      }
      if (el.presetModal) {
        el.presetModal.hidden = false;
      }
    } catch (e) {
      showError("No se pudieron cargar los presets: " + e.message);
    }
  }

  function closePresetModal() {
    if (el.presetModal) el.presetModal.hidden = true;
  }

  function buildModelParams() {
    const out = {};
    const aleatoriedadMode = (el.paramAleatoriedadMode && el.paramAleatoriedadMode.value) || "temperature";
    for (const paramId of Object.keys(paramsConfig.params)) {
      if (paramId === "temperature" && aleatoriedadMode === "top_p") continue;
      if (paramId === "top_p" && aleatoriedadMode === "temperature") continue;
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
      const def = spec.default;
      let same = false;
      if (spec.type === "string_list") {
        same = Array.isArray(def) && Array.isArray(current) && def.length === current.length && def.every((d, i) => d === current[i]);
      } else if (current === null || current === undefined || current === "") {
        same = def === undefined || def === null || def === "";
      } else {
        same = (typeof def === "number" && Number(current) === def) || (current === def) || (String(current) === String(def));
      }
      if (!same) {
        if (spec.type === "string_list" && Array.isArray(current) && current.length === 0) continue;
        out[paramId] = current;
      }
    }
    return out;
  }

  async function onProviderChange() {
    currentProvider = el.providerSelect ? el.providerSelect.value : "ollama";
    await loadModels(false);
    // Actualizar conversación si hay una abierta
    if (currentConversationId) {
      fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({
          provider: currentProvider,
          model_id: (el.modelSelect && el.modelSelect.value) || (models[0] || ""),
        }),
      }).catch(() => {});
    }
  }

  async function loadConversations() {
    try {
      const list = await fetchJson(`${API}/conversations`);
      renderConversationsList(list);
    } catch (e) {
      showError("Error al cargar conversaciones: " + e.message);
    }
  }

  const deleteIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 6h18\"/><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"/><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/></svg>";
  const clearHistoryIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6h18\"/><path d=\"M8 6V4h8v2\"/><path d=\"M5 6l1 14h12l1-14\"/><path d=\"M10 10v7\"/><path d=\"M14 10v7\"/></svg>";
  const arrowDownToInputSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 5v14\"/><path d=\"M19 12l-7 7-7-7\"/></svg>";
  const msgDeleteIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6h18\"/><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"/><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/></svg>";
  const msgCopyIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\" ry=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/></svg>";

  function renderConversationsList(list) {
    if (!el.conversationsList) return;
    el.conversationsList.innerHTML = list
      .map(
        (c) =>
          `<div class="conversation-item ${c.id === currentConversationId ? "active" : ""}" data-id="${escapeHtml(c.id)}">
            <div class="conv-row">
              <span class="conv-title">${escapeHtml(c.title)}</span>
              <button type="button" class="conv-clear-btn" data-id="${escapeHtml(c.id)}" title="Limpiar historial de mensajes" aria-label="Limpiar historial">${clearHistoryIconSvg}</button>
              <button type="button" class="conv-delete-btn" data-id="${escapeHtml(c.id)}" title="Eliminar conversación" aria-label="Eliminar conversación">${deleteIconSvg}</button>
            </div>
            <div class="conv-meta">${escapeHtml(c.provider || "ollama")}/${escapeHtml(c.model_id)} · ${formatDate(c.updated_at)}</div>
          </div>`
      )
      .join("");
    el.conversationsList.querySelectorAll(".conversation-item").forEach((node) => {
      node.addEventListener("click", (e) => {
        if (e.target.closest(".conv-delete-btn") || e.target.closest(".conv-clear-btn")) return;
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
    el.conversationsList.querySelectorAll(".conv-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteConversation(btn.dataset.id);
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

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  async function setCurrentConversation(conv) {
    currentConversationId = conv ? conv.id : null;
    if (conv) {
      if (el.conversationTitle) el.conversationTitle.value = conv.title;
      // Establecer el proveedor primero
      currentProvider = conv.provider || "ollama";
      if (el.providerSelect) el.providerSelect.value = currentProvider;
      // Cargar modelos del proveedor y luego establecer el modelo
      await loadModels(false);
      if (el.modelSelect) el.modelSelect.value = conv.model_id;
      if (el.systemInstructionGlobal) el.systemInstructionGlobal.value = conv.system_instruction_global || "";
      messages = (conv.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        id: m.id || null,
        debug_request: m.debug_request || null,
        debug_response: m.debug_response || null,
      }));
    } else {
      if (el.conversationTitle) el.conversationTitle.value = "Nueva conversación";
      currentProvider = providers[0] || "ollama";
      if (el.providerSelect) el.providerSelect.value = currentProvider;
      if (el.modelSelect) el.modelSelect.value = models[0] || "";
      if (el.systemInstructionGlobal) el.systemInstructionGlobal.value = "";
      messages = [];
    }
    renderMessages();
    loadConversations();
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
          title: "Nueva conversación",
          model_id: model,
          provider: provider,
          system_instruction_global: (el.systemInstructionGlobal && el.systemInstructionGlobal.value.trim()) || null,
        }),
      });
      await setCurrentConversation(conv);
      await loadConversations();
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
          title: (el.conversationTitle && el.conversationTitle.value.trim()) || "Nueva conversación",
          model_id: (el.modelSelect && el.modelSelect.value) || "",
          provider: (el.providerSelect && el.providerSelect.value) || currentProvider || "ollama",
          system_instruction_global: (el.systemInstructionGlobal && el.systemInstructionGlobal.value.trim()) || null,
        }),
      });
      await setCurrentConversation(conv);
      await loadConversations();
    } catch (e) {
      showError("Error al guardar: " + e.message);
    }
  }

  async function saveMessageToChromadb(conversationId, messageId) {
    const btn = document.querySelector(`[data-save-chromadb="${messageId}"]`);
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(`${API}/conversations/${conversationId}/messages/${messageId}/save-to-chromadb`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      showNotice("Mensaje guardado en ChromaDB.");
    } catch (e) {
      showError("Error al guardar en ChromaDB: " + e.message);
      if (btn) btn.disabled = false;
    }
  }

  function isShowDebugMode() {
    return el.showDebugModeCheck && el.showDebugModeCheck.checked;
  }

  function renderMessages() {
    if (!el.messagesContainer) return;
    if (messages.length === 0) {
      el.messagesContainer.innerHTML = '<div class="empty-state">Escribe un mensaje para empezar.</div>';
      return;
    }
    const showDebug = isShowDebugMode();
    el.messagesContainer.innerHTML = messages
      .map(
        (m) => {
          const footerBtns = m.id
            ? `<div class="message-footer">
                <button type="button" class="msg-action-btn msg-to-input-btn" data-msg-id="${escapeHtml(m.id)}" title="Enviar al cuadro de mensaje">${arrowDownToInputSvg}</button>
                <button type="button" class="msg-action-btn msg-delete-btn" data-msg-id="${escapeHtml(m.id)}" title="Eliminar del historial">${msgDeleteIconSvg}</button>
                <button type="button" class="msg-action-btn msg-copy-btn" data-msg-id="${escapeHtml(m.id)}" title="Copiar">${msgCopyIconSvg}</button>
              </div>`
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
          return `<div class="message ${m.role}" data-msg-id="${m.id ? escapeHtml(m.id) : ""}">
            <div class="role-label">${m.role === "user" ? "Tú" : "Asistente"}</div>
            <div class="content">${escapeHtml(m.content).replace(/\n/g, "<br>")}</div>
            ${debugHtml}
            ${footerBtns}
          </div>`;
        }
      )
      .join("");
    el.messagesContainer.querySelectorAll(".msg-to-input-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const msgId = btn.dataset.msgId;
        const msg = msgId ? messages.find((m) => m.id === msgId) : null;
        if (msg && msg.content && el.messageInput) {
          el.messageInput.value = msg.content;
          el.messageInput.focus();
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
    if (el.messagesContainer) el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
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
    if (el.instructionOverride) el.instructionOverride.value = "";
    renderMessages();

    const msgEl = document.createElement("div");
    msgEl.className = "message assistant";
    const showDebug = isShowDebugMode();
    msgEl.innerHTML = showDebug
      ? '<div class="role-label">Asistente</div><div class="content"></div><div class="message-debug-stream" style="display:block"></div>'
      : '<div class="role-label">Asistente</div><div class="content"></div>';
    if (el.messagesContainer) el.messagesContainer.appendChild(msgEl);
    const contentEl = msgEl.querySelector(".content");
    const debugStreamEl = msgEl.querySelector(".message-debug-stream");
    if (el.messagesContainer) el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;

    currentAbortController = new AbortController();
    setCancelButtonState();
    try {
      const systemInstructionGlobal = (el.systemInstructionGlobal && el.systemInstructionGlobal.value) ? el.systemInstructionGlobal.value.trim() : "";
      const saveToChromadb = (el.saveToChromadbSelect && el.saveToChromadbSelect.value) ? el.saveToChromadbSelect.value : "user";
      const res = await fetch(`${API}/conversations/${currentConversationId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          instruction_override: instructionOverride,
          system_instruction_global: systemInstructionGlobal,
          save_to_chromadb: saveToChromadb,
        }),
        signal: currentAbortController.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let debugRequest = null;
      const debugMetaLines = []; // Solo metadata (sin los chunks de content)
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
              if (showDebug && debugStreamEl) {
                debugStreamEl.innerHTML = `<div class="message-debug-block"><div class="debug-label-text">Request al LLM:</div>${debugRequest ? escapeHtml(debugRequest) : "(cargando...)"}</div><div class="message-debug-block"><div class="debug-label-text">Response metadata:</div>${escapeHtml(debugMetaLines.join("\n"))}</div>`;
              }
            }
            if (data.debug_request) {
              debugRequest = data.debug_request;
              if (showDebug && debugStreamEl) {
                debugStreamEl.innerHTML = `<div class="message-debug-block"><div class="debug-label-text">Request al LLM:</div>${escapeHtml(debugRequest)}</div><div class="message-debug-block"><div class="debug-label-text">Response metadata:</div>${escapeHtml(debugMetaLines.join("\n"))}</div>`;
              }
            }
            if (data.error) {
              fullContent += `[Error: ${data.error}]`;
              contentEl.innerHTML = escapeHtml(fullContent).replace(/\n/g, "<br>");
            }
            if (data.user_message_id && messages.length > 0) {
              messages[messages.length - 1].id = data.user_message_id;
            }
            if (data.content !== undefined) {
              fullContent += data.content;
              contentEl.innerHTML = escapeHtml(fullContent).replace(/\n/g, "<br>");
              if (el.messagesContainer) el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
            }
            if (data.done) {
              msgEl.remove();
              messages.push({
                role: "assistant",
                content: fullContent,
                id: data.id || null,
                debug_request: debugRequest || null,
                debug_response: debugMetaLines.length > 0 ? debugMetaLines.join("\n") : null,
              });
              renderMessages();
              loadConversations();
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      currentAbortController = null;
      setCancelButtonState();
    } catch (e) {
      if (e.name === "AbortError") {
        msgEl.remove();
        messages.pop();
        renderMessages();
        if (currentConversationId) {
          fetch(`${API}/conversations/${currentConversationId}/messages/last`, { method: "DELETE" }).catch(() => {});
        }
        showNotice("Mensaje anulado.");
      } else {
        msgEl.remove();
        messages.pop();
        renderMessages();
        showError("Error al enviar: " + e.message);
      }
      currentAbortController = null;
      setCancelButtonState();
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

  async function onModelChange() {
    try {
      await fetchJson(`${API}/ollama/clear-memory`, { method: "POST" });
    } catch (e) {
      showError("Error al limpiar memoria de Ollama: " + (e.message || "desconocido"));
      return;
    }
    if (currentConversationId) {
      fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({ model_id: (el.modelSelect && el.modelSelect.value) || "llama3.2" }),
      }).catch(() => {});
    }
  }

  if (el.btnCancelMessage) el.btnCancelMessage.disabled = true;

  function setCancelButtonState() {
    if (el.btnCancelMessage) el.btnCancelMessage.disabled = !currentAbortController;
  }

  if (el.btnNewChat) el.btnNewChat.addEventListener("click", newConversation);
  if (el.btnSave) el.btnSave.addEventListener("click", saveConversation);
  if (el.btnSend) el.btnSend.addEventListener("click", sendMessage);
  if (el.showDebugModeCheck) el.showDebugModeCheck.addEventListener("change", renderMessages);
  if (el.btnCancelMessage) el.btnCancelMessage.addEventListener("click", cancelLastMessage);
  if (el.btnClearMemory) el.btnClearMemory.addEventListener("click", clearMemory);
  if (el.btnLoadPreset) el.btnLoadPreset.addEventListener("click", openPresetModal);
  if (el.btnResetParams) el.btnResetParams.addEventListener("click", resetParamsToDefaults);
  if (el.presetModalClose) el.presetModalClose.addEventListener("click", closePresetModal);
  if (el.presetModal) {
    el.presetModal.addEventListener("click", (e) => {
      if (e.target === el.presetModal) closePresetModal();
    });
  }
  if (el.paramAleatoriedadMode) {
    el.paramAleatoriedadMode.addEventListener("change", () => {
      const mode = el.paramAleatoriedadMode.value;
      if (mode === "temperature") setParamControlToDefault("top_p");
      else if (mode === "top_p") setParamControlToDefault("temperature");
    });
  }
  if (el.btnRefreshModels) el.btnRefreshModels.addEventListener("click", refreshModels);
  if (el.providerSelect) el.providerSelect.addEventListener("change", onProviderChange);
  if (el.modelSelect) el.modelSelect.addEventListener("change", onModelChange);
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
    const sections = Array.from(document.querySelectorAll(".accordion-section[data-accordion-section]"));
    const state = getAccordionState();
    if (state) {
      sections.forEach((section) => {
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
    // Solo una categoría abierta: cerrar todas salvo la primera que esté abierta
    const openSections = sections.filter((s) => s.classList.contains("is-open"));
    if (openSections.length > 1) {
      openSections.slice(1).forEach((section) => {
        section.classList.remove("is-open");
        const btn = section.querySelector(".accordion-header");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
      saveAccordionState();
    }
  }

  initAccordionState();

  document.querySelectorAll(".accordion-header").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.closest(".accordion-section");
      if (!section) return;
      section.classList.toggle("is-open");
      const isOpen = section.classList.contains("is-open");
      btn.setAttribute("aria-expanded", isOpen);
      // Al abrir una categoría, contraer el resto (solo una abierta a la vez)
      if (isOpen) {
        document.querySelectorAll(".accordion-section[data-accordion-section]").forEach((other) => {
          if (other !== section) {
            other.classList.remove("is-open");
            const otherBtn = other.querySelector(".accordion-header");
            if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
          }
        });
      }
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
      if (el.modelSelect) el.modelSelect.innerHTML = "";
    }
    await loadParamsForProvider(currentProvider);
    await loadConversations();
  }
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
