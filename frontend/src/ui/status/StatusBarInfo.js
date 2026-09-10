import { uiStore, currentStatus } from "../../store/ui.js";
import { settingsStore } from "../../store/settings.js";
import { sessionStore } from "../../store/session.js";
import { useStore } from "../../hooks/useStore.js";

export function renderContextUsageBar() {
  const row = document.getElementById("context-usage-row");
  const textEl = document.getElementById("context-usage-text");
  const badgeEl = document.getElementById("context-usage-badge");
  const barWrap = document.getElementById("context-usage-bar-wrap");
  const bar = document.getElementById("context-usage-bar");
  if (!row) return;
  const lastUsage = sessionStore.get().lastUsage;
  const contextLength = sessionStore.get().contextLength;
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
}

export function StatusBarInfo() {
  useStore(uiStore);
  const status = currentStatus();
  const provider = useStore(settingsStore, (s) => s.currentProvider);
  const model = useStore(settingsStore, (s) => s.currentModel);
  const usage = useStore(sessionStore, (s) => s.lastUsage);
  const ctx = useStore(sessionStore, (s) => s.contextLength);
  const prompt = usage ? usage.prompt_tokens : 0;
  const completion = usage ? usage.completion_tokens : 0;
  const used = prompt + completion;
  const pct = ctx ? Math.min(100, Math.round((used / ctx) * 100)) : 0;
  renderContextUsageBar();
  return {
    status,
    provider,
    model,
    usage,
    ctx,
    prompt,
    completion,
    used,
    pct,
  };
}
