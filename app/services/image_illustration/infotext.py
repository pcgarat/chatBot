"""Parseo de infotext / params.txt de Automatic1111 / Forge Neo."""

from __future__ import annotations

import re
from typing import Any

from app.services.image_illustration.models import ForgeMode

_STEPS_LINE = re.compile(
    r"Steps:\s*(?P<steps>\d+)\s*,\s*Sampler:\s*(?P<sampler>[^,]+),\s*"
    r"Schedule type:\s*(?P<scheduler>[^,]+),\s*CFG scale:\s*(?P<cfg>[0-9.]+),\s*"
    r"Seed:\s*(?P<seed>-?\d+),\s*Size:\s*(?P<w>\d+)x(?P<h>\d+)",
    re.IGNORECASE,
)
_MODEL = re.compile(r"Model:\s*([^,]+)", re.IGNORECASE)
_DENOISING = re.compile(r"Denoising strength:\s*([0-9.]+)", re.IGNORECASE)
_NEGATIVE = re.compile(
    r"Negative prompt:\s*(.*?)(?=\nSteps:|\Z)",
    re.IGNORECASE | re.DOTALL,
)
_MODULE = re.compile(r"Module\s+(\d+):\s*([^,]+)", re.IGNORECASE)


def split_prompt_and_params(info: str) -> tuple[str, str]:
    """Separa prompt (líneas antes de Steps:) del resto del infotext."""
    if not info:
        return "", ""
    match = re.search(r"\nSteps:\s*", info)
    if not match:
        # params.txt a veces empieza por prompt y luego Steps en la misma/siguiente línea
        m2 = re.search(r"(^|\n)Steps:\s*", info)
        if not m2:
            return info.strip(), ""
        idx = m2.start()
        if info[idx] == "\n":
            idx += 1
        return info[:idx].strip(), info[idx:].strip()
    return info[: match.start()].strip(), info[match.start() + 1 :].strip()


def parse_modules_from_info(info: str) -> list[str]:
    found = _MODULE.findall(info or "")
    found.sort(key=lambda t: int(t[0]))
    return [name.strip() for _, name in found if name.strip()]


def parse_infotext(info: str) -> dict[str, Any]:
    """
    Extrae campos API-compatibles desde infotext o params.txt.
    No inventa defaults: solo incluye lo que aparece en el texto.
    """
    prompt, params_blob = split_prompt_and_params(info or "")
    recovered: dict[str, Any] = {}
    if prompt:
        # Si el bloque params incluye "Negative prompt:" al inicio raro, prompt ya está
        recovered["prompt"] = prompt

    neg = _NEGATIVE.search(info or "")
    if neg:
        recovered["negative_prompt"] = neg.group(1).strip()

    m = _STEPS_LINE.search(info or "")
    if not m:
        m = _STEPS_LINE.search(params_blob)
    if m:
        recovered["steps"] = int(m.group("steps"))
        recovered["sampler_name"] = m.group("sampler").strip()
        recovered["scheduler"] = m.group("scheduler").strip()
        recovered["cfg_scale"] = float(m.group("cfg"))
        recovered["seed"] = int(m.group("seed"))
        recovered["width"] = int(m.group("w"))
        recovered["height"] = int(m.group("h"))

    model = _MODEL.search(info or "")
    if model:
        recovered["sd_model_checkpoint"] = model.group(1).strip()

    den = _DENOISING.search(info or "")
    if den:
        recovered["denoising_strength"] = float(den.group(1))

    modules = parse_modules_from_info(info or "")
    if modules:
        recovered["modules"] = modules

    return recovered


def parse_pnginfo_parameters(parameters: dict[str, Any] | None, info: str = "") -> dict[str, Any]:
    """Fusiona dict `parameters` de /sdapi/v1/png-info con el infotext crudo."""
    from_info = parse_infotext(info)
    if not parameters:
        return from_info

    out = dict(from_info)
    mapping = {
        "Steps": ("steps", int),
        "Sampler": ("sampler_name", str),
        "Schedule type": ("scheduler", str),
        "CFG scale": ("cfg_scale", float),
        "Seed": ("seed", int),
        "Denoising strength": ("denoising_strength", float),
        "Model": ("sd_model_checkpoint", str),
        "Prompt": ("prompt", str),
        "Negative prompt": ("negative_prompt", str),
    }
    for src, (dst, caster) in mapping.items():
        if src in parameters and parameters[src] not in (None, ""):
            try:
                out[dst] = caster(parameters[src])
            except (TypeError, ValueError):
                pass

    if "Size-1" in parameters and "Size-2" in parameters:
        try:
            out["width"] = int(parameters["Size-1"])
            out["height"] = int(parameters["Size-2"])
        except (TypeError, ValueError):
            pass

    if "modules" not in out:
        modules = parse_modules_from_info(info)
        if modules:
            out["modules"] = modules
    return out


def detect_mode(source_path: str | None, fields: dict[str, Any]) -> ForgeMode:
    """Detecta txt2img vs img2img por ruta de salida y/o denoising."""
    path = (source_path or "").replace("\\", "/").lower()
    if "img2img-images" in path:
        return ForgeMode.IMG2IMG
    if "txt2img-images" in path:
        return ForgeMode.TXT2IMG
    if "denoising_strength" in fields:
        return ForgeMode.IMG2IMG
    return ForgeMode.TXT2IMG


def build_api_body(fields: dict[str, Any], mode: ForgeMode) -> tuple[dict[str, Any], dict[str, Any], list[str], list[str]]:
    """
    Construye body A1111 + override_settings.
    Returns: body, override_settings, recovered_field_names, omitted_notes
    """
    body: dict[str, Any] = {}
    override: dict[str, Any] = {}
    recovered: list[str] = []
    notes: list[str] = []

    direct = [
        "prompt",
        "negative_prompt",
        "steps",
        "sampler_name",
        "scheduler",
        "cfg_scale",
        "seed",
        "width",
        "height",
        "denoising_strength",
    ]
    for key in direct:
        if key in fields:
            body[key] = fields[key]
            recovered.append(key)

    if mode == ForgeMode.TXT2IMG and "denoising_strength" in body:
        # txt2img puede ignorarlo; lo dejamos si venía, pero no es obligatorio
        pass

    if "sd_model_checkpoint" in fields:
        override["sd_model_checkpoint"] = fields["sd_model_checkpoint"]
        recovered.append("sd_model_checkpoint")

    modules = fields.get("modules") or []
    if modules:
        recovered.append("modules")

    if "prompt" not in body:
        notes.append("prompt ausente en último gen; se sustituirá por el de escena")
    if mode == ForgeMode.IMG2IMG and "denoising_strength" not in body:
        notes.append("img2img sin denoising_strength en infotext")

    return body, override, recovered, notes
