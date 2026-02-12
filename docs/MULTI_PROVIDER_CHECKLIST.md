# Multi-Provider LLM Integration

Extensión del chatbot para soportar múltiples proveedores de LLM además de Ollama.

## Proveedor objetivo: Mancer

- **Documentación**: https://mancer.tech/docs-api/
- **Base URL**: `https://neuro.mancer.tech`
- **API**: Compatible con OpenAI (`/oai/v1/chat/completions`)
- **Autenticación**: API Key en header `Authorization: Bearer <key>`
- **Streaming**: Soportado con SSE (`stream=true`)

---

## Diseño Arquitectónico

### Patrones de Diseño Aplicados

1. **Strategy Pattern**: Cada proveedor implementa la misma interfaz pero con comportamiento diferente
2. **Factory Pattern**: `ProviderFactory` crea instancias según configuración
3. **Protocol (Structural Subtyping)**: Interfaz definida con `typing.Protocol` para flexibilidad

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        api_conversations.py                      │
│                        api_models.py                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ProviderFactory                             │
│  get_provider(provider_type: str) -> LLMProvider                │
│  get_provider_for_conversation(conv) -> LLMProvider             │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│   OllamaProvider  │ │   MancerProvider  │ │  (FutureProvider) │
│                   │ │                   │ │                   │
│ - list_models()   │ │ - list_models()   │ │ - list_models()   │
│ - chat()          │ │ - chat()          │ │ - chat()          │
│ - chat_stream()   │ │ - chat_stream()   │ │ - chat_stream()   │
│ - validate()      │ │ - validate()      │ │ - validate()      │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

### Interfaz LLMProvider (Protocol)

```python
from typing import Protocol, AsyncIterator
from dataclasses import dataclass

@dataclass
class ProviderModelInfo:
    """Información de un modelo del proveedor."""
    name: str
    provider: str
    context_length: int | None = None
    pricing: dict | None = None  # Para Mancer: {"prompt": 0.001, "completion": 0.002}

class LLMProvider(Protocol):
    """Interfaz común para todos los proveedores de LLM."""
    
    @property
    def provider_name(self) -> str:
        """Nombre identificador del proveedor (ej: 'ollama', 'mancer')."""
        ...
    
    def list_models(self) -> list[ProviderModelInfo]:
        """Lista los modelos disponibles en este proveedor."""
        ...
    
    def chat(self, model: str, messages: list[dict]) -> str:
        """Envía mensajes y devuelve la respuesta completa."""
        ...
    
    async def chat_stream(self, model: str, messages: list[dict]) -> AsyncIterator[dict]:
        """Streaming de respuesta. Yield dicts con 'content', 'done', 'error', etc."""
        ...
    
    def validate_connection(self) -> bool:
        """Verifica que el proveedor esté accesible."""
        ...
```

---

## Checklist de Implementación

### Fase 1: Refactorización Base (Infraestructura)

- [ ] **1.1** Crear `app/providers/__init__.py` - Paquete de proveedores
- [ ] **1.2** Crear `app/providers/base.py` - Definir `LLMProvider` Protocol y `ProviderModelInfo`
- [ ] **1.3** Crear `app/providers/ollama.py` - Refactorizar `ollama_client.py` a clase `OllamaProvider`
  - [ ] Migrar `list_models()`, `chat()`, `chat_stream()`
  - [ ] Añadir `validate_connection()` y `provider_name`
  - [ ] Adaptar `chat_stream` a async iterator con formato unificado
- [ ] **1.4** Crear `app/providers/factory.py` - `ProviderFactory` para obtener proveedores
- [ ] **1.5** Tests unitarios para `OllamaProvider` (refactorizado)

### Fase 2: Configuración y Modelo de Datos

- [ ] **2.1** Actualizar `app/config.py`:
  - [ ] `default_provider: str = "ollama"` (proveedor por defecto)
  - [ ] `mancer_api_key: str = ""` (API key de Mancer)
  - [ ] `mancer_base_url: str = "https://neuro.mancer.tech"`
- [ ] **2.2** Actualizar modelo `Conversation` en `app/models.py`:
  - [ ] Añadir columna `provider: str = "ollama"` (permite override por conversación)
- [ ] **2.3** Migración de BD: añadir columna `provider` con default "ollama"
- [ ] **2.4** Actualizar schemas (`ConversationCreate`, `ConversationOut`, etc.)
- [ ] **2.5** Tests de migración y schemas

### Fase 3: Implementar MancerProvider

- [ ] **3.1** Crear `app/providers/mancer.py` - Clase `MancerProvider`:
  - [ ] `list_models()` → GET `/oai/v1/models`
  - [ ] `chat()` → POST `/oai/v1/chat/completions` (sin stream)
  - [ ] `chat_stream()` → POST `/oai/v1/chat/completions` con `stream=true`
  - [ ] `validate_connection()` → GET `/oai/v1/models` y verificar respuesta
  - [ ] Manejo de errores específicos de Mancer (créditos, rate limit)
- [ ] **3.2** Registrar `MancerProvider` en `ProviderFactory`
- [ ] **3.3** Tests unitarios para `MancerProvider` (mock de API)
- [ ] **3.4** Test de integración real con Mancer (opcional, requiere API key)

### Fase 4: Integrar en API/Router

- [ ] **4.1** Actualizar `api_models.py`:
  - [ ] Nuevo endpoint `GET /api/providers` → lista proveedores disponibles
  - [ ] Modificar `GET /api/models` → acepta `?provider=ollama|mancer` (default: todos)
  - [ ] Nuevo endpoint `GET /api/providers/{provider}/models` → modelos de un proveedor
- [ ] **4.2** Actualizar `api_conversations.py`:
  - [ ] `_stream_generator_async` → usar `provider.chat_stream()` en vez de httpx directo
  - [ ] `send_message` (no-stream) → usar `provider.chat()`
  - [ ] Obtener proveedor desde `conv.provider` o default
- [ ] **4.3** Tests de integración para endpoints actualizados

### Fase 5: Frontend

- [ ] **5.1** Selector de proveedor en UI (junto al selector de modelo o en config)
- [ ] **5.2** Al cambiar proveedor, recargar lista de modelos de ese proveedor
- [ ] **5.3** Mostrar info de proveedor en la conversación (badge o similar)
- [ ] **5.4** Manejar errores específicos de Mancer (créditos agotados, etc.)

### Fase 6: Documentación y Cleanup

- [ ] **6.1** Actualizar `.env.example` con nuevas variables
- [ ] **6.2** Documentar en README cómo configurar cada proveedor
- [ ] **6.3** Eliminar `app/ollama_client.py` (código migrado a `providers/ollama.py`)
- [ ] **6.4** Review final de código y tests

---

## Variables de Entorno Nuevas

```bash
# Proveedor por defecto (ollama, mancer)
DEFAULT_LLM_PROVIDER=ollama

# Mancer
MANCER_API_KEY=your-api-key-here
MANCER_BASE_URL=https://neuro.mancer.tech
```

---

## Formato de Modelos Unificado

Para el frontend, todos los proveedores devolverán modelos en formato consistente:

```json
{
  "name": "mytholite",
  "provider": "mancer",
  "display_name": "Mytholite (Mancer)",
  "context_length": 8192,
  "pricing": {
    "prompt_per_1k": 0.001,
    "completion_per_1k": 0.002
  }
}
```

Para Ollama (sin pricing):

```json
{
  "name": "llama3.2:latest",
  "provider": "ollama", 
  "display_name": "llama3.2:latest (Ollama)",
  "context_length": null,
  "pricing": null
}
```

---

## Notas sobre Mancer API

### Autenticación
```
Authorization: Bearer <MANCER_API_KEY>
```

### Endpoint Chat Completions
```
POST https://neuro.mancer.tech/oai/v1/chat/completions
Content-Type: application/json

{
  "model": "mytholite",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "stream": true,
  "max_tokens": 1000,
  "temperature": 0.7
}
```

### Respuesta Streaming (SSE)
```
data: {"id":"...","model":"mytholite","choices":[{"delta":{"content":"Hello"},...}]}
data: {"id":"...","model":"mytholite","choices":[{"delta":{"content":" world"},...}]}
data: [DONE]
```

### Consideraciones
- Los créditos se descuentan aunque se desconecte antes de terminar
- Usar `custom_timeout` para controlar timeout del lado del servidor
- No hay garantía de determinismo incluso con `seed` o `temperature=0`

### Stop / Cancelación

| Mecanismo | Descripción |
|-----------|-------------|
| `stop` (param) | Array de strings que detienen la generación (ej: `["###", "\n\n"]`) |
| Desconexión SSE | Al cerrar el stream, Mancer detecta y para la generación |
| `custom_timeout` | Timeout máximo de generación (servidor) |

**Implementación actual en Ollama**: Al cerrar la conexión httpx (`response.aclose()`) se detiene la generación.

**Para Mancer**: El mismo patrón funciona - al cerrar el cliente httpx/aiohttp, el servidor detecta la desconexión y deja de generar (y solo cobra hasta ese punto).

---

## Orden de Implementación Recomendado

1. **Fase 1** → Refactorizar sin romper funcionalidad actual
2. **Fase 2** → Preparar modelo de datos
3. **Fase 3** → Implementar Mancer (puede testearse aisladamente)
4. **Fase 4** → Integrar en API (aquí se conecta todo)
5. **Fase 5** → Frontend (última para no bloquear desarrollo)
6. **Fase 6** → Cleanup y docs

Cada fase debe incluir tests y pasar CI antes de continuar.
