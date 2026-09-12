/**
 * Progreso de generación de imágenes por petición (batch) en la status bar.
 * Todos los chips van a la izquierda del nombre del proveedor.
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
  renderChips(document.getElementById("image-batch-progress"), normalized);
}
