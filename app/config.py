from pathlib import Path

from pydantic import field_validator
from pydantic import Field
from pydantic_settings import BaseSettings

# Raíz del proyecto (donde está .env), para cargar .env aunque se arranque desde otro directorio
_PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    ollama_host: str = "http://localhost:11434"
    database_url: str = "sqlite:///./chatbot.db"
    verbose: bool = Field(False, validation_alias="VERBOSE")  # VERBOSE=1 o -v: volcar RAG + Ollama en stderr
    # RAG con ChromaDB + embeddings con Ollama (modelo local)
    chroma_host: str = Field(default="http://localhost:8001", validation_alias="CHROMA_HOST")
    ollama_embedding_model: str = Field(
        default="mxbai-embed-large:latest",
        validation_alias="OLLAMA_EMBEDDING_MODEL",
    )
    # Por defecto se usa Ollama para embeddings. Si quieres OpenAI: EMBEDDINGS_PROVIDER=openai y OPENAI_API_KEY
    embeddings_provider: str = Field(default="ollama", validation_alias="EMBEDDINGS_PROVIDER")
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    # Número de pares usuario-asistente a enviar a Ollama como historial (0 = sin historial). Por defecto 10.
    ollama_history_turns: int = Field(default=10, validation_alias="OLLAMA_HISTORY_TURNS")

    @field_validator("ollama_history_turns", mode="before")
    @classmethod
    def parse_ollama_history_turns(cls, v):
        """Si está vacío o no es válido, devuelve 10."""
        if v is None or v == "":
            return 10
        try:
            n = int(v)
            return max(0, n)  # 0 = sin historial; valores negativos se convierten en 0
        except (ValueError, TypeError):
            return 10

    class Config:
        env_file = str(_PROJECT_ROOT / ".env")
        env_file_encoding = "utf-8"
        # Asegurar que se lean las variables del .env (no solo del entorno del proceso)
        extra = "ignore"


settings = Settings()
