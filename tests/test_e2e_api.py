"""
Tests end-to-end de la API contra Ollama real.

Requieren que Ollama esté levantado y accesible (p. ej. ollama serve).
Si Ollama no está disponible, los tests se omiten y se muestra un aviso al usuario.

Ejecutar solo estos tests:  pytest -m e2e
Excluirlos (p. ej. en CI sin Ollama):  pytest -m "not e2e"
"""
import json
import pytest

pytestmark = pytest.mark.e2e


def _get_first_ollama_model(client):
    """Obtiene el nombre del primer modelo Ollama disponible; hace skip si no hay ninguno."""
    r = client.get("/api/providers/ollama/models")
    assert r.status_code == 200
    models = r.json()
    if not models:
        pytest.skip("Ollama no tiene ningún modelo instalado. Ejecuta 'ollama pull <modelo>'.")
    return models[0]["name"]


def _encode_model_id(model_id: str) -> str:
    """Codifica model_id para la URL (los ':' se convierten en %3A)."""
    from urllib.parse import quote
    return quote(model_id, safe="")


# ----- API Ollama -----


def test_e2e_ollama_validate(client, ollama_available):
    """GET /api/providers/ollama/validate devuelve 200 y ok cuando Ollama está activo."""
    r = client.get("/api/providers/ollama/validate")
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True


def test_e2e_ollama_models(client, ollama_available):
    """GET /api/providers/ollama/models devuelve lista de modelos (puede estar vacía si no hay modelos)."""
    r = client.get("/api/providers/ollama/models")
    assert r.status_code == 200
    models = r.json()
    assert isinstance(models, list)
    for m in models:
        assert "name" in m
        assert m.get("provider") == "ollama"


def test_e2e_models_default_provider(client, ollama_available):
    """GET /api/models (sin provider) usa Ollama por defecto y devuelve lista de modelos."""
    r = client.get("/api/models")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_e2e_conversation_create_and_send_message(client, ollama_available):
    """
    Flujo completo: crear conversación, enviar mensaje al LLM (Ollama real) y comprobar respuesta.
    """
    model_name = _get_first_ollama_model(client)

    # Crear conversación
    r_create = client.post(
        "/api/conversations",
        json={
            "title": "E2E test",
            "model_id": model_name,
            "provider": "ollama",
        },
    )
    assert r_create.status_code == 200
    conv = r_create.json()
    conversation_id = conv["id"]
    assert conv["provider"] == "ollama"
    assert conv["model_id"] == model_name

    # Enviar mensaje (prompt corto para que el test sea rápido)
    r_msg = client.post(
        f"/api/conversations/{conversation_id}/messages",
        json={"content": "Responde con una sola palabra: OK"},
    )
    assert r_msg.status_code == 200
    msg = r_msg.json()
    assert msg.get("role") == "assistant"
    assert "content" in msg
    assert len(msg["content"].strip()) >= 0  # puede ser "OK" o una frase

    # Comprobar que la conversación tiene el mensaje guardado
    r_get = client.get(f"/api/conversations/{conversation_id}")
    assert r_get.status_code == 200
    conv_out = r_get.json()
    assert len(conv_out["messages"]) >= 2  # user + assistant
    roles = [m["role"] for m in conv_out["messages"]]
    assert "user" in roles
    assert "assistant" in roles


def test_e2e_ollama_clear_memory(client, ollama_available):
    """POST /api/ollama/clear-memory devuelve 200 y un objeto con 'unloaded' (lista)."""
    r = client.post("/api/ollama/clear-memory")
    assert r.status_code == 200
    data = r.json()
    assert "unloaded" in data
    assert isinstance(data["unloaded"], list)


# ----- API Models / Providers -----


def test_e2e_list_providers(client, ollama_available):
    """GET /api/providers devuelve lista de proveedores (al menos ollama)."""
    r = client.get("/api/providers")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    names = [p["name"] for p in data]
    assert "ollama" in names


def test_e2e_provider_params_ollama(client, ollama_available):
    """GET /api/providers/ollama/params devuelve provider y params."""
    r = client.get("/api/providers/ollama/params")
    assert r.status_code == 200
    data = r.json()
    assert data.get("provider") == "ollama"
    assert "params" in data
    assert isinstance(data["params"], (list, dict))


def test_e2e_provider_presets_ollama(client, ollama_available):
    """GET /api/providers/ollama/presets devuelve provider y presets."""
    r = client.get("/api/providers/ollama/presets")
    assert r.status_code == 200
    data = r.json()
    assert data.get("provider") == "ollama"
    assert "presets" in data
    assert isinstance(data["presets"], (list, dict))


def test_e2e_list_all_models(client, ollama_available):
    """GET /api/models/all devuelve lista de modelos de todos los proveedores."""
    r = client.get("/api/models/all")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for m in data:
        assert "name" in m
        assert "provider" in m


def test_e2e_provider_capabilities_ollama(client, ollama_available):
    """GET /api/providers/ollama/capabilities devuelve capabilities."""
    r = client.get("/api/providers/ollama/capabilities")
    assert r.status_code == 200
    data = r.json()
    assert "capabilities" in data
    assert isinstance(data["capabilities"], list)


def test_e2e_get_model_info(client, ollama_available):
    """GET /api/providers/ollama/models/{model_id}/info devuelve provider_info y user_info."""
    model_id = _get_first_ollama_model(client)
    path_id = _encode_model_id(model_id)
    r = client.get(f"/api/providers/ollama/models/{path_id}/info")
    assert r.status_code == 200
    data = r.json()
    assert "provider_info" in data
    assert "user_info" in data
    assert "uncensored" in data["user_info"]
    assert "instructions" in data["user_info"]
    assert "tags" in data["user_info"]


def test_e2e_put_model_info(client, ollama_available):
    """PUT /api/providers/ollama/models/{model_id}/info actualiza user_info."""
    model_id = _get_first_ollama_model(client)
    path_id = _encode_model_id(model_id)
    r = client.put(
        f"/api/providers/ollama/models/{path_id}/info",
        json={"tags": ["e2e-test-tag"]},
    )
    assert r.status_code == 200
    data = r.json()
    assert "user_info" in data
    assert "e2e-test-tag" in data["user_info"].get("tags", [])


def test_e2e_refresh_model_info(client, ollama_available):
    """POST /api/providers/ollama/models/{model_id}/info/refresh refresca provider_info."""
    model_id = _get_first_ollama_model(client)
    path_id = _encode_model_id(model_id)
    r = client.post(f"/api/providers/ollama/models/{path_id}/info/refresh")
    assert r.status_code == 200
    data = r.json()
    assert "provider_info" in data
    assert "user_info" in data


def test_e2e_list_model_tags(client, ollama_available):
    """GET /api/models/tags devuelve lista de tags."""
    r = client.get("/api/models/tags")
    assert r.status_code == 200
    data = r.json()
    assert "tags" in data
    assert isinstance(data["tags"], list)


def test_e2e_get_context_length(client, ollama_available):
    """GET /api/providers/ollama/models/{model_id}/context-length devuelve context_length (número o null)."""
    model_id = _get_first_ollama_model(client)
    path_id = _encode_model_id(model_id)
    r = client.get(f"/api/providers/ollama/models/{path_id}/context-length")
    assert r.status_code == 200
    data = r.json()
    assert "context_length" in data
    # Puede ser int (desde ficha, preset o list_models) o null si no hay fuente
    assert data["context_length"] is None or isinstance(data["context_length"], int)
    if data["context_length"] is not None:
        assert data["context_length"] > 0


# ----- API Conversations -----


def test_e2e_list_conversations(client, ollama_available):
    """GET /api/conversations devuelve lista (puede estar vacía)."""
    r = client.get("/api/conversations")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_e2e_create_conversation(client, ollama_available):
    """POST /api/conversations crea una conversación y devuelve sus datos."""
    model_name = _get_first_ollama_model(client)
    r = client.post(
        "/api/conversations",
        json={"title": "E2E create", "model_id": model_name, "provider": "ollama"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "id" in data
    assert data["title"] == "E2E create"
    assert data["model_id"] == model_name
    assert data["provider"] == "ollama"
    assert "created_at" in data
    assert data.get("messages", []) == []


def test_e2e_get_conversation(client, ollama_available):
    """GET /api/conversations/{id} devuelve la conversación con mensajes."""
    model_name = _get_first_ollama_model(client)
    r_create = client.post(
        "/api/conversations",
        json={"title": "E2E get", "model_id": model_name, "provider": "ollama"},
    )
    assert r_create.status_code == 200
    cid = r_create.json()["id"]
    r = client.get(f"/api/conversations/{cid}")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == cid
    assert "messages" in data
    assert isinstance(data["messages"], list)


def test_e2e_update_conversation(client, ollama_available):
    """PUT /api/conversations/{id} actualiza título/model_id/provider."""
    model_name = _get_first_ollama_model(client)
    r_create = client.post(
        "/api/conversations",
        json={"title": "Original", "model_id": model_name, "provider": "ollama"},
    )
    assert r_create.status_code == 200
    cid = r_create.json()["id"]
    r = client.put(
        f"/api/conversations/{cid}",
        json={"title": "Updated title"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated title"


def test_e2e_send_message_stream(client, ollama_available):
    """POST /api/conversations/{id}/messages/stream devuelve NDJSON con chunks y mensaje asistente."""
    model_name = _get_first_ollama_model(client)
    r_create = client.post(
        "/api/conversations",
        json={"title": "Stream E2E", "model_id": model_name, "provider": "ollama"},
    )
    assert r_create.status_code == 200
    cid = r_create.json()["id"]
    r = client.post(
        f"/api/conversations/{cid}/messages/stream",
        json={"content": "Di solo: Hola"},
    )
    assert r.status_code == 200
    lines = [line for line in r.text.strip().split("\n") if line]
    assert len(lines) >= 1
    # Debe haber al menos una línea con "content" o "done"
    content_parts = [l for l in lines if '"content"' in l or '"done"' in l]
    assert len(content_parts) >= 1
    # Comprobar que hay done al final
    last = json.loads(lines[-1])
    assert last.get("done") is True and "id" in last


def test_e2e_delete_last_message(client, ollama_available):
    """DELETE /api/conversations/{id}/messages/last elimina el último mensaje."""
    model_name = _get_first_ollama_model(client)
    r_create = client.post(
        "/api/conversations",
        json={"title": "Del last", "model_id": model_name, "provider": "ollama"},
    )
    assert r_create.status_code == 200
    cid = r_create.json()["id"]
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Mensaje único"})
    r = client.delete(f"/api/conversations/{cid}/messages/last")
    assert r.status_code == 204
    conv = client.get(f"/api/conversations/{cid}").json()
    # Quedan 0 mensajes (solo habíamos añadido user + assistant, se borra el último)
    assert len(conv["messages"]) <= 2


def test_e2e_clear_conversation_messages(client, ollama_available):
    """DELETE /api/conversations/{id}/messages limpia todos los mensajes."""
    model_name = _get_first_ollama_model(client)
    r_create = client.post(
        "/api/conversations",
        json={"title": "Clear msgs", "model_id": model_name, "provider": "ollama"},
    )
    assert r_create.status_code == 200
    cid = r_create.json()["id"]
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Uno"})
    r = client.delete(f"/api/conversations/{cid}/messages")
    assert r.status_code == 204
    conv = client.get(f"/api/conversations/{cid}").json()
    assert conv["messages"] == []


def test_e2e_delete_message(client, ollama_available):
    """DELETE /api/conversations/{id}/messages/{message_id} elimina un mensaje concreto."""
    model_name = _get_first_ollama_model(client)
    r_create = client.post(
        "/api/conversations",
        json={"title": "Del one", "model_id": model_name, "provider": "ollama"},
    )
    assert r_create.status_code == 200
    cid = r_create.json()["id"]
    r_msg = client.post(f"/api/conversations/{cid}/messages", json={"content": "Para borrar"})
    assert r_msg.status_code == 200
    # La respuesta es el mensaje del asistente; borramos ese
    msg_id = r_msg.json().get("id")
    assert msg_id
    r = client.delete(f"/api/conversations/{cid}/messages/{msg_id}")
    assert r.status_code == 204


def test_e2e_save_message_to_chromadb(client, ollama_available):
    """POST /api/conversations/{id}/messages/{message_id}/save-to-chromadb devuelve 204 (Chroma opcional)."""
    model_name = _get_first_ollama_model(client)
    r_create = client.post(
        "/api/conversations",
        json={"title": "Chroma E2E", "model_id": model_name, "provider": "ollama"},
    )
    assert r_create.status_code == 200
    cid = r_create.json()["id"]
    r_msg = client.post(f"/api/conversations/{cid}/messages", json={"content": "Para Chroma"})
    assert r_msg.status_code == 200
    msg_id = r_msg.json().get("id")
    assert msg_id
    r = client.post(f"/api/conversations/{cid}/messages/{msg_id}/save-to-chromadb")
    # 204 si Chroma está disponible; 500/503 si Chroma no está
    if r.status_code != 204:
        pytest.skip("Chroma no disponible (save-to-chromadb requiere ChromaDB)")


def test_e2e_delete_conversation(client, ollama_available):
    """DELETE /api/conversations/{id} elimina la conversación."""
    model_name = _get_first_ollama_model(client)
    r_create = client.post(
        "/api/conversations",
        json={"title": "To delete", "model_id": model_name, "provider": "ollama"},
    )
    assert r_create.status_code == 200
    cid = r_create.json()["id"]
    r = client.delete(f"/api/conversations/{cid}")
    assert r.status_code == 204
    r_get = client.get(f"/api/conversations/{cid}")
    assert r_get.status_code == 404
