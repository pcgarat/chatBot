"""Contexto de ejecución para encolar generaciones Forge."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class IllustrationRunContext:
    """Metadatos de conversación/mensaje para encolar trabajos Forge."""

    conversation_id: str
    message_id: str
    prompt_model: str | None = None
    prompt_provider: str | None = None
    batch_id: str | None = None
    retries: int = 0
    rules: dict[str, Any] = field(default_factory=dict)
    enqueue_fn: Callable[..., str] | None = None

    @property
    def uses_queue(self) -> bool:
        return self.enqueue_fn is not None
