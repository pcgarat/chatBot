"""
Tests para el sistema de proveedores de LLM.

Tests unitarios para:
- OllamaProvider
- MancerProvider
- ProviderFactory
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.providers.base import LLMProvider, ProviderModelInfo, StreamChunk
from app.providers.ollama import OllamaProvider, get_ollama_provider
from app.providers.factory import ProviderFactory, get_provider


class TestProviderModelInfo:
    """Tests para ProviderModelInfo dataclass."""

    def test_basic_creation(self):
        """Test creación básica de ProviderModelInfo."""
        info = ProviderModelInfo(name="llama3.2", provider="ollama")
        assert info.name == "llama3.2"
        assert info.provider == "ollama"
        assert info.display_name == "llama3.2 (ollama)"
        assert info.context_length is None
        assert info.pricing is None

    def test_with_all_fields(self):
        """Test creación con todos los campos."""
        info = ProviderModelInfo(
            name="mytholite",
            provider="mancer",
            display_name="Mytholite Custom",
            context_length=8192,
            pricing={"prompt_per_1k": 0.001, "completion_per_1k": 0.002},
        )
        assert info.name == "mytholite"
        assert info.display_name == "Mytholite Custom"
        assert info.context_length == 8192
        assert info.pricing["prompt_per_1k"] == 0.001


class TestStreamChunk:
    """Tests para StreamChunk dataclass."""

    def test_content_chunk(self):
        """Test creación de chunk de contenido."""
        chunk = StreamChunk.content_chunk("Hello")
        assert chunk.type == "content"
        assert chunk.content == "Hello"
        assert chunk.error is None

    def test_done_chunk(self):
        """Test creación de chunk de fin."""
        chunk = StreamChunk.done_chunk(model="llama3.2", tokens=100)
        assert chunk.type == "done"
        assert chunk.metadata["model"] == "llama3.2"
        assert chunk.metadata["tokens"] == 100

    def test_error_chunk(self):
        """Test creación de chunk de error."""
        chunk = StreamChunk.error_chunk("Connection failed", status_code=500)
        assert chunk.type == "error"
        assert chunk.error == "Connection failed"
        assert chunk.metadata["status_code"] == 500


class TestOllamaProvider:
    """Tests para OllamaProvider."""

    def test_provider_name(self):
        """Test que el nombre del proveedor es correcto."""
        provider = OllamaProvider(host="http://localhost:11434")
        assert provider.provider_name == "ollama"

    def test_host_default(self):
        """Test que usa el host de settings por defecto."""
        with patch("app.providers.ollama.settings") as mock_settings:
            mock_settings.ollama_host = "http://test:11434"
            mock_settings.verbose = False
            provider = OllamaProvider()
            assert provider.host == "http://test:11434"

    def test_host_override(self):
        """Test que se puede override el host."""
        provider = OllamaProvider(host="http://custom:11434")
        assert provider.host == "http://custom:11434"

    def test_list_models_success(self):
        """Test listado de modelos exitoso."""
        provider = OllamaProvider(host="http://localhost:11434")

        with patch.object(provider, "_get_client") as mock_client:
            mock_client.return_value.list.return_value = {
                "models": [
                    {"model": "llama3.2:latest"},
                    {"model": "codellama:13b"},
                ]
            }
            models = provider.list_models()

        assert len(models) == 2
        assert models[0].name == "llama3.2:latest"
        assert models[0].provider == "ollama"
        assert models[1].name == "codellama:13b"

    def test_list_models_connection_error(self):
        """Test error de conexión al listar modelos."""
        provider = OllamaProvider(host="http://localhost:11434")

        with patch.object(provider, "_get_client") as mock_client:
            mock_client.return_value.list.side_effect = Exception("Connection refused")

            with pytest.raises(ConnectionError) as exc_info:
                provider.list_models()
            assert "No se pudo conectar a Ollama" in str(exc_info.value)

    def test_chat_success(self):
        """Test chat exitoso."""
        provider = OllamaProvider(host="http://localhost:11434")

        with patch.object(provider, "_get_client") as mock_client:
            mock_client.return_value.chat.return_value = {
                "message": {"content": "Hello! How can I help you?"}
            }
            with patch("app.providers.ollama.settings") as mock_settings:
                mock_settings.verbose = False
                result = provider.chat(
                    "llama3.2",
                    [{"role": "user", "content": "Hi"}]
                )

        assert result == "Hello! How can I help you?"

    def test_validate_connection_success(self):
        """Test validación de conexión exitosa."""
        provider = OllamaProvider(host="http://localhost:11434")

        with patch.object(provider, "list_models") as mock_list:
            mock_list.return_value = [ProviderModelInfo(name="test", provider="ollama")]
            assert provider.validate_connection() is True

    def test_validate_connection_failure(self):
        """Test validación de conexión fallida."""
        provider = OllamaProvider(host="http://localhost:11434")

        with patch.object(provider, "list_models") as mock_list:
            mock_list.side_effect = ConnectionError("Failed")
            assert provider.validate_connection() is False

    def test_implements_protocol(self):
        """Test que OllamaProvider implementa LLMProvider protocol."""
        provider = OllamaProvider(host="http://localhost:11434")
        assert isinstance(provider, LLMProvider)


class TestOllamaProviderSingleton:
    """Tests para el singleton de OllamaProvider."""

    def test_get_ollama_provider_singleton(self):
        """Test que get_ollama_provider devuelve singleton."""
        # Reset singleton
        import app.providers.ollama as ollama_module
        ollama_module._default_provider = None

        provider1 = get_ollama_provider()
        provider2 = get_ollama_provider()
        assert provider1 is provider2


class TestProviderFactory:
    """Tests para ProviderFactory."""

    def setup_method(self):
        """Limpiar cache antes de cada test."""
        ProviderFactory.clear_cache()

    def test_get_ollama_provider(self):
        """Test obtener proveedor Ollama."""
        provider = ProviderFactory.get_provider("ollama")
        assert provider.provider_name == "ollama"
        assert isinstance(provider, OllamaProvider)

    def test_get_provider_cached(self):
        """Test que el proveedor se cachea."""
        provider1 = ProviderFactory.get_provider("ollama")
        provider2 = ProviderFactory.get_provider("ollama")
        assert provider1 is provider2

    def test_get_provider_case_insensitive(self):
        """Test que el tipo es case-insensitive."""
        provider1 = ProviderFactory.get_provider("OLLAMA")
        provider2 = ProviderFactory.get_provider("Ollama")
        assert provider1 is provider2

    def test_get_invalid_provider(self):
        """Test error con proveedor inválido."""
        with pytest.raises(ValueError) as exc_info:
            ProviderFactory.get_provider("invalid")
        assert "no soportado" in str(exc_info.value)

    def test_get_default_provider(self):
        """Test obtener proveedor por defecto."""
        with patch("app.providers.factory.settings") as mock_settings:
            mock_settings.default_llm_provider = "ollama"
            provider = ProviderFactory.get_default_provider()
            assert provider.provider_name == "ollama"

    def test_parse_model_id_with_provider_prefix(self):
        """Test parseo de model_id con prefijo de proveedor."""
        with patch("app.providers.factory.settings") as mock_settings:
            mock_settings.default_llm_provider = "ollama"
            provider_type, model_name = ProviderFactory.parse_model_id("mancer:mytholite")
            assert provider_type == "mancer"
            assert model_name == "mytholite"

    def test_parse_model_id_without_prefix(self):
        """Test parseo de model_id sin prefijo (usa default)."""
        with patch("app.providers.factory.settings") as mock_settings:
            mock_settings.default_llm_provider = "ollama"
            provider_type, model_name = ProviderFactory.parse_model_id("llama3.2:latest")
            assert provider_type == "ollama"
            assert model_name == "llama3.2:latest"

    def test_list_available_providers_ollama_only(self):
        """Test listado de proveedores (solo Ollama si no hay key de Mancer)."""
        with patch("app.providers.factory.settings") as mock_settings:
            mock_settings.mancer_api_key = ""
            providers = ProviderFactory.list_available_providers()
            assert providers == ["ollama"]

    def test_list_available_providers_with_mancer(self):
        """Test listado de proveedores (incluyendo Mancer si hay key)."""
        with patch("app.providers.factory.settings") as mock_settings:
            mock_settings.mancer_api_key = "mcr-test-key"
            providers = ProviderFactory.list_available_providers()
            assert "ollama" in providers
            assert "mancer" in providers


class TestGetProviderFunction:
    """Tests para la función get_provider."""

    def setup_method(self):
        """Limpiar cache antes de cada test."""
        ProviderFactory.clear_cache()

    def test_get_provider_with_type(self):
        """Test get_provider con tipo específico."""
        provider = get_provider("ollama")
        assert provider.provider_name == "ollama"

    def test_get_provider_default(self):
        """Test get_provider sin tipo (usa default)."""
        with patch("app.providers.factory.settings") as mock_settings:
            mock_settings.default_llm_provider = "ollama"
            provider = get_provider()
            assert provider.provider_name == "ollama"


class TestMancerProvider:
    """Tests para MancerProvider."""

    def test_provider_name(self):
        """Test que el nombre del proveedor es correcto."""
        with patch("app.providers.mancer.settings") as mock_settings:
            mock_settings.mancer_api_key = "test-key"
            mock_settings.mancer_base_url = "https://neuro.mancer.tech"
            mock_settings.verbose = False

            from app.providers.mancer import MancerProvider
            provider = MancerProvider()
            assert provider.provider_name == "mancer"

    def test_missing_api_key(self):
        """Test error si no hay API key."""
        with patch("app.providers.mancer.settings") as mock_settings:
            mock_settings.mancer_api_key = ""
            mock_settings.mancer_base_url = "https://neuro.mancer.tech"

            from app.providers.mancer import MancerProvider
            with pytest.raises(ValueError) as exc_info:
                MancerProvider()
            assert "MANCER_API_KEY" in str(exc_info.value)

    def test_api_key_override(self):
        """Test que se puede override la API key."""
        with patch("app.providers.mancer.settings") as mock_settings:
            mock_settings.mancer_api_key = "default-key"
            mock_settings.mancer_base_url = "https://neuro.mancer.tech"
            mock_settings.verbose = False

            from app.providers.mancer import MancerProvider
            provider = MancerProvider(api_key="custom-key")
            assert provider._api_key == "custom-key"

    def test_implements_protocol(self):
        """Test que MancerProvider implementa LLMProvider protocol."""
        with patch("app.providers.mancer.settings") as mock_settings:
            mock_settings.mancer_api_key = "test-key"
            mock_settings.mancer_base_url = "https://neuro.mancer.tech"
            mock_settings.verbose = False

            from app.providers.mancer import MancerProvider
            provider = MancerProvider()
            assert isinstance(provider, LLMProvider)
