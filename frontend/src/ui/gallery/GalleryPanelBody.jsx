import { imagesStore } from "../../store/images.js";
import { sessionStore } from "../../store/session.js";
import { layoutStore } from "../../store/layout.js";
import { useStore } from "../../hooks/useStore.js";
import {
  loadGalleryPage,
  setGalleryFilter,
  setGalleryScopeAll,
  openGalleryLightbox,
  closeGalleryLightbox,
  stepGalleryLightbox,
  purgeOrphans,
  GALLERY_PAGE_SIZE,
} from "../../app/galleryActions.js";
import { useEffect } from "react";

export function GalleryPanelBody() {
  const items = useStore(imagesStore, (s) => s.galleryItems);
  const filters = useStore(imagesStore, (s) => s.galleryFilters);
  const options = useStore(imagesStore, (s) => s.galleryFilterOptions);
  const scopeAll = useStore(imagesStore, (s) => s.galleryScopeAll);
  const total = useStore(imagesStore, (s) => s.galleryTotal);
  const offset = useStore(imagesStore, (s) => s.galleryOffset);
  const lightbox = useStore(imagesStore, (s) => s.galleryLightboxIndex);
  const visible = useStore(layoutStore, (s) => s.centerGalleryVisible);
  const convTitle = useStore(sessionStore, (s) => s.title);
  const convId = useStore(sessionStore, (s) => s.conversationId);

  useEffect(() => {
    if (visible) loadGalleryPage();
  }, [visible, convId, filters, offset]);

  const current = lightbox >= 0 ? items[lightbox] : null;
  const from = items.length ? offset + 1 : 0;
  const to = offset + items.length;

  return (
    <>
      <div className="image-gallery-toolbar" id="image-gallery-toolbar">
        <label className="image-gallery-filter">
          <span>LLM</span>
          <select id="gallery-filter-prompt-model" className="param-control" aria-label="Filtrar por LLM" value={filters.promptModel || ""} onChange={(e) => setGalleryFilter({ promptModel: e.target.value })}>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="image-gallery-filter">
          <span>Provider</span>
          <select id="gallery-filter-prompt-provider" className="param-control" aria-label="Filtrar por Provider" value={filters.promptProvider || ""} onChange={(e) => setGalleryFilter({ promptProvider: e.target.value })}>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="image-gallery-filter">
          <span>Checkpoint</span>
          <select id="gallery-filter-forge-model" className="param-control" aria-label="Filtrar por Checkpoint" value={filters.forgeModel || ""} onChange={(e) => setGalleryFilter({ forgeModel: e.target.value })}>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="image-gallery-filter">
          <span>Steps</span>
          <select id="gallery-filter-steps" className="param-control" aria-label="Filtrar por Steps" value={filters.steps || ""} onChange={(e) => setGalleryFilter({ steps: e.target.value })}>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="image-gallery-filter">
          <span>Tamaño</span>
          <select id="gallery-filter-size" className="param-control" aria-label="Filtrar por Tamaño" value={filters.size || ""} onChange={(e) => setGalleryFilter({ size: e.target.value })}>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="image-gallery-filter">
          <span>Modo</span>
          <select id="gallery-filter-mode" className="param-control" aria-label="Filtrar por Modo" value={filters.mode || ""} onChange={(e) => setGalleryFilter({ mode: e.target.value })}>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="image-gallery-filter">
          <span>Seed</span>
          <select id="gallery-filter-seed" className="param-control" aria-label="Filtrar por Seed" value={filters.seed || ""} onChange={(e) => setGalleryFilter({ seed: e.target.value })}>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="image-gallery-filter image-gallery-filter-prompt">
          <span>Prompt</span>
          <input type="search" id="gallery-filter-prompt-q" className="param-control" placeholder="Buscar en el prompt" aria-label="Buscar en el prompt" value={filters.promptQ || ""} onChange={(e) => setGalleryFilter({ promptQ: e.target.value })} />
        </label>
      </div>
      <div className="image-gallery-scope" id="image-gallery-scope">
        <button type="button" id="gallery-scope-all" className="btn btn-secondary btn-small" aria-pressed={scopeAll ? "true" : "false"} onClick={() => setGalleryScopeAll(true)}>Todas las conversaciones</button>
        <span id="gallery-scope-conv-label" className="image-gallery-scope-label" hidden={scopeAll || !convTitle}>{convTitle}</span>
        <button type="button" id="gallery-purge-orphans" className="btn btn-secondary btn-small image-gallery-purge-orphans" title="Eliminar del disco las imágenes que no están incrustadas en ningún mensaje" onClick={purgeOrphans}>Eliminar archivos huérfanos</button>
      </div>
      <div className="image-gallery-messages" id="image-gallery-messages" hidden></div>
      <div className="image-gallery-grid" id="image-gallery-grid">
        {items.map((item, i) => {
          const src = item.url || (item.filename ? `/api/illustrated-images/${encodeURIComponent(item.filename)}` : "");
          const sizeStyle = item.width > 0 && item.height > 0 ? { aspectRatio: `${item.width} / ${item.height}` } : undefined;
          return (
            <button key={item.filename || i} type="button" className="image-gallery-card" data-gallery-index={i} onClick={() => openGalleryLightbox(i)}>
              {src ? <img src={src} alt="" loading="lazy" width={item.width || undefined} height={item.height || undefined} style={sizeStyle} /> : null}
              <div className="image-gallery-card-body">
                <p className="image-gallery-card-prompt">{(item.prompt || "").trim() || "(sin prompt)"}</p>
                <button type="button" className="gallery-open-message" onClick={(e) => { e.stopPropagation(); }}>Ver en el chat</button>
              </div>
            </button>
          );
        })}
      </div>
      <div className="image-gallery-pager" id="image-gallery-pager">
        {items.length ? (
          <>
            <button type="button" className="btn btn-secondary btn-small" id="gallery-page-prev" disabled={offset <= 0} onClick={() => imagesStore.set({ galleryOffset: Math.max(0, offset - GALLERY_PAGE_SIZE) })}>Anterior</button>
            <span>{from}–{to} de {total}</span>
            <button type="button" className="btn btn-secondary btn-small" id="gallery-page-next" disabled={offset + items.length >= total} onClick={() => imagesStore.set({ galleryOffset: offset + GALLERY_PAGE_SIZE })}>Siguiente</button>
          </>
        ) : null}
      </div>
      <div id="image-gallery-lightbox" className="modal-overlay image-gallery-lightbox" role="dialog" aria-modal="true" aria-labelledby="image-gallery-lightbox-title" hidden={lightbox < 0}>
        <div className="modal-content image-gallery-lightbox-content">
          <div className="image-gallery-lightbox-header">
            <h2 id="image-gallery-lightbox-title" className="modal-title">Imagen generada</h2>
            <button type="button" id="image-gallery-lightbox-close" className="icon-btn" title="Cerrar" aria-label="Cerrar" onClick={closeGalleryLightbox}>×</button>
          </div>
          <div className="image-gallery-lightbox-body">
            <div className="image-gallery-lightbox-media">
              <button type="button" id="image-gallery-lightbox-prev" className="image-gallery-lightbox-nav" title="Anterior" aria-label="Imagen anterior" disabled={total <= 1} onClick={() => stepGalleryLightbox(-1)}>‹</button>
              <img id="image-gallery-lightbox-img" alt="" src={current && (current.url || (current.filename ? `/api/illustrated-images/${encodeURIComponent(current.filename)}` : ""))} />
              <button type="button" id="image-gallery-lightbox-next" className="image-gallery-lightbox-nav" title="Siguiente" aria-label="Imagen siguiente" disabled={total <= 1} onClick={() => stepGalleryLightbox(1)}>›</button>
            </div>
            <div className="image-gallery-lightbox-meta" id="image-gallery-lightbox-meta"></div>
          </div>
        </div>
      </div>
    </>
  );
}

export function initImageGallery() {
  loadGalleryPage();
}
