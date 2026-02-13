# Checklist: Implementación de parámetros LLM por proveedor

Basado en **`docs/DESIGN_LLM_PARAMS.md`**.

**Estado:** Implementación inicial completada para Ollama. Config en `config/provider_params.json` (raíz del proyecto). Pendiente: sección `mancer` en config, tests 10.3/10.5/10.6, documentación 11.

**Revisión post-merge:** Comprobado en código: `provider_params.py` (get_params_config, build_extra_body, set_nested, list_providers_with_params), `api_models.py` (GET params/presets/validate), schemas (model_params), base/ollama/mancer (extra_body), api_conversations (build_extra_body, extra_body en stream y chat), app.js (loadParamsForProvider, applyParamsConfig, buildModelParams), tests params en test_api_models.

**Objetivos:**
- Parámetros activos por proveedor definidos en archivo de configuración.
- Controles en la UI activos/deshabilitados según el proveedor seleccionado.
- Enviar en la petición solo los parámetros que el usuario ha modificado (si no cambia nada, no se envía ninguno).

---

## 1. Configuración y módulo de carga

- [x] **1.1** Crear archivo de configuración de parámetros por proveedor:
  - [x] Ubicación: `config/provider_params.json` (raíz del proyecto)
  - [x] Definir sección `ollama` con: temperature, top_p, top_k, min_p, max_tokens, num_ctx, seed, stop_sequences, repeat_penalty, repeat_last_n
  - [ ] Definir sección `mancer` (pendiente)
  - [x] Cada parámetro con: `api_key`, `type`, `default` y opcionalmente `min`, `max`

- [x] **1.2** Crear módulo `app/provider_params.py`:
  - [x] Función `_load_config()` que lee el JSON
  - [x] Caché en memoria del config
  - [x] `get_params_config(provider_name)` (devuelve `{}` si el proveedor no está)
  - [x] Helper `set_nested(d, path, value)` para rutas como `options.temperature`
  - [x] `list_providers_with_params()` y `build_extra_body(provider_name, model_params)`
  - [x] Config como dict (api_key, type, default, min, max)

- [x] **1.3** Usar solo JSON (sin PyYAML).

---

## 2. API: endpoint de parámetros por proveedor

- [x] **2.1** Añadir endpoint **GET** `/api/providers/{provider}/params`:
  - [x] Ubicación: `app/routers/api_models.py`
  - [x] Respuesta: `{ "provider": "<name>", "params": { ... } }`
  - [x] Si el proveedor no está en el config, devolver `params: {}`
  - [x] Usar `get_params_config(provider)` desde `app/provider_params.py`

- [x] **2.2** Docstring en la ruta; tests en `test_api_models.py`.

---

## 3. Schemas y body de envío de mensaje

- [x] **3.1** En `app/schemas.py`:
  - [x] Añadir a `MessageSend`: `model_params: Optional[dict[str, Any]] = None`
  - [x] Documentar: "Solo incluir parámetros que el usuario ha modificado; si vacío o ausente, no se envían extras."

- [ ] **3.2** Validación (opcional en Fase 1): no implementada.

---

## 4. Backend: mapeo de `model_params` a payload del proveedor

- [x] **4.1** Helper `build_extra_body(provider_name, model_params)` en `app/provider_params.py`; el router lo usa antes de `chat_stream`/`chat`. Si no hay `model_params` o está vacío, devuelve `{}`.

- [x] **4.2** `extra_body` se pasa a `provider.chat_stream` y `provider.chat`.

---

## 5. Proveedores: extender `chat_stream` para aceptar `extra_body`

- [x] **5.1** Protocol en `app/providers/base.py`: firma `chat_stream(..., extra_body=None)` y `chat(..., extra_body=None)`; documentado.

- [x] **5.2** En `app/providers/ollama.py`: `chat_stream` y `chat` con `extra_body`; merge en payload; sync `chat` con opciones vía httpx.

- [x] **5.3** En `app/providers/mancer.py`: `chat_stream` y `chat` con `extra_body`; merge en cuerpo raíz.

- [x] **5.4** Router actualizado: todas las llamadas pasan `extra_body`.

---

## 6. Router: inyectar `extra_body` en el flujo de streaming y no-streaming

- [x] **6.1** En `api_conversations.py`: `extra_body = build_extra_body(conv.provider, body.model_params)`; se pasa a `_stream_generator_async` y a `provider.chat_stream(..., extra_body=extra_body)`; el payload de debug incluye `extra_body`.

- [x] **6.2** Endpoint no-streaming `send_message`: construye `extra_body` y lo pasa a `provider.chat(..., extra_body=extra_body)`.

- [x] **6.3** Protocol y Ollama/Mancer: `chat()` extendido con `extra_body`.

---

## 7. Frontend: obtener parámetros al cambiar de proveedor

- [x] **7.1** En `app/static/js/app.js`: al cambiar de proveedor se llama a GET `/api/providers/{provider}/params`; respuesta en `paramsConfig`.

- [x] **7.2** `applyParamsConfig()`: para cada `[data-control-id]`, si está en `paramsConfig.params` se habilita y se asigna `default`; si no, se deshabilita.

- [x] **7.3** Al cargar (`initLoad`) y al abrir conversación (`setCurrentConversation`) se llama a `loadParamsForProvider(currentProvider)`.

---

## 8. Frontend: enviar solo parámetros modificados

- [x] **8.1** Defaults en `paramsConfig.params[id].default`; valores actuales se leen de los controles al enviar.

- [x] **8.2** `buildModelParams()`: solo incluye parámetros donde `valor_actual !== default`; el body lleva `model_params` solo si hay al menos una clave.

- [x] **8.3** Valores leídos por `data-control-id`; `string_list` (stop_sequences) como array (split por líneas).

---

## 9. Frontend: sincronizar controles con IDs del config

- [x] **9.1** `data-control-id` del HTML coinciden con las claves del config (temperature, top_p, max_tokens, stop_sequences, etc.).

- [x] **9.2** Convención: id interno `max_tokens` en UI y en config; en Ollama `api_key: "options.num_predict"`. `stop_sequences` → `api_key: "options.stop"`.

---

## 10. Tests

- [x] **10.1** Cubierto por test integración GET params (get_params_config usado por el endpoint).
- [x] **10.2** Test `test_get_provider_params_unknown`: devuelve `params: {}`.
- [ ] **10.3** Test unitario: `set_nested` construye dict anidado (pendiente).
- [x] **10.4** Test `test_get_provider_params_ollama`: GET `/api/providers/ollama/params` 200 y estructura correcta.
- [ ] **10.5** Test integración: POST stream con `model_params` y comprobar payload al proveedor (pendiente).
- [ ] **10.6** Test integración: POST stream sin `model_params` (pendiente).
- [ ] **10.7** (Opcional) Test E2E o manual (pendiente).

---

## 11. Documentación y limpieza

- [ ] **11.1** Actualizar o enlazar en el README la existencia de `config/provider_params.json` y `docs/DESIGN_LLM_PARAMS.md`.
- [ ] **11.2** Comentar en el código que los parámetros solo se envían si el usuario los modifica y que la fuente de verdad es el config.

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

## Archivos afectados

| Archivo | Estado |
|---------|--------|
| `config/provider_params.json` | ✅ Config Ollama |
| `app/provider_params.py` | ✅ Nuevo |
| `app/providers/base.py` | ✅ Firma `chat_stream` y `chat` con `extra_body` |
| `app/providers/ollama.py` | ✅ `chat_stream` + `chat` con `extra_body` |
| `app/providers/mancer.py` | ✅ `chat_stream` + `chat` con `extra_body` |
| `app/routers/api_conversations.py` | ✅ `build_extra_body`, llamada con `extra_body` |
| `app/routers/api_models.py` | ✅ GET `/api/providers/{provider}/params`, `/presets`, `/validate` |
| `app/schemas.py` | ✅ Campo `model_params` en `MessageSend` |
| `app/static/js/app.js` | ✅ `loadParamsForProvider`, `applyParamsConfig`, `buildModelParams` |
| `app/static/index.html` | Sin cambios (ids ya coinciden) |
| `tests/test_api_models.py` | ✅ Tests GET params |
