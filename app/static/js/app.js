(function () {
  const API = "/api";
  let currentConversationId = null;
  let messages = [];
  let models = [];
  let currentAbortController = null;

  const el = {
    conversationsList: document.getElementById("conversations-list"),
    conversationTitle: document.getElementById("conversation-title"),
    modelSelect: document.getElementById("model-select"),
    systemInstructionGlobal: document.getElementById("system-instruction-global"),
    injectInstructionEveryCheck: document.getElementById("inject-instruction-every-check"),
    injectInstructionEveryN: document.getElementById("inject-instruction-every-n"),
    messagesContainer: document.getElementById("messages-container"),
    instructionOverride: document.getElementById("instruction-override"),
    messageInput: document.getElementById("message-input"),
    btnNewChat: document.getElementById("btn-new-chat"),
    btnSave: document.getElementById("btn-save"),
    btnSend: document.getElementById("btn-send"),
    btnCancelMessage: document.getElementById("btn-cancel-message"),
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

  async function loadModels() {
    try {
      const data = await fetchJson(`${API}/models`);
      models = data.map((m) => m.name);
      el.modelSelect.innerHTML = models.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
      return models;
    } catch (e) {
      showError("No se pudieron cargar los modelos: " + e.message);
      return [];
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

  function renderConversationsList(list) {
    el.conversationsList.innerHTML = list
      .map(
        (c) =>
          `<div class="conversation-item ${c.id === currentConversationId ? "active" : ""}" data-id="${escapeHtml(c.id)}">
            <div class="conv-title">${escapeHtml(c.title)}</div>
            <div class="conv-meta">${escapeHtml(c.model_id)} · ${formatDate(c.updated_at)}</div>
          </div>`
      )
      .join("");
    el.conversationsList.querySelectorAll(".conversation-item").forEach((node) => {
      node.addEventListener("click", () => openConversation(node.dataset.id));
    });
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
      el.conversationTitle.value = conv.title;
      el.modelSelect.value = conv.model_id;
      el.systemInstructionGlobal.value = conv.system_instruction_global || "";
      messages = conv.messages || [];
    } else {
      el.conversationTitle.value = "Nueva conversación";
      el.modelSelect.value = models[0] || "llama3.2";
      el.systemInstructionGlobal.value = "";
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
      const model = el.modelSelect.value || (models[0] || "llama3.2");
      const conv = await fetchJson(`${API}/conversations`, {
        method: "POST",
        body: JSON.stringify({
          title: "Nueva conversación",
          model_id: model,
          system_instruction_global: el.systemInstructionGlobal.value.trim() || null,
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
          title: el.conversationTitle.value.trim() || "Nueva conversación",
          model_id: el.modelSelect.value,
          system_instruction_global: el.systemInstructionGlobal.value.trim() || null,
        }),
      });
      setCurrentConversation(conv);
    } catch (e) {
      showError("Error al guardar: " + e.message);
    }
  }

  function renderMessages() {
    if (messages.length === 0) {
      el.messagesContainer.innerHTML = '<div class="empty-state">Escribe un mensaje para empezar.</div>';
      return;
    }
    el.messagesContainer.innerHTML = messages
      .map(
        (m) =>
          `<div class="message ${m.role}">
            <div class="role-label">${m.role === "user" ? "Tú" : "Asistente"}</div>
            <div class="content">${escapeHtml(m.content).replace(/\n/g, "<br>")}</div>
          </div>`
      )
      .join("");
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
  }

  async function sendMessage() {
    const content = el.messageInput.value.trim();
    if (!content) return;
    const instructionOverride = el.instructionOverride.value.trim() || null;

    if (!currentConversationId) {
      await newConversation();
      if (!currentConversationId) return;
    }

    messages.push({ role: "user", content });
    el.messageInput.value = "";
    el.instructionOverride.value = "";
    renderMessages();

    const msgEl = document.createElement("div");
    msgEl.className = "message assistant";
    msgEl.innerHTML = '<div class="role-label">Asistente</div><div class="content"></div>';
    el.messagesContainer.appendChild(msgEl);
    const contentEl = msgEl.querySelector(".content");
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;

    currentAbortController = new AbortController();
    setCancelButtonState();
    try {
      const systemInstructionGlobal = (el.systemInstructionGlobal && el.systemInstructionGlobal.value) ? el.systemInstructionGlobal.value.trim() : "";
      const injectEvery = (el.injectInstructionEveryCheck && el.injectInstructionEveryCheck.checked) ? (parseInt(el.injectInstructionEveryN.value, 10) || 1) : 0;
      const res = await fetch(`${API}/conversations/${currentConversationId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          instruction_override: instructionOverride,
          system_instruction_global: systemInstructionGlobal,
          inject_instruction_every: injectEvery || null,
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
            if (data.error) throw new Error(data.error);
            if (data.injecting_instruction) {
              showNotice("Se están enviando las instrucciones globales.");
            }
            if (data.content !== undefined) {
              fullContent += data.content;
              contentEl.innerHTML = escapeHtml(fullContent).replace(/\n/g, "<br>");
              el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
            }
            if (data.done) {
              messages.push({ role: "assistant", content: fullContent });
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

  function onModelChange() {
    if (currentConversationId) {
      fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({ model_id: el.modelSelect.value }),
      }).catch(() => {});
    }
  }

  if (el.injectInstructionEveryN) {
    el.injectInstructionEveryN.disabled = !(el.injectInstructionEveryCheck && el.injectInstructionEveryCheck.checked);
  }
  el.injectInstructionEveryCheck.addEventListener("change", function () {
    if (el.injectInstructionEveryN) el.injectInstructionEveryN.disabled = !el.injectInstructionEveryCheck.checked;
  });
  if (el.btnCancelMessage) el.btnCancelMessage.disabled = true;

  function setCancelButtonState() {
    if (el.btnCancelMessage) el.btnCancelMessage.disabled = !currentAbortController;
  }

  el.btnNewChat.addEventListener("click", newConversation);
  el.btnSave.addEventListener("click", saveConversation);
  el.btnSend.addEventListener("click", sendMessage);
  if (el.btnCancelMessage) el.btnCancelMessage.addEventListener("click", cancelLastMessage);
  el.modelSelect.addEventListener("change", onModelChange);

  el.messageInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  loadModels().then(() => loadConversations());
})();
