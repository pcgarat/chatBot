# Checklist: Integración del proveedor OpenAI

**Objetivo:** Añadir OpenAI como proveedor de LLM en el chatBot, siguiendo la misma arquitectura que Ollama y Mancer (Protocol `LLMProvider`, Factory, parámetros por proveedor, uso de contexto).

**Referencias:**
- **OpenAI API:** [Overview](https://developers.openai.com/api/reference/overview/), [Chat Completions](https://platform.openai.com/docs/api-reference/chat), [Streaming](https://developers.openai.com/api/docs/guides/streaming-responses)
- **Autenticación:** `Authorization: Bearer OPENAI_API_KEY` (header)
- **Base URL:** `https://api.openai.com` (oficial); soportar override para Azure/custom
- **Chat:** `POST /v1/chat/completions` — `model`, `messages`, `stream`, `max_tokens` o `max_completion_tokens`, `temperature`, `top_p`, `stop`, `presence_penalty`, `frequency_penalty`
- **Listar modelos:** `GET /v1/models` — respuesta: `data[]` con `id`, `object`, `created`, `owned_by` (no incluye `context_length` en el listado estándar)
- **Recuperar modelo:** `GET /v1/models/{model}` — revisar si devuelve ventana de contexto; si no, usar preset o mapa estático por modelo

---

## 1. Configuración

- [x] **1.1** En `app/config.py`:
  - Reutilizar `openai_api_key` (ya existe para embeddings). Si se desea uso solo-LLM sin embeddings, la misma variable sirve.
  - Añadir `openai_base_url: str = "https://api.openai.com"` (para Azure o proxies: `OPENAI_BASE_URL`).
- [ ] **1.2** Actualizar `.env.example` con:
  - `OPENAI_API_KEY=sk-...` (ya documentado si se usa embeddings)
  - `OPENAI_BASE_URL=https://api.openai.com` (opcional)

---

## 2. Proveedor: interfaz y clase

- [x] **2.1** Crear `app/providers/openai.py` con clase `OpenAIProvider` que implemente el Protocol `LLMProvider`:
  - `provider_name` → `"openai"`.
  - `list_models()` → `GET {base_url}/v1/models`, mapear `data[].id` a `ProviderModelInfo(name=id, provider="openai", display_name=..., context_length=...)`.
    - Si la API no devuelve `context_length` en el listado, obtenerlo por modelo vía `GET /v1/models/{id}` (Retrieve) si ese endpoint expone ventana de contexto; si no, dejar `context_length=None` y depender de preset/`config/openai.json` (ver 3.2).
  - `chat()` → `POST {base_url}/v1/chat/completions` con `stream: false`; extraer `choices[0].message.content`.
  - `chat_stream()` → mismo endpoint con `stream: true`; leer SSE (`data: {...}` / `data: [DONE]`), extraer `choices[0].delta.content`; en el chunk final incluir `usage: { prompt_tokens, completion_tokens }` si la API lo envía (normalizado como en Mancer/Ollama).
  - `validate_connection()` → por ejemplo `GET /v1/models` y comprobar respuesta OK.
- [x] **2.2** Manejo de errores:
  - HTTP 401: API key inválida o faltante.
  - HTTP 429: rate limit (reintentos o mensaje claro al usuario).
  - Cuerpo de error OpenAI: `error.message` (igual que Mancer).
- [x] **2.3** OpenAI no expone `show_model` ni `unload_model_from_memory`; no implementar esos métodos (las capacidades quedarán `[]` para openai; la UI ya oculta “Refrescar desde proveedor” cuando no hay `show_model`).

---

## 3. Parámetros y presets

- [x] **3.1** En `config/provider_params.json` añadir entrada `"openai"` con parámetros compatibles con la API:
  - `temperature` → `api_key: "temperature"`, type float, default p.ej. 0.7, min 0, max 2.
  - `max_tokens` → `api_key: "max_tokens"` (o `max_completion_tokens` si se usa solo para modelos que lo requieran; documentar en comentario). Tipo int, default p.ej. 1024, min -1/max según doc.
  - `top_p` → `api_key: "top_p"`, float, default 1, min 0, max 1.
  - `stop_sequences` → `api_key: "stop"`, type `string_list`, default [] (OpenAI acepta hasta 4 cadenas).
  - `presence_penalty` → `api_key: "presence_penalty"`, float, default 0, rango según doc (-2..2).
  - `frequency_penalty` → `api_key: "frequency_penalty"`, float, default 0, rango según doc (-2..2).
  - No incluir `seed` si la API lo tiene deprecado/beta; si se incluye, documentar “best effort”.
- [x] **3.2** Crear `config/openai.json` con presets por modelo: `context_length.max`, `max_tokens` y `tags` (features, modalities, endpoints). En GET/PUT/POST .../info para openai, los tags del preset se fusionan con los tags de usuario en la respuesta.

---

## 4. Contexto máximo (context_length)

- [x] **4.1** Origen del contexto máximo para OpenAI (prioridad):
  1. **Ficha del modelo:** Si en el futuro se rellena `provider_info` (p.ej. desde Retrieve model o caché), usar `details.context_length` o equivalente (alineado con `_resolve_context_length` en `api_models.py`).
  2. **Preset:** En `config/openai.json`, por modelo, clave con `max` para contexto (p.ej. clave tipo `context_length` o la que use `get_context_length_max` para openai).
  3. **list_models:** Si se obtiene `context_length` en `OpenAIProvider.list_models()` (vía Retrieve o respuesta extendida), `ProviderModelInfo.context_length` ya alimenta `_resolve_context_length`.
- [x] **4.2** Si la API nunca devuelve contexto en listado ni en Retrieve: documentar en código que la barra de uso de contexto mostrará “—” o solo tokens usados hasta que exista preset en `config/openai.json` o se añada un mapa estático por `model_id` en el proveedor.

---

## 5. Factory e integración en la app

- [x] **5.1** En `app/providers/factory.py`:
  - Registrar `"openai"` en `ProviderFactory.get_provider()` (crear `OpenAIProvider()` cuando `provider_type == "openai"`).
  - En `list_available_providers()`: incluir `"openai"` solo si `settings.openai_api_key` está definida (no vacía).
  - En `parse_model_id()`: añadir `"openai"` a la lista de prefijos conocidos (`ollama`, `mancer`, `openai`).
  - Actualizar mensaje de error “Proveedores disponibles” para incluir `openai`.
- [x] **5.2** En `app/providers/__init__.py`: documentar OpenAIProvider (creación vía factory). si se usa desde tests o desde factory por nombre (o mantener creación solo vía factory).

---

## 6. API y rutas

- [x] **6.1** Los endpoints existentes son por `provider_name`; no hace falta cambiar rutas. Comprobar que:
  - `GET /api/providers` devuelve `openai` cuando hay API key.
  - `GET /api/providers/openai/models` lista modelos de OpenAI.
  - `GET /api/providers/openai/models/{model_id}/context-length` devuelve `context_length` (null o número) según 4.1/4.2.
  - `GET /api/providers/openai/params` y `.../presets` devuelven config y presets de openai.
- [x] **6.2** En `api_conversations.py` la conversación ya usa `conv.provider` y `get_provider(conv.provider)`; al crear/actualizar conversación con `provider="openai"` debe usarse `OpenAIProvider` sin cambios adicionales en el router (salvo que se añada lógica específica por proveedor).

---

## 7. Schemas y modelo de datos

- [x] **7.1** En `app/schemas.py`, comentarios actualizados a "ollama | mancer | openai".
- [x] **7.2** Migraciones de BD: la columna `provider` en conversaciones suele ser string libre; no suele requerir migración. Verificar que no haya checks que excluyan `openai`.

---

## 8. Uso de contexto (usage) en streaming

- [x] **8.1** En `chat_stream()` de OpenAI, al recibir el último chunk o un chunk con `usage` (OpenAI a veces envía usage en el último evento), normalizar a `StreamChunk.done_chunk(..., usage={"prompt_tokens": n, "completion_tokens": m})` para que la barra de uso de contexto en el frontend funcione igual que con Ollama/Mancer.
- [x] **8.2** Documentar en comentario del proveedor que el cliente NDJSON espera `usage` en metadata del chunk `done` cuando el proveedor lo proporcione.

---

## 9. Tests

- [x] **9.1** Tests unitarios de `OpenAIProvider` en `tests/test_providers.py` (TestOpenAIProvider): list_models, chat, chat_stream, validate_connection, HTTP 401.
- [x] **9.2** Tests de integración en TestProviderFactory: get_openai_provider, list_available_providers_with_openai, parse_model_id_openai_prefix.
- [x] **9.3** Tests e2e en `test_e2e_api.py`: list_providers_includes_openai_when_key_set, openai_models, openai_validate, openai_params, openai_context_length (fixture openai_available hace skip si no hay OPENAI_API_KEY).

---

## 10. Frontend

- [ ] **10.1** El selector de proveedor y el de modelos ya son genéricos (carga modelos por `GET /api/providers/{provider}/models`). Comprobar que al elegir “openai” se listen los modelos de OpenAI y que se pueda crear/enviar mensajes en una conversación con provider openai.
- [ ] **10.2** Si hay etiquetas o textos que listen “Ollama, Mancer”, actualizar a “Ollama, Mancer, OpenAI” donde tenga sentido (p.ej. en documentación o tooltips).

---

## 11. Documentación y cierre

- [ ] **11.1** Actualizar `docs/MULTI_PROVIDER_CHECKLIST.md` o equivalente indicando que OpenAI está soportado y cómo configurarlo (OPENAI_API_KEY, OPENAI_BASE_URL opcional).
- [ ] **11.2** En el checklist de uso de contexto (CONTEXT_USAGE_CHECKLIST), añadir nota: para OpenAI, `context_length` puede venir de preset o de list_models si se enriquece con Retrieve/model docs.
- [ ] **11.3** Revisión final: linter, tests sin e2e (`make test` o `pytest tests/ -m "not e2e"`), y opcionalmente un test e2e con OpenAI si se dispone de API key.

---

## Resumen de archivos a tocar

| Archivo | Acción |
|--------|--------|
| `app/config.py` | Añadir `openai_base_url` (opcional). Reutilizar `openai_api_key`. |
| `app/providers/openai.py` (o `openai_provider.py`) | Nueva clase `OpenAIProvider` (list_models, chat, chat_stream, validate_connection). |
| `app/providers/factory.py` | Registrar openai; incluir en list_available_providers cuando hay key; parse_model_id. |
| `config/provider_params.json` | Entrada `"openai"` con temperature, max_tokens, top_p, stop, presence_penalty, frequency_penalty. |
| `config/openai.json` | (Opcional) Presets por modelo y/o context_length por modelo. |
| `app/schemas.py` | Añadir "openai" en enums/listas de proveedor si existen. |
| Tests | Unitarios del proveedor (mock); integración factory; e2e opcional. |
| `.env.example` | OPENAI_API_KEY, OPENAI_BASE_URL (opcional). |
| Docs | MULTI_PROVIDER, CONTEXT_USAGE, README si aplica. |

---

## Notas API OpenAI (Chat Completions)

- **Request:** `POST https://api.openai.com/v1/chat/completions`  
  - Body: `model`, `messages` (array de `{role, content}`), `stream`, `max_tokens` o `max_completion_tokens`, `temperature`, `top_p`, `stop` (string o array de hasta 4), `presence_penalty`, `frequency_penalty`.
- **Response (no stream):** `choices[0].message.content`, `usage.prompt_tokens`, `usage.completion_tokens`.
- **Streaming (SSE):** eventos `data: {...}`; contenido en `choices[0].delta.content`; evento final puede incluir `usage`; `data: [DONE]` indica fin.
- **Organización/proyecto:** headers opcionales `OpenAI-Organization`, `OpenAI-Project` (no obligatorios para integración básica).
