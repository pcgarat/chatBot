from fastapi import APIRouter, HTTPException

from app import ollama_client
from app.schemas import ModelInfo

router = APIRouter(prefix="/api", tags=["models"])


@router.get("/models", response_model=list[ModelInfo])
def list_models():
    """Lista los modelos disponibles en Ollama."""
    try:
        names = ollama_client.list_models()
        return [ModelInfo(name=n) for n in names]
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Ollama no está disponible o no se pudo listar modelos: {e!s}",
        )
