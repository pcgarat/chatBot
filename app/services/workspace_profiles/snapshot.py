"""Normaliza el snapshot de un perfil. Rechaza cromo de UI y claves desconocidas."""

from __future__ import annotations

from app.services.workspace_profiles.models import ImagesSnapshot, WorkspaceSnapshot

NAME_MAX_LEN = 80
HISTORY_TURNS_MAX = 100
PROMPT_MAX_LEN = 4000
PROMPT_SYSTEM_MAX_LEN = 8000


class SnapshotValidationError(ValueError):
    """Snapshot inválido o nombre de perfil vacío."""


def normalize_profile_name(name: str | None) -> str:
    cleaned = " ".join(str(name or "").strip().split())
    if not cleaned:
        raise SnapshotValidationError("El nombre del perfil no puede estar vacío")
    if len(cleaned) > NAME_MAX_LEN:
        raise SnapshotValidationError(f"El nombre no puede superar {NAME_MAX_LEN} caracteres")
    return cleaned


def normalize_snapshot(raw: dict | None) -> dict:
    """Devuelve un dict canónico listo para persistir."""
    data = raw if isinstance(raw, dict) else {}
    snap = WorkspaceSnapshot(
        provider=_bounded_str(data.get("provider") or "ollama", 64) or "ollama",
        model_id=_bounded_str(data.get("model_id") or "", 128),
        model_params=_as_dict(data.get("model_params")),
        params_excluded=_str_list(data.get("params_excluded")),
        history_turns=_clamp_int(data.get("history_turns"), 0, HISTORY_TURNS_MAX, 5),
        system_instructions=_normalize_instructions(data.get("system_instructions")),
        images=_normalize_images(data.get("images")),
    )
    if not snap.model_id:
        raise SnapshotValidationError("El snapshot necesita un modelo")
    return snap.to_dict()


def _bounded_str(value: object, max_len: int) -> str:
    text = str(value or "").strip()
    return text[:max_len]


def _as_dict(value: object) -> dict:
    return dict(value) if isinstance(value, dict) else {}


def _str_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        key = str(item or "").strip()
        if key and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def _clamp_int(value: object, lo: int, hi: int, default: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _normalize_instructions(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    items: list[dict] = []
    for raw in value:
        if isinstance(raw, str):
            text = raw.strip()
            if text:
                items.append({"title": "", "content": text})
            continue
        if not isinstance(raw, dict):
            continue
        item: dict = {
            "title": str(raw.get("title") or ""),
            "content": str(raw.get("content") or ""),
        }
        rule_id = str(raw.get("rule_id") or "").strip()
        if rule_id:
            item["rule_id"] = rule_id
        if item["title"] or item["content"] or item.get("rule_id"):
            items.append(item)
    return items


def _normalize_images(value: object) -> ImagesSnapshot:
    data = value if isinstance(value, dict) else {}
    return ImagesSnapshot(
        enabled=bool(data.get("enabled")),
        use_chat_config=bool(data.get("use_chat_config")),
        images_per_response=_clamp_int(data.get("images_per_response"), 1, 50, 2),
        batch_size=_clamp_int(data.get("batch_size"), 1, 50, 10),
        retries=_clamp_int(data.get("retries"), 0, 10, 1),
        prompt=_bounded_str(data.get("prompt") or "", PROMPT_MAX_LEN),
        prompt_system_instructions=_bounded_str(
            data.get("prompt_system_instructions") or "", PROMPT_SYSTEM_MAX_LEN
        ),
        prompt_provider=_bounded_str(data.get("prompt_provider") or "", 64),
        prompt_model=_bounded_str(data.get("prompt_model") or "", 128),
    )
