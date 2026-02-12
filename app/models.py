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
    system_instruction_global = Column(Text, nullable=True)
    inject_instruction_every = Column(Integer, nullable=True)  # Deprecado: se ignora. Las instrucciones se envían siempre.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship(
        "Message",
        back_populates="conversation",
        order_by="Message.created_at",
        cascade="all, delete-orphan",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(32), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    instruction_override = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Debug: payload enviado a Ollama (solo mensajes assistant)
    debug_request_json = Column(Text, nullable=True)
    # Debug: raw del stream (líneas NDJSON enviadas al cliente)
    debug_response_raw = Column(Text, nullable=True)

    conversation = relationship("Conversation", back_populates="messages")
