"""Tests de los endpoints de conversaciones y mensajes."""
import pytest
from unittest.mock import patch, MagicMock

from app.routers.api_conversations import _build_llm_messages


def _mock_conv(system_instruction_global="Instrucciones"):
    """Convierte objeto con system_instruction_global."""
    c = MagicMock()
    c.system_instruction_global = system_instruction_global
    return c


def _mock_msg(role: str, content: str):
    """Objeto mensaje con role y content."""
    m = MagicMock()
    m.role = role
    m.content = content
    return m


@patch("app.routers.api_conversations.settings")
def test_build_llm_messages_estructura_basica(mock_settings):
    """Estructura: system, historial (si hay), user con prompt actual."""
    mock_settings.ollama_history_turns = 10
    conv = _mock_conv("Global.")
    existing = []
    msgs, _ = _build_llm_messages(conv, existing, "Hola", None, rag_context=None)
    assert len(msgs) >= 1
    assert msgs[-1]["role"] == "user"
    assert msgs[-1]["content"] == "Hola"
    assert msgs[0]["role"] == "system"
    assert "Global." in msgs[0]["content"]


@patch("app.routers.api_conversations.settings")
def test_build_llm_messages_incluye_historial_orden_cronologico(mock_settings):
    """El historial va de más antiguo a más nuevo antes del prompt actual."""
    mock_settings.ollama_history_turns = 2
    conv = _mock_conv("Global.")
    existing = [
        _mock_msg("user", "M1"),
        _mock_msg("assistant", "R1"),
        _mock_msg("user", "M2"),
        _mock_msg("assistant", "R2"),
    ]
    msgs, _ = _build_llm_messages(conv, existing, "M3", None, rag_context=None)
    # system, user, assistant, user, assistant, user (actual)
    assert msgs[0]["role"] == "system"
    assert msgs[1]["role"] == "user" and msgs[1]["content"] == "M1"
    assert msgs[2]["role"] == "assistant" and msgs[2]["content"] == "R1"
    assert msgs[3]["role"] == "user" and msgs[3]["content"] == "M2"
    assert msgs[4]["role"] == "assistant" and msgs[4]["content"] == "R2"
    assert msgs[5]["role"] == "user" and msgs[5]["content"] == "M3"


@patch("app.routers.api_conversations.settings")
def test_build_llm_messages_limita_ultimos_n_pares(mock_settings):
    """Solo se envían los últimos N pares (N=2 => 4 mensajes de historial)."""
    mock_settings.ollama_history_turns = 2
    conv = _mock_conv("Global.")
    existing = [
        _mock_msg("user", "M1"),
        _mock_msg("assistant", "R1"),
        _mock_msg("user", "M2"),
        _mock_msg("assistant", "R2"),
        _mock_msg("user", "M3"),
        _mock_msg("assistant", "R3"),
    ]
    msgs, _ = _build_llm_messages(conv, existing, "M4", None, rag_context=None)
    # system + 4 historial (M2,R2,M3,R3) + 1 actual = 6 mensajes + system
    hist = [m for m in msgs if m["role"] in ("user", "assistant")]
    assert len(hist) == 5  # 4 historial + 1 actual
    assert hist[0]["content"] == "M2"
    assert hist[1]["content"] == "R2"
    assert hist[2]["content"] == "M3"
    assert hist[3]["content"] == "R3"
    assert hist[4]["content"] == "M4"


@patch("app.routers.api_conversations.settings")
def test_build_llm_messages_sin_historial_cuando_turns_0(mock_settings):
    """Si ollama_history_turns=0, no se envía historial."""
    mock_settings.ollama_history_turns = 0
    conv = _mock_conv("Global.")
    existing = [
        _mock_msg("user", "M1"),
        _mock_msg("assistant", "R1"),
    ]
    msgs, _ = _build_llm_messages(conv, existing, "M2", None, rag_context=None)
    assert len(msgs) == 2  # system + user actual
    assert msgs[-1]["content"] == "M2"


@patch("app.routers.api_conversations.settings")
def test_build_llm_messages_menos_de_n_pares_envia_todos(mock_settings):
    """Si hay menos mensajes que N pares, se envían todos."""
    mock_settings.ollama_history_turns = 10
    conv = _mock_conv("Global.")
    existing = [
        _mock_msg("user", "M1"),
        _mock_msg("assistant", "R1"),
    ]
    msgs, _ = _build_llm_messages(conv, existing, "M2", None, rag_context=None)
    hist = [m for m in msgs if m["role"] in ("user", "assistant")]
    assert len(hist) == 3  # M1, R1, M2
    assert hist[0]["content"] == "M1"
    assert hist[1]["content"] == "R1"
    assert hist[2]["content"] == "M2"


def test_create_conversation(client):
    r = client.post(
        "/api/conversations",
        json={
            "title": "Mi chat",
            "model_id": "llama3.2",
            "system_instruction_global": "Responde breve.",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Mi chat"
    assert data["model_id"] == "llama3.2"
    assert data["system_instruction_global"] == "Responde breve."
    assert "id" in data
    assert data["messages"] == []


def test_create_conversation_defaults(client):
    r = client.post("/api/conversations", json={})
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Nueva conversación"
    assert data["model_id"] == "llama3.2"
    assert data["system_instruction_global"] is None


def test_list_conversations_empty(client):
    r = client.get("/api/conversations")
    assert r.status_code == 200
    assert r.json() == []


def test_list_conversations_after_create(client):
    client.post("/api/conversations", json={"title": "A", "model_id": "m1"})
    client.post("/api/conversations", json={"title": "B", "model_id": "m2"})
    r = client.get("/api/conversations")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    titles = [c["title"] for c in data]
    assert "A" in titles and "B" in titles


def test_get_conversation_404(client):
    r = client.get("/api/conversations/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert "no encontrada" in r.json()["detail"].lower()


def test_get_conversation_ok(client):
    create = client.post("/api/conversations", json={"title": "Test", "model_id": "m"})
    cid = create.json()["id"]
    r = client.get(f"/api/conversations/{cid}")
    assert r.status_code == 200
    assert r.json()["title"] == "Test"
    assert r.json()["messages"] == []
    assert "model_params" in r.json()
    assert r.json()["model_params"] is None


def test_update_conversation_ok(client):
    create = client.post("/api/conversations", json={"title": "Antes", "model_id": "m1"})
    cid = create.json()["id"]
    r = client.put(
        f"/api/conversations/{cid}",
        json={"title": "Después", "model_id": "m2", "system_instruction_global": "Sé breve."},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "Después"
    assert data["model_id"] == "m2"
    assert data["system_instruction_global"] == "Sé breve."


def test_update_and_get_conversation_model_params(client):
    create = client.post("/api/conversations", json={"title": "Params", "model_id": "m"})
    cid = create.json()["id"]
    params = {"temperature": 0.7, "num_ctx": 4096}
    r = client.put(f"/api/conversations/{cid}", json={"model_params": params})
    assert r.status_code == 200
    assert r.json()["model_params"] == params
    get_r = client.get(f"/api/conversations/{cid}")
    assert get_r.status_code == 200
    assert get_r.json()["model_params"] == params


def test_conversation_system_instructions(client):
    """Crear y actualizar conversación con system_instructions (lista de reglas con título y contenido)."""
    create = client.post(
        "/api/conversations",
        json={
            "title": "Reglas",
            "model_id": "m",
            "system_instructions": [
                {"title": "R1", "content": "Regla A"},
                {"title": "R2", "content": "Regla B"},
            ],
        },
    )
    assert create.status_code == 200
    data = create.json()
    assert data.get("system_instructions") == [
        {"title": "R1", "content": "Regla A"},
        {"title": "R2", "content": "Regla B"},
    ]
    cid = data["id"]
    r = client.put(
        f"/api/conversations/{cid}",
        json={"system_instructions": [{"title": "Solo", "content": "Solo una"}]},
    )
    assert r.status_code == 200
    assert r.json()["system_instructions"] == [{"title": "Solo", "content": "Solo una"}]
    get_r = client.get(f"/api/conversations/{cid}")
    assert get_r.json()["system_instructions"] == [{"title": "Solo", "content": "Solo una"}]


def test_update_conversation_404(client):
    r = client.put(
        "/api/conversations/00000000-0000-0000-0000-000000000000",
        json={"title": "X"},
    )
    assert r.status_code == 404


def test_delete_conversation_ok(client):
    create = client.post("/api/conversations", json={"title": "Borrar", "model_id": "m"})
    cid = create.json()["id"]
    r = client.delete(f"/api/conversations/{cid}")
    assert r.status_code == 204
    get_r = client.get(f"/api/conversations/{cid}")
    assert get_r.status_code == 404


def test_delete_conversation_404(client):
    r = client.delete("/api/conversations/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


@patch("app.routers.api_conversations.get_provider")
def test_clear_conversation_messages(mock_get_provider, client):
    """Limpiar historial borra mensajes pero mantiene la conversación y sus instrucciones."""
    mock_provider = MagicMock()
    mock_provider.chat.return_value = "Respuesta."
    mock_get_provider.return_value = mock_provider
    create = client.post(
        "/api/conversations",
        json={"title": "Conv", "model_id": "m", "system_instruction_global": "Mis instrucciones."},
    )
    cid = create.json()["id"]
    # Enviar un mensaje
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Hola"})
    # Verificar que hay mensajes
    conv = client.get(f"/api/conversations/{cid}").json()
    assert len(conv["messages"]) == 2
    # Limpiar historial
    r = client.delete(f"/api/conversations/{cid}/messages")
    assert r.status_code == 204
    # Verificar que no hay mensajes pero sí conversación con instrucciones
    conv = client.get(f"/api/conversations/{cid}").json()
    assert len(conv["messages"]) == 0
    assert conv["system_instruction_global"] == "Mis instrucciones."
    assert conv["title"] == "Conv"


def test_clear_conversation_messages_404(client):
    r = client.delete("/api/conversations/00000000-0000-0000-0000-000000000000/messages")
    assert r.status_code == 404


@patch("app.routers.api_conversations.get_provider")
@patch("app.routers.api_conversations.rag.delete_message_document")
def test_delete_last_message_204(mock_rag_delete, mock_get_provider, client):
    """DELETE last mensaje devuelve 204 y elimina el último mensaje."""
    mock_provider = MagicMock()
    mock_provider.chat.return_value = "Respuesta"
    mock_get_provider.return_value = mock_provider
    create = client.post("/api/conversations", json={"title": "Conv", "model_id": "m"})
    cid = create.json()["id"]
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Uno"})
    r = client.delete(f"/api/conversations/{cid}/messages/last")
    assert r.status_code == 204
    conv = client.get(f"/api/conversations/{cid}").json()
    # Solo queda el mensaje user; el último (assistant) fue eliminado
    assert len(conv["messages"]) == 1
    assert conv["messages"][0]["role"] == "user"
    assert conv["messages"][0]["content"] == "Uno"


def test_delete_last_message_404(client):
    """DELETE last cuando no hay mensajes devuelve 404."""
    create = client.post("/api/conversations", json={"title": "Conv", "model_id": "m"})
    cid = create.json()["id"]
    r = client.delete(f"/api/conversations/{cid}/messages/last")
    assert r.status_code == 404
    assert "no hay mensajes" in r.json()["detail"].lower()


@patch("app.routers.api_conversations.get_provider")
@patch("app.routers.api_conversations.rag.delete_message_document")
def test_delete_message_by_id_204(mock_rag_delete, mock_get_provider, client):
    """DELETE message por id devuelve 204 y elimina ese mensaje."""
    mock_provider = MagicMock()
    mock_provider.chat.return_value = "Respuesta"
    mock_get_provider.return_value = mock_provider
    create = client.post("/api/conversations", json={"title": "Conv", "model_id": "m"})
    cid = create.json()["id"]
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Uno"})
    conv = client.get(f"/api/conversations/{cid}").json()
    msg_id = conv["messages"][0]["id"]
    r = client.delete(f"/api/conversations/{cid}/messages/{msg_id}")
    assert r.status_code == 204
    conv2 = client.get(f"/api/conversations/{cid}").json()
    # Queda solo el mensaje assistant
    assert len(conv2["messages"]) == 1
    assert conv2["messages"][0]["role"] == "assistant"
    mock_rag_delete.assert_called_once_with(cid, msg_id)


def test_delete_message_by_id_404(client):
    """DELETE message con id inexistente devuelve 404."""
    create = client.post("/api/conversations", json={"title": "Conv", "model_id": "m"})
    cid = create.json()["id"]
    r = client.delete(f"/api/conversations/{cid}/messages/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert "mensaje" in r.json()["detail"].lower()


@patch("app.routers.api_conversations.settings")
def test_build_llm_messages_incluye_rag_context(mock_settings):
    """Si hay rag_context se incluye en el system message."""
    mock_settings.ollama_history_turns = 10
    conv = _mock_conv("Global.")
    msgs, _ = _build_llm_messages(
        conv, [], "Hola", None, system_instruction_global=None, rag_context="Contexto RAG aquí."
    )
    assert msgs[0]["role"] == "system"
    assert "Contexto relevante del historial" in msgs[0]["content"]
    assert "Contexto RAG aquí." in msgs[0]["content"]
    assert "Global." in msgs[0]["content"]


@patch("app.routers.api_conversations.get_provider")
def test_send_message_ok(mock_get_provider, client):
    mock_provider = MagicMock()
    mock_provider.chat.return_value = "Hola, soy el asistente."
    mock_get_provider.return_value = mock_provider
    create = client.post("/api/conversations", json={"title": "Chat", "model_id": "llama3.2"})
    cid = create.json()["id"]

    r = client.post(
        f"/api/conversations/{cid}/messages",
        json={"content": "Hola", "instruction_override": None},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["role"] == "assistant"
    assert data["content"] == "Hola, soy el asistente."
    mock_provider.chat.assert_called_once()
    call_messages = mock_provider.chat.call_args[0][1]
    assert call_messages[-1]["role"] == "user"
    assert call_messages[-1]["content"] == "Hola"

    # Historial: la conversación tiene 2 mensajes (user + assistant)
    get_conv = client.get(f"/api/conversations/{cid}")
    assert len(get_conv.json()["messages"]) == 2
    assert get_conv.json()["messages"][0]["content"] == "Hola"
    assert get_conv.json()["messages"][1]["content"] == "Hola, soy el asistente."


@patch("app.routers.api_conversations.get_provider")
def test_send_message_with_instruction_override(mock_get_provider, client):
    mock_provider = MagicMock()
    mock_provider.chat.return_value = "Respuesta breve."
    mock_get_provider.return_value = mock_provider
    create = client.post(
        "/api/conversations",
        json={"title": "Chat", "model_id": "m", "system_instruction_global": "Global."},
    )
    cid = create.json()["id"]

    r = client.post(
        f"/api/conversations/{cid}/messages",
        json={"content": "Dime algo", "instruction_override": "Responde en una frase."},
    )
    assert r.status_code == 200
    call_messages = mock_provider.chat.call_args[0][1]
    # Debe haber un mensaje system con global + override
    assert call_messages[0]["role"] == "system"
    assert "Global." in call_messages[0]["content"]
    assert "Responde en una frase." in call_messages[0]["content"]
    # El mensaje del usuario no debe contener la instrucción visible
    assert call_messages[-1]["content"] == "Dime algo"


def test_send_message_404(client):
    r = client.post(
        "/api/conversations/00000000-0000-0000-0000-000000000000/messages",
        json={"content": "Hola"},
    )
    assert r.status_code == 404


def test_send_message_content_required(client):
    create = client.post("/api/conversations", json={"title": "C", "model_id": "m"})
    cid = create.json()["id"]
    r = client.post(f"/api/conversations/{cid}/messages", json={"content": ""})
    assert r.status_code == 422


@patch("app.routers.api_conversations.get_provider")
def test_send_message_provider_error(mock_get_provider, client):
    mock_provider = MagicMock()
    mock_provider.chat.side_effect = ConnectionError("Connection refused")
    mock_get_provider.return_value = mock_provider
    create = client.post("/api/conversations", json={"title": "C", "model_id": "m"})
    cid = create.json()["id"]
    r = client.post(f"/api/conversations/{cid}/messages", json={"content": "Hola"})
    assert r.status_code == 502
    assert "ollama" in r.json()["detail"].lower()


@patch("app.routers.api_conversations.rag.add_message")
@patch("app.routers.api_conversations.rag.get_relevant_context")
@patch("app.routers.api_conversations.get_provider")
def test_send_message_calls_rag_get_context_and_add(mock_get_provider, mock_rag_context, mock_rag_add, client):
    """Al enviar un mensaje se llama a get_relevant_context y a add_message solo para el mensaje user."""
    mock_provider = MagicMock()
    mock_provider.chat.return_value = "Respuesta."
    mock_get_provider.return_value = mock_provider
    mock_rag_context.return_value = ""
    create = client.post("/api/conversations", json={"title": "RAG", "model_id": "m"})
    cid = create.json()["id"]
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Hola"})
    mock_rag_context.assert_called_once()
    assert mock_rag_context.call_args[0][0] == cid
    assert mock_rag_context.call_args[0][1] == "Hola"
    # add_message solo para el mensaje del usuario (no se guardan respuestas del asistente)
    mock_rag_add.assert_called_once()
    assert mock_rag_add.call_args[0][2] == "user"


@patch("app.routers.api_conversations.rag.delete_conversation_documents")
def test_delete_conversation_calls_rag_delete_documents(mock_rag_delete, client):
    """Al eliminar una conversación se llama a delete_conversation_documents."""
    create = client.post("/api/conversations", json={"title": "Borrar RAG", "model_id": "m"})
    cid = create.json()["id"]
    client.delete(f"/api/conversations/{cid}")
    mock_rag_delete.assert_called_once_with(cid)
