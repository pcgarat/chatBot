"""
Proveedor de LLM para Mancer (https://mancer.tech).

Mancer usa una API compatible con OpenAI (/oai/v1/chat/completions).
Soporta streaming con SSE.
"""

import json
import sys
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.config import settings
from app.providers.base import LLMProvider, ProviderModelInfo, StreamChunk

# URL base de Mancer (constante, igual para todos los usuarios)
MANCER_BASE_URL = "https://neuro.mancer.tech"


class MancerProvider:
    """
    Proveedor para Mancer.tech (API compatible con OpenAI).

    Implementa la interfaz LLMProvider para interactuar con Mancer.
    Soporta chat síncrono, streaming asíncrono y listado de modelos.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        """
        Inicializa el proveedor de Mancer.

        Args:
            api_key: API key de Mancer. Si es None, usa settings.mancer_api_key.
            base_url: URL base de Mancer. Si es None, usa MANCER_BASE_URL.
        """
        self._api_key = api_key or settings.mancer_api_key
        self._base_url = (base_url or MANCER_BASE_URL).rstrip("/")

        if not self._api_key:
            raise ValueError(
                "MANCER_API_KEY no configurada. "
                "Establece la variable de entorno MANCER_API_KEY o pásala al constructor."
            )

    @property
    def provider_name(self) -> str:
        """Nombre identificador del proveedor."""
        return "mancer"

    @property
    def base_url(self) -> str:
        """URL base de la API de Mancer."""
        return self._base_url

    def _get_headers(self) -> dict[str, str]:
        """Obtiene los headers para las peticiones a Mancer."""
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _dump_to_stderr(self, model: str, messages: list[dict[str, Any]]) -> None:
        """Si verbose está activo, imprime en stderr el payload enviado a Mancer."""
        if not settings.verbose:
            return
        payload = {"model": model, "messages": messages}
        print("--- enviado a Mancer ---", file=sys.stderr)
        print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
        print("--- fin ---", file=sys.stderr)

    def list_models(self) -> list[ProviderModelInfo]:
        """
        Lista los modelos disponibles en Mancer.

        Returns:
            Lista de ProviderModelInfo con info de cada modelo.

        Raises:
            ConnectionError: Si no se puede conectar a Mancer.
        """
        url = f"{self._base_url}/oai/v1/models"
        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()

            result = []
            models = data.get("data", [])
            for m in models:
                model_id = m.get("id", "")
                if not model_id:
                    continue

                # Extraer pricing si está disponible
                pricing = None
                if "pricing" in m:
                    p = m["pricing"]
                    pricing = {
                        "prompt_per_1k": p.get("prompt", 0),
                        "completion_per_1k": p.get("completion", 0),
                    }

                result.append(
                    ProviderModelInfo(
                        name=model_id,
                        provider=self.provider_name,
                        context_length=m.get("context_length"),
                        pricing=pricing,
                    )
                )
            return result
        except httpx.HTTPStatusError as e:
            raise ConnectionError(
                f"Error HTTP al listar modelos de Mancer: {e.response.status_code}"
            ) from e
        except Exception as e:
            raise ConnectionError(f"No se pudo conectar a Mancer: {e}") from e

    def chat(self, model: str, messages: list[dict[str, Any]]) -> str:
        """
        Envía mensajes a Mancer y devuelve la respuesta completa.

        Args:
            model: Nombre del modelo a usar.
            messages: Lista de mensajes {"role": str, "content": str}.

        Returns:
            Contenido de la respuesta del asistente.

        Raises:
            ConnectionError: Si no se puede conectar a Mancer.
        """
        self._dump_to_stderr(model, messages)
        url = f"{self._base_url}/oai/v1/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
        }

        try:
            with httpx.Client(timeout=120) as client:
                response = client.post(
                    url,
                    headers=self._get_headers(),
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

            # Extraer contenido de la respuesta (formato OpenAI)
            choices = data.get("choices", [])
            if not choices:
                return ""
            message = choices[0].get("message", {})
            return message.get("content", "")

        except httpx.HTTPStatusError as e:
            error_detail = ""
            try:
                error_data = e.response.json()
                error_detail = error_data.get("error", {}).get("message", "")
            except Exception:
                pass
            raise ConnectionError(
                f"Error HTTP de Mancer ({e.response.status_code}): {error_detail or e}"
            ) from e
        except Exception as e:
            raise ConnectionError(f"Error al llamar a Mancer: {e}") from e

    async def chat_stream(
        self, model: str, messages: list[dict[str, Any]]
    ) -> AsyncIterator[StreamChunk]:
        """
        Streaming de respuesta desde Mancer (SSE).

        Args:
            model: Nombre del modelo a usar.
            messages: Lista de mensajes {"role": str, "content": str}.

        Yields:
            StreamChunk con contenido parcial, errores o metadata.

        Note:
            Al cerrar el iterador, se cancela la conexión a Mancer.
            Mancer detecta la desconexión y deja de generar (y cobrar).
        """
        self._dump_to_stderr(model, messages)
        url = f"{self._base_url}/oai/v1/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
        }

        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                    "POST",
                    url,
                    headers=self._get_headers(),
                    json=payload,
                    timeout=httpx.Timeout(None),
                ) as response:
                    # Verificar HTTP status
                    if response.status_code != 200:
                        error_text = ""
                        try:
                            # Intentar leer el cuerpo del error
                            body = await response.aread()
                            error_data = json.loads(body)
                            error_text = error_data.get("error", {}).get("message", "")
                        except Exception:
                            error_text = response.reason_phrase or "Unknown error"

                        yield StreamChunk.error_chunk(
                            f"HTTP {response.status_code}: {error_text}",
                            status_code=response.status_code,
                        )
                        return

                    # Leer SSE stream
                    async for line in response.aiter_lines():
                        if not line:
                            continue

                        # SSE format: "data: {...}" o "data: [DONE]"
                        if line.startswith("data: "):
                            data_str = line[6:]  # Quitar "data: "

                            # Fin del stream
                            if data_str == "[DONE]":
                                yield StreamChunk.done_chunk(model=model)
                                return

                            try:
                                data = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue

                            # Verificar error
                            if "error" in data:
                                yield StreamChunk.error_chunk(
                                    data["error"].get("message", str(data["error"]))
                                )
                                continue

                            # Extraer contenido (formato OpenAI streaming)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield StreamChunk.content_chunk(content)

                                # Verificar finish_reason
                                finish_reason = choices[0].get("finish_reason")
                                if finish_reason:
                                    # Emitir metadata de uso si está disponible
                                    usage = data.get("usage", {})
                                    yield StreamChunk.done_chunk(
                                        model=data.get("model", model),
                                        finish_reason=finish_reason,
                                        prompt_tokens=usage.get("prompt_tokens"),
                                        completion_tokens=usage.get("completion_tokens"),
                                    )
                                    return

            except GeneratorExit:
                # Cliente canceló - Mancer detectará la desconexión
                raise
            except Exception as e:
                yield StreamChunk.error_chunk(
                    str(e),
                    exception_type=type(e).__name__,
                )

    def validate_connection(self) -> bool:
        """
        Verifica que Mancer esté accesible.

        Returns:
            True si Mancer responde correctamente.
        """
        try:
            self.list_models()
            return True
        except Exception:
            return False
