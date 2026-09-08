"""Vista de galería de imágenes generadas (listado, filtros, lightbox)."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "app" / "static" / "index.html"
APP_JS = ROOT / "app" / "static" / "js" / "app.js"
STYLE_CSS = ROOT / "app" / "static" / "css" / "style.css"


def test_gallery_entry_and_panel_exist_in_html():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert 'id="btn-image-gallery"' in html
    assert 'id="btn-center-chat"' in html
    assert 'id="image-gallery-panel"' in html
    assert 'id="chat-column"' in html
    assert 'id="image-gallery-grid"' in html
    assert 'id="image-gallery-lightbox"' in html
    assert 'id="gallery-filter-prompt-model"' in html
    assert 'id="gallery-filter-forge-model"' in html
    assert 'id="gallery-filter-steps"' in html
    assert 'id="gallery-filter-size"' in html
    assert 'id="gallery-filter-mode"' in html
    assert 'id="gallery-filter-seed"' in html
    assert 'id="gallery-filter-prompt-q"' in html
    assert 'id="conversation-image-filter-notice"' in html
    assert 'id="conversation-image-filter-notice-dismiss"' in html
    assert 'class="chat-image-filter-notice-open"' in html
    assert 'id="gallery-scope-all"' in html
    assert 'id="gallery-scope-conv-label"' in html
    assert 'id="center-panels-empty"' in html
    assert 'id="center-panels-splitter"' in html
    header = html[html.index('class="chat-panel-header"') : html.index('id="center-panels-empty"')]
    left = html[html.index('id="column-left"') : html.index("</aside>")]
    actions = html[html.index('class="chat-session-actions"') : html.index('id="center-panels-empty"')]
    assert 'id="btn-center-chat"' in header
    assert 'id="btn-image-gallery"' in header
    assert 'id="btn-image-queue"' in header
    assert 'id="btn-history-messages"' not in header
    assert 'id="btn-center-chat"' not in left
    assert 'id="btn-image-gallery"' not in left
    assert 'id="btn-image-queue"' not in left
    assert 'id="btn-history-messages"' in left
    chat_btn = actions.index('id="btn-center-chat"')
    gallery_btn = actions.index('id="btn-image-gallery"')
    queue_btn = actions.index('id="btn-image-queue"')
    delete_btn = actions.index('id="btn-clear-memory"')
    assert chat_btn < gallery_btn < queue_btn < delete_btn
    assert 'class="center-view-toggle"' in actions
    assert 'id="gallery-view-title"' not in html
    panel = html.index('id="image-gallery-panel"')
    queue_panel = html.index('id="image-queue-panel"')
    chat = html.index('id="chat-column"')
    splitter = html.index('id="center-panels-splitter"')
    assert chat < splitter < panel < queue_panel
    assert 'id="image-queue-list"' in html
    assert 'id="image-queue-pause-toggle"' in html
    assert 'id="image-queue-paused-label"' in html
    assert 'id="image-queue-cancel-all"' in html
    assert 'id="gallery-purge-orphans"' in html
    assert 'scroll-y-reveal' in html
    assert 'id="messages-container"' in html
    assert 'data-queue-status="pending"' in html


def test_gallery_js_loads_list_and_opens_lightbox():
    js = APP_JS.read_text(encoding="utf-8")
    assert "initImageGallery" in js
    assert "setGalleryPanelVisible" in js
    assert "setChatPanelVisible" in js
    assert "/illustrated-images/facets" in js
    assert "/illustrated-images?" in js
    assert "openGalleryLightbox" in js
    assert "openConversationAtMessage" in js
    assert "refreshGalleryAfterScopeChange" in js
    assert "gallery-scope-all" in js
    assert "illustrated-images/messages" in js
    assert "conversation_id" in js
    assert "data-center-gallery" in js
    assert "data-center-queue" in js
    assert "data-center-chat" in js
    assert "setQueuePanelVisible" in js
    assert "loadImageQueuePage" in js
    assert "bindScrollReveal" in js
    assert "is-scrollbar-visible" in js
    assert "deleteImageQueueJobs" in js
    assert "image-queue-delete-btn" in js
    assert "image-queue-context-menu" in js
    assert "toggleImageQueuePaused" in js
    assert "image-queue-pause-toggle" in js
    assert "cancelAllActiveImageQueueJobs" in js
    assert "image-generation-queue/cancel-active" in js
    assert "purgeOrphanIllustratedFiles" in js
    assert "illustrated-images/orphans/purge" in js
    assert "gallery-purge-orphans" in js
    assert "gallery-open-message" in js
    assert "stayHere" in js
    assert "initCenterPanelSplit" in js
    assert "centerChatGalleryShare" in js
    assert "applyCenterPanelShare" in js
    start = js.index("function initImageGallery")
    body = js[start : start + 3500]
    assert "btn-image-gallery" in body
    assert "btn-center-chat" in body
    assert "ArrowLeft" in js[js.index("initImageGallery") : js.index("initImageGallery") + 7000]


def test_open_conversation_does_not_close_gallery():
    js = APP_JS.read_text(encoding="utf-8")
    open_fn = js[
        js.index("async function openConversation") : js.index("async function newConversation")
    ]
    assert "exitGalleryView" not in open_fn
    assert "isGalleryPanelVisible" in open_fn
    assert "setChatPanelVisible(true)" in open_fn
    new_fn = js[js.index("async function newConversation") : js.index("async function newConversation") + 250]
    assert "exitGalleryView" not in new_fn
    assert "setChatPanelVisible(true)" in new_fn


def test_gallery_css_toggles_panels_independently():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert "html[data-center-chat=\"off\"] .chat-column" in css
    assert "html[data-center-gallery=\"on\"] #image-gallery-panel" in css
    assert "html[data-center-gallery=\"on\"] .column-right" not in css
    assert ".image-gallery-grid" in css
    assert ".image-gallery-lightbox" in css
    assert ".image-gallery-messages" in css
    assert ".image-gallery-msg-chip" in css
    assert ".chat-image-filter-notice-wrap" in css
    assert ".chat-image-filter-notice-dismiss" in css
    assert ".chat-illustration-frame.is-gallery-filter-hidden" in css
    assert ".center-panel-toggles" in css
    toggles = css[css.index(".center-panel-toggles") : css.index(".center-panel-toggles") + 220]
    assert "inline-flex" in toggles
    assert "flex-direction: column" not in toggles
    assert ".center-view-toggle" in css
    assert ".center-view-toggle[aria-pressed=\"true\"]" in css
    assert ".center-view-toggle-text" in css
    assert "@container chat-title" in css
    assert ".center-panels-empty" in css
    assert ".center-panels-splitter" in css
    assert ".scroll-y-reveal" in css
    assert ".scroll-y-reveal.is-scrollbar-visible" in css
    scroll_reveal = css[css.index(".scroll-y-reveal") : css.index(".scroll-y-reveal") + 500]
    assert "scrollbar-gutter: stable" in scroll_reveal
    assert "scrollbar-width: none" not in scroll_reveal
    assert "--center-chat-share" in css
    assert "--center-gallery-share" in css
    assert "ns-resize" in css
    chunk = css[
        css.index("html[data-center-chat=\"off\"] .chat-column") : css.index(
            "html[data-center-chat=\"off\"] .chat-column"
        )
        + 200
    ]
    assert "display: none" in chunk or "display:none" in chunk


def test_gallery_thumbs_keep_original_aspect_ratio():
    """Las miniaturas no deben recortarse a un recuadro fijo (cover + alto fijo)."""
    css = STYLE_CSS.read_text(encoding="utf-8")
    js = APP_JS.read_text(encoding="utf-8")
    block = re.search(r"\.image-gallery-card img\s*\{([^}]+)\}", css)
    assert block, "Falta regla .image-gallery-card img"
    body = block.group(1)
    assert "object-fit: cover" not in body
    assert not re.search(r"\bheight\s*:\s*\d+px", body), (
        "Un alto fijo aplasta retrato y panorama al mismo recuadro"
    )
    assert re.search(r"height\s*:\s*auto", body)
    assert "object-fit: contain" in body
    assert not re.search(r"aspect-ratio\s*:\s*[\d.]+", body)
    render = js[js.index("function renderGalleryGrid") : js.index("function loadGalleryPage")]
    assert 'width="' in render
    assert "item.width" in render
    assert "item.height" in render


def test_gallery_cards_do_not_overflow_grid_rows():
    """Retrato y paisaje juntos no deben pintar unas tarjetas encima de otras.

    min-height en el img hace cíclico el track sizing del grid: la fila queda
    más baja que la imagen y la tarjeta (button) se desborda a la fila siguiente.
    """
    css = STYLE_CSS.read_text(encoding="utf-8")
    js = APP_JS.read_text(encoding="utf-8")
    img = re.search(r"\.image-gallery-card img\s*\{([^}]+)\}", css)
    assert img, "Falta regla .image-gallery-card img"
    img_body = img.group(1)
    assert "min-height" not in img_body, (
        "min-height en el thumb subestima la fila y las tarjetas se pisan"
    )
    card = re.search(r"\.image-gallery-card\s*\{([^}]+)\}", css)
    assert card, "Falta regla .image-gallery-card"
    card_body = card.group(1)
    assert "width: 100%" in card_body
    assert "min-width: 0" in card_body
    assert "height: max-content" in card_body
    assert "appearance: none" in card_body
    grid = re.search(r"\.image-gallery-grid\s*\{([^}]+)\}", css)
    assert grid, "Falta regla .image-gallery-grid"
    assert "align-items: start" in grid.group(1)
    render = js[js.index("function renderGalleryGrid") : js.index("function loadGalleryPage")]
    assert "aspect-ratio:" in render
    assert "item.width" in render
    assert "item.height" in render


def test_gallery_lightbox_navigates_across_pages():
    """El visor recorre toda la colección, no solo la página visible."""
    js = APP_JS.read_text(encoding="utf-8")
    css = STYLE_CSS.read_text(encoding="utf-8")
    step = js[
        js.index("function stepGalleryLightbox") : js.index(
            "function highlightIllustrationInConversation"
        )
    ]
    assert "galleryTotal" in step
    assert "galleryPageOffsetForAbsolute" in step
    assert "loadGalleryPage" in step
    assert "silent: true" in step or "silent:!0" in step.replace(" ", "")
    assert "% galleryItems.length" not in step
    assert "galleryItems.length < 2" not in step
    load = js[js.index("async function loadGalleryPage") : js.index("function closeGalleryLightbox")]
    assert "silent" in load
    assert "!silent" in load
    assert "Cargando…" in load
    render = js[
        js.index("function renderGalleryLightbox") : js.index("function openGalleryLightbox")
    ]
    assert "galleryTotal > 1" in render
    assert "galleryItems.length < 2" not in render
    assert "prev.disabled" in render
    assert "next.disabled" in render
    assert "function galleryPageOffsetForAbsolute" in js
    assert "GALLERY_PAGE_SIZE" in js[js.index("function galleryPageOffsetForAbsolute") :]
    assert ".image-gallery-lightbox-nav:disabled" in css


def test_index_serves_gallery_button(client):
    r = client.get("/")
    assert r.status_code == 200
    assert b'id="btn-image-gallery"' in r.content
    assert b'id="btn-center-chat"' in r.content
    assert b'id="image-gallery-lightbox"' in r.content
    assert b'id="center-panels-splitter"' in r.content
    assert b'id="gallery-filter-seed"' in r.content
    assert b'id="conversation-image-filter-notice"' in r.content


def test_gallery_toolbar_filters_apply_to_conversation_images():
    js = APP_JS.read_text(encoding="utf-8")
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert 'id="gallery-filter-seed"' in html
    assert "hasActiveGalleryToolbarFilters" in js
    assert "appendGalleryToolbarFilters" in js
    assert "refreshConversationImageFilter" in js
    assert "scheduleConversationImageFilter" in js
    assert "applyIllustrationFilterToRoot" in js
    assert "is-gallery-filter-hidden" in js
    assert "syncImageFilterNotice" in js
    assert "illustrated-images/matching-filenames" in js
    assert "gallery-filter-seed" in js
    refresh_fn = js[
        js.index("async function refreshConversationImageFilter") : js.index(
            "function scheduleConversationImageFilter"
        )
    ]
    assert "conversation_id" in refresh_fn
    assert "message_id" not in refresh_fn
    assert "syncImageFilterNotice" in refresh_fn
    notice_fn = js[
        js.index("function syncImageFilterNotice") : js.index("function applyIllustrationFilterToRoot")
    ]
    assert "conversation-image-filter-notice" in notice_fn
    assert "hidden" in notice_fn
    assert "hasActiveGalleryToolbarFilters" in notice_fn
    render_fn = js[js.index("function renderMessages") : js.index("function closeAllMessageContextMenus")]
    assert "scheduleConversationImageFilter" in render_fn
    assert "onGalleryToolbarFilterChange" in js
    assert "clearGalleryToolbarFilters" in js
    assert "conversation-image-filter-notice-dismiss" in js
    assert "setGalleryPanelVisible(true)" in js[js.index("chat-image-filter-notice-open") : js.index("chat-image-filter-notice-open") + 400]
