"""Render de propuestas DRAFT de overlay bajo docs/research/overlay-proposals/."""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PROPOSALS_DIR = _REPO_ROOT / "docs" / "research" / "overlay-proposals"


def sanitize_model_id_for_path(model_id: str) -> str:
    """Sanitiza model id para nombre de archivo (`:` → `-`, resto no seguro → `-`)."""
    cleaned = model_id.replace(":", "-")
    cleaned = re.sub(r"[^\w.\-]+", "-", cleaned, flags=re.UNICODE)
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-.")
    return cleaned or "model"


def proposal_filename(model_id: str, when: date | None = None) -> str:
    """Nombre `{sanitized}_{YYYY-MM-DD}.md`."""
    day = when or date.today()
    return f"{sanitize_model_id_for_path(model_id)}_{day.isoformat()}.md"


def proposal_path(
    model_id: str,
    *,
    proposals_dir: Path | None = None,
    when: date | None = None,
) -> Path:
    """Ruta completa de la propuesta markdown."""
    base = proposals_dir if proposals_dir is not None else DEFAULT_PROPOSALS_DIR
    return base / proposal_filename(model_id, when)


def render_proposal_markdown(
    model_id: str,
    stub: dict[str, Any],
    *,
    provider: str = "ollama",
    wrote_overlay: bool = False,
    when: date | None = None,
) -> str:
    """Markdown mínimo DRAFT: fiable vs dudoso + aviso no-apply."""
    day = when or date.today()
    caps = stub.get("capabilities") if isinstance(stub.get("capabilities"), dict) else {}
    params = stub.get("params") if isinstance(stub.get("params"), dict) else {}
    thinking = caps.get("thinking") if isinstance(caps.get("thinking"), dict) else {}
    num_ctx = params.get("num_ctx") if isinstance(params.get("num_ctx"), dict) else {}
    overlay_path = f"config/model_overlays/{provider}.json"
    wrote_label = "escrito en overlay" if wrote_overlay else "stub dry-run (no persistido)"

    lines = [
        f"Última modificación: {day.isoformat()}",
        "",
        f"# Overlay proposal: `{model_id}`",
        "",
        f"**Provider:** `{provider}`  ",
        f"**Estado stub:** {wrote_label}  ",
        f"**Overlay path:** `{overlay_path}`  ",
        f"**Contrato:** [`SPEC_MODEL_CONTRACT_2026-09-02.md`](../../specs/SPEC_MODEL_CONTRACT_2026-09-02.md)",
        "",
        "## Resumen del stub",
        "",
        f"- `capabilities.vision`: `{caps.get('vision')}`",
        f"- `capabilities.tools`: `{caps.get('tools')}`",
        f"- `capabilities.thinking`: `{thinking}`",
        f"- `params.num_ctx`: `{num_ctx or {}}`",
        f"- `recipes`: `{stub.get('recipes', [])}` (vacío a propósito)",
        f"- `quirks`: `{stub.get('quirks', [])}` (vacío a propósito)",
        "",
        "## Fiable vs dudoso",
        "",
        "| Campo | Origen | Notas |",
        "|-------|--------|-------|",
        "| vision / tools | show capabilities | Fiable para auto-write |",
        "| thinking boolean\\|none | flag `thinking` en show | Fiable; levels requieren review |",
        "| num_ctx.max | show model_info/details | Fiable si presente; default ≠ max a revisar |",
        "| temperature / top_p / … | — | Dudoso; no auto-write |",
        "| thinking levels / true_maps_to | — | Dudoso; no inventar en JSON |",
        "| recipes / quirks | — | Dudoso; no inventar en JSON |",
        "",
        "## DRAFT — requiere revisión",
        "",
        "- [ ] ¿Thinking necesita `kind: levels` y `values` / `true_maps_to` / `can_disable`?",
        "- [ ] Defaults de sampling (`temperature`, `top_p`, …) y `num_ctx.default` ≠ max",
        "- [ ] Recipes (plantilla opcional; no copiar sin probar)",
        "- [ ] Quirks candidatos (nunca apply automático)",
        "",
        "> **Aviso:** no copiar esta sección DRAFT al overlay JSON sin revisión humana.",
        "",
    ]
    return "\n".join(lines)


def write_proposal(
    model_id: str,
    stub: dict[str, Any],
    *,
    provider: str = "ollama",
    wrote_overlay: bool = False,
    proposals_dir: Path | None = None,
    when: date | None = None,
) -> Path:
    """Escribe la propuesta markdown y devuelve la ruta."""
    path = proposal_path(model_id, proposals_dir=proposals_dir, when=when)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = render_proposal_markdown(
        model_id,
        stub,
        provider=provider,
        wrote_overlay=wrote_overlay,
        when=when,
    )
    path.write_text(content, encoding="utf-8")
    return path
