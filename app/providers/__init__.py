"""
Paquete de proveedores de LLM.

Proveedores disponibles:
- OllamaProvider: Modelos locales via Ollama
- MancerProvider: Modelos cloud via Mancer.tech (API compatible OpenAI)
- OpenAIProvider: Modelos vía API oficial OpenAI
"""

from app.providers.base import LLMProvider, ProviderModelInfo
from app.providers.factory import ProviderFactory, get_provider

__all__ = [
    "LLMProvider",
    "ProviderModelInfo",
    "ProviderFactory",
    "get_provider",
]
