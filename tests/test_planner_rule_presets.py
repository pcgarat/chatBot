"""CRUD de presets de reglas del planificador."""
from app.services.planner_rule_presets.service import (
    PlannerRulePresetService,
    PresetNameConflict,
)
from app.services.planner_rule_presets.snapshot import normalize_rule_preset_snapshot
from app.services.planner_rule_presets.storage import SqlAlchemyPlannerRulePresetRepository


def _payload(**overrides):
    base = {
        "name": "Flux nocturno",
        "snapshot": {
            "rules": [
                {"title": "Luz", "content": "Nocturna", "rule_id": "pr1"},
                {"title": "Estilo", "content": "cinematic"},
            ]
        },
    }
    base.update(overrides)
    return base


def test_normalize_rule_preset_keeps_rule_ids_and_drops_chrome():
    out = normalize_rule_preset_snapshot(
        {
            "rules": [{"title": "Luz", "content": "Nocturna", "rule_id": "pr1"}],
            "darkMode": True,
            "enabled": True,
        }
    )
    assert out == {
        "rules": [{"title": "Luz", "content": "Nocturna", "rule_id": "pr1"}]
    }


def test_normalize_rule_preset_accepts_legacy_string():
    out = normalize_rule_preset_snapshot({"rules": "plan well"})
    assert out["rules"] == [{"title": "Instrucciones", "content": "plan well"}]


def test_normalize_rule_preset_accepts_bare_list_or_invalid():
    assert normalize_rule_preset_snapshot(
        [{"title": "Luz", "content": "Nocturna", "rule_id": "pr1"}]
    ) == {"rules": [{"title": "Luz", "content": "Nocturna", "rule_id": "pr1"}]}
    assert normalize_rule_preset_snapshot("no-dict") == {"rules": []}


def test_normalize_rule_preset_allows_empty_selection():
    assert normalize_rule_preset_snapshot({"rules": []}) == {"rules": []}


def test_planner_rule_presets_are_in_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/planner-rule-presets" in paths
    assert "get" in paths["/api/planner-rule-presets"]
    assert "post" in paths["/api/planner-rule-presets"]
    assert "/api/planner-rule-presets/{preset_id}" in paths


def test_create_list_get_update_delete_preset(client):
    created = client.post("/api/planner-rule-presets", json=_payload())
    assert created.status_code == 201
    data = created.json()
    assert data["name"] == "Flux nocturno"
    assert data["snapshot"]["rules"][0]["rule_id"] == "pr1"
    preset_id = data["id"]

    listed = client.get("/api/planner-rule-presets")
    assert listed.status_code == 200
    assert any(item["id"] == preset_id for item in listed.json())

    got = client.get(f"/api/planner-rule-presets/{preset_id}")
    assert got.status_code == 200
    assert got.json()["snapshot"]["rules"][1]["content"] == "cinematic"

    updated = client.put(
        f"/api/planner-rule-presets/{preset_id}",
        json={
            "name": "Flux nocturno v2",
            "snapshot": {"rules": [{"title": "POV", "content": "cámara al hombro"}]},
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Flux nocturno v2"
    assert len(updated.json()["snapshot"]["rules"]) == 1

    deleted = client.delete(f"/api/planner-rule-presets/{preset_id}")
    assert deleted.status_code == 204
    missing = client.get(f"/api/planner-rule-presets/{preset_id}")
    assert missing.status_code == 404


def test_create_preset_duplicate_name_conflict(client):
    payload = _payload(name="Mismo")
    assert client.post("/api/planner-rule-presets", json=payload).status_code == 201
    again = client.post("/api/planner-rule-presets", json=_payload(name="mismo"))
    assert again.status_code == 409


def test_create_preset_rejects_empty_name(client):
    r = client.post("/api/planner-rule-presets", json=_payload(name="  "))
    assert r.status_code == 400


def test_service_name_conflict_on_rename(db_session):
    repo = SqlAlchemyPlannerRulePresetRepository(db_session)
    service = PlannerRulePresetService(repo)
    a = service.create_preset("Alpha", {"rules": []})
    service.create_preset("Beta", {"rules": []})
    try:
        service.update_preset(a.id, name="beta")
    except PresetNameConflict:
        return
    raise AssertionError("Renombrar a un nombre ocupado debía fallar")
