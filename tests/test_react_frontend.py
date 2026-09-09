"""El frontend es un SPA React servido desde app/static (build de Vite)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SRC = ROOT / "frontend" / "src"
APP_JSX = FRONTEND_SRC / "App.jsx"
MAIN_JSX = FRONTEND_SRC / "main.jsx"
LEGACY_JS = FRONTEND_SRC / "app.js"


def test_react_shell_is_the_markup_source():
    jsx = APP_JSX.read_text(encoding="utf-8")
    assert "export default function App" in jsx
    assert 'id="app"' in jsx
    assert 'id="messages-container"' in jsx
    assert 'id="column-left"' in jsx
    assert 'id="column-right"' in jsx
    assert 'id="image-gallery-panel"' in jsx
    assert 'id="image-queue-panel"' in jsx


def test_react_bootstrap_monta_el_shell_y_arranca_la_app():
    main = MAIN_JSX.read_text(encoding="utf-8")
    assert "createRoot" in main
    assert "from \"react-dom/client\"" in main
    assert "from \"./App.jsx\"" in main
    assert "initApp" in main
    assert "useLayoutEffect" in main
    assert "StrictMode" not in main


def test_legacy_controller_exports_init_app_once():
    js = LEGACY_JS.read_text(encoding="utf-8")
    assert "export function initApp" in js
    assert "if (appStarted)" in js
    assert "document.addEventListener(\"DOMContentLoaded\"" not in js


def test_index_serves_react_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")
    assert 'id="root"' in r.text
    assert 'id="app"' in r.text
    assert "/static/js/main.js" in r.text


def test_static_bundle_exposes_legacy_controller(client):
    r = client.get("/static/js/app.js")
    assert r.status_code == 200
    assert "initApp" in r.text
    assert "initImageGallery" in r.text
