"""El frontend es un SPA React servido desde app/static (build de Vite)."""
from pathlib import Path

from tests.frontend_source import frontend_markup, frontend_source

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SRC = ROOT / "frontend" / "src"
APP_JSX = FRONTEND_SRC / "App.jsx"
MAIN_JSX = FRONTEND_SRC / "main.jsx"
LEGACY_JS = FRONTEND_SRC / "app.js"
VITE_INDEX = ROOT / "frontend" / "index.html"
STYLE_CSS = FRONTEND_SRC / "styles" / "style.css"


def _css_rule_block(css: str, selector: str) -> str:
    needle = f"{selector} {{"
    idx = css.find(needle)
    assert idx >= 0, f"Falta la regla CSS {selector!r}"
    return css[idx : css.index("}", idx)]


def test_react_shell_is_the_markup_source():
    jsx = frontend_markup()
    assert "export default function App" in APP_JSX.read_text(encoding="utf-8")
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
    assert "bootApp" in frontend_source()
    assert "initApp" not in main
    assert "StrictMode" not in main


def test_legacy_controller_was_removed():
    assert not LEGACY_JS.exists()
    src = frontend_source()
    assert "export async function bootApp" in src
    assert "export function initApp" not in src


def test_index_serves_react_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")
    served = r.text
    vite = VITE_INDEX.read_text(encoding="utf-8")
    assert 'id="root"' in served or 'id="root"' in vite
    assert 'id="app"' in frontend_markup()
    assert "/src/main.jsx" in vite or "/static/js/main.js" in served


def test_static_bundle_no_longer_exposes_init_app():
    src = frontend_source()
    assert "initImageGallery" in src
    assert "export function initApp" not in src
    assert "bootApp" in src


def test_react_root_fills_viewport_height_chain():
    """Sin #root en la cadena flex, body recorta los tres paneles por la mitad."""
    css = STYLE_CSS.read_text(encoding="utf-8")
    root = _css_rule_block(css, "#root")
    assert "display: flex" in root
    assert "flex-direction: column" in root
    assert "flex: 1" in root
    assert "min-height: 0" in root
    assert "height: 100%" in root
    app = _css_rule_block(css, ".app-shell,\n#app")
    assert "flex: 1" in app
    assert "min-height: 0" in app
    assert "flex-direction: row" in app
