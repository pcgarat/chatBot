"""
Proveedor de LLM para OpenAI (https://platform.openai.com).

Usa la API oficial: POST /v1/chat/completions, GET /v1/models.
Soporta streaming con SSE. No implementa show_model ni unload_model.
"""

import json
import sys
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.config import settings
from app.providers.base import LLMProvider, ProviderModelInfo, StreamChunk


class OpenAIProvider:
    """
    Proveedor para OpenAI (API oficial).

    Implementa la interfaz LLMProvider. Autenticación vía OPENAI_API_KEY.
    Base URL configurable (OPENAI_BASE_URL) para Azure o proxies.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        """
        Inicializa el proveedor de OpenAI.

        Args:
            api_key: API key. Si es None, usa settings.openai_api_key.
            base_url: URL base. Si es None, usa settings.openai_base_url.
        """
        self._api_key = api_key or settings.openai_api_key
        self._base_url = (base_url or settings.openai_base_url).rstrip("/")

        if not self._api_key:
            raise ValueError(
                "OPENAI_API_KEY no configurada. "
                "Establece la variable de entorno OPENAI_API_KEY o pásala al constructor."
            )

    @property
    def provider_name(self) -> str:
        """Nombre identificador del proveedor."""
        return "openai"

    @property
    def base_url(self) -> str:
        """URL base de la API."""
        return self._base_url

    def _get_headers(self) -> dict[str, str]:
        """Headers para las peticiones (Bearer token). Opcional: OpenAI-Organization, OpenAI-Project."""
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        if settings.openai_organization_id and settings.openai_organization_id.strip():
            headers["OpenAI-Organization"] = settings.openai_organization_id.strip()
        if settings.openai_project_id and settings.openai_project_id.strip():
            headers["OpenAI-Project"] = settings.openai_project_id.strip()
        return headers

    def _dump_to_stderr(
        self,
        model: str,
        messages: list[dict[str, Any]],
        extra_body: dict[str, Any] | None = None,
    ) -> None:
        """Si verbose está activo, imprime en stderr el payload enviado."""
        if not settings.verbose:
            return
        payload = {"model": model, "messages": messages}
        if extra_body:
            payload.update(extra_body)
        print("--- enviado a OpenAI ---", file=sys.stderr)
        print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
        print("--- fin ---", file=sys.stderr)

    def list_models(self) -> list[ProviderModelInfo]:
        """
        Lista los modelos disponibles en OpenAI (GET /v1/models).

        La API oficial no devuelve context_length en el listado; se deja None.
        El contexto máximo puede venir de config/openai.json (preset) o de
        la ficha del modelo si se enriquece en el futuro.
        """
        url = f"{self._base_url}/v1/models"
        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
            result = []
            for m in data.get("data", []):
                model_id = m.get("id", "")
                if not model_id:
                    continue
                # OpenAI list no incluye context_length; preset/ficha lo pueden aportar
                result.append(
                    ProviderModelInfo(
                        name=model_id,
                        provider=self.provider_name,
                        context_length=None,
                        pricing=None,
                    )
                )
            return result
        except httpx.HTTPStatusError as e:
            error_detail = _extract_error_message(e)
            raise ConnectionError(
                f"Error HTTP al listar modelos de OpenAI: {e.response.status_code} - {error_detail}"
            ) from e
        except Exception as e:
            raise ConnectionError(f"No se pudo conectar a OpenAI: {e}") from e

    def chat(
        self,
        model: str,
        messages: list[dict[str, Any]],
        extra_body: dict[str, Any] | None = None,
    ) -> str:
        """
        Envía mensajes a OpenAI y devuelve la respuesta completa (POST /v1/chat/completions).
        """
        self._dump_to_stderr(model, messages, extra_body)
        url = f"{self._base_url}/v1/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
        }
        if extra_body:
            payload.update(extra_body)
        try:
            with httpx.Client(timeout=120) as client:
                response = client.post(
                    url,
                    headers=self._get_headers(),
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
            choices = data.get("choices", [])
            if not choices:
                return ""
            message = choices[0].get("message", {})
            return message.get("content", "")
        except httpx.HTTPStatusError as e:
            error_detail = _extract_error_message(e)
            raise ConnectionError(
                f"Error HTTP de OpenAI ({e.response.status_code}): {error_detail}"
            ) from e
        except Exception as e:
            raise ConnectionError(f"Error al llamar a OpenAI: {e}") from e

    async def chat_stream(
        self,
        model: str,
        messages: list[dict[str, Any]],
        extra_body: dict[str, Any] | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """
        Streaming de respuesta desde OpenAI (SSE).
        Incluye usage normalizado en el chunk done cuando la API lo envía.
        """
        self._dump_to_stderr(model, messages, extra_body)
        url = f"{self._base_url}/v1/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
        }
        if extra_body:
            payload.update(extra_body)
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                    "POST",
                    url,
                    headers=self._get_headers(),
                    json=payload,
                    timeout=httpx.Timeout(None),
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        error_detail = _parse_error_body(body)
                        yield StreamChunk.error_chunk(
                            f"HTTP {response.status_code}: {error_detail}",
                            status_code=response.status_code,
                        )
                        return
                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            yield StreamChunk.done_chunk(model=model)
                            return
                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue
                        if "error" in data:
                            yield StreamChunk.error_chunk(
                                data["error"].get("message", str(data["error"]))
                            )
                            continue
                        choices = data.get("choices", [])
                        if not choices:
                            continue
                        delta = choices[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield StreamChunk.content_chunk(content)
                        finish_reason = choices[0].get("finish_reason")
                        if finish_reason:
                            raw = data.get("usage", {})
                            pt = raw.get("prompt_tokens")
                            ct = raw.get("completion_tokens")
                            usage = None
                            if pt is not None or ct is not None:
                                usage = {
                                    "prompt_tokens": int(pt) if pt is not None else 0,
                                    "completion_tokens": int(ct) if ct is not None else 0,
                                }
                            yield StreamChunk.done_chunk(
                                model=data.get("model", model),
                                finish_reason=finish_reason,
                                usage=usage,
                            )
                            return
            except GeneratorExit:
                raise
            except Exception as e:
                yield StreamChunk.error_chunk(
                    str(e),
                    exception_type=type(e).__name__,
                )

    def validate_connection(self) -> bool:
        """Verifica que OpenAI esté accesible (listando modelos)."""
        try:
            self.list_models()
            return True
        except Exception:
            return False


def _extract_error_message(exc: httpx.HTTPStatusError) -> str:
    """Extrae error.message del cuerpo de respuesta OpenAI."""
    try:
        data = exc.response.json()
        return data.get("error", {}).get("message", "") or str(exc)
    except Exception:
        return exc.response.text or str(exc)


def _parse_error_body(body: bytes) -> str:
    """Parsea cuerpo de error y devuelve mensaje legible."""
    try:
        data = json.loads(body)
        return data.get("error", {}).get("message", "") or body.decode("utf-8", errors="replace")[:200]
    except Exception:
        return body.decode("utf-8", errors="replace")[:200]
