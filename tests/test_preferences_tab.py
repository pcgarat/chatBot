"""Tab Preferencias anclado al fondo del rail derecho, con acordeón Interfaz."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "app" / "static" / "index.html"
APP_JS = ROOT / "app" / "static" / "js" / "app.js"
STYLE_CSS = ROOT / "app" / "static" / "css" / "style.css"


def test_preferences_tab_is_docked_after_work_tabs():
    html = INDEX_HTML.read_text(encoding="utf-8")
    reglas = html.index('id="sidebar-tab-reglas"')
    ajustes = html.index('id="sidebar-tab-parametros"')
    imagenes = html.index('id="sidebar-tab-imagenes"')
    spacer = html.index("sidebar-tab-rail-spacer")
    prefs = html.index('id="sidebar-tab-preferencias"')
    assert reglas < ajustes < imagenes < spacer < prefs
    assert 'data-sidebar-tab="preferencias"' in html
    assert 'id="tab-preferencias"' in html
    assert 'aria-controls="tab-preferencias"' in html
    assert "sidebar-tab--docked" in html


def test_interfaz_accordion_hosts_interface_controls():
    html = INDEX_HTML.read_text(encoding="utf-8")
    prefs = html.split('id="tab-preferencias"')[1].split("sidebar-footer")[0]
    assert 'data-accordion-section="prefs-interfaz"' in prefs
    assert "Interfaz" in prefs
    assert 'id="pref-font-base-decrease"' in prefs
    assert 'id="pref-font-base-increase"' in prefs
    assert 'id="pref-font-base-value"' in prefs
    assert 'id="pref-font-decrease"' in prefs
    assert 'id="pref-font-increase"' in prefs
    assert 'id="pref-font-value"' in prefs
    assert 'id="pref-font-left-decrease"' in prefs
    assert 'id="pref-font-left-increase"' in prefs
    assert 'id="pref-font-left-value"' in prefs
    assert 'id="pref-font-right-decrease"' in prefs
    assert 'id="pref-font-right-increase"' in prefs
    assert 'id="pref-font-right-value"' in prefs
    assert 'id="pref-image-label"' in prefs
    assert 'id="pref-image-decrease"' in prefs
    assert 'id="pref-image-increase"' in prefs
    assert 'id="pref-image-value"' in prefs
    assert 'id="pref-debug-log-decrease"' in prefs
    assert 'id="pref-debug-log-increase"' in prefs
    assert 'id="pref-debug-log-value"' in prefs
    assert "Historial de debug" in prefs
    base_row = prefs.index('id="pref-font-base-value"')
    font_row = prefs.index('id="pref-font-value"')
    left_row = prefs.index('id="pref-font-left-value"')
    right_row = prefs.index('id="pref-font-right-value"')
    image_row = prefs.index('id="pref-image-value"')
    debug_row = prefs.index('id="pref-debug-log-value"')
    dark_row = prefs.index('id="dark-mode-toggle"')
    assert base_row < font_row < left_row < right_row < image_row < debug_row < dark_row
    assert "Texto base" in prefs
    assert "Texto del panel izquierdo" in prefs
    assert "Texto del panel derecho" in prefs
    assert "Imágenes de la conversación" in prefs
    assert "Tamaño de las ilustraciones en los mensajes" in prefs
    assert 'id="dark-mode-toggle"' in prefs
    assert 'id="auto-scroll-during-generation"' in prefs
    assert 'id="pref-collapse-all-messages"' in prefs
    assert "Colapsar" in prefs
    assert prefs.count('id="dark-mode-toggle"') == 1
    assert prefs.count('id="auto-scroll-during-generation"') == 1


def test_chat_header_keeps_font_and_collapse_shortcuts():
    html = INDEX_HTML.read_text(encoding="utf-8")
    stream = html.split('id="chat-column"')[1].split('id="center-panels-splitter"')[0]
    assert 'id="btn-font-size-decrease"' in stream
    assert 'id="btn-font-size-increase"' in stream
    assert 'id="btn-collapse-all-messages"' in stream


def test_preferences_js_shares_handlers_without_duplicate_logic():
    js = APP_JS.read_text(encoding="utf-8")
    assert '"preferencias"' in js
    assert "pref-font-decrease" in js
    assert "pref-font-increase" in js
    assert "pref-font-base-decrease" in js
    assert "initUiBaseFontScale" in js
    assert "setUiBaseFontScale" in js
    assert "--ui-base-font-scale" in js
    assert '"pref-font-left"' in js
    assert '"pref-font-right"' in js
    assert 'prefix + "-decrease"' in js
    assert 'prefix + "-increase"' in js
    assert "setSidebarFontScale" in js
    assert "initSidebarFontScales" in js
    assert "sidebarLeftFontScale" in js
    assert "sidebarRightFontScale" in js
    assert "--sidebar-left-font-scale" in js
    assert "--sidebar-right-font-scale" in js
    assert "pref-collapse-all-messages" in js
    assert "formatFontSizeLabel" in js
    assert "pref-font-value" in js
    assert "pref-image-decrease" in js
    assert "setConversationImageSize" in js
    assert "IMAGE_SIZE_" in js
    assert "chatbot_conversation_image_size" in js
    assert "setDebugLogSize" in js
    assert "chatbot_debug_log_size" in js
    start = js.index("const SIDEBAR_MAIN_SECTION_IDS")
    ids = js[start : start + 160]
    assert "preferencias" in ids


def test_preferences_css_docks_tab_and_lays_out_rows():
    css = STYLE_CSS.read_text(encoding="utf-8")
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert ".sidebar-tab-rail-spacer" in css
    assert "sidebar-tab--docked" in html
    assert ".pref-row" in css
    assert ".pref-font-stepper" in css
    assert ".pref-font-value" in css
    assert "--sidebar-left-font-scale" in css
    assert "--sidebar-right-font-scale" in css
    assert "calc(0.6875rem * var(--sidebar-left-font-scale, 1))" in css
    assert "calc(0.75rem * var(--sidebar-right-font-scale, 1))" in css
    chat_rule = css.split(".chat-illustration-frame {")[1].split("}")[0]
    gallery_rule = css.split(".image-gallery-card img {")[1].split("}")[0]
    assert "--chat-image-max-width" in chat_rule
    assert "--chat-image-max-width" not in gallery_rule


def test_index_serves_preferences_tab(client):
    r = client.get("/")
    assert r.status_code == 200
    assert b'id="sidebar-tab-preferencias"' in r.content
    assert b'id="tab-preferencias"' in r.content
    assert b'id="pref-collapse-all-messages"' in r.content
    assert b'id="pref-font-base-value"' in r.content
    assert b'id="pref-font-left-value"' in r.content
    assert b'id="pref-font-right-value"' in r.content
    assert b'id="pref-image-value"' in r.content
    assert b'id="pref-debug-log-value"' in r.content


def test_sidebar_font_scale_persists_in_head_script():
    html = INDEX_HTML.read_text(encoding="utf-8")
    head = html.split("</head>")[0]
    assert "uiBaseFontScale" in head
    assert "--ui-base-font-scale" in head
    assert "sidebarLeftFontScale" in head
    assert "sidebarRightFontScale" in head
    assert "--sidebar-left-font-scale" in head
    assert "--sidebar-right-font-scale" in head
    interfaz = html.split('data-accordion-section="prefs-interfaz"')[1].split("sidebar-footer")[0]
    base = interfaz.index("Texto base")
    conv = interfaz.index("Texto de la conversación")
    left = interfaz.index("Texto del panel izquierdo")
    right = interfaz.index("Texto del panel derecho")
    images = interfaz.index("Imágenes de la conversación")
    dark = interfaz.index("Tema oscuro")
    assert base < conv < left < right < images < dark
