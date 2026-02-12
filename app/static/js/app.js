(function () {
  function init() {
  const API = "/api";
  let currentConversationId = null;
  let messages = [];
  let models = [];
  let currentAbortController = null;

  const el = {
    conversationsList: document.getElementById("conversations-list"),
    conversationTitle: document.getElementById("conversation-title"),
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
  };

  const saveToChromaIconSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z\"/><polyline points=\"17 21 17 13 7 13 7 21\"/><polyline points=\"7 3 7 8 15 8\"/></svg>";

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

  async function loadModels(preserveSelection = false) {
    const previousModel = preserveSelection && el.modelSelect ? el.modelSelect.value : null;
    try {
      const data = await fetchJson(`${API}/models`);
      models = data.map((m) => m.name);
      if (el.modelSelect) {
        el.modelSelect.innerHTML = models.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
        if (previousModel && models.includes(previousModel)) {
          el.modelSelect.value = previousModel;
        }
      }
      return models;
    } catch (e) {
      showError("No se pudieron cargar los modelos: " + e.message);
      return [];
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
            <div class="conv-meta">${escapeHtml(c.model_id)} · ${formatDate(c.updated_at)}</div>
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

  function setCurrentConversation(conv) {
    currentConversationId = conv ? conv.id : null;
    if (conv) {
      if (el.conversationTitle) el.conversationTitle.value = conv.title;
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
      if (el.modelSelect) el.modelSelect.value = models[0] || "llama3.2";
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
      const model = (el.modelSelect && el.modelSelect.value) || (models[0] || "llama3.2");
      const conv = await fetchJson(`${API}/conversations`, {
        method: "POST",
        body: JSON.stringify({
          title: "Nueva conversación",
          model_id: model,
          system_instruction_global: (el.systemInstructionGlobal && el.systemInstructionGlobal.value.trim()) || null,
        }),
      });
      setCurrentConversation(conv);
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
          model_id: (el.modelSelect && el.modelSelect.value) || "llama3.2",
          system_instruction_global: (el.systemInstructionGlobal && el.systemInstructionGlobal.value.trim()) || null,
        }),
      });
      setCurrentConversation(conv);
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
          const saveBtn = m.id
            ? `<div class="message-footer"><button type="button" class="msg-save-chromadb-btn" data-save-chromadb="${escapeHtml(m.id)}" title="Guardar en ChromaDB">${saveToChromaIconSvg}</button></div>`
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
            ${saveBtn}
          </div>`;
        }
      )
      .join("");
    el.messagesContainer.querySelectorAll(".msg-save-chromadb-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const msgId = btn.dataset.saveChromadb;
        if (msgId && currentConversationId) saveMessageToChromadb(currentConversationId, msgId);
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
  if (el.btnRefreshModels) el.btnRefreshModels.addEventListener("click", refreshModels);
  if (el.modelSelect) el.modelSelect.addEventListener("change", onModelChange);
  if (el.messageInput) {
    el.messageInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  loadModels().then(() => loadConversations());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
