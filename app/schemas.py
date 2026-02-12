from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ----- Models -----
class ModelInfo(BaseModel):
    """Información básica de un modelo (compatibilidad)."""
    name: str


class ProviderModelInfo(BaseModel):
    """Información extendida de un modelo con proveedor."""
    name: str
    provider: str
    display_name: str | None = None
    context_length: int | None = None
    pricing: dict[str, float] | None = None


class ProviderInfo(BaseModel):
    """Información de un proveedor de LLM."""
    name: str
    available: bool = True


# ----- Conversation -----
class ConversationCreate(BaseModel):
    title: str = "Nueva conversación"
    model_id: str = "llama3.2"
    provider: str = "ollama"  # ollama | mancer
    system_instruction_global: Optional[str] = None
    inject_instruction_every: Optional[int] = None  # Deprecado: se ignora. Las instrucciones se envían siempre.


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    model_id: Optional[str] = None
    provider: Optional[str] = None  # ollama | mancer
    system_instruction_global: Optional[str] = None
    inject_instruction_every: Optional[int] = None  # Deprecado: se ignora.


class MessageInChat(BaseModel):
    role: str
    content: str
    id: Optional[str] = None
    debug_request: Optional[str] = None  # JSON enviado al LLM (solo assistant)
    debug_response: Optional[str] = None  # Raw del stream (solo assistant)


class ConversationOut(BaseModel):
    id: str
    title: str
    model_id: str
    provider: str = "ollama"
    system_instruction_global: Optional[str] = None
    inject_instruction_every: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageInChat] = []

    class Config:
        from_attributes = True


class ConversationListItem(BaseModel):
    id: str
    title: str
    model_id: str
    provider: str = "ollama"
    updated_at: datetime

    class Config:
        from_attributes = True


# Qué guardar en ChromaDB: "none" nada, "user" solo mensajes usuario, "assistant" solo respuestas, "both" ambos
SaveToChromadbKind = Literal["none", "user", "assistant", "both"]


# ----- Messages -----
class MessageSend(BaseModel):
    content: str = Field(..., min_length=1)
    instruction_override: Optional[str] = None
    system_instruction_global: Optional[str] = None
    inject_instruction_every: Optional[int] = None  # Deprecado: se ignora.
    save_to_chromadb: SaveToChromadbKind = "user"  # qué indexar en Chroma: none, user, assistant, both


class MessageResponse(BaseModel):
    role: str
    content: str
    id: Optional[str] = None

    class Config:
        from_attributes = True
