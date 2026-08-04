from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator


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


# ----- Model info (ficha por modelo: provider_info + user_info) -----
class ModelInfoUserInfo(BaseModel):
    """Datos que el usuario asocia a un modelo. instructions = reglas resueltas desde instruction_ids."""
    uncensored: bool = False
    instructions: list["RuleItem"] = Field(default_factory=list)  # Reglas resueltas (rule_id, title, content)
    instruction_ids: list[str] = Field(default_factory=list)  # Ids de reglas en la biblioteca
    tags: list[str] = Field(default_factory=list)


class ModelInfoResponse(BaseModel):
    """Respuesta de GET /api/providers/{provider}/models/.../info."""
    provider_info: dict[str, Any] = Field(default_factory=dict)
    user_info: ModelInfoUserInfo = Field(default_factory=lambda: ModelInfoUserInfo())


class ModelInfoUpdateRequest(BaseModel):
    """Body de PUT/PATCH para actualizar solo user_info (todos los campos opcionales). Límites aplicados en backend."""
    uncensored: Optional[bool] = None
    instructions: Optional[list[str]] = None  # Legado
    instruction_ids: Optional[list[str]] = None  # Ids de reglas (biblioteca)
    tags: Optional[list[str]] = None


class TagsResponse(BaseModel):
    """Respuesta de GET /api/models/tags (lista de tags únicos para autocompletado)."""
    tags: list[str] = Field(default_factory=list)


class ProviderCapabilitiesResponse(BaseModel):
    """Respuesta de GET /api/providers/{provider}/capabilities."""
    capabilities: list[str] = Field(default_factory=list)


class StreamUsageInfo(BaseModel):
    """
    Uso de tokens en el stream (normalizado para todos los proveedores).
    Los proveedores mapean sus campos (Ollama: prompt_eval_count/eval_count,
    Mancer: usage.prompt_tokens/completion_tokens) a este esquema.
    """
    prompt_tokens: int = 0
    completion_tokens: int = 0


# ----- Rules (biblioteca) -----
class RuleCreate(BaseModel):
    """Body para crear una regla en la biblioteca."""
    title: str = ""
    content: str = ""


class RuleUpdate(BaseModel):
    """Body para actualizar una regla (todos opcionales)."""
    title: Optional[str] = None
    content: Optional[str] = None


class RuleOut(BaseModel):
    """Regla devuelta por la API (biblioteca)."""
    id: str
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ----- Conversation -----
class RuleItem(BaseModel):
    """Ítem de regla en una conversación: puede ser referencia (rule_id) o inline (title+content)."""
    rule_id: Optional[str] = None  # Si existe, se resuelve desde la biblioteca
    title: str = ""
    content: str = ""


class ConversationCreate(BaseModel):
    title: str = "Nueva conversación"
    model_id: str = "llama3.2"
    provider: str = "ollama"  # ollama | mancer | openai
    system_instruction_global: Optional[str] = None
    system_instructions: Optional[list[RuleItem]] = None  # Lista de reglas (título + contenido)
    inject_instruction_every: Optional[int] = None  # Deprecado: se ignora. Las instrucciones se envían siempre.


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    model_id: Optional[str] = None
    provider: Optional[str] = None  # ollama | mancer | openai
    system_instruction_global: Optional[str] = None
    system_instructions: Optional[list[RuleItem]] = None
    inject_instruction_every: Optional[int] = None  # Deprecado: se ignora.
    model_params: Optional[dict[str, Any]] = None  # Parámetros del modelo guardados por el usuario en esta conversación
    history_turns: Optional[int] = None  # Pares user+assistant a enviar en el prompt; null = default 5
    instruction_override: Optional[str] = None  # Instrucción solo para el siguiente mensaje; último valor por conversación


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
    provider: str = "ollama"  # ollama | mancer | openai
    system_instruction_global: Optional[str] = None
    system_instructions: Optional[list[RuleItem]] = None
    inject_instruction_every: Optional[int] = None
    model_params: Optional[dict[str, Any]] = None
    history_turns: Optional[int] = None  # Pares user+assistant en el prompt; null = default 5
    instruction_override: Optional[str] = None  # Último valor de instrucción por mensaje en esta conversación
    created_at: datetime
    updated_at: datetime
    messages: list[MessageInChat] = []

    class Config:
        from_attributes = True


class ConversationListItem(BaseModel):
    id: str
    title: str
    model_id: str
    provider: str = "ollama"  # ollama | mancer | openai
    updated_at: datetime
    last_message_at: datetime | None = None

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
    # Solo incluir parámetros que el usuario ha modificado; si vacío o ausente, no se envían extras.
    model_params: Optional[dict[str, Any]] = None


class MessageResponse(BaseModel):
    role: str
    content: str
    id: Optional[str] = None

    class Config:
        from_attributes = True


class IllustrateRequest(BaseModel):
    """Opciones del panel Imágenes para POST .../illustrate."""

    images_per_response: int = Field(default=2, ge=1, le=20)
    prompt_provider: str = Field(default="ollama", min_length=1)
    prompt_model: str = Field(default="", description="Obligatorio salvo use_chat_config.")
    retries: int = Field(default=1, ge=0, le=10)
    prompt: str = Field(
        default="",
        max_length=4000,
        description="Texto opcional concatenado a cada prompt de escena antes de enviar a Forge.",
    )
    prompt_system_instructions: str = Field(
        default="",
        max_length=8000,
        description="Instrucciones adicionales de sistema para el LLM que planifica escenas/prompts.",
    )
    use_chat_config: bool = Field(
        default=False,
        description=(
            "Si true, el planificador usa provider/modelo/reglas/params de la conversación "
            "en lugar de los del panel."
        ),
    )
    include_prompt_debug: bool = Field(
        default=False,
        description="Si true, emite eventos llm_debug (request/response del planificador) por escena.",
    )
    debug: bool = False

    @model_validator(mode="after")
    def _require_prompt_model_unless_chat_config(self):
        if not self.use_chat_config and not (self.prompt_model or "").strip():
            raise ValueError("prompt_model es obligatorio si use_chat_config es false")
        return self
