"""Vista de galería de imágenes generadas (listado, filtros, lightbox)."""
from pathlib import Path

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
    gallery_btn = html.index('id="btn-image-gallery"')
    queue_btn = html.index('id="btn-image-queue"')
    chat_btn = html.index('id="btn-center-chat"')
    new_btn = html.index('id="btn-new-chat"')
    assert new_btn < chat_btn < gallery_btn < queue_btn
    panel = html.index('id="image-gallery-panel"')
    queue_panel = html.index('id="image-queue-panel"')
    chat = html.index('id="chat-column"')
    splitter = html.index('id="center-panels-splitter"')
    assert chat < splitter < panel < queue_panel
    assert 'id="image-queue-list"' in html
    assert 'id="image-queue-pause-toggle"' in html
    assert 'id="image-queue-paused-label"' in html
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
    assert "flex-direction: column" in css[css.index(".center-panel-toggles") : css.index(".center-panel-toggles") + 120]
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
