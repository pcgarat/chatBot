"""
Proveedor de LLM para Mancer (https://mancer.tech).

Mancer usa una API compatible con OpenAI (/oai/v1/chat/completions).
Soporta streaming con SSE.
"""

import json
import sys
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import quote

import httpx

from app.config import settings
from app.providers.base import LLMProvider, ProviderModelInfo, StreamChunk

# URL base de Mancer (constante, igual para todos los usuarios)
MANCER_BASE_URL = "https://neuro.mancer.tech"

# IDs de modelos conocidos (catálogo público mancer.tech/models). Se usan como fallback
# si GET /oai/v1/models devuelve 0 o 1 modelo (p. ej. cuando la API responde con formato distinto).
MANCER_KNOWN_MODEL_IDS = [
    "mythomax",
    "mytholite",
    "weaver",
    "remm-slerp",
    "goliath-120b",
    "magnum-72b-v4",
    "glm-4.7",
    "danspe-v1-3-0-12b",
    "danspe-v1-3-0-24b",
]


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

    def _dump_to_stderr(
        self,
        model: str,
        messages: list[dict[str, Any]],
        extra_body: dict[str, Any] | None = None,
    ) -> None:
        """Si verbose está activo, imprime en stderr el payload enviado a Mancer."""
        if not settings.verbose:
            return
        payload = {"model": model, "messages": messages}
        if extra_body:
            payload.update(extra_body)
        print("--- enviado a Mancer ---", file=sys.stderr)
        print(json.dumps(payload, ensure_ascii=False, indent=2), file=sys.stderr)
        print("--- fin ---", file=sys.stderr)

    def list_models(self) -> list[ProviderModelInfo]:
        """
        Lista los modelos disponibles en Mancer.

        Acepta varios formatos de respuesta (OpenAI usa "data" como array;
        algunas implementaciones usan "models" o devuelven un dict por id).

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

            # Normalizar a lista de dicts: soportar "data" (array), "models" (array),
            # "data" como dict id -> info, o respuesta en raíz como array
            if isinstance(data, list):
                raw = data
            elif isinstance(data, dict):
                raw = data.get("data") or data.get("models")
                if raw is None:
                    raw = []
            else:
                raw = []

            if isinstance(raw, dict):
                # Un solo modelo: {"id": "x", "object": "model", ...}
                if raw.get("id") and raw.get("object") == "model":
                    models = [raw]
                else:
                    # Mapa id -> { ... info ... }
                    models = [
                        {"id": mid, **(m if isinstance(m, dict) else {})}
                        for mid, m in raw.items()
                    ]
            else:
                models = raw if isinstance(raw, list) else []

            result = []
            seen_ids = set()
            for m in models:
                model_id = m.get("id", "") if isinstance(m, dict) else ""
                if not model_id or model_id in seen_ids:
                    continue
                seen_ids.add(model_id)

                pricing = None
                if isinstance(m, dict) and "pricing" in m:
                    p = m["pricing"]
                    if isinstance(p, dict):
                        pricing = {
                            "prompt_per_1k": p.get("prompt", 0),
                            "completion_per_1k": p.get("completion", 0),
                        }

                result.append(
                    ProviderModelInfo(
                        name=model_id,
                        provider=self.provider_name,
                        context_length=m.get("context_length") if isinstance(m, dict) else None,
                        pricing=pricing,
                    )
                )

            # Si la API devolvió 0 o 1 modelo, completar con el catálogo conocido (mancer.tech/models)
            if len(result) < 2 and MANCER_KNOWN_MODEL_IDS:
                for mid in MANCER_KNOWN_MODEL_IDS:
                    if mid not in seen_ids:
                        seen_ids.add(mid)
                        result.append(
                            ProviderModelInfo(
                                name=mid,
                                provider=self.provider_name,
                                context_length=None,
                                pricing=None,
                            )
                        )
            return result
        except httpx.HTTPStatusError as e:
            raise ConnectionError(
                f"Error HTTP al listar modelos de Mancer: {e.response.status_code}"
            ) from e
        except Exception as e:
            raise ConnectionError(f"No se pudo conectar a Mancer: {e}") from e

    def chat(
        self,
        model: str,
        messages: list[dict[str, Any]],
        extra_body: dict[str, Any] | None = None,
    ) -> str:
        """
        Envía mensajes a Mancer y devuelve la respuesta completa.

        Args:
            model: Nombre del modelo a usar.
            messages: Lista de mensajes {"role": str, "content": str}.
            extra_body: Fragmento a fusionar en el payload (temperature, max_tokens, etc. en raíz).

        Returns:
            Contenido de la respuesta del asistente.

        Raises:
            ConnectionError: Si no se puede conectar a Mancer.
        """
        self._dump_to_stderr(model, messages, extra_body)
        url = f"{self._base_url}/oai/v1/chat/completions"
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
        self,
        model: str,
        messages: list[dict[str, Any]],
        extra_body: dict[str, Any] | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """
        Streaming de respuesta desde Mancer (SSE).

        Args:
            model: Nombre del modelo a usar.
            messages: Lista de mensajes {"role": str, "content": str}.
            extra_body: Fragmento a fusionar en el payload (temperature, max_tokens, etc. en raíz).

        Yields:
            StreamChunk con contenido parcial, errores o metadata.

        Note:
            Al cerrar el iterador, se cancela la conexión a Mancer.
            Mancer detecta la desconexión y deja de generar (y cobrar).
        """
        self._dump_to_stderr(model, messages, extra_body)
        url = f"{self._base_url}/oai/v1/chat/completions"
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
                                    # Objeto usage normalizado (mismo esquema que Ollama)
                                    raw = data.get("usage", {})
                                    pt, ct = raw.get("prompt_tokens"), raw.get("completion_tokens")
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
                # Cliente canceló - Mancer detectará la desconexión
                raise
            except Exception as e:
                yield StreamChunk.error_chunk(
                    str(e),
                    exception_type=type(e).__name__,
                )

    def show_model(self, model_name: str) -> dict[str, Any] | None:
        """
        Capacidad opcional: detalles del modelo vía GET /oai/v1/models/{model_id}.
        Devuelve un dict normalizado para almacenar en provider_info (con fetched_at).
        None si el modelo no existe o hay error de conexión.
        """
        from datetime import datetime, timezone

        model_id_encoded = quote(str(model_name), safe="")
        url = f"{self._base_url}/oai/v1/models/{model_id_encoded}"
        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(url, headers=self._get_headers())
                if response.status_code != 200:
                    return None
                raw = response.json()
                # Algunas APIs devuelven el modelo en {"data": {...}}
                data = raw.get("data", raw) if isinstance(raw, dict) else {}
        except Exception:
            return None
        if not data or not isinstance(data, dict):
            return None
        # Normalizar a formato provider_info (compatible con la UI de ficha)
        fetched_at = datetime.now(tz=timezone.utc).isoformat()
        context_length = data.get("context_length")
        pricing = data.get("pricing")
        out = {
            "fetched_at": fetched_at,
            "context_length": context_length,
            "id": data.get("id"),
            "pricing": pricing,
        }
        # Campos extra que Mancer pueda devolver (ej. arquitectura, límites)
        if "architecture" in data:
            out.setdefault("model_info", {})["architecture"] = data["architecture"]
        if context_length is not None and "model_info" not in out:
            out["model_info"] = {"context_length": context_length}
        elif context_length is not None:
            out["model_info"]["context_length"] = context_length
        return {k: v for k, v in out.items() if v is not None}

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
