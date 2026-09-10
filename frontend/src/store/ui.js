import { createStore } from "./createStore.js";

export const STATUS_LABELS = {
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
  "images.retrying": "Reintentando imágenes fallidas",
  "images.done": "Ilustración completada",
  "images.error": "Error en la ilustración",
  "images.cancelled": "Ilustración cancelada",
};

export const uiStore = createStore({
  statusStack: [],
  statusSeq: 0,
});

export function showError(msg) {
  const toast = document.createElement("div");
  toast.className = "error-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

export function showNotice(msg) {
  const toast = document.createElement("div");
  toast.className = "notice-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
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

export const appStatus = {
  push(kind, code, message, data) {
    const state = uiStore.get();
    const id = `st-${state.statusSeq + 1}`;
    const entry = {
      id,
      kind,
      code,
      label: labelFor(code, message, data),
      detail: "",
    };
    uiStore.set({
      statusSeq: state.statusSeq + 1,
      statusStack: state.statusStack.concat(entry),
    });
    return id;
  },
  update(id, code, message, data) {
    uiStore.set((s) => ({
      ...s,
      statusStack: s.statusStack.map((e) =>
        e.id === id
          ? { ...e, code, label: labelFor(code, message, data), detail: message && !STATUS_LABELS[code] ? String(message) : e.detail }
          : e
      ),
    }));
  },
  pop(id) {
    uiStore.set((s) => ({
      ...s,
      statusStack: s.statusStack.filter((e) => e.id !== id),
    }));
  },
};

export function currentStatus() {
  const stack = uiStore.get().statusStack;
  if (!stack.length) return { label: STATUS_LABELS["app.ready"], detail: "", busy: false };
  const top = stack[stack.length - 1];
  return { label: top.label, detail: top.detail || "", busy: true };
}
