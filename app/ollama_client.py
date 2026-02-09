import json
import sys
from collections.abc import Iterator
from typing import Any

from ollama import Client

from app.config import settings


def _dump_sent_to_ollama(model: str, messages: list[dict[str, Any]]) -> None:
    """Si verbose está activo, imprime en stderr el payload tal cual se envía a Ollama."""
    if not settings.verbose:
        return
    payload = {"model": model, "messages": messages}
    print("--- enviado a Ollama ---", file=sys.stderr)
    print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
    print("--- fin ---", file=sys.stderr)

_client: Client | None = None


def get_ollama_client() -> Client:
    global _client
    if _client is None:
        _client = Client(host=settings.ollama_host)
    return _client


def _model_name(m: Any) -> str:
    """Extrae el nombre del modelo tanto si es un objeto (atributo model) como un dict."""
    if hasattr(m, "model"):
        return getattr(m, "model", "") or ""
    return m.get("model") or m.get("name") or ""


def list_models() -> list[str]:
    """Lista los nombres de los modelos disponibles en Ollama."""
    try:
        client = get_ollama_client()
        response = client.list()
        models = response.get("models", []) if isinstance(response, dict) else getattr(response, "models", [])
        names = [_model_name(m) for m in models if _model_name(m)]
        return names
    except Exception:
        raise


def chat(model: str, messages: list[dict[str, Any]]) -> str:
    """
    Envía la lista de mensajes a Ollama y devuelve el contenido de la respuesta del asistente.
    messages: lista de dicts con "role" y "content" (ej. {"role": "system", "content": "..."}).
    """
    _dump_sent_to_ollama(model, messages)
    try:
        client = get_ollama_client()
        response = client.chat(model=model, messages=messages)
        content = response.get("message", {}).get("content", "")
        return content or ""
    except Exception:
        raise


def chat_stream(model: str, messages: list[dict[str, Any]]) -> Iterator[str]:
    """Igual que chat pero hace streaming: va devolviendo trozos de contenido."""
    _dump_sent_to_ollama(model, messages)
    try:
        client = get_ollama_client()
        for chunk in client.chat(model=model, messages=messages, stream=True):
            msg = chunk.get("message") if isinstance(chunk, dict) else getattr(chunk, "message", None)
            if msg is None:
                continue
            content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "") or ""
            if content:
                yield content
    except Exception:
        raise
