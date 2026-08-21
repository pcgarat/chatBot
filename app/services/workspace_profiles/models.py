"""Entidades de perfiles de workspace (rig de configuración)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class WorkspaceProfile:
    """Perfil nombrado: snapshot de modelo, reglas, params e imágenes."""

    id: str
    name: str
    snapshot: dict
    created_at: datetime
    updated_at: datetime


@dataclass
class ImagesSnapshot:
    enabled: bool = False
    use_chat_config: bool = False
    images_per_response: int = 2
    batch_size: int = 10
    retries: int = 1
    prompt: str = ""
    prompt_system_instructions: str = ""
    prompt_provider: str = ""
    prompt_model: str = ""

    def to_dict(self) -> dict:
        return {
            "enabled": self.enabled,
            "use_chat_config": self.use_chat_config,
            "images_per_response": self.images_per_response,
            "batch_size": self.batch_size,
            "retries": self.retries,
            "prompt": self.prompt,
            "prompt_system_instructions": self.prompt_system_instructions,
            "prompt_provider": self.prompt_provider,
            "prompt_model": self.prompt_model,
        }


@dataclass
class WorkspaceSnapshot:
    provider: str = "ollama"
    model_id: str = ""
    model_params: dict = field(default_factory=dict)
    params_excluded: list[str] = field(default_factory=list)
    history_turns: int = 5
    system_instructions: list[dict] = field(default_factory=list)
    images: ImagesSnapshot = field(default_factory=ImagesSnapshot)

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "model_id": self.model_id,
            "model_params": self.model_params,
            "params_excluded": list(self.params_excluded),
            "history_turns": self.history_turns,
            "system_instructions": list(self.system_instructions),
            "images": self.images.to_dict(),
        }
