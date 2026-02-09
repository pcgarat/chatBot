(function () {
  const API = "/api";
  let currentConversationId = null;
  let messages = [];
  let models = [];

  const el = {
    conversationsList: document.getElementById("conversations-list"),
    conversationTitle: document.getElementById("conversation-title"),
    modelSelect: document.getElementById("model-select"),
    systemInstructionGlobal: document.getElementById("system-instruction-global"),
    messagesContainer: document.getElementById("messages-container"),
    instructionOverride: document.getElementById("instruction-override"),
    messageInput: document.getElementById("message-input"),
    btnNewChat: document.getElementById("btn-new-chat"),
    btnSave: document.getElementById("btn-save"),
    btnSend: document.getElementById("btn-send"),
  };

  function showError(msg) {
    const toast = document.createElement("div");
    toast.className = "error-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
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

    const loadingEl = document.createElement("div");
    loadingEl.className = "message assistant loading";
    loadingEl.textContent = "Pensando...";
    el.messagesContainer.appendChild(loadingEl);
    el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;

    try {
      const response = await fetchJson(`${API}/conversations/${currentConversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, instruction_override: instructionOverride }),
      });
      loadingEl.remove();
      messages.push({ role: "assistant", content: response.content });
      renderMessages();
      loadConversations();
    } catch (e) {
      loadingEl.remove();
      messages.pop();
      renderMessages();
      showError("Error al enviar: " + e.message);
    }
  }

  function onModelChange() {
    if (currentConversationId) {
      fetchJson(`${API}/conversations/${currentConversationId}`, {
        method: "PUT",
        body: JSON.stringify({ model_id: el.modelSelect.value }),
      }).catch(() => {});
    }
  }

  el.btnNewChat.addEventListener("click", newConversation);
  el.btnSave.addEventListener("click", saveConversation);
  el.btnSend.addEventListener("click", sendMessage);
  el.modelSelect.addEventListener("change", onModelChange);

  el.messageInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  loadModels().then(() => loadConversations());
})();
