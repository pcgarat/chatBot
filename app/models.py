import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


def generate_uuid():
    return str(uuid.uuid4())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(512), nullable=False, default="Nueva conversación")
    model_id = Column(String(128), nullable=False, default="llama3.2")
    provider = Column(String(64), nullable=False, default="ollama")  # ollama | mancer
    system_instruction_global = Column(Text, nullable=True)  # Legado: una sola instrucción
    instruction_ids = Column(Text, nullable=True)  # JSON: lista de rule_id (referencias a rules). Fuente de verdad.
    system_instructions = Column(Text, nullable=True)  # Deprecado: antes se guardaba JSON con title+content; se mantiene para migración/legado
    inject_instruction_every = Column(Integer, nullable=True)  # Deprecado: se ignora. Las instrucciones se envían siempre.
    model_params = Column(Text, nullable=True)  # JSON: param_id -> value (parámetros guardados por el usuario en esta conversación)
    history_turns = Column(Integer, nullable=True)  # Número de pares user+assistant a enviar en el prompt; null/0 = usar default 5
    instruction_override = Column(Text, nullable=True)  # Instrucción solo para el siguiente mensaje; último valor por conversación
    active_leaf_message_id = Column(String(36), nullable=True)  # Hoja del camino de intento que se está viendo
    forked_from_conversation_id = Column(String(36), nullable=True, index=True)
    forked_from_message_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_message_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # soft-delete; null = activa

    messages = relationship(
        "Message",
        back_populates="conversation",
        order_by="Message.created_at",
        cascade="all, delete-orphan",
    )


class Rule(Base):
    """Regla reutilizable de la biblioteca. scope=chat (conversación/modelo) o planner (ilustración)."""
    __tablename__ = "rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(512), nullable=False, default="")
    content = Column(Text, nullable=False, default="")
    scope = Column(String(32), nullable=False, default="chat")  # chat | planner
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(String(36), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True, index=True)
    role = Column(String(32), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    instruction_override = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Debug: payload enviado a Ollama (solo mensajes assistant)
    debug_request_json = Column(Text, nullable=True)
    # Debug: raw del stream (líneas NDJSON enviadas al cliente)
    debug_response_raw = Column(Text, nullable=True)

    conversation = relationship("Conversation", back_populates="messages")
    illustrated_images = relationship(
        "IllustratedImage",
        back_populates="message",
        cascade="all, delete-orphan",
    )


class IllustratedImage(Base):
    """Metadatos de una imagen generada (params Forge + prompt) ligada a un mensaje."""

    __tablename__ = "illustrated_images"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(
        String(36),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename = Column(String(255), nullable=False, unique=True)
    scene_id = Column(String(64), nullable=True)
    mode = Column(String(32), nullable=False, default="txt2img")
    params_json = Column(Text, nullable=False, default="{}")
    prompt_model = Column(String(128), nullable=True)
    prompt_provider = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("Message", back_populates="illustrated_images")


class WorkspaceProfileRecord(Base):
    """Perfil de workspace: snapshot JSON de modelo, reglas, params e imágenes."""

    __tablename__ = "workspace_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(80), nullable=False, unique=True)
    snapshot_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
