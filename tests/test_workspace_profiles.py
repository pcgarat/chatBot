"""Normalización y CRUD de perfiles de workspace."""
from app.services.workspace_profiles.service import (
    ProfileNameConflict,
    WorkspaceProfileService,
)
from app.services.workspace_profiles.snapshot import (
    SnapshotValidationError,
    normalize_profile_name,
    normalize_snapshot,
)
from app.services.workspace_profiles.storage import SqlAlchemyWorkspaceProfileRepository


def _minimal_snapshot(**overrides):
    base = {
        "provider": "ollama",
        "model_id": "llama3.2",
        "model_params": {"temperature": 0.4},
        "params_excluded": ["seed"],
        "history_turns": 7,
        "system_instructions": [{"title": "Tono", "content": "Sé breve", "rule_id": "r1"}],
        "images": {
            "enabled": True,
            "use_chat_config": False,
            "images_per_response": 3,
            "batch_size": 8,
            "retries": 2,
            "prompt": "cinematic",
            "prompt_system_instructions": "plan well",
            "prompt_provider": "ollama",
            "prompt_model": "qwen",
            "debug": True,
            "darkMode": True,
            "steps": 28,
            "width": 768,
            "height": 1024,
            "seed": -1,
        },
        "font_size": 2,
    }
    base.update(overrides)
    return base


def test_normalize_snapshot_keeps_rig_and_drops_chrome():
    out = normalize_snapshot(_minimal_snapshot())
    assert out["provider"] == "ollama"
    assert out["model_id"] == "llama3.2"
    assert out["model_params"]["temperature"] == 0.4
    assert out["params_excluded"] == ["seed"]
    assert out["history_turns"] == 7
    assert out["system_instructions"][0]["rule_id"] == "r1"
    assert out["images"]["enabled"] is True
    assert out["images"]["prompt"] == "cinematic"
    assert out["images"]["steps"] == 28
    assert out["images"]["width"] == 768
    assert out["images"]["height"] == 1024
    assert out["images"]["seed"] == -1
    assert out["images"]["prompt_system_instructions"] == [
        {"title": "Instrucciones", "content": "plan well"}
    ]
    assert "debug" not in out["images"]
    assert "darkMode" not in out["images"]
    assert "font_size" not in out


def test_normalize_snapshot_keeps_planner_rule_list():
    raw = _minimal_snapshot()
    raw["images"]["prompt_system_instructions"] = [
        {"title": "Luz", "content": "Nocturna", "rule_id": "pr1"}
    ]
    out = normalize_snapshot(raw)
    assert out["images"]["prompt_system_instructions"][0]["rule_id"] == "pr1"
    assert out["images"]["prompt_system_instructions"][0]["content"] == "Nocturna"


def test_normalize_snapshot_requires_model():
    try:
        normalize_snapshot({"provider": "ollama", "model_id": "  "})
    except SnapshotValidationError as exc:
        assert "modelo" in str(exc).lower()
    else:
        raise AssertionError("Debía fallar sin modelo")


def test_normalize_profile_name_strips_and_rejects_empty():
    assert normalize_profile_name("  Relato   faro  ") == "Relato faro"
    try:
        normalize_profile_name("   ")
    except SnapshotValidationError:
        pass
    else:
        raise AssertionError("Nombre vacío debía fallar")


def test_workspace_profiles_are_in_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/workspace-profiles" in paths
    assert "get" in paths["/api/workspace-profiles"]
    assert "post" in paths["/api/workspace-profiles"]
    assert "/api/workspace-profiles/{profile_id}" in paths


def test_create_list_get_update_delete_profile(client):
    payload = {"name": "Relato faro", "snapshot": _minimal_snapshot()}
    created = client.post("/api/workspace-profiles", json=payload)
    assert created.status_code == 201
    data = created.json()
    assert data["name"] == "Relato faro"
    assert data["snapshot"]["images"]["enabled"] is True
    assert "debug" not in data["snapshot"]["images"]
    profile_id = data["id"]

    listed = client.get("/api/workspace-profiles")
    assert listed.status_code == 200
    assert any(item["id"] == profile_id for item in listed.json())

    got = client.get(f"/api/workspace-profiles/{profile_id}")
    assert got.status_code == 200
    assert got.json()["snapshot"]["history_turns"] == 7

    updated = client.put(
        f"/api/workspace-profiles/{profile_id}",
        json={"name": "Relato faro v2", "snapshot": _minimal_snapshot(history_turns=3)},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Relato faro v2"
    assert updated.json()["snapshot"]["history_turns"] == 3

    deleted = client.delete(f"/api/workspace-profiles/{profile_id}")
    assert deleted.status_code == 204
    missing = client.get(f"/api/workspace-profiles/{profile_id}")
    assert missing.status_code == 404


def test_create_profile_duplicate_name_conflict(client):
    payload = {"name": "Mismo", "snapshot": _minimal_snapshot()}
    assert client.post("/api/workspace-profiles", json=payload).status_code == 201
    again = client.post("/api/workspace-profiles", json={"name": "mismo", "snapshot": _minimal_snapshot()})
    assert again.status_code == 409


def test_create_profile_rejects_empty_name(client):
    r = client.post("/api/workspace-profiles", json={"name": "  ", "snapshot": _minimal_snapshot()})
    assert r.status_code == 400


def test_service_name_conflict_on_rename(db_session):
    repo = SqlAlchemyWorkspaceProfileRepository(db_session)
    service = WorkspaceProfileService(repo)
    a = service.create_profile("Alpha", _minimal_snapshot())
    service.create_profile("Beta", _minimal_snapshot())
    try:
        service.update_profile(a.id, name="beta")
    except ProfileNameConflict:
        return
    raise AssertionError("Renombrar a un nombre ocupado debía fallar")
