"""
Capacidades opcionales por proveedor (patrón strategy).

Cada proveedor puede implementar solo las capacidades que tiene sentido:
- show_model: detalles del modelo (ej. Ollama POST /api/show).
- unload_model: descargar modelo de memoria (ej. Ollama).

La app comprueba con hasattr(provider, "show_model") antes de llamar.
"""

from app.providers import get_provider


# Nombres estables de capacidades (catálogo)
SHOW_MODEL = "show_model"
UNLOAD_MODEL = "unload_model"


def get_provider_capabilities(provider_type: str) -> list[str]:
    """
    Devuelve la lista de capacidades que soporta un proveedor.
    Usado por el frontend para mostrar/ocultar acciones (ej. "Refrescar desde proveedor", "Descargar de memoria").

    Returns:
        Lista de nombres, ej. ["show_model", "unload_model"] para Ollama.
    """
    try:
        provider = get_provider(provider_type)
    except ValueError:
        return []
    caps = []
    if hasattr(provider, "show_model") and callable(getattr(provider, "show_model")):
        caps.append(SHOW_MODEL)
    if hasattr(provider, "unload_model_from_memory") and callable(getattr(provider, "unload_model_from_memory")):
        caps.append(UNLOAD_MODEL)
    return caps


def get_model_details(provider_type: str, model_name: str) -> dict | None:
    """
    Obtiene los detalles del modelo desde el proveedor (capacidad show_model).
    Si el proveedor no implementa show_model o falla, devuelve None.
    """
    try:
        provider = get_provider(provider_type)
    except ValueError:
        return None
    if not hasattr(provider, "show_model") or not callable(getattr(provider, "show_model")):
        return None
    return provider.show_model(model_name)
