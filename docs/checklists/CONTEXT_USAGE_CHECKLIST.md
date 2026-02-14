# Checklist: Uso de contexto (prompt + respuesta) en el panel de conversación

**Objetivo:** Mostrar en el panel de conversación el uso de contexto (tokens del prompt y de la respuesta) frente al contexto máximo del modelo, mediante una barra de progreso. La información debe ser extensible a distintos proveedores, cada uno con su forma de reportar tokens y contexto máximo.

**Referencias:**
- **Ollama API (streaming):** En el chunk final (`done: true`) devuelve `prompt_eval_count` (tokens de entrada), `eval_count` (tokens de salida). [Ollama API - Generate](https://docs.ollama.com/api/generate), [Streaming](https://docs.ollama.com/api/streaming).
- **Mancer / OpenAI-compatible:** En streaming suele enviar `usage: { prompt_tokens, completion_tokens }` en el último mensaje o en un chunk de finalización.
- **Contexto máximo:** Puede venir de (1) ficha del modelo (`provider_info` vía show_model, ej. `model_info["llama.context_length"]`), (2) preset del modelo (`config/ollama.json` → `num_ctx.max` por modelo), (3) `list_models` cuando el proveedor exponga `context_length` (ej. Mancer).

---

## 1. Modelo de datos unificado (usage)

- [x] **1.1** Definir estructura **normalizada** de uso de contexto para toda la app:
  - **`prompt_tokens`** (int): tokens del prompt enviado al modelo.
  - **`completion_tokens`** (int): tokens de la respuesta generada.
  - **`context_length`** (int | null): contexto máximo del modelo (opcional; si no se conoce, la barra puede mostrar solo "X + Y tokens" o "X / ?").
  Así cada proveedor mapea sus campos a estos nombres.

- [x] **1.2** Definir en backend (ej. `app/schemas.py` o `app/providers/base.py`) un tipo o dict de contrato, por ejemplo:
  ```text
  UsageInfo = { "prompt_tokens": int, "completion_tokens": int }
  ```
  y opcionalmente un tipo para la barra:
  ```text
  ContextUsageDisplay = { "prompt_tokens": int, "completion_tokens": int, "context_length": int | null }
  ```

- [x] **1.3** Documentar el mapeo por proveedor:
  - **Ollama:** `prompt_eval_count` → `prompt_tokens`, `eval_count` → `completion_tokens`. Contexto máximo: `provider_info.model_info["llama.context_length"]` o preset `num_ctx.max`.
  - **Mancer (OpenAI-style):** `usage.prompt_tokens`, `usage.completion_tokens`. Contexto máximo: `list_models` → `context_length` o preset si existe.
  - Otros: definir al integrar (ej. Anthropic, Cohere con sus propios campos).

---

## 2. Capacidad opcional «usage en stream»

- [x] **2.1** Decidir si se añade una capacidad explícita (ej. `usage_in_stream`) en `app/providers/capabilities.py`:
  - **Opción A (elegida):** No añadir capacidad nueva; el frontend muestra la barra siempre que reciba `usage` en la metadata del stream (si no hay datos, no se muestra o se muestra "—"). Así cualquier proveedor que rellene la metadata participa sin registrar capacidad.
  - ~~Opción B:~~ Añadir capacidad explícita y mostrar barra solo si el proveedor la tiene (descartada).

- [x] **2.2** N/A (Opción B descartada).

---

## 3. Backend: normalizar usage en el stream

- [x] **3.1** En **Ollama** (`app/providers/ollama.py`), en el `done_chunk` del streaming, incluir además de `eval_count` los campos que Ollama envía en el chunk final: `prompt_eval_count`, `eval_count`. Pasar a la metadata del chunk un objeto **normalizado** `usage`:
  ```text
  usage: { "prompt_tokens": data.get("prompt_eval_count"), "completion_tokens": data.get("eval_count") }
  ```
  para que el consumidor (API y frontend) siempre reciba el mismo esquema.

- [x] **3.2** En **Mancer** (`app/providers/mancer.py`), donde ya se hace `done_chunk(..., prompt_tokens=..., completion_tokens=...)`, unificar para que la metadata del `done_chunk` incluya un objeto `usage: { prompt_tokens, completion_tokens }` (además o en lugar de campos sueltos), coherente con Ollama.

- [x] **3.3** En el generador del stream de la API (`app/routers/api_conversations.py`), cuando se recibe `chunk.type == "done"` y `chunk.metadata`, asegurar que la línea que se envía al cliente (ej. `stream_metadata`) contenga siempre un objeto **usage** normalizado si el proveedor lo envió (ej. `{ "usage": { "prompt_tokens": n, "completion_tokens": m } }`). Si el proveedor no envía usage, no incluir `usage` o enviar `usage: null`.

- [x] **3.4** Documentar en código o en docs que cualquier proveedor nuevo que quiera alimentar la barra de contexto debe incluir en el `done_chunk` (o en un chunk previo) al menos `usage: { prompt_tokens, completion_tokens }`.

---

## 4. Backend: contexto máximo (context_length)

- [x] **4.1** Origen del contexto máximo para la barra (prioridad sugerida):
  1. **Ficha del modelo:** `GET /api/providers/{provider}/models/{model_id}/info` → `provider_info.model_info["llama.context_length"]` (Ollama) o `provider_info.details.context_length` / campo equivalente según proveedor. Ya se expone en la ficha; el frontend puede leerlo.
  2. **Preset del modelo:** Para el modelo actual, leer `config/{provider}.json` (ej. `config/ollama.json`) y tomar el `max` del parámetro `num_ctx` (o el equivalente por proveedor) como cota superior del contexto.
  3. **list_models:** Si `ProviderModelInfo.context_length` está poblado (ej. Mancer), usarlo cuando no haya ficha ni preset.

- [x] **4.2** Opción de backend: endpoint o campo existente que devuelva **solo** el `context_length` recomendado para un `(provider, model_id)` (agregando ficha + preset + list_models) para que el frontend no tenga que orquestar varias llamadas. Por ejemplo:
  - **GET** `/api/providers/{provider}/models/{model_id}/context-length` → `{ "context_length": number | null }`, o
  - Incluir en la respuesta de **GET** `.../info` un campo calculado `effective_context_length` (opcional) que resuelva la misma lógica. Decidir según preferencia (un solo GET info vs endpoint dedicado).

- [x] **4.3** Si se usa preset: en `app/provider_params.py` (o módulo que lea presets) exponer una función del tipo `get_context_length_max(provider_name: str, model_name: str) -> int | None` que devuelva el `max` de `num_ctx` del preset de ese modelo, si existe.

---

## 5. Frontend: obtención de context_length

- [x] **5.1** Al cargar la conversación o al cambiar de modelo/proveedor, obtener el **context_length** para el modelo actual:
  - Si existe endpoint dedicado (4.2): llamar a `GET .../context-length` y guardar en estado (ej. `currentContextLength`).
  - Si no: (a) llamar a `GET .../info` y extraer de `provider_info` (p. ej. `model_info["llama.context_length"]` o `details.context_length`); (b) si no viene, opcionalmente llamar a presets y leer `num_ctx.max` del modelo actual. Guardar en estado para la barra.

- [x] **5.2** Mantener en estado del panel: `contextLength: number | null`, `usage: { prompt_tokens: number, completion_tokens: number } | null`. Actualizar `usage` al recibir la metadata del stream (línea `stream_metadata` con `usage`).

---

## 6. Frontend: barra de progreso en el panel de conversación

- [x] **6.1** Ubicación: en el panel de conversación (cabecera del chat o debajo del selector de modelo), una zona dedicada a “Uso de contexto” que no ocupe demasiado espacio (ej. una fila con barra + leyenda).

- [x] **6.2** Diseño de la barra:
  - Dos segmentos o dos colores: uno para **prompt** (tokens de entrada) y otro para **respuesta** (tokens de salida), sobre el total **context_length** cuando esté disponible.
  - Si `context_length` es null: mostrar solo texto del tipo “Prompt: X tokens · Respuesta: Y tokens” (o “X + Y tokens”) sin barra, o barra sin escala total.
  - Si `context_length` está definido: barra de progreso donde la longitud total representa `context_length`; primera parte hasta `prompt_tokens`, segunda parte hasta `prompt_tokens + completion_tokens` (con leyenda “Prompt” y “Respuesta” o iconos/tooltips).

- [x] **6.3** Valores por defecto: antes de enviar un mensaje, `usage` puede ser null (ocultar barra o mostrar “—”). Tras completar el stream, actualizar con el `usage` recibido en `stream_metadata` y, si se conoce, con `context_length` ya cargado.

- [x] **6.4** Accesibilidad: etiquetas/títulos para la barra (ej. “Uso de contexto del modelo”) y si es posible `aria-*` para lectores de pantalla (p. ej. “prompt X de total Y tokens”).

---

## 7. Frontend: integración con el stream

- [x] **7.1** En el cliente que consume el stream (NDJSON), al procesar cada línea:
  - Si existe una línea con `stream_metadata` (o equivalente) que incluya `usage`, guardar `usage` en estado y actualizar la barra.
  - Si el stream envía `usage` dentro del objeto `done` (ej. `{ "done": true, "id": "...", "usage": { ... } }`), leer `usage` de ahí y actualizar estado y barra.

- [x] **7.2** Decidir alcance de la barra: ¿solo el último mensaje enviado (último turno) o acumulado de la conversación? Recomendación para MVP: **último turno** (prompt_tokens y completion_tokens de la última respuesta), ya que es lo que devuelve cada proveedor por request. Si en el futuro se quiere “uso acumulado en la conversación”, sería una extensión (backend tendría que sumar o el frontend acumular).

---

## 8. Casos borde y extensibilidad

- [x] **8.1** Proveedor sin usage: si el proveedor no envía `usage` en el stream, la barra no se muestra o se muestra solo el texto “Uso no disponible” / “—”.

- [x] **8.2** Context_length desconocido: barra solo con segmentos relativos entre prompt y respuesta (opcional) o solo texto “Prompt: X · Respuesta: Y”.

- [ ] **8.3** Modelos “thinking” (Ollama): si en el futuro el stream incluye tokens de “thinking”, decidir si se cuentan como parte de `completion_tokens` (si el proveedor ya los agrupa) o se añade un tercer segmento “Razonamiento”; por ahora mantener solo prompt_tokens y completion_tokens.

- [x] **8.4** Nuevos proveedores: documentar que para soportar la barra deben (1) incluir en el `done_chunk` (o chunk final) un objeto `usage: { prompt_tokens, completion_tokens }` y (2) opcionalmente exponer `context_length` vía ficha (show_model), list_models o preset.

---

## 9. Tests

- [x] **9.1** Test unitario o de integración: mock del stream de Ollama con `done: true, prompt_eval_count, eval_count`; comprobar que la respuesta del stream de la API incluye `usage` normalizado con `prompt_tokens` y `completion_tokens`.

- [x] **9.2** Test: Mancer (o mock) con `usage.prompt_tokens` y `usage.completion_tokens` en el chunk final; comprobar que la API reenvía el mismo esquema `usage` al cliente.

- [x] **9.3** Test: proveedor que no envía usage; comprobar que no se rompe el stream y que la respuesta no incluye `usage` (o incluye null).

- [x] **9.4** Test (opcional): función que obtiene `context_length` a partir de ficha + preset + list_models; comprobar prioridad y valores por defecto.

---

## 10. Documentación

- [ ] **10.1** Actualizar documentación de la API (o README) con el formato de `stream_metadata` / `usage` en el stream de mensajes y con el origen de `context_length`.

- [ ] **10.2** En `app/providers/capabilities.py` o en un doc de arquitectura, describir el contrato de “usage en stream” y el mapeo por proveedor (Ollama, Mancer, otros).

---

## Resumen de estructura de datos (propuesta)

**Uso normalizado (siempre en mismo formato para todos los proveedores):**
```text
usage: {
  "prompt_tokens": number,   // tokens del prompt
  "completion_tokens": number // tokens de la respuesta
}
```

**Contexto máximo (para la barra):**
```text
context_length: number | null   // desde provider_info, preset num_ctx.max, o list_models
```

**Mapeo por proveedor (resumen):**

| Proveedor | prompt_tokens     | completion_tokens | context_length (origen)                    |
|-----------|-------------------|-------------------|--------------------------------------------|
| Ollama    | prompt_eval_count | eval_count       | provider_info.model_info["llama.context_length"] o preset num_ctx.max |
| Mancer    | usage.prompt_tokens | usage.completion_tokens | list_models.context_length o preset       |

---

## Orden sugerido de implementación

1. Modelo de datos unificado y mapeo en proveedores (secciones 1, 3).  
2. Context_length: backend (4) y opcionalmente endpoint o campo en info (4.2).  
3. Frontend: obtención de context_length (5) y barra de progreso (6).  
4. Integración con el stream en el frontend (7).  
5. Capacidad opcional (2) si se adopta Opción B.  
6. Casos borde (8), tests (9) y documentación (10).
