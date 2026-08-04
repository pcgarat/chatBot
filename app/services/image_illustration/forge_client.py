"""Cliente HTTP hacia la API A1111-compatible de Forge Neo."""

from __future__ import annotations

import base64
from typing import Any

import httpx

from app.services.image_illustration.models import ForgeMode


class ForgeClientError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class ForgeHttpClient:
    """Adapter: POST /sdapi/v1/txt2img | img2img."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:7860",
        timeout_seconds: float = 600.0,
        http_client: httpx.Client | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._http = http_client

    def generate(self, mode: ForgeMode, body: dict[str, Any]) -> bytes:
        endpoint = "txt2img" if mode == ForgeMode.TXT2IMG else "img2img"
        url = f"{self.base_url}/sdapi/v1/{endpoint}"
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
