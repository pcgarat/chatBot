"""
Endpoints para listar modelos y proveedores de LLM.
"""

from fastapi import APIRouter, HTTPException, Query

from app.provider_params import get_params_config
from app.providers import ProviderFactory, get_provider
from app.schemas import ModelInfo, ProviderInfo, ProviderModelInfo

router = APIRouter(prefix="/api", tags=["models"])


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
        return [
            ProviderModelInfo(
                name=m.name,
                provider=m.provider,
                display_name=m.display_name,
                context_length=m.context_length,
                pricing=m.pricing,
            )
            for m in models
        ]
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
