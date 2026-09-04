"""CLI del generador de overlays Ollama."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable

from app.services.model_contract.overlays import overlays_path, save_overlays
from app.tools.overlay_generator.proposal import (
    proposal_path,
    render_proposal_markdown,
    write_proposal,
)
from app.tools.overlay_generator.stub import merge_overlay, stub_from_show

ShowFn = Callable[[str], dict[str, Any] | None]
ListFn = Callable[[], list[str]]


class OverlayGeneratorError(RuntimeError):
    """Error de generación (show fallido, args inválidos, etc.)."""


def _default_show(model_id: str) -> dict[str, Any] | None:
    from app.providers import get_provider

    provider = get_provider("ollama")
    show = getattr(provider, "show_model", None)
    if not callable(show):
        return None
    return show(model_id)


def _default_list_models() -> list[str]:
    from app.providers import get_provider

    provider = get_provider("ollama")
    return [m.name for m in provider.list_models()]


def _load_overlay_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise OverlayGeneratorError(f"No se pudo leer overlays en {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise OverlayGeneratorError(f"Overlay inválido (no es objeto JSON): {path}")
    return data


def process_one_model(
    model_id: str,
    *,
    provider: str,
    write: bool,
    show_fn: ShowFn,
    overlay_file: Path,
    proposals_dir: Path,
    overlays_data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Genera stub (+ propuesta). Si write=False no toca disco.

    Returns:
        Dict con stub, merged, proposal_path, wrote flags.
    """
    show = show_fn(model_id)
    if not show:
        raise OverlayGeneratorError(
            f"show falló o modelo inexistente: provider={provider!r} model={model_id!r}"
        )

    stub = stub_from_show(model_id, show)
    data = overlays_data if overlays_data is not None else _load_overlay_file(overlay_file)
    existing = data.get(model_id) if isinstance(data.get(model_id), dict) else None
    merged = merge_overlay(existing, stub)
    prop_path = proposal_path(model_id, proposals_dir=proposals_dir)
    proposal_text = render_proposal_markdown(
        model_id,
        stub,
        provider=provider,
        wrote_overlay=write,
    )

    wrote_overlay = False
    wrote_proposal = False
    if write:
        data[model_id] = merged
        save_overlays(provider, data, path=overlay_file)
        wrote_overlay = True
        prop_path = write_proposal(
            model_id,
            stub,
            provider=provider,
            wrote_overlay=True,
            proposals_dir=proposals_dir,
        )
        wrote_proposal = True

    return {
        "model_id": model_id,
        "stub": stub,
        "merged": merged,
        "proposal_path": str(prop_path),
        "proposal_markdown": proposal_text,
        "wrote_overlay": wrote_overlay,
        "wrote_proposal": wrote_proposal,
    }


def _print_result(result: dict[str, Any], *, write: bool) -> None:
    mode = "WRITE" if write else "DRY-RUN"
    print(f"[{mode}] model={result['model_id']}")
    print(f"  proposal → {result['proposal_path']}")
    print("  stub:")
    print(json.dumps(result["stub"], ensure_ascii=False, indent=2))
    if not write:
        print("  (sin escritura; usa --write para persistir)")


def run_single(
    model_id: str,
    *,
    provider: str = "ollama",
    write: bool = False,
    show_fn: ShowFn | None = None,
    overlay_file: Path | None = None,
    proposals_dir: Path | None = None,
) -> dict[str, Any]:
    """Procesa un modelo."""
    from app.tools.overlay_generator.proposal import DEFAULT_PROPOSALS_DIR

    overlay_path = overlay_file or overlays_path(provider)
    props = proposals_dir or DEFAULT_PROPOSALS_DIR
    return process_one_model(
        model_id,
        provider=provider,
        write=write,
        show_fn=show_fn or _default_show,
        overlay_file=overlay_path,
        proposals_dir=props,
    )


def run_batch(
    *,
    provider: str = "ollama",
    write: bool = False,
    missing_only: bool = True,
    show_fn: ShowFn | None = None,
    list_fn: ListFn | None = None,
    overlay_file: Path | None = None,
    proposals_dir: Path | None = None,
) -> list[dict[str, Any]]:
    """
    Batch: missing (list ∩ ¬ overlay) o all listados.

    Un fallo de show no aborta el lote entero (best-effort); se reporta y continúa.
    Con --write, el JSON se guarda por modelo exitoso (no deja el archivo a medias
    por un show fallido posterior).
    """
    from app.tools.overlay_generator.proposal import DEFAULT_PROPOSALS_DIR

    overlay_path = overlay_file or overlays_path(provider)
    props = proposals_dir or DEFAULT_PROPOSALS_DIR
    show = show_fn or _default_show
    listed = (list_fn or _default_list_models)()
    data = _load_overlay_file(overlay_path)

    if missing_only:
        targets = [m for m in listed if m not in data]
    else:
        targets = list(listed)

    print(f"[BATCH] provider={provider} models={len(targets)} missing_only={missing_only} write={write}")
    if not targets:
        print("  (ningún modelo a procesar)")
        return []

    results: list[dict[str, Any]] = []
    for model_id in targets:
        try:
            # Recargar data tras writes previos para merge consistente
            if write:
                data = _load_overlay_file(overlay_path)
            result = process_one_model(
                model_id,
                provider=provider,
                write=write,
                show_fn=show,
                overlay_file=overlay_path,
                proposals_dir=props,
                overlays_data=data,
            )
            if write:
                data[model_id] = result["merged"]
            results.append(result)
            _print_result(result, write=write)
        except OverlayGeneratorError as exc:
            print(f"[ERROR] {model_id}: {exc}", file=sys.stderr)
            results.append({"model_id": model_id, "error": str(exc)})
    return results


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m app.tools.overlay_generator",
        description="Genera stub de overlay Ollama + propuesta DRAFT (dry-run por defecto).",
    )
    parser.add_argument("--provider", default="ollama", help="Proveedor (MVP: ollama)")
    parser.add_argument("--model", help="Model id (modo un modelo)")
    parser.add_argument("--write", action="store_true", help="Persistir overlay + propuesta")
    parser.add_argument(
        "--batch-missing",
        action="store_true",
        help="Batch: modelos listados sin clave en overlay",
    )
    parser.add_argument(
        "--batch-all",
        action="store_true",
        help="Batch: todos los listados (respeta preserve en merge)",
    )
    parser.add_argument(
        "--overlay-file",
        type=Path,
        default=None,
        help="Ruta alternativa al JSON de overlays (tests)",
    )
    parser.add_argument(
        "--proposals-dir",
        type=Path,
        default=None,
        help="Directorio de propuestas (tests)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.provider != "ollama":
        print(f"Proveedor no soportado en MVP: {args.provider!r}", file=sys.stderr)
        return 2

    modes = sum(bool(x) for x in (args.model, args.batch_missing, args.batch_all))
    if modes != 1:
        parser.error("Indica exactamente uno de: --model, --batch-missing, --batch-all")

    try:
        if args.model:
            result = run_single(
                args.model,
                provider=args.provider,
                write=args.write,
                overlay_file=args.overlay_file,
                proposals_dir=args.proposals_dir,
            )
            _print_result(result, write=args.write)
            return 0

        results = run_batch(
            provider=args.provider,
            write=args.write,
            missing_only=bool(args.batch_missing),
            overlay_file=args.overlay_file,
            proposals_dir=args.proposals_dir,
        )
        errors = [r for r in results if r.get("error")]
        return 1 if errors and not any(r.get("stub") for r in results) else 0
    except OverlayGeneratorError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001 — CLI top-level
        print(f"Error inesperado: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
