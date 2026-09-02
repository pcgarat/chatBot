"""Entidades del contrato de modelo (capacidades, params, recetas)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ThinkingCapability:
    """Cómo se controla el razonamiento del modelo (no es un param más)."""

    kind: str = "none"  # "none" | "boolean" | "levels"
    values: tuple[str, ...] = ()
    can_disable: bool = True
    true_maps_to: str | None = None
    default: str | bool | None = None


@dataclass(frozen=True)
class ModelCapabilities:
    vision: bool = False
    tools: bool = False
    structured_output: bool = False
    thinking: ThinkingCapability = field(default_factory=ThinkingCapability)


@dataclass(frozen=True)
class Recipe:
    id: str
    label: str
    params: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ModelContract:
    """Contrato efectivo: qué puede el modelo, qué params hay, recetas y quirks."""

    provider: str
    model: str
    capabilities: ModelCapabilities
    params: dict = field(default_factory=dict)
    recipes: tuple[Recipe, ...] = ()
    quirks: tuple[str, ...] = ()


def empty_model_contract(provider: str, model: str) -> ModelContract:
    """Null Object: modelo sin overlay ni show (thinking none, sin recetas)."""
    return ModelContract(
        provider=provider,
        model=model,
        capabilities=ModelCapabilities(),
        params={},
        recipes=(),
        quirks=(),
    )


def contract_as_dict(contract: ModelContract) -> dict:
    """Serialización estable para la API (mismo shape que la spec)."""
    th = contract.capabilities.thinking
    return {
        "provider": contract.provider,
        "model": contract.model,
        "capabilities": {
            "vision": contract.capabilities.vision,
            "tools": contract.capabilities.tools,
            "structured_output": contract.capabilities.structured_output,
            "thinking": {
                "kind": th.kind,
                "values": list(th.values),
                "can_disable": th.can_disable,
                "true_maps_to": th.true_maps_to,
                "default": th.default,
            },
        },
        "params": contract.params,
        "recipes": [
            {"id": r.id, "label": r.label, "params": r.params} for r in contract.recipes
        ],
        "quirks": list(contract.quirks),
    }
