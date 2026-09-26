"""Contrato del SPA publicado en app/static: es lo que sirve el puerto 8000.

El resto de tests de UI leen las fuentes de frontend/src, así que no detectan que el
build publicado se haya quedado atrás. Estos tests miran el artefacto realmente servido.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "app" / "static"
INDEX_HTML = STATIC_DIR / "index.html"
BUNDLE_JS = STATIC_DIR / "js" / "main.js"
FRONTEND_SRC = ROOT / "frontend" / "src"

EXPORTA_COMPONENTE = re.compile(r"^export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z]\w*)", re.M)
IMPORTA_NOMBRES = re.compile(r"\bimport\s+(?:[\w*\s{},]+)\s+from\s+[\"']", re.M)


def _fuentes_jsx():
    for path in sorted(FRONTEND_SRC.rglob("*.jsx")):
        if ".test." not in path.name:
            yield path


def componentes_react():
    """Componentes exportados desde .jsx que además son importados por alguien.

    Los que nadie importa quedan fuera: Rollup los elimina por tree-shaking y su
    ausencia del bundle no indica que el build esté desfasado.
    """
    importados = set()
    for path in FRONTEND_SRC.rglob("*.js*"):
        if path.suffix in {".js", ".jsx"}:
            for bloque in IMPORTA_NOMBRES.findall(path.read_text(encoding="utf-8")):
                importados.update(re.findall(r"[A-Z]\w*", bloque))

    for path in _fuentes_jsx():
        for nombre in EXPORTA_COMPONENTE.findall(path.read_text(encoding="utf-8")):
            if nombre in importados:
                yield nombre, path.relative_to(ROOT)


def test_index_publicado_monta_el_spa_react():
    html = INDEX_HTML.read_text(encoding="utf-8")
    assert '<div id="root">' in html
    assert "/static/js/main.js" in html
    assert "/static/css/style.css" in html


def test_bundle_publicado_contiene_los_componentes_react_actuales():
    """El bundle servido debe incluir todos los componentes de frontend/src/ui.

    Los nombres sobreviven a la minificación porque vite.config.js fija keepNames.
    """
    bundle = BUNDLE_JS.read_text(encoding="utf-8", errors="ignore")
    ausentes = [str(rel) for nombre, rel in componentes_react() if nombre not in bundle]
    assert not ausentes, (
        "El SPA publicado en app/static está desfasado respecto a frontend/src. "
        f"Componentes ausentes del bundle: {ausentes}. Ejecuta 'make frontend-build'."
    )


def test_la_raiz_sirve_el_spa_react(client):
    r = client.get("/")
    assert r.status_code == 200
    assert '<div id="root">' in r.text
    assert "/static/js/main.js" in r.text
