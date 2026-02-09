"""Endpoints para control de Ollama (liberar memoria, etc.)."""

from fastapi import APIRouter, HTTPException

from app import ollama_client

router = APIRouter(prefix="/api", tags=["ollama"])


@router.post("/ollama/clear-memory")
def clear_ollama_memory():
    """
    Descarga todos los modelos de Ollama de VRAM/RAM (liberar memoria).
    No borra ningún modelo del disco. Cierra las cargas en memoria para que
    Ollama deje de usar GPU/RAM hasta que se vuelva a usar un modelo.
    """
    try:
        running = ollama_client.list_running_models()
        for model in running:
            try:
                ollama_client.unload_model_from_memory(model)
            except Exception:
                pass
        return {"unloaded": running}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo listar modelos en ejecución en Ollama: {e!s}",
        )
