from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ----- Models (Ollama) -----
class ModelInfo(BaseModel):
    name: str


# ----- Conversation -----
class ConversationCreate(BaseModel):
    title: str = "Nueva conversación"
    model_id: str = "llama3.2"
    system_instruction_global: Optional[str] = None
    inject_instruction_every: Optional[int] = None  # null/0 = cada mensaje; >0 = solo cada X mensajes de usuario


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    model_id: Optional[str] = None
    system_instruction_global: Optional[str] = None
    inject_instruction_every: Optional[int] = None


class MessageInChat(BaseModel):
    role: str
    content: str


class ConversationOut(BaseModel):
    id: str
    title: str
    model_id: str
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
    updated_at: datetime

    class Config:
        from_attributes = True


# ----- Messages -----
class MessageSend(BaseModel):
    content: str = Field(..., min_length=1)
    instruction_override: Optional[str] = None
    system_instruction_global: Optional[str] = None
    inject_instruction_every: Optional[int] = None  # Si > 0: enviar instrucción global solo cada X mensajes de usuario


class MessageResponse(BaseModel):
    role: str
    content: str
    id: Optional[str] = None

    class Config:
        from_attributes = True
