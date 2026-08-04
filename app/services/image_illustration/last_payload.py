"""Reconstrucción del último payload de Forge (ReplayLastGeneration)."""

from __future__ import annotations

import base64
import mimetypes
from pathlib import Path
from typing import Any

import httpx

from app.services.image_illustration.infotext import (
    build_api_body,
    detect_mode,
    parse_infotext,
    parse_pnginfo_parameters,
)
from app.services.image_illustration.models import ForgeMode, LastGenerationPayload

_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


class LastPayloadError(RuntimeError):
    """No se pudo reconstruir el último payload."""


def find_latest_output_image(data_path: str | Path) -> Path:
    root = Path(data_path) / "output"
    if not root.is_dir():
        raise LastPayloadError(f"No existe output en FORGE_DATA_PATH: {root}")
    latest: Path | None = None
    latest_mtime = -1.0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in _IMAGE_SUFFIXES:
            continue
        try:
            mtime = path.stat().st_mtime
        except OSError:
            continue
        if mtime > latest_mtime:
            latest_mtime = mtime
            latest = path
    if latest is None:
        raise LastPayloadError(f"No hay imágenes en {root}")
    return latest


def list_style_init_images(init_dir: str | Path | None) -> list[Path]:
    if not init_dir:
        return []
    root = Path(init_dir)
    if not root.is_dir():
        return []
    files = [
        p
        for p in sorted(root.iterdir(), key=lambda x: x.stat().st_mtime if x.is_file() else 0)
        if p.is_file() and p.suffix.lower() in _IMAGE_SUFFIXES
    ]
    return files


def file_to_data_uri(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    if not mime:
        mime = "image/png"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def read_params_txt(data_path: str | Path) -> str:
    path = Path(data_path) / "params.txt"
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8", errors="replace")


class FileSystemLastPayloadSource:
    """
    Carga el último gen desde disco (+ png-info HTTP opcional).
    Si forge_client/http no está disponible, usa solo params.txt + ruta.
    """

    def __init__(
        self,
        data_path: str,
        style_init_dir: str = "",
        forge_base_url: str = "http://127.0.0.1:7860",
        timeout_seconds: float = 60.0,
        http_client: httpx.Client | None = None,
    ):
        self.data_path = data_path
        self.style_init_dir = style_init_dir
        self.forge_base_url = forge_base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._http = http_client

    def _png_info(self, image_path: Path) -> tuple[str, dict[str, Any]]:
        data_uri = file_to_data_uri(image_path)
        client = self._http
        owns = False
        if client is None:
            client = httpx.Client(timeout=self.timeout_seconds)
            owns = True
        try:
            resp = client.post(
                f"{self.forge_base_url}/sdapi/v1/png-info",
                json={"image": data_uri},
            )
            if resp.status_code != 200:
                return "", {}
            payload = resp.json()
            return payload.get("info") or "", payload.get("parameters") or {}
        except (httpx.HTTPError, ValueError, TypeError):
            return "", {}
        finally:
            if owns:
                client.close()

    def _options(self) -> dict[str, Any]:
        client = self._http
        owns = False
        if client is None:
            client = httpx.Client(timeout=self.timeout_seconds)
            owns = True
        try:
            resp = client.get(f"{self.forge_base_url}/sdapi/v1/options")
            if resp.status_code != 200:
                return {}
            data = resp.json()
            return data if isinstance(data, dict) else {}
        except (httpx.HTTPError, ValueError, TypeError):
            return {}
        finally:
            if owns:
                client.close()

    def load(self) -> LastGenerationPayload:
        if not self.data_path:
            raise LastPayloadError("FORGE_DATA_PATH no configurado")

        latest = find_latest_output_image(self.data_path)
        info, parameters = self._png_info(latest)
        params_txt = read_params_txt(self.data_path)
        if not info and params_txt:
            info = params_txt

        fields = parse_pnginfo_parameters(parameters, info)
        if params_txt:
            from_txt = parse_infotext(params_txt)
            for k, v in from_txt.items():
                fields.setdefault(k, v)

        options = self._options()
        if "sd_model_checkpoint" not in fields and options.get("sd_model_checkpoint"):
            fields["sd_model_checkpoint"] = options["sd_model_checkpoint"]
        if "modules" not in fields:
            mods = options.get("forge_additional_modules")
            if isinstance(mods, list) and mods:
                # Guardar solo nombres de fichero
                fields["modules"] = [Path(str(m)).name for m in mods]

        mode = detect_mode(str(latest), fields)
        body, override, recovered, notes = build_api_body(fields, mode)
        modules = list(fields.get("modules") or [])

        if mode == ForgeMode.IMG2IMG:
            init_paths = list_style_init_images(self.style_init_dir)
            if init_paths:
                body["init_images"] = [file_to_data_uri(p) for p in init_paths]
                recovered.append("init_images:style_init_dir")
            else:
                body["init_images"] = [file_to_data_uri(latest)]
                recovered.append("init_images:last_output")
                notes.append(
                    "init_images = última salida (FORGE_STYLE_INIT_DIR vacío o sin imágenes)"
                )

        return LastGenerationPayload(
            mode=mode,
            body=body,
            recovered_fields=recovered,
            omitted_notes=notes,
            source_image_path=str(latest),
            raw_info=info or params_txt,
            override_settings=override,
            modules=modules,
        )
