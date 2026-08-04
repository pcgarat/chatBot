"""
Proveedor de LLM para abliteration.ai (https://docs.abliteration.ai/).

API compatible con OpenAI: POST /v1/chat/completions, GET /v1/models.
Auth: Authorization Bearer $ABLIT_KEY. Modelos uncensored con reasoning por defecto.
"""

import json
import sys
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import quote

import httpx

from app.config import settings
from app.providers.base import LLMProvider, ProviderModelInfo, StreamChunk

ABLIT_BASE_URL = "https://api.abliteration.ai"

# Catálogo oficial (docs/models). Fallback si GET /v1/models falla o viene vacío.
# Pricing: uso facturado por tokens totales a tarifa única por modelo ($/1M).
ABLIT_KNOWN_MODELS: dict[str, dict[str, Any]] = {
    "abliterated-model": {
        "context_length": 262_144,
        "pricing": {"prompt_per_1k": 0.003, "completion_per_1k": 0.003},
        "display_name": "abliterated-model (multimodal, 256K)",
    },
    "abliterated-model-large": {
        "context_length": 1_000_000,
        "pricing": {"prompt_per_1k": 0.005, "completion_per_1k": 0.005},
        "display_name": "abliterated-model-large (text, 1M)",
    },
}


class AbliterationProvider:
    """
    Proveedor para abliteration.ai (API compatible con OpenAI).

    Implementa LLMProvider. Autenticación vía ABLIT_KEY.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        self._api_key = api_key if api_key is not None else settings.ablit_key
        self._base_url = (base_url or settings.ablit_base_url or ABLIT_BASE_URL).rstrip("/")

        if not self._api_key:
            raise ValueError(
                "ABLIT_KEY no configurada. "
                "Establece la variable de entorno ABLIT_KEY o pásala al constructor."
            )

    @property
    def provider_name(self) -> str:
        return "abliteration"

    @property
    def base_url(self) -> str:
        return self._base_url

    def _get_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _dump_to_stderr(
        self,
        model: str,
        messages: list[dict[str, Any]],
        extra_body: dict[str, Any] | None = None,
    ) -> None:
        if not settings.verbose:
            return
        payload = {"model": model, "messages": messages}
        if extra_body:
            payload.update(extra_body)
        print("--- enviado a Abliteration ---", file=sys.stderr)
        print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
        print("--- fin ---", file=sys.stderr)

    def _model_info_from_known(self, model_id: str) -> ProviderModelInfo:
        known = ABLIT_KNOWN_MODELS.get(model_id, {})
        return ProviderModelInfo(
            name=model_id,
            provider=self.provider_name,
            display_name=known.get("display_name"),
            context_length=known.get("context_length"),
            pricing=known.get("pricing"),
        )

    def list_models(self) -> list[ProviderModelInfo]:
        """
        Lista modelos vía GET /v1/models.

        Enriquece con contexto/precios del catálogo conocido. Si la API
        no responde o no trae modelos, usa el catálogo estático.
        """
        url = f"{self._base_url}/v1/models"
        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
            raw = data.get("data", []) if isinstance(data, dict) else []
            result: list[ProviderModelInfo] = []
            seen: set[str] = set()
            for m in raw:
                if not isinstance(m, dict):
                    continue
                model_id = m.get("id", "")
                if not model_id or model_id in seen:
                    continue
                seen.add(model_id)
                known = ABLIT_KNOWN_MODELS.get(model_id, {})
                result.append(
                    ProviderModelInfo(
                        name=model_id,
                        provider=self.provider_name,
                        display_name=known.get("display_name"),
                        context_length=m.get("context_length") or known.get("context_length"),
                        pricing=known.get("pricing"),
                    )
                )
            for mid in ABLIT_KNOWN_MODELS:
                if mid not in seen:
                    result.append(self._model_info_from_known(mid))
            return result
        except httpx.HTTPStatusError as e:
            error_detail = _extract_error_message(e)
            raise ConnectionError(
                f"Error HTTP al listar modelos de Abliteration: "
                f"{e.response.status_code} - {error_detail}"
            ) from e
        except Exception as e:
            raise ConnectionError(f"No se pudo conectar a Abliteration: {e}") from e

    def chat(
        self,
        model: str,
        messages: list[dict[str, Any]],
        extra_body: dict[str, Any] | None = None,
    ) -> str:
        self._dump_to_stderr(model, messages, extra_body)
        url = f"{self._base_url}/v1/chat/completions"
        payload: dict[str, Any] = {
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
            return message.get("content", "") or ""
        except httpx.HTTPStatusError as e:
            error_detail = _extract_error_message(e)
            raise ConnectionError(
                f"Error HTTP de Abliteration ({e.response.status_code}): {error_detail}"
            ) from e
        except Exception as e:
            raise ConnectionError(f"Error al llamar a Abliteration: {e}") from e

    async def chat_stream(
        self,
        model: str,
        messages: list[dict[str, Any]],
        extra_body: dict[str, Any] | None = None,
    ) -> AsyncIterator[StreamChunk]:
        self._dump_to_stderr(model, messages, extra_body)
        url = f"{self._base_url}/v1/chat/completions"
        payload: dict[str, Any] = {
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

    def show_model(self, model_name: str) -> dict[str, Any] | None:
        """
        Detalles del modelo vía GET /v1/models/{id}, enriquecidos con el catálogo local.
        """
        from datetime import datetime, timezone

        model_id_encoded = quote(str(model_name), safe="")
        url = f"{self._base_url}/v1/models/{model_id_encoded}"
        data: dict[str, Any] = {}
        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(url, headers=self._get_headers())
                if response.status_code == 200:
                    raw = response.json()
                    data = raw.get("data", raw) if isinstance(raw, dict) else {}
                    if not isinstance(data, dict):
                        data = {}
        except Exception:
            data = {}

        known = ABLIT_KNOWN_MODELS.get(model_name, {})
        if not data and not known:
            return None

        fetched_at = datetime.now(tz=timezone.utc).isoformat()
        context_length = data.get("context_length") or known.get("context_length")
        out: dict[str, Any] = {
            "fetched_at": fetched_at,
            "id": data.get("id") or model_name,
            "context_length": context_length,
            "pricing": known.get("pricing"),
            "model_info": {"context_length": context_length} if context_length else {},
        }
        if known.get("display_name"):
            out["display_name"] = known["display_name"]
        return {k: v for k, v in out.items() if v is not None and v != {}}

    def validate_connection(self) -> bool:
        try:
            self.list_models()
            return True
        except Exception:
            return False


def _extract_error_message(exc: httpx.HTTPStatusError) -> str:
    try:
        data = exc.response.json()
        return data.get("error", {}).get("message", "") or str(exc)
    except Exception:
        return exc.response.text or str(exc)


def _parse_error_body(body: bytes) -> str:
    try:
        data = json.loads(body)
        return data.get("error", {}).get("message", "") or body.decode("utf-8", errors="replace")[:200]
    except Exception:
        return body.decode("utf-8", errors="replace")[:200]
