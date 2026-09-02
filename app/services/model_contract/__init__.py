"""Contrato de modelo: capacidades, overlay y merge (sin adapters por modelo)."""

from app.services.model_contract.models import (
    ModelCapabilities,
    ModelContract,
    Recipe,
    ThinkingCapability,
    contract_as_dict,
    empty_model_contract,
)
from app.services.model_contract.overlays import load_overlays
from app.services.model_contract.resolve import resolve_model_contract
from app.services.model_contract.thinking import normalize_think_value

__all__ = [
    "ModelCapabilities",
    "ModelContract",
    "Recipe",
    "ThinkingCapability",
    "empty_model_contract",
    "contract_as_dict",
    "load_overlays",
    "normalize_think_value",
    "resolve_model_contract",
]
