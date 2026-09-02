"""
Endpoints para listar modelos y proveedores de LLM.
Incluye ficha de modelo (provider_info + user_info) y capacidades por proveedor.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud import get_rule as crud_get_rule
from app.db import get_db
from app.model_info import MAX_TAG_LENGTH, MAX_TAGS, get_all_tags, get_model_info, set_model_info, update_user_info
from app.provider_params import get_context_length_max, get_params_config, get_presets
from app.providers import ProviderFactory, get_provider
from app.providers.capabilities import get_model_details, get_provider_capabilities
from app.services.model_contract import contract_as_dict, resolve_model_contract
from app.schemas import (
    ModelInfo,
    ModelInfoResponse,
    ModelInfoUpdateRequest,
    ModelInfoUserInfo,
    ProviderCapabilitiesResponse,
    ProviderInfo,
    ProviderModelInfo,
    ModelContractResponse,
    RuleItem,
    TagsResponse,
)

router = APIRouter(prefix="/api", tags=["models"])


def _merged_tags_for_response(provider_name: str, model_id: str, user_tags: list[str]) -> list[str]:
    """
    Tags a devolver en la ficha: user_tags + tags del preset (solo openai).
    Sin duplicados, ordenados, respetando MAX_TAGS y MAX_TAG_LENGTH.
    """
    combined = list(user_tags) if user_tags else []
    if provider_name == "openai":
        presets = get_presets("openai")
        if isinstance(presets, dict):
            preset = presets.get(model_id)
            if isinstance(preset, dict) and isinstance(preset.get("tags"), list):
                combined = list(dict.fromkeys(combined + [t for t in preset["tags"] if isinstance(t, str)]))
    # Aplicar límites: longitud por tag y número total
    out = [t.strip()[:MAX_TAG_LENGTH] for t in combined if isinstance(t, str) and t.strip()][:MAX_TAGS]
    return sorted(dict.fromkeys(out))


@router.get("/providers", response_model=list[ProviderInfo])
def list_providers():
    """Lista los proveedores de LLM disponibles."""
    providers = ProviderFactory.list_available_providers()
    return [ProviderInfo(name=p, available=True) for p in providers]


@router.get("/providers/{provider_name}/params")
def get_provider_params(provider_name: str):
    """
    Devuelve los parámetros de generación soportados por un proveedor.

    La respuesta se usa en el frontend para habilitar/deshabilitar controles
    y conocer el valor por defecto de cada parámetro. Solo se envían al LLM
    los parámetros que el usuario ha modificado.
    """
    params = get_params_config(provider_name)
    return {"provider": provider_name, "params": params}


@router.get("/providers/{provider_name}/presets")
def get_provider_presets(provider_name: str):
    """
    Devuelve los presets de modelos para un proveedor (config/{provider}.json).

    Cada preset es un nombre de modelo con sus parámetros por defecto.
    Se usan en "Cargar preset" en la UI; no se aplican automáticamente.
    """
    presets = get_presets(provider_name)
    return {"provider": provider_name, "presets": presets}


@router.get("/providers/{provider_name}/validate")
def validate_provider(provider_name: str):
    """Comprueba si el proveedor está activo y aceptando conexiones. Devuelve 200 si ok, 503 si no."""
    try:
        provider = get_provider(provider_name)
        if provider.validate_connection():
            return {"ok": True}
        raise HTTPException(status_code=503, detail="Proveedor no disponible")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Proveedor {provider_name} no disponible: {e!s}",
        )


@router.get("/providers/{provider_name}/models", response_model=list[ProviderModelInfo])
def list_provider_models(provider_name: str):
    """Lista los modelos disponibles en un proveedor específico."""
    try:
        provider = get_provider(provider_name)
        models = provider.list_models()
        # Construir lista explícita (evita problemas de serialización con generadores/iteradores)
        result = []
        for m in models:
            result.append(
                ProviderModelInfo(
                    name=m.name,
                    provider=m.provider,
                    display_name=m.display_name,
                    context_length=m.context_length,
                    pricing=m.pricing,
                )
            )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo conectar al proveedor {provider_name}: {e!s}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Error al listar modelos de {provider_name}: {e!s}",
        )


@router.get("/models", response_model=list[ModelInfo])
def list_models(provider: str | None = Query(None, description="Filtrar por proveedor (ollama, mancer)")):
    """
    Lista los modelos disponibles.

    Si se especifica provider, lista solo los de ese proveedor.
    Si no, lista los del proveedor por defecto (Ollama).
    """
    try:
        if provider:
            prov = get_provider(provider)
        else:
            prov = get_provider("ollama")  # Por defecto Ollama para compatibilidad

        models = prov.list_models()
        return [ModelInfo(name=m.name) for m in models]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo conectar al proveedor: {e!s}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo listar modelos: {e!s}",
        )


@router.get("/models/all", response_model=list[ProviderModelInfo])
def list_all_models():
    """Lista todos los modelos de todos los proveedores disponibles."""
    all_models = []
    for provider_name in ProviderFactory.list_available_providers():
        try:
            provider = get_provider(provider_name)
            models = provider.list_models()
            all_models.extend([
                ProviderModelInfo(
                    name=m.name,
                    provider=m.provider,
                    display_name=m.display_name,
                    context_length=m.context_length,
                    pricing=m.pricing,
                )
                for m in models
            ])
        except Exception:
            # Si un proveedor falla, continuar con los demás
            continue
    return all_models


# ----- Ficha de modelo (provider_info + user_info) y capacidades -----


@router.get("/providers/{provider_name}/capabilities", response_model=ProviderCapabilitiesResponse)
def get_capabilities(provider_name: str):
    """Lista las capacidades que soporta el proveedor (ej. show_model, unload_model)."""
    try:
        caps = get_provider_capabilities(provider_name)
        return ProviderCapabilitiesResponse(capabilities=caps)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _resolve_instruction_ids(instruction_ids: list[str], db: Session) -> list[RuleItem]:
    """Resuelve ids de reglas a RuleItem (rule_id, title, content). Reglas borradas se omiten."""
    out = []
    for rid in instruction_ids:
        rule = crud_get_rule(db, rid)
        if rule:
            out.append(RuleItem(rule_id=rule.id, title=rule.title, content=rule.content))
    return out


@router.get(
    "/providers/{provider_name}/models/{model_id:path}/info",
    response_model=ModelInfoResponse,
)
def get_model_info_route(provider_name: str, model_id: str, db: Session = Depends(get_db)):
    """
    Devuelve la ficha del modelo (provider_info + user_info).
    instruction_ids se resuelven a instructions (lista de RuleItem) desde la biblioteca.
    Si no hay instruction_ids pero sí instructions (legado list[str]), se devuelven como RuleItem.
    """
    try:
        get_provider(provider_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    raw = get_model_info(provider_name, model_id)
    user_raw = raw["user_info"] or {}
    instruction_ids = user_raw.get("instruction_ids") or []
    instructions_resolved = _resolve_instruction_ids(instruction_ids, db)
    # Compatibilidad: si no hay instruction_ids pero sí instructions (legado list[str]), devolverlas como RuleItem
    if not instructions_resolved and instruction_ids == []:
        legacy = user_raw.get("instructions") or []
        if isinstance(legacy, list) and legacy:
            instructions_resolved = [
                RuleItem(title=("Instrucción %d" % (i + 1)), content=(s if isinstance(s, str) else str(s)))
                for i, s in enumerate(legacy)
            ]
    tags_final = _merged_tags_for_response(provider_name, model_id, user_raw.get("tags") or [])
    user_info = ModelInfoUserInfo(
        uncensored=user_raw.get("uncensored", False),
        instructions=instructions_resolved,
        instruction_ids=instruction_ids,
        tags=tags_final,
    )
    return ModelInfoResponse(provider_info=raw["provider_info"], user_info=user_info)


@router.get(
    "/providers/{provider_name}/models/{model_id:path}/contract",
    response_model=ModelContractResponse,
)
def get_model_contract(provider_name: str, model_id: str):
    """
    Contrato efectivo del modelo: capabilities, params mergeados, recipes y quirks.
    show_model es best-effort; si falla se omite la capa live.
    """
    try:
        get_provider(provider_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    show = None
    try:
        show = get_model_details(provider_name, model_id)
    except Exception:
        show = None
    contract = resolve_model_contract(provider_name, model_id, show=show)
    return contract_as_dict(contract)


@router.put(
    "/providers/{provider_name}/models/{model_id:path}/info",
    response_model=ModelInfoResponse,
)
def put_model_info_route(
    provider_name: str, model_id: str, body: ModelInfoUpdateRequest, db: Session = Depends(get_db)
):
    """Actualiza solo user_info (uncensored, instructions/instruction_ids, tags). Campos opcionales."""
    try:
        get_provider(provider_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    update_user_info(
        provider_name,
        model_id,
        uncensored=body.uncensored,
        instructions=body.instructions,
        instruction_ids=body.instruction_ids,
        tags=body.tags,
    )
    raw = get_model_info(provider_name, model_id)
    user_raw = raw["user_info"] or {}
    instruction_ids = user_raw.get("instruction_ids") or []
    instructions_resolved = _resolve_instruction_ids(instruction_ids, db)
    tags_final = _merged_tags_for_response(provider_name, model_id, user_raw.get("tags") or [])
    user_info = ModelInfoUserInfo(
        uncensored=user_raw.get("uncensored", False),
        instructions=instructions_resolved,
        instruction_ids=instruction_ids,
        tags=tags_final,
    )
    return ModelInfoResponse(provider_info=raw["provider_info"], user_info=user_info)


@router.post(
    "/providers/{provider_name}/models/{model_id:path}/info/refresh",
    response_model=ModelInfoResponse,
)
def refresh_model_provider_info(provider_name: str, model_id: str, db: Session = Depends(get_db)):
    """
    Refresca provider_info llamando a la capacidad show_model del proveedor.
    Si falla, no sobrescribe el provider_info existente; devuelve la ficha actual.
    """
    try:
        get_provider(provider_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    details = get_model_details(provider_name, model_id)
    if details is not None:
        current = get_model_info(provider_name, model_id)
        set_model_info(
            provider_name,
            model_id,
            provider_info=details,
            user_info=current["user_info"],
        )
    raw = get_model_info(provider_name, model_id)
    user_raw = raw["user_info"] or {}
    instruction_ids = user_raw.get("instruction_ids") or []
    instructions_resolved = _resolve_instruction_ids(instruction_ids, db)
    tags_final = _merged_tags_for_response(provider_name, model_id, user_raw.get("tags") or [])
    user_info = ModelInfoUserInfo(
        uncensored=user_raw.get("uncensored", False),
        instructions=instructions_resolved,
        instruction_ids=instruction_ids,
        tags=tags_final,
    )
    return ModelInfoResponse(provider_info=raw["provider_info"], user_info=user_info)


def _resolve_context_length(provider_name: str, model_id: str) -> int | None:
    """
    Resuelve el contexto máximo (tokens) para un modelo.
    Prioridad: 1) ficha (provider_info), 2) preset (num_ctx.max), 3) list_models.
    """
    raw = get_model_info(provider_name, model_id)
    provider_info = raw.get("provider_info") or {}
    model_info = provider_info.get("model_info") or {}
    details = provider_info.get("details") or {}
    ctx = (
        model_info.get("llama.context_length")
        or model_info.get("context_length")
        or details.get("context_length")
        or provider_info.get("context_length")
    )
    if ctx is not None:
        try:
            return int(ctx)
        except (TypeError, ValueError):
            pass
    ctx = get_context_length_max(provider_name, model_id)
    if ctx is not None:
        return ctx
    try:
        provider = get_provider(provider_name)
        for m in provider.list_models():
            if m.name == model_id and m.context_length is not None:
                return m.context_length
    except Exception:
        pass
    return None


@router.get("/providers/{provider_name}/models/{model_id:path}/context-length")
def get_model_context_length(provider_name: str, model_id: str):
    """
    Devuelve el contexto máximo (tokens) del modelo para la barra de uso.
    Origen: ficha del modelo (show), preset (num_ctx.max) o list_models.
    """
    try:
        get_provider(provider_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    ctx = _resolve_context_length(provider_name, model_id)
    return {"context_length": ctx}


@router.get("/models/tags", response_model=TagsResponse)
def list_model_tags():
    """Lista todos los tags únicos de las fichas (para autocompletado en la UI)."""
    return TagsResponse(tags=get_all_tags())
