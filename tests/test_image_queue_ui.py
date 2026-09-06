"""Filas de la cola: miniatura, fechas y re-render estable en el poll."""
from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "app" / "static" / "js" / "app.js"
STYLE_CSS = Path(__file__).resolve().parents[1] / "app" / "static" / "css" / "style.css"


def _js() -> str:
    return APP_JS.read_text(encoding="utf-8")


def _fn(js: str, name: str, next_name: str) -> str:
    start = js.index(name)
    end = js.index(next_name, start + 1)
    return js[start:end]


def test_queue_completed_rows_render_lazy_thumbnail():
    js = _js()
    render = _fn(js, "function renderImageQueueList", "function pruneImageQueueSelection")
    assert "renderImageQueueThumb" in render
    thumb = _fn(js, "function renderImageQueueThumb", "function renderImageQueueDates")
    assert 'status === "completed"' in thumb
    assert "result_filename" in thumb
    assert "illustrated-images/" in thumb
    assert 'loading="lazy"' in thumb
    assert "image-queue-thumb" in thumb
    assert "image-queue-thumb--empty" in thumb
    assert 'status === "pending"' not in thumb


def test_queue_rows_show_enqueue_datetime_and_generated_datetime():
    js = _js()
    render = _fn(js, "function renderImageQueueList", "function pruneImageQueueSelection")
    assert "renderImageQueueDates" in render
    dates = _fn(js, "function renderImageQueueDates", "function renderImageQueueList")
    assert "formatDateTime(item.created_at)" in dates
    assert "formatDateTime(item.completed_at)" in dates
    assert "En cola:" in dates
    assert "Generada:" in dates
    assert 'status === "completed"' in dates
    assert "<time" in dates
    assert "hour:" in _fn(js, "function formatDateTime", "function getDefaultConversationTitle")


def test_queue_poll_skips_identical_list_rerender():
    """Reescribir innerHTML cada 2.5s recarga las miniaturas y parpadea."""
    js = _js()
    render = _fn(js, "function renderImageQueueList", "function pruneImageQueueSelection")
    assert "imageQueueListRenderKey" in render
    assert "imageQueueLastRenderKey" in render
    key_fn = _fn(js, "function imageQueueListRenderKey", "function renderImageQueueThumb")
    assert "created_at" in key_fn
    assert "completed_at" in key_fn
    assert "result_filename" in key_fn


def test_queue_thumb_css_is_square_cover():
    css = STYLE_CSS.read_text(encoding="utf-8")
    assert ".image-queue-thumb" in css
    assert ".image-queue-thumb-img" in css
    assert ".image-queue-row-dates" in css
    img = css[css.index(".image-queue-thumb-img") : css.index(".image-queue-thumb-img") + 220]
    assert "object-fit: cover" in img
    main = css[css.index(".image-queue-row-main {") : css.index(".image-queue-row-main {") + 180]
    assert "auto auto 1fr auto" in main
