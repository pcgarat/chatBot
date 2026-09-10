import { useEffect } from "react";
import { useStore } from "../../hooks/useStore.js";
import { settingsStore } from "../../store/settings.js";
import { sessionStore } from "../../store/session.js";
import { debugStore } from "../../store/debug.js";
import { uiStore, currentStatus } from "../../store/ui.js";
import { historyStore } from "../../store/history.js";
import { getWorkspaceProfiles } from "../../app/profilesActions.js";
import { onMessageHistorySearchInput } from "../../app/historyActions.js";
import { renderContextUsageBar } from "../status/StatusBarInfo.js";

function fillSelect(id, values, current) {
  const el = document.getElementById(id);
  if (!el) return;
  const names = values.map((v) => (typeof v === "string" ? v : v.name || v.id || "")).filter(Boolean);
  const html = names.map((n) => `<option value="${n.replace(/"/g, "&quot;")}">${n}</option>`).join("");
  if (el.innerHTML !== html && (el.tagName === "SELECT")) {
    const keep = el.value;
    el.innerHTML = html || el.innerHTML;
    if (current && names.includes(current)) el.value = current;
    else if (names.includes(keep)) el.value = keep;
  } else if (current && el.value !== current) {
    el.value = current;
  }
}

export function StoreDomSync() {
  const providers = useStore(settingsStore, (s) => s.providers);
  const models = useStore(settingsStore, (s) => s.models);
  const provider = useStore(settingsStore, (s) => s.currentProvider);
  const model = useStore(settingsStore, (s) => s.currentModel);
  const library = useStore(settingsStore, (s) => s.libraryRules);
  const plannerLib = useStore(settingsStore, (s) => s.plannerLibraryRules);
  const title = useStore(sessionStore, (s) => s.title);
  const autoTitle = useStore(sessionStore, (s) => s.autoTitle);
  const draft = useStore(sessionStore, (s) => s.composerDraft);
  const instruction = useStore(sessionStore, (s) => s.instructionOverride);
  const kind = useStore(sessionStore, (s) => s.conversationKind);
  const abort = useStore(sessionStore, (s) => s.abortController);
  const chatLog = useStore(debugStore, (s) => s.chatLog);
  const imagesLog = useStore(debugStore, (s) => s.imagesLog);
  const chatOpen = useStore(debugStore, (s) => s.chatOpen);
  const imagesOpen = useStore(debugStore, (s) => s.imagesOpen);
  const mode = useStore(historyStore, (s) => s.mode);
  useStore(uiStore);

  useEffect(() => {
    fillSelect("provider-select", providers, provider);
    const headerP = document.getElementById("header-provider-name");
    if (headerP) headerP.textContent = provider || "";
  }, [providers, provider]);

  useEffect(() => {
    fillSelect("model-select", models, model);
    const headerM = document.getElementById("header-model-name");
    if (headerM) headerM.textContent = model || "";
    const input = document.getElementById("model-select-input");
    if (input && model) input.value = model;
  }, [models, model]);

  useEffect(() => {
    const sel = document.getElementById("rule-library-select");
    if (sel) {
      sel.innerHTML =
        '<option value="">Elegir regla</option>' +
        library.map((r) => `<option value="${r.id}">${(r.title || "").replace(/</g, "")}</option>`).join("");
    }
  }, [library]);

  useEffect(() => {
    const sel = document.getElementById("planner-rule-library-select");
    if (sel) {
      sel.innerHTML =
        '<option value="">Elegir regla</option>' +
        plannerLib.map((r) => `<option value="${r.id}">${(r.title || "").replace(/</g, "")}</option>`).join("");
    }
  }, [plannerLib]);

  useEffect(() => {
    const t = document.getElementById("conversation-title");
    if (t && t !== document.activeElement) t.value = title || "";
    const a = document.getElementById("conversation-auto-title");
    if (a) a.checked = !!autoTitle;
  }, [title, autoTitle]);

  useEffect(() => {
    const ta = document.getElementById("message-input");
    if (ta && ta !== document.activeElement) ta.value = draft || "";
    const ins = document.getElementById("instruction-override");
    if (ins && ins !== document.activeElement) ins.value = instruction || "";
    const gen = document.getElementById("btn-generate-prompt");
    if (gen) gen.hidden = kind !== "prompt_generator";
    const send = document.getElementById("btn-send");
    if (send) {
      send.setAttribute("data-composer-action", abort ? "stop" : "send");
      send.title = abort ? "Parar" : "Enviar";
      send.setAttribute("aria-label", abort ? "Parar generación" : "Enviar mensaje");
    }
  }, [draft, instruction, kind, abort]);

  useEffect(() => {
    const wrap = document.getElementById("message-history-search-wrap");
    if (wrap) wrap.hidden = mode !== "messages";
    const btn = document.getElementById("btn-history-messages");
    if (btn) btn.setAttribute("aria-pressed", mode === "messages" ? "true" : "false");
    const search = document.getElementById("message-history-search");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "1";
      search.addEventListener("input", (e) => onMessageHistorySearchInput(e.target.value));
    }
  }, [mode]);

  useEffect(() => {
    const log = document.getElementById("chat-debug-log");
    if (log) {
      log.innerHTML = (chatLog || [])
        .map((e) => `<article class="debug-entry"><header>${e.title || ""}</header><pre>${e.details || e.response || ""}</pre></article>`)
        .join("");
    }
    const column = document.getElementById("column-right");
    if (column) column.classList.toggle("is-debug-expanded", !!(chatOpen || imagesOpen));
    const body = document.getElementById("debug-chat-body");
    const tog = document.getElementById("debug-chat-toggle");
    if (body) body.hidden = !chatOpen;
    if (tog) tog.setAttribute("aria-expanded", chatOpen ? "true" : "false");
  }, [chatLog, chatOpen]);

  useEffect(() => {
    const log = document.getElementById("images-debug-log");
    if (log) {
      log.innerHTML = (imagesLog || [])
        .map((e) => `<article class="debug-entry"><header>${e.html || e.title || ""}</header></article>`)
        .join("");
    }
    const body = document.getElementById("debug-images-body");
    const tog = document.getElementById("debug-images-toggle");
    if (body) body.hidden = !imagesOpen;
    if (tog) tog.setAttribute("aria-expanded", imagesOpen ? "true" : "false");
  }, [imagesLog, imagesOpen]);

  useEffect(() => {
    const st = currentStatus();
    const text = document.getElementById("app-status-text");
    const detail = document.getElementById("app-status-detail");
    const bar = document.getElementById("app-status-bar");
    if (text) text.textContent = st.label;
    if (detail) {
      detail.hidden = !st.detail;
      detail.textContent = st.detail || "";
    }
    if (bar) bar.classList.toggle("is-busy", st.busy);
    renderContextUsageBar();
  });

  useEffect(() => {
    const sel = document.getElementById("workspace-profile-select");
    if (!sel) return;
    const list = getWorkspaceProfiles();
    const current = sel.value;
    sel.innerHTML =
      '<option value="">Elegir perfil</option>' +
      list.map((p) => `<option value="${p.id}">${(p.name || "").replace(/</g, "")}</option>`).join("");
    if (current) sel.value = current;
  });

  return null;
}
