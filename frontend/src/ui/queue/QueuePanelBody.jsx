import { useEffect } from "react";
import { useStore } from "../../hooks/useStore.js";
import { imagesStore } from "../../store/images.js";
import { initImageQueuePanel, setQueueFilter } from "../../app/queueActions.js";

const QUEUE_STATUS_FILTERS = [
  { status: "", label: "Todas" },
  { status: "pending", label: "Pendientes" },
  { status: "generating", label: "Generándose" },
  { status: "completed", label: "Generadas" },
  { status: "failed", label: "Fallidas" },
];

export function QueuePanelBody() {
  const filterStatus = useStore(imagesStore, (s) => s.queueFilterStatus || "");
  const paused = useStore(imagesStore, (s) => !!s.queuePaused);

  useEffect(() => {
    initImageQueuePanel();
  }, []);

  return (
    <>
      <div className="image-queue-toolbar">
        <div className="image-queue-filters" role="group" aria-label="Filtrar cola de imágenes">
          {QUEUE_STATUS_FILTERS.map((filter) => {
            const active = filterStatus === filter.status;
            return (
              <button
                key={filter.status || "all"}
                type="button"
                className={active ? "image-queue-filter-btn is-active" : "image-queue-filter-btn"}
                data-queue-status={filter.status}
                aria-pressed={active ? "true" : "false"}
                onClick={() => setQueueFilter(filter.status)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="image-queue-toolbar-actions">
          <span id="image-queue-paused-label" className="image-queue-paused-label" hidden={!paused}>Cola pausada</span>
          <button
            type="button"
            id="image-queue-pause-toggle"
            className="btn btn-secondary btn-small image-queue-pause-btn"
            aria-pressed={paused ? "true" : "false"}
            title={paused ? "Reanudar la generación encolada" : "Pausar la generación encolada"}
          >
            {paused ? "Reanudar" : "Pausar"}
          </button>
          <button type="button" id="image-queue-cancel-all" className="btn btn-secondary btn-small" title="Cancelar pendientes y en curso">Cancelar todo</button>
          <span id="image-queue-active-count" className="image-queue-active-count" aria-live="polite"></span>
        </div>
      </div>
      <div className="image-queue-list scroll-y-reveal" id="image-queue-list"></div>
    </>
  );
}

export { initImageQueuePanel };
