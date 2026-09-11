"""UI: parámetros Forge en el panel Imágenes."""
from tests.frontend_source import frontend_markup, frontend_source

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_images_panel_has_forge_param_controls():
    html = frontend_markup()
    images = html.split('id="tab-imagenes"')[1].split('id="tab-preferencias"')[0]
    assert 'id="images-forge-steps"' in images
    assert 'id="images-forge-width"' in images
    assert 'id="images-forge-height"' in images
    assert 'id="images-forge-seed"' in images
    assert 'id="btn-images-forge-reload-params"' in images
    assert "Parámetros Forge" in images


def test_js_sends_forge_params_on_illustrate_and_remaining():
    js = frontend_source()
    illustrate = js.split("async function maybeIllustrateAssistantMessage")[1].split(
        "async function generateRemainingImages"
    )[0]
    remaining = js.split("async function generateRemainingImages")[1].split(
        "async function illustrateAtParagraph"
    )[0]
    assert "readForgePanelParams()" in illustrate
    assert "readForgePanelParams()" in remaining
    at_fn = js.split("async function illustrateAtParagraph")[1].split(
        "async function runIllustrationStream"
    )[0]
    assert "readForgePanelParams()" in at_fn
    assert "/forge/last-generation-params" in js
    assert "function reloadForgeParamsFromLastGen" in js
