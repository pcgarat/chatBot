"""Tests de códigos de estado para la barra inferior."""

from app.services.image_illustration.status_codes import (
    IMAGES_PLANNING,
    status_event,
)


def test_status_event_shape():
    ev = status_event(IMAGES_PLANNING, "Planificando escenas", index=1, total=2)
    assert ev.type == "status"
    assert ev.message == "Planificando escenas"
    d = ev.to_dict()
    assert d["type"] == "status"
    assert d["data"]["code"] == IMAGES_PLANNING
    assert d["data"]["index"] == 1
    assert d["data"]["total"] == 2
