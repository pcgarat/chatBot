"""UI de variantes: conversación nueva cuyo historial se lee del origen."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = ROOT / "app" / "static" / "index.html"
APP_JS = ROOT / "app" / "static" / "js" / "app.js"
STYLE_CSS = ROOT / "app" / "static" / "css" / "style.css"


def test_index_no_tiene_banner_de_intento_in_place():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert 'id="fork-attempt-banner"' not in html
    assert 'id="btn-cancel-fork"' not in html
    assert "Nuevo intento desde este mensaje" not in html


def test_js_menu_nueva_conversacion_desde_aqui():
    js = APP_JS.read_text(encoding="utf-8")
    assert 'data-action="fork-conversation"' in js
    assert "Nueva conversación desde aquí" in js
    assert "forkConversationFromMessage" in js
    assert "/fork" in js
    assert 'startsWith("tmp-")' in js
    assert "inherited_messages" in js
    assert "buildConversationForest" in js
    assert "message-row-inherited" in js
    assert 'data-action="new-attempt"' not in js
    assert "startNewAttempt" not in js
    assert "msg-attempt-switcher" not in js


def test_js_mutaciones_contenido_disponibles_en_heredados():
    """Ilustrar/fotos actúan sobre la fila canónica; borrar sigue oculto en heredados."""
    js = APP_JS.read_text(encoding="utf-8")
    assert '!isInherited && !isEphemeralDebug && m.role === "assistant"' not in js
    assert "!isInherited && m.role === \"assistant\" && hasContent" not in js
    assert "msg-illustrate-btn" in js
    assert 'data-action="clear-photos"' in js
    assert "isInherited ? \"\" :" in js
    assert "msg-delete-btn" in js


def test_css_variante_anidada_e_historial_heredado():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".conversation-item-fork" in css
    assert ".message-row-inherited" in css
    assert ".message-inherited-split" in css
    assert ".fork-attempt-banner" not in css
    assert ".msg-attempt-switcher" not in css


def test_index_sirve_sin_banner_intento(client):
    r = client.get("/")
    assert r.status_code == 200
    assert 'id="fork-attempt-banner"' not in r.text
    js = client.get("/static/js/app.js")
    assert js.status_code == 200
    assert "Nueva conversación desde aquí" in js.text
