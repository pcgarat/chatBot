/**
 * Progreso de generación de imágenes por petición (batch) en la status bar.
 * Chips a izquierda/derecha del nombre del proveedor.
 */

export function normalizeBatchProgress(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter(function (row) {
      return (
        row &&
        row.batch_id &&
        Number(row.total) > 0 &&
        Number(row.completed) < Number(row.total)
      );
    })
    .map(function (row) {
      return {
        batchId: String(row.batch_id),
        completed: Math.max(0, Number(row.completed) || 0),
        total: Math.max(0, Number(row.total) || 0),
        createdAt: row.created_at || null,
      };
    })
    .sort(function (a, b) {
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
}

/** Mitad más antigua a la izquierda del proveedor; el resto a la derecha. */
export function splitBatchProgressAroundProvider(batches) {
  const list = Array.isArray(batches) ? batches.slice() : [];
  if (!list.length) return { left: [], right: [] };
  if (list.length === 1) return { left: list, right: [] };
  const mid = Math.ceil(list.length / 2);
  return { left: list.slice(0, mid), right: list.slice(mid) };
}

export function formatBatchProgressLabel(batch) {
  if (!batch) return "";
  return String(batch.completed) + "/" + String(batch.total);
}

function renderChips(container, batches) {
  if (!container) return;
  if (!batches.length) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML = batches
    .map(function (batch) {
      const label = formatBatchProgressLabel(batch);
      return (
        '<span class="image-batch-progress-chip" data-batch-id="' +
        String(batch.batchId).replace(/"/g, "") +
        '" title="Imágenes descargadas de esta petición">' +
        label +
        "</span>"
      );
    })
    .join("");
}

export function syncImageBatchProgressDom(batches) {
  const normalized = normalizeBatchProgress(batches);
  const { left, right } = splitBatchProgressAroundProvider(normalized);
  renderChips(document.getElementById("image-batch-progress-left"), left);
  renderChips(document.getElementById("image-batch-progress-right"), right);
}
