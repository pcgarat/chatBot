# Checklist: Implementación de parámetros LLM por proveedor

Basado en **`docs/DESIGN_LLM_PARAMS.md`**.

**Objetivos:**
- Parámetros activos por proveedor definidos en archivo de configuración.
- Controles en la UI activos/deshabilitados según el proveedor seleccionado.
- Enviar en la petición solo los parámetros que el usuario ha modificado (si no cambia nada, no se envía ninguno).

---

## 1. Configuración y módulo de carga

- [ ] **1.1** Crear archivo de configuración de parámetros por proveedor:
  - [ ] Ubicación: `app/config/provider_params.yaml` o `app/config/provider_params.json`
  - [ ] Definir sección `ollama` con al menos: `temperature`, `top_p`, `top_k`, `num_predict`, `seed`, `stop` (según diseño)
  - [ ] Definir sección `mancer` con al menos: `temperature`, `max_tokens`, `top_p`, `stop` (según diseño)
  - [ ] Cada parámetro con: `api_key`, `type`, `default` y opcionalmente `min`, `max`

- [ ] **1.2** Crear módulo `app/provider_params.py`:
  - [ ] Función `_load_config()` que lee el YAML/JSON (usar PyYAML o solo JSON para evitar dependencia)
  - [ ] Caché en memoria del config (recargar al arranque o bajo demanda)
  - [ ] `get_params_config(provider_name: str) -> dict[str, ParamSpec]` (devuelve `{}` si el proveedor no está)
  - [ ] Helper `set_nested(d: dict, path: str, value: Any)` para rutas como `options.temperature`
  - [ ] (Opcional) `list_providers_with_params() -> list[str]`
  - [ ] Definir `ParamSpec` (dataclass o TypedDict) con: `api_key`, `type`, `default`, `min` (opcional), `max` (opcional)

- [ ] **1.3** Añadir dependencia PyYAML en `requirements.txt` si se usa YAML (o documentar que se usa solo JSON).

---

## 2. API: endpoint de parámetros por proveedor

- [ ] **2.1** Añadir endpoint **GET** `/api/providers/{provider}/params`:
  - [ ] Ubicación: en `app/routers/api_models.py` o nuevo router `api_providers.py` (o en el existente de providers)
  - [ ] Respuesta: `{ "provider": "<name>", "params": { "<param_id>": { "type", "default", "min", "max", "api_key" }, ... } }`
  - [ ] Si el proveedor no está en el config, devolver `params: {}` (o 404 según criterio)
  - [ ] Usar `get_params_config(provider)` desde `app/provider_params.py`

- [ ] **2.2** Documentar la ruta (docstring o OpenAPI) y probar con curl/httpx.

---

## 3. Schemas y body de envío de mensaje

- [ ] **3.1** En `app/schemas.py`:
  - [ ] Añadir a `MessageSend` el campo opcional: `model_params: Optional[dict[str, Any]] = None`
  - [ ] Documentar: "Solo incluir parámetros que el usuario ha modificado; si vacío o ausente, no se envían extras."

- [ ] **3.2** Validación (opcional en Fase 1): no obligatorio validar tipos/rangos en backend si el frontend y el config ya restringen; si se valida, usar `get_params_config(provider)` para comprobar claves y tipos.

---

## 4. Backend: mapeo de `model_params` a payload del proveedor

- [ ] **4.1** En el router de conversaciones (o en un helper en `app/provider_params.py`):
  - [ ] Antes de llamar a `provider.chat_stream(...)`, obtener `specs = get_params_config(provider_name)`
  - [ ] Si `body.model_params` existe y no está vacío:
    - [ ] Para cada `(key, value)` en `body.model_params`:
      - [ ] Si `key not in specs`, ignorar (o log)
      - [ ] Obtener `api_key` (ej. `"options.temperature"`) y escribir en estructura anidada con `set_nested`
    - [ ] Construir `extra_body` (dict) con esa estructura
  - [ ] Si no hay `model_params` o está vacío, `extra_body = {}` o `None`

- [ ] **4.2** Pasar `extra_body` al proveedor en la llamada a `chat_stream` (ver siguiente bloque).

---

## 5. Proveedores: extender `chat_stream` para aceptar `extra_body`

- [ ] **5.1** Actualizar el **Protocol** en `app/providers/base.py`:
  - [ ] Cambiar firma de `chat_stream` a: `async def chat_stream(self, model: str, messages: list[dict], extra_body: dict[str, Any] | None = None) -> AsyncIterator[StreamChunk]`
  - [ ] Documentar: `extra_body` se fusiona en el payload HTTP (anidado o raíz según proveedor).

- [ ] **5.2** En `app/providers/ollama.py`:
  - [ ] Añadir parámetro `extra_body: dict | None = None` a `chat_stream`
  - [ ] Construir `payload = {"model": model, "messages": messages, "stream": True}`
  - [ ] Si `extra_body`, hacer merge en `payload` (p. ej. `payload.update(extra_body)` o merge profundo si hay anidación; Ollama espera `{"options": {...}}` dentro de `extra_body`)
  - [ ] Usar el payload resultante en la petición HTTP (POST `/api/chat`)

- [ ] **5.3** En `app/providers/mancer.py`:
  - [ ] Añadir parámetro `extra_body: dict | None = None` a `chat_stream`
  - [ ] Construir `payload = {"model": model, "messages": messages, "stream": True}` y fusionar `extra_body` en el cuerpo raíz (Mancer/OpenAI usan `temperature`, `max_tokens`, etc. en raíz)
  - [ ] Usar el payload resultante en la petición HTTP

- [ ] **5.4** Actualizar todas las llamadas a `chat_stream` en el proyecto para pasar `extra_body` (router de conversaciones y cualquier otro que use el provider).

---

## 6. Router: inyectar `extra_body` en el flujo de streaming y no-streaming

- [ ] **6.1** En `app/routers/api_conversations.py`:
  - [ ] En `send_message_stream` (o en la función generadora que llama al provider):
    - [ ] Obtener `extra_body` a partir de `body.model_params` y `get_params_config(conv.provider)` (ver 4.1)
    - [ ] Llamar a `provider.chat_stream(model_id, llm_messages, extra_body=extra_body)`
  - [ ] Incluir `model_params` (o el payload final) en `debug_request` si se muestra en el frontend, para que el usuario vea qué se envió

- [ ] **6.2** En el endpoint **no-streaming** `send_message` (POST sin stream):
  - [ ] Añadir la misma lógica: construir `extra_body` desde `body.model_params` y pasarlo a `provider.chat()` si se extiende también la firma de `chat`; o construir el payload completo en el router y pasar solo lo necesario al proveedor según cómo se implemente `chat` (ver 5.x).

- [ ] **6.3** Si el endpoint no-streaming usa `provider.chat()` (sin `extra_body`), extender también `chat()` en el Protocol y en Ollama/Mancer para aceptar `extra_body` y aplicarlo al payload.

---

## 7. Frontend: obtener parámetros al cambiar de proveedor

- [ ] **7.1** En `app/static/js/app.js`:
  - [ ] Al cambiar de proveedor (evento `change` del `<select id="provider-select">`), llamar a **GET** `/api/providers/{provider}/params`
  - [ ] Guardar en estado (variable o objeto) la respuesta: `paramsConfig = { provider, params: { ... } }`

- [ ] **7.2** Para cada control del panel de parámetros (los que tienen `data-control-id`):
  - [ ] Si el `data-control-id` está en `paramsConfig.params`, habilitar el control y asignar valor por defecto desde `paramsConfig.params[id].default`
  - [ ] Si no está, deshabilitar el control (y opcionalmente ocultar o dejar visible en gris) y no enviar ese parámetro

- [ ] **7.3** Al cargar la página o al abrir una conversación, si ya hay un proveedor seleccionado, cargar sus params con GET `/api/providers/{provider}/params` y aplicar la misma lógica de habilitar/deshabilitar y defaults.

---

## 8. Frontend: enviar solo parámetros modificados

- [ ] **8.1** Mantener en estado los “defaults” del proveedor actual (vienen de GET params) y los “valores actuales” de cada control (cuando el usuario cambia un valor, actualizar ese estado).

- [ ] **8.2** En la función que construye el body de `POST .../messages/stream` (y la de no-stream si se usa):
  - [ ] Inicializar `model_params = {}`
  - [ ] Para cada parámetro activo (presente en `paramsConfig.params`), si `valor_actual !== default`, añadir `model_params[param_id] = valor_actual` (convertir a número o array según tipo si hace falta)
  - [ ] Enviar en el body el campo `model_params` solo si tiene al menos una clave; si está vacío, omitir el campo o enviar `{}`

- [ ] **8.3** Asegurar que los valores se leen de los inputs/selects correctos (por ejemplo `#param-temperature`, `#param-max-tokens`, etc.) y que tipos como `string_list` (stop sequences) se serializan como array de strings (ej. split por comas o por líneas).

---

## 9. Frontend: sincronizar controles con IDs del config

- [ ] **9.1** Revisar que los `data-control-id` del HTML (y los id de los inputs) coincidan con las claves del config (ej. `temperature`, `top_p`, `max_tokens`, `num_predict`, `stop`, `seed`). Ajustar nombres en el config o en el HTML para que haya correspondencia 1:1.

- [ ] **9.2** Si el config usa `num_predict` y en el panel el control se llama “Límite de tokens de salida”, seguir usando `data-control-id="max_tokens"` o un id interno que el backend traduzca; en el config de Ollama usar `num_predict` como clave interna y `api_key: "options.num_predict"`. Decidir convención (ej. ids internos genéricos: `max_tokens` en UI, y en config de Ollama `max_tokens` con `api_key: "options.num_predict"`) y aplicarla de forma consistente.

---

## 10. Tests

- [ ] **10.1** Test unitario: `get_params_config("ollama")` devuelve dict con las claves esperadas y cada entrada tiene `api_key`, `type`, `default`.
- [ ] **10.2** Test unitario: `get_params_config("unknown")` devuelve `{}`.
- [ ] **10.3** Test unitario: `set_nested` construye correctamente un dict anidado a partir de un path `"options.temperature"`.
- [ ] **10.4** Test integración: GET `/api/providers/ollama/params` devuelve 200 y estructura `{ "provider": "ollama", "params": { ... } }`.
- [ ] **10.5** Test integración: POST messages/stream con `model_params: { "temperature": 0.5 }` no falla y el payload enviado al proveedor (mock o registro) incluye el parámetro en el lugar correcto (ej. `options.temperature` para Ollama).
- [ ] **10.6** Test integración: POST messages/stream sin `model_params` (o `{}`) no envía parámetros extra al proveedor.
- [ ] **10.7** (Opcional) Test E2E o manual: cambiar de proveedor en la UI, comprobar que se habilitan/deshabilitan controles; enviar mensaje con un parámetro modificado y comprobar en debug que llega al backend y al LLM.

---

## 11. Documentación y limpieza

- [ ] **11.1** Actualizar o enlazar en el README (o en docs) la existencia de `provider_params.yaml`/`provider_params.json` y el diseño en `docs/DESIGN_LLM_PARAMS.md`.
- [ ] **11.2** Comentar en el código (router o `provider_params.py`) que los parámetros “solo se envían si el usuario los modifica” y que la fuente de verdad es el archivo de config.

---

## Orden sugerido de ejecución

1. **Config y módulo** (1.1 → 1.2)  
2. **Endpoint GET params** (2.1 → 2.2)  
3. **Schemas** (3.1 → 3.2)  
4. **Protocol y proveedores** (5.1 → 5.2 → 5.3 → 5.4)  
5. **Router: extra_body y streaming** (4.1 → 4.2 → 6.1 → 6.2/6.3)  
6. **Frontend: cargar params y habilitar controles** (7.1 → 7.2 → 7.3)  
7. **Frontend: enviar solo modificados** (8.1 → 8.2 → 8.3)  
8. **Ajuste de IDs** (9.1 → 9.2)  
9. **Tests** (10.1 → … → 10.7)  
10. **Documentación** (11.1 → 11.2)

---

## Archivos afectados (estimado)

| Archivo | Cambios |
|---------|---------|
| `app/config/provider_params.yaml` o `.json` | Nuevo |
| `app/provider_params.py` | Nuevo |
| `app/providers/base.py` | Firma de `chat_stream` (y opcionalmente `chat`) |
| `app/providers/ollama.py` | `chat_stream` + `chat` con `extra_body` |
| `app/providers/mancer.py` | `chat_stream` + `chat` con `extra_body` |
| `app/routers/api_conversations.py` | Lectura de `model_params`, construcción de `extra_body`, llamada con `extra_body` |
| `app/routers/api_models.py` o nuevo router | GET `/api/providers/{provider}/params` |
| `app/schemas.py` | Campo `model_params` en `MessageSend` |
| `app/static/js/app.js` | Carga de params al cambiar proveedor, habilitar/deshabilitar controles, construir `model_params` al enviar |
| `app/static/index.html` | (Opcional) Ajustar ids o `data-control-id` para coincidir con config |
| `requirements.txt` | PyYAML si se usa YAML |
| `tests/` | Tests unitarios e integración anteriores |
