export function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es", { day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
  } catch (_) {
    return "";
  }
}

export function formatDateTime(iso) {
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

export function getDefaultConversationTitle() {
  const now = new Date();
  return now.toLocaleString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
