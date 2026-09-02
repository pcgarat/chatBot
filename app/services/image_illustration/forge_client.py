"""Cliente HTTP hacia la API A1111-compatible de Forge Neo."""

from __future__ import annotations

import base64
import json
import sys
from typing import Any

import httpx

from app.config import settings
from app.services.image_illustration.models import ForgeMode

_BINARY_BODY_KEYS = frozenset({"init_images", "mask", "include_init_images"})


def sanitize_forge_body_for_log(body: dict[str, Any]) -> dict[str, Any]:
    """Copia el body para log: omite base64 largos (init_images/mask) y deja el resto intacto."""
    out: dict[str, Any] = {}
    for key, value in (body or {}).items():
        if key in _BINARY_BODY_KEYS:
            out[key] = _redact_binary_field(value)
        else:
            out[key] = value
    return out


def _redact_binary_field(value: Any) -> Any:
    if isinstance(value, list):
        return [_redact_binary_field(item) for item in value]
    if isinstance(value, str):
        return f"<base64 omitted len={len(value)}>"
    if value is True or value is False or value is None:
        return value
    return f"<omitted type={type(value).__name__}>"


def log_forge_request(mode: ForgeMode, url: str, body: dict[str, Any]) -> None:
    """Si VERBOSE=1, vuelca a stderr la petición a Forge (params, prompt, modelo, etc.)."""
    if not settings.verbose:
        return
    endpoint = "txt2img" if mode == ForgeMode.TXT2IMG else "img2img"
    print(f"--- Forge Neo {endpoint} → {url} ---", file=sys.stderr, flush=True)
    print(
        json.dumps(sanitize_forge_body_for_log(body), ensure_ascii=False, indent=2, default=str),
        file=sys.stderr,
        flush=True,
    )
    print("--- fin Forge Neo ---", file=sys.stderr, flush=True)


class ForgeClientError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _bytes_to_data_uri(image_bytes: bytes, mime: str = "image/png") -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime};base64,{encoded}"


class ForgeHttpClient:
    """Adapter: POST /sdapi/v1/txt2img | img2img y /reactor/image."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:7860",
        timeout_seconds: float = 600.0,
        http_client: httpx.Client | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._http = http_client

    def reactor_swap(
        self,
        *,
        source_image: bytes,
        target_image: bytes,
        params: dict[str, Any],
    ) -> bytes:
        """Face swap vía API externa de ReActor; devuelve la imagen resultante."""
        url = f"{self.base_url}/reactor/image"
        payload = {
            "source_image": _bytes_to_data_uri(source_image),
            "target_image": _bytes_to_data_uri(target_image),
            **params,
        }
        if settings.verbose:
            summary = {
                k: v
                for k, v in payload.items()
                if k not in ("source_image", "target_image")
            }
            print(
                f"--- Forge ReActor → {url} {json.dumps(summary, ensure_ascii=False)} ---",
                file=sys.stderr,
                flush=True,
            )
        client = self._http
        owns = False
        if client is None:
            client = httpx.Client(timeout=self.timeout_seconds)
            owns = True
        try:
            resp = client.post(url, json=payload)
            if resp.status_code != 200:
                detail = resp.text[:500] if resp.text else resp.reason_phrase
                raise ForgeClientError(
                    f"ReActor HTTP {resp.status_code}: {detail}",
                    status_code=resp.status_code,
                )
            data = resp.json()
            raw = data.get("image") if isinstance(data, dict) else None
            if not raw:
                raise ForgeClientError("ReActor no devolvió image")
            if isinstance(raw, str) and raw.startswith("data:"):
                raw = raw.split(",", 1)[-1]
            try:
                return base64.b64decode(raw)
            except Exception as exc:
                raise ForgeClientError(f"Imagen ReActor base64 inválida: {exc}") from exc
        except httpx.HTTPError as exc:
            raise ForgeClientError(f"Error de red ReActor: {exc}") from exc
        finally:
            if owns:
                client.close()

    def generate(self, mode: ForgeMode, body: dict[str, Any]) -> bytes:
        endpoint = "txt2img" if mode == ForgeMode.TXT2IMG else "img2img"
        url = f"{self.base_url}/sdapi/v1/{endpoint}"
        log_forge_request(mode, url, body)
        client = self._http
        owns = False
        if client is None:
            client = httpx.Client(timeout=self.timeout_seconds)
            owns = True
        try:
            resp = client.post(url, json=body)
            if resp.status_code != 200:
                detail = resp.text[:500] if resp.text else resp.reason_phrase
                raise ForgeClientError(
                    f"Forge {endpoint} HTTP {resp.status_code}: {detail}",
                    status_code=resp.status_code,
                )
            data = resp.json()
            images = data.get("images") if isinstance(data, dict) else None
            if not images:
                raise ForgeClientError("Forge no devolvió images[]")
            raw = images[0]
            if isinstance(raw, str) and raw.startswith("data:"):
                raw = raw.split(",", 1)[-1]
            try:
                return base64.b64decode(raw)
            except Exception as exc:
                raise ForgeClientError(f"Imagen base64 inválida: {exc}") from exc
        except httpx.HTTPError as exc:
            raise ForgeClientError(f"Error de red Forge: {exc}") from exc
        finally:
            if owns:
                client.close()
