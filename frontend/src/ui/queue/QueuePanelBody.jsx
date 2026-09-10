import { useEffect } from "react";
import { imagesStore } from "../../store/images.js";
import { layoutStore } from "../../store/layout.js";
import { useStore } from "../../hooks/useStore.js";
import {
  loadImageQueuePage,
  startImageQueuePoll,
  maybeStopImageQueuePoll,
  setQueueFilter,
  toggleQueuePause,
  cancelAllQueue,
  deleteQueueSelection,
  toggleQueueSelected,
  IMAGE_QUEUE_STATUS_LABELS,
} from "../../app/queueActions.js";
import { formatDateTime } from "../../lib/dates.js";

export function QueuePanelBody() {
  const items = useStore(imagesStore, (s) => s.queueItems);
  const filter = useStore(imagesStore, (s) => s.queueFilterStatus);
  const paused = useStore(imagesStore, (s) => s.queuePaused);
  const selected = useStore(imagesStore, (s) => s.queueSelectedIds);
  const expanded = useStore(imagesStore, (s) => s.queueExpandedId);
  const visible = useStore(layoutStore, (s) => s.centerQueueVisible);

  useEffect(() => {
    if (visible) {
      loadImageQueuePage();
      startImageQueuePoll();
    } else {
      maybeStopImageQueuePoll();
    }
  }, [visible]);

  return (
    <>
      <div className="image-queue-toolbar">
        <div className="image-queue-filters" role="group" aria-label="Filtrar cola de imágenes" data-queue-status="pending">
          {[
            ["pending", "Pendientes"],
            ["generating", "Generándose"],
            ["completed", "Generadas"],
            ["failed", "Fallidas"],
          ].map(([status, label]) => (
            <button
              key={status || "all"}
              type="button"
              className={`image-queue-filter-btn${filter === status ? " is-active" : ""}`}
              data-queue-status={status}
              onClick={() => setQueueFilter(status)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="image-queue-toolbar-actions">
          <span id="image-queue-paused-label" className="image-queue-paused-label" hidden={!paused}>Cola pausada</span>
          <button type="button" id="image-queue-pause-toggle" className="btn btn-secondary btn-small image-queue-pause-btn" aria-pressed={paused ? "true" : "false"} title="Pausar la generación encolada" onClick={toggleQueuePause}>{paused ? "Reanudar" : "Pausar"}</button>
          <button type="button" id="image-queue-cancel-all" className="btn btn-secondary btn-small" onClick={cancelAllQueue}>Cancelar todas</button>
          <button type="button" className="btn btn-secondary btn-small image-queue-delete-btn" id="image-queue-delete-btn" onClick={() => deleteQueueSelection()}>Eliminar</button>
          <span id="image-queue-active-count" className="image-queue-active-count" aria-live="polite">{items.filter((i) => i.status === "generating" || i.status === "pending").length}</span>
        </div>
      </div>
      <div className="image-queue-list scroll-y-reveal" id="image-queue-list">
        {items.map((item) => {
          const thumb = item.result_filename
            ? `<div class="image-queue-thumb"><img class="image-queue-thumb-img" src="/api/illustrated-images/${encodeURIComponent(item.result_filename)}" alt="" loading="lazy" /></div>`
            : `<div class="image-queue-thumb image-queue-thumb--empty" aria-hidden="true"></div>`;
          return (
            <div
              key={item.id}
              className={`image-queue-item${selected.includes(item.id) ? " is-selected" : ""}`}
              data-id={item.id}
              onClick={(e) => toggleQueueSelected(item.id, e.shiftKey || e.metaKey || e.ctrlKey)}
              onContextMenu={(e) => {
                e.preventDefault();
                deleteQueueSelection([item.id]);
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: thumb }} />
              <div>
                <strong>{IMAGE_QUEUE_STATUS_LABELS[item.status] || item.status}</strong>
                {item.created_at ? <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function initImageQueuePanel() {
  loadImageQueuePage();
}
