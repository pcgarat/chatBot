from typing import Any

from ollama import Client

from app.config import settings

_client: Client | None = None


def get_ollama_client() -> Client:
    global _client
    if _client is None:
        _client = Client(host=settings.ollama_host)
    return _client


def list_models() -> list[str]:
    """Lista los nombres de los modelos disponibles en Ollama."""
    try:
        client = get_ollama_client()
        response = client.list()
        names = [m["name"] for m in response.get("models", [])]
        # Los nombres pueden venir como "llama3.2:latest"; devolvemos tal cual para el selector
        return names
    except Exception:
        raise


def chat(model: str, messages: list[dict[str, Any]]) -> str:
    """
    Envía la lista de mensajes a Ollama y devuelve el contenido de la respuesta del asistente.
    messages: lista de dicts con "role" y "content" (ej. {"role": "system", "content": "..."}).
    """
    try:
        client = get_ollama_client()
        response = client.chat(model=model, messages=messages)
        content = response.get("message", {}).get("content", "")
        return content or ""
    except Exception:
        raise
