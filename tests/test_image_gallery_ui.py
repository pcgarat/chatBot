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
    assert 'id="gallery-filter-prompt-q"' in html
    assert 'id="gallery-scope-all"' in html
    assert 'id="gallery-scope-conv-label"' in html
    assert 'id="center-panels-empty"' in html
    assert 'id="center-panels-splitter"' in html
    gallery_btn = html.index('id="btn-image-gallery"')
    chat_btn = html.index('id="btn-center-chat"')
    new_btn = html.index('id="btn-new-chat"')
    assert new_btn < chat_btn < gallery_btn
    panel = html.index('id="image-gallery-panel"')
    chat = html.index('id="chat-column"')
    splitter = html.index('id="center-panels-splitter"')
    assert chat < splitter < panel


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
    assert "data-center-chat" in js
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
    assert ".center-panel-toggles" in css
    assert "flex-direction: column" in css[css.index(".center-panel-toggles") : css.index(".center-panel-toggles") + 120]
    assert ".center-panels-empty" in css
    assert ".center-panels-splitter" in css
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
