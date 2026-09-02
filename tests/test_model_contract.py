"""Tests del dominio model_contract: tipos, thinking, overlays y contrato vacío."""

from app.services.model_contract import overlays as overlays_mod
from app.services.model_contract.models import (
    ModelCapabilities,
    ModelContract,
    ThinkingCapability,
    empty_model_contract,
)
from app.services.model_contract.overlays import load_overlays
from app.services.model_contract.resolve import resolve_model_contract
from app.services.model_contract.thinking import normalize_think_value


def _clear_overlay_cache(provider: str | None = None) -> None:
    if provider is not None:
        overlays_mod._cache.pop(provider, None)
    else:
        overlays_mod._cache.clear()


def test_empty_model_contract_es_null_object():
    """Sin overlay: thinking none, sin recetas ni quirks, params vacíos."""
    contract = empty_model_contract("ollama", "llama3.2")
    assert isinstance(contract, ModelContract)
    assert contract.provider == "ollama"
    assert contract.model == "llama3.2"
    assert contract.capabilities.thinking.kind == "none"
    assert contract.capabilities.vision is False
    assert contract.capabilities.tools is False
    assert contract.recipes == ()
    assert contract.quirks == ()
    assert contract.params == {}


def test_thinking_boolean_vs_levels():
    """boolean y levels son kinds distintos; none no tiene values."""
    none = ThinkingCapability(kind="none")
    boolean = ThinkingCapability(kind="boolean", values=("false", "true"), can_disable=True)
    levels = ThinkingCapability(
        kind="levels",
        values=("low", "medium", "high"),
        can_disable=False,
        true_maps_to="medium",
        default="medium",
    )
    assert none.kind == "none"
    assert boolean.kind == "boolean"
    assert levels.kind == "levels"
    assert levels.can_disable is False
    assert levels.true_maps_to == "medium"


def test_normalize_think_none_no_envia():
    """kind none: no hay valor de think que enviar."""
    thinking = ThinkingCapability(kind="none")
    assert normalize_think_value(thinking, True) is None
    assert normalize_think_value(thinking, False) is None
    assert normalize_think_value(thinking, "max") is None


def test_normalize_think_boolean():
    thinking = ThinkingCapability(kind="boolean", can_disable=True)
    assert normalize_think_value(thinking, False) is False
    assert normalize_think_value(thinking, "false") is False
    assert normalize_think_value(thinking, True) is True
    assert normalize_think_value(thinking, "true") is True


def test_normalize_think_gpt_oss_coerce_false_a_true_maps_to():
    """can_disable false: think false/true se coaccionan a true_maps_to."""
    thinking = ThinkingCapability(
        kind="levels",
        values=("low", "medium", "high"),
        can_disable=False,
        true_maps_to="medium",
        default="medium",
    )
    assert normalize_think_value(thinking, False) == "medium"
    assert normalize_think_value(thinking, "false") == "medium"
    assert normalize_think_value(thinking, True) == "medium"
    assert normalize_think_value(thinking, "high") == "high"
    assert normalize_think_value(thinking, "low") == "low"


def test_normalize_think_deepseek_permite_off_y_max():
    thinking = ThinkingCapability(
        kind="levels",
        values=("false", "true", "max"),
        can_disable=True,
        default="true",
    )
    assert normalize_think_value(thinking, False) is False
    assert normalize_think_value(thinking, "false") is False
    assert normalize_think_value(thinking, True) is True
    assert normalize_think_value(thinking, "max") == "max"


def test_normalize_think_none_usa_default():
    thinking = ThinkingCapability(kind="boolean", can_disable=True, default=False)
    assert normalize_think_value(thinking, None) is False


def test_empty_contract_capabilities_defaults():
    caps = ModelCapabilities()
    assert caps.thinking.kind == "none"
    assert caps.structured_output is False


# ----- overlays -----


def test_load_overlays_archivo_inexistente():
    _clear_overlay_cache("provider_inexistente_xyz")
    assert load_overlays("provider_inexistente_xyz") == {}


def test_load_overlays_json_invalido(tmp_path):
    _clear_overlay_cache("broken")
    (tmp_path / "broken.json").write_text("{ no json", encoding="utf-8")
    original = overlays_mod._OVERLAYS_DIR
    overlays_mod._OVERLAYS_DIR = tmp_path
    try:
        assert load_overlays("broken") == {}
    finally:
        overlays_mod._OVERLAYS_DIR = original
        _clear_overlay_cache("broken")


def test_load_overlays_ollama_tiene_dos_modelos_antagónicos():
    _clear_overlay_cache("ollama")
    data = load_overlays("ollama")
    assert set(data) == {"gpt-oss:120b-cloud", "deepseek-v4-flash:cloud"}


def test_overlay_gpt_oss_es_sparse_y_thinking_no_off():
    overlay = load_overlays("ollama")["gpt-oss:120b-cloud"]
    thinking = overlay["capabilities"]["thinking"]
    assert thinking["can_disable"] is False
    assert thinking["true_maps_to"] == "medium"
    assert list(thinking["values"]) == ["low", "medium", "high"]
    assert overlay["params"]["num_ctx"]["max"] == 131072
    assert overlay["params"]["num_ctx"]["default"] != overlay["params"]["num_ctx"]["max"]
    assert "api_key" not in overlay["params"].get("temperature", {})
    assert "top_k" not in overlay["params"]
    recipes = {r["id"]: r for r in overlay["recipes"]}
    assert "fast" in recipes and "hard" in recipes


def test_overlay_deepseek_es_sparse_con_max_y_disable():
    overlay = load_overlays("ollama")["deepseek-v4-flash:cloud"]
    thinking = overlay["capabilities"]["thinking"]
    assert thinking["can_disable"] is True
    assert "max" in thinking["values"]
    assert overlay["params"]["num_ctx"]["max"] == 1048576
    assert overlay["params"]["num_ctx"]["default"] == 32768
    recipes = {r["id"]: r for r in overlay["recipes"]}
    assert recipes["fast"]["params"]["think"] is False
    assert recipes["hard"]["params"]["think"] == "max"
    assert "coding" in recipes


# ----- resolve / merge -----


def test_resolve_sin_overlay_es_null_object_con_params_de_proveedor():
    contract = resolve_model_contract("ollama", "modelo-sin-overlay-xyz")
    assert contract.capabilities.thinking.kind == "none"
    assert contract.recipes == ()
    assert "think" not in contract.params
    assert contract.params["temperature"]["api_key"] == "options.temperature"
    assert contract.params["num_ctx"]["max"] == 131072


def test_resolve_show_thinking_sin_overlay_es_boolean_no_inventa_niveles():
    show = {"capabilities": ["completion", "thinking", "vision", "tools"]}
    contract = resolve_model_contract("ollama", "otro-modelo", show=show)
    assert contract.capabilities.thinking.kind == "boolean"
    assert contract.capabilities.thinking.values == ()
    assert contract.capabilities.vision is True
    assert contract.capabilities.tools is True
    assert "think" in contract.params
    assert contract.params["think"]["api_key"] == "think"
    assert contract.params["think"]["type"] == "boolean"


def test_resolve_show_none_no_lanza():
    contract = resolve_model_contract("ollama", "modelo-sin-overlay-xyz", show=None)
    assert contract.capabilities.thinking.kind == "none"


def test_resolve_show_invalido_no_lanza():
    contract = resolve_model_contract("ollama", "modelo-sin-overlay-xyz", show=["no-dict"])
    assert contract.capabilities.thinking.kind == "none"


def test_resolve_gpt_oss_antagonista():
    contract = resolve_model_contract("ollama", "gpt-oss:120b-cloud")
    th = contract.capabilities.thinking
    assert th.kind == "levels"
    assert th.can_disable is False
    assert th.true_maps_to == "medium"
    assert th.values == ("low", "medium", "high")
    assert contract.capabilities.vision is False
    assert contract.params["num_ctx"]["max"] == 131072
    assert contract.params["num_ctx"]["default"] == 32768
    assert contract.params["temperature"]["api_key"] == "options.temperature"
    assert contract.params["temperature"]["default"] == 0.4
    assert contract.params["think"]["api_key"] == "think"
    recipes = {r.id: r for r in contract.recipes}
    assert recipes["fast"].params["think"] == "low"
    assert recipes["hard"].params["think"] == "high"


def test_resolve_deepseek_antagonista():
    contract = resolve_model_contract("ollama", "deepseek-v4-flash:cloud")
    th = contract.capabilities.thinking
    assert th.kind == "levels"
    assert th.can_disable is True
    assert "max" in th.values
    assert contract.capabilities.vision is False
    assert contract.params["num_ctx"]["max"] == 1048576
    assert contract.params["num_ctx"]["default"] == 32768
    assert contract.params["temperature"]["api_key"] == "options.temperature"
    assert contract.params["think"]["api_key"] == "think"
    recipes = {r.id: r for r in contract.recipes}
    assert recipes["fast"].params["think"] is False
    assert recipes["hard"].params["think"] == "max"


def test_resolve_overlay_gana_sobre_show_en_thinking():
    """Show no inventa niveles si el overlay ya define thinking."""
    show = {"capabilities": ["thinking", "vision"]}
    contract = resolve_model_contract("ollama", "gpt-oss:120b-cloud", show=show)
    assert contract.capabilities.thinking.kind == "levels"
    assert contract.capabilities.thinking.can_disable is False
    assert contract.capabilities.vision is False


def test_resolve_live_context_rellena_max_si_overlay_no_lo_trae():
    show = {
        "capabilities": ["completion"],
        "model_info": {"llama.context_length": 8192},
    }
    contract = resolve_model_contract("ollama", "modelo-sin-overlay-xyz", show=show)
    assert contract.params["num_ctx"]["max"] == 8192
