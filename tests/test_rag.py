"""Tests del módulo RAG: add, get_relevant_context, delete_conversation_documents (con mocks)."""
import pytest
from unittest.mock import MagicMock, patch

from app import rag
from app.config import settings


def test_rag_add_message_no_op_sin_config():
    """Sin OPENAI_API_KEY o CHROMA_HOST, add_message no hace nada y no lanza."""
    with patch.object(rag, "settings", MagicMock(openai_api_key="", chroma_host="")):
        rag._chroma_available = None
        rag.add_message("conv-1", "msg-1", "user", "Hola")
    # No excepción
    rag._chroma_available = None


def test_rag_get_relevant_context_vacio_sin_config():
    """Sin config, get_relevant_context devuelve ''."""
    with patch.object(rag, "settings", MagicMock(openai_api_key="", chroma_host="")):
        rag._chroma_available = None
        assert rag.get_relevant_context("conv-1", "pregunta") == ""
    rag._chroma_available = None


def test_rag_delete_conversation_documents_no_op_sin_config():
    """Sin config, delete_conversation_documents no hace nada."""
    with patch.object(rag, "settings", MagicMock(openai_api_key="", chroma_host="")):
        rag._chroma_available = None
        rag.delete_conversation_documents("conv-1")
    rag._chroma_available = None


@patch("app.rag._get_collection")
def test_rag_add_message_llama_add(mock_get_coll):
    """Con colección mockeada, add_message llama a coll.add con ids, documents, metadatas."""
    mock_coll = MagicMock()
    mock_get_coll.return_value = mock_coll
    with patch.object(rag, "settings", MagicMock(openai_api_key="key", chroma_host="http://localhost:8001")):
        rag._chroma_available = True
        rag.add_message("c1", "m1", "user", "Hola mundo")
    mock_coll.add.assert_called_once()
    call = mock_coll.add.call_args
    assert call.kwargs["ids"] == ["m1"]
    assert "Hola" in call.kwargs["documents"][0] and "user" in call.kwargs["documents"][0]
    assert call.kwargs["metadatas"][0]["conversation_id"] == "c1"
    assert call.kwargs["metadatas"][0]["role"] == "user"
    assert call.kwargs["metadatas"][0]["message_id"] == "m1"
    rag._chroma_available = None


@patch("app.rag._get_collection")
def test_rag_get_relevant_context_llama_query(mock_get_coll):
    """Con colección mockeada, get_relevant_context llama a coll.query y devuelve documentos."""
    mock_coll = MagicMock()
    mock_coll.query.return_value = {"documents": [["user: Hola", "assistant: Hola!"]]}
    mock_get_coll.return_value = mock_coll
    with patch.object(rag, "settings", MagicMock(openai_api_key="key", chroma_host="http://localhost:8001")):
        rag._chroma_available = True
        out = rag.get_relevant_context("c1", "qué dijiste?")
    mock_coll.query.assert_called_once()
    call = mock_coll.query.call_args
    assert call.kwargs["where"] == {"conversation_id": "c1"}
    assert out == "user: Hola\n\nassistant: Hola!"
    rag._chroma_available = None


@patch("app.rag._get_collection")
def test_rag_delete_conversation_documents_llama_delete(mock_get_coll):
    """Con colección mockeada, delete_conversation_documents llama a coll.delete(where=...)."""
    mock_coll = MagicMock()
    mock_get_coll.return_value = mock_coll
    with patch.object(rag, "settings", MagicMock(openai_api_key="key", chroma_host="http://localhost:8001")):
        rag._chroma_available = True
        rag.delete_conversation_documents("c1")
    mock_coll.delete.assert_called_once_with(where={"conversation_id": "c1"})
    rag._chroma_available = None


@patch("app.rag._get_collection")
def test_rag_get_relevant_context_filtra_por_camino(mock_get_coll):
    mock_coll = MagicMock()
    mock_coll.query.return_value = {
        "ids": [["m-rama", "m-camino"]],
        "documents": [["otra rama", "este intento"]],
    }
    mock_get_coll.return_value = mock_coll
    with patch.object(rag, "settings", MagicMock(openai_api_key="key", chroma_host="http://localhost:8001")):
        rag._chroma_available = True
        out = rag.get_relevant_context("c1", "pregunta", allowed_message_ids={"m-camino"})
    assert out == "este intento"
    rag._chroma_available = None


@patch("app.rag._get_collection")
def test_rag_get_relevant_context_consulta_varios_conversation_id(mock_get_coll):
    mock_coll = MagicMock()
    mock_coll.query.return_value = {"documents": [["doc origen"]]}
    mock_get_coll.return_value = mock_coll
    with patch.object(rag, "settings", MagicMock(openai_api_key="key", chroma_host="http://localhost:8001")):
        rag._chroma_available = True
        out = rag.get_relevant_context("c-hija", "pregunta", conversation_ids={"c-origen", "c-hija"})
    where = mock_coll.query.call_args.kwargs["where"]
    ids = {item["conversation_id"] for item in where["$or"]}
    assert ids == {"c-origen", "c-hija"}
    assert out == "doc origen"
    rag._chroma_available = None


@patch("app.rag._get_collection")
def test_rag_get_relevant_context_camino_vacio_no_consulta(mock_get_coll):
    mock_coll = MagicMock()
    mock_get_coll.return_value = mock_coll
    with patch.object(rag, "settings", MagicMock(openai_api_key="key", chroma_host="http://localhost:8001")):
        rag._chroma_available = True
        out = rag.get_relevant_context("c1", "pregunta", allowed_message_ids=set())
    mock_coll.query.assert_not_called()
    assert out == ""
    rag._chroma_available = None
