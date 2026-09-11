Última modificación: 2026-09-11

# Checklist: Contrato de modelo

**Spec:** [`docs/specs/SPEC_MODEL_CONTRACT_2026-09-02.md`](../specs/SPEC_MODEL_CONTRACT_2026-09-02.md)  
**Plan:** [`docs/plans/PLAN_MODEL_CONTRACT_2026-09-02.md`](../plans/PLAN_MODEL_CONTRACT_2026-09-02.md)  
**Diseño:** [`docs/DESIGN_MODEL_CONTRACT_2026-09-02.md`](../DESIGN_MODEL_CONTRACT_2026-09-02.md)

**Estado:** **v1 merged** en `main` (PR [#36](https://github.com/pcgarat/chatBot/pull/36), squash `0b85cc8`). Overlays de **8 cloud** + defaults de contrato en UI. Siguiente: **v2** (sección al final).

**Rama v1:** `feat/model-contract` (borrada tras merge).  
**Rama v2:** crear `feat/...` al empezar (p. ej. `feat/model-contract-quirks`).

**Verificación habitual:** `make test` o `pytest tests/ -m "not e2e"`.

---

## Phase 1: Foundation

### Task 1: Tipos de dominio

**Description:** Definir el contrato en código (capabilities, thinking, params mergeables, recipes, quirks) sin I/O.

**Acceptance criteria:**
- [x] Dataclasses (o equivalentes) en `app/services/model_contract/` con `ThinkingCapability` (`kind`, `values`, `can_disable`, `true_maps_to`, `default`)
- [x] Un contrato «vacío» / Null Object para modelo sin overlay (`thinking.kind = "none"`, `recipes = []`)
- [x] Sin clases por modelo y sin imports de FastAPI en el dominio

**Verification:**
- [x] Tests de construcción/normalización del thinking (boolean vs levels, coerce documentado)
- [x] `pytest tests/test_model_contract.py -m "not e2e"` (o el módulo que se cree)

**Dependencies:** ninguna (spec aprobada)

**Files likely touched:**
- `app/services/model_contract/models.py`
- `app/services/model_contract/__init__.py`
- `tests/test_model_contract.py`

**Estimated scope:** S

---

### Task 2: Overlays JSON + loader

**Description:** Archivo sparse por proveedor y función que lo lee (caché en memoria, como presets).

**Acceptance criteria:**
- [x] `config/model_overlays/ollama.json` con entradas cloud (v1 arrancó con GPT-OSS + DeepSeek; **2026-09-11:** 9 cloud — gpt-oss, deepseek-v4-flash, gemma4-31b, glm-5.3-flash, **glm-5.3**, glm-5.2, kimi-k2.6, kimi-k3, mistral-large-3). También `openai.json`, `mancer.json`, `abliteration.json`.
- [x] Overlay = deltas + `capabilities` + `recipes` + `quirks`; no copia el schema entero
- [x] Loader: archivo ausente o JSON inválido → `{}` (mismo criterio que `get_presets`)
- [x] DeepSeek: `num_ctx.max` 1048576, default ctx ≠ max, recetas fast/coding/hard, thinking con `max` y disable
- [x] GPT-OSS: `can_disable: false`, `true_maps_to: "medium"`, values low/medium/high, recetas, `num_ctx.max` 131072

**Verification:**
- [x] Test: loader lee las claves cloud; test: provider sin archivo → `{}`

**Dependencies:** Task 1

**Files likely touched:**
- `config/model_overlays/ollama.json`
- `app/services/model_contract/overlays.py`
- `tests/test_model_contract.py`

**Estimated scope:** S

---

### Task 3: ResolveModelContract (merge)

**Description:** Fusionar provider_params + detalles live (`show_model` / ficha) + overlay. Prioridad: overlay gana en defaults/max/thinking; live aporta vision/tools/context si existen.

**Acceptance criteria:**
- [x] `resolve_model_contract(provider, model_id, *, show=None) -> ModelContract`
- [x] Sin overlay: params = schema del proveedor; thinking none salvo que `show` indique thinking (entonces kind boolean por defecto, sin niveles inventados)
- [x] Con overlay: `api_key` de params heredados del proveedor si el overlay no los redefine
- [x] `think` aparece en `params` solo si el overlay/contrato de thinking no es `none`
- [x] Show que falla o es None no lanza

**Verification:**
- [x] Tests: los dos modelos antagónicos (tabla de la spec §14 del diseño)
- [x] Test: modelo inventado + schema ollama → 200 lógico, recipes vacías
- [x] `pytest tests/test_model_contract.py -m "not e2e"`

**Dependencies:** Task 1, Task 2

**Files likely touched:**
- `app/services/model_contract/resolve.py`
- `tests/test_model_contract.py`

**Estimated scope:** M

---

### Checkpoint: Foundation

- [x] Tests de dominio en verde
- [x] El mismo merge cubre GPT-OSS y DeepSeek
- [x] Review humana del JSON de overlay (valores recetas) — merge PR #36

---

## Phase 2: Contrato consultable

### Task 4: GET .../contract

**Description:** Endpoint que serializa el contrato resuelto. `show_model` best-effort.

**Acceptance criteria:**
- [x] `GET /api/providers/{provider}/models/{model_id}/contract`
- [x] Shape de la spec (provider, model, capabilities, params, recipes, quirks)
- [x] Proveedor desconocido: 400 (igual que `/info`, no 404)
- [x] Modelo sin overlay: 200
- [x] No cambia la respuesta de `/params` ni `/presets`

**Verification:**
- [x] Tests en `tests/test_api_models.py` con show mockeado
- [x] `pytest tests/test_api_models.py tests/test_model_contract.py -m "not e2e"`

**Dependencies:** Task 3

**Files likely touched:**
- `app/routers/api_models.py`
- `app/schemas.py`
- `tests/test_api_models.py`

**Estimated scope:** M

---

### Task 5: E2E del GET contract

**Description:** Cubrir el endpoint nuevo en e2e (regla del repo). No se corre en `make test`.

**Acceptance criteria:**
- [x] Test e2e: GET contract de un modelo listado por Ollama local (o skip si no hay Ollama)
- [x] Assert de claves top-level del JSON

**Verification:**
- [x] El test está escrito y marcado `e2e`
- [x] No añadir este test al camino `make test`

**Dependencies:** Task 4

**Files likely touched:**
- `tests/test_e2e_api.py`

**Estimated scope:** S

---

### Checkpoint: API

- [x] GET contract estable
- [x] Presets/params intactos
- [x] Review humana: el JSON sirve para pintar el knob (PR #36)

---

## Phase 3: El chat envía think

### Task 6: build_extra_body contract-aware

**Description:** Mapear `model_params` con las specs del **contrato** (no solo `provider_params.json`). Test que falle primero: `think` no viaja.

**Acceptance criteria:**
- [x] Firma compatible: `build_extra_body(provider, model_params, model_id=None)`
- [x] Con `model_id`, specs = `params` del contrato
- [x] `api_key: "think"` escribe en la raíz; temperature sigue en `options.temperature`
- [x] `think: false` + `can_disable: false` → valor `true_maps_to`
- [x] Sin `model_id`, comportamiento actual (regresión)

**Verification:**
- [x] Test rojo primero, luego verde
- [x] DeepSeek `think: "max"` → extra_body `{"think": "max"}` (más options si hay)
- [x] GPT-OSS `think: false` → `think: "medium"` (o el `true_maps_to` del overlay)
- [x] Lista vacía de stop sigue sin enviarse
- [x] `pytest tests/test_provider_params.py tests/test_model_contract.py -m "not e2e"`

**Dependencies:** Task 3

**Files likely touched:**
- `app/provider_params.py`
- `tests/test_provider_params.py`

**Estimated scope:** M

---

### Task 7: Call sites pasan model_id

**Description:** Chat stream/sync e illustrate resuelven extra_body con el modelo de la conversación.

**Acceptance criteria:**
- [x] `api_conversations.py` (stream y send) pasan `conv.model_id`
- [x] `api_images.py` (use_chat_config) pasa el model_id de la conv si usa `build_extra_body`
- [x] Sin model_id en conv: no 500; fallback a specs de proveedor

**Verification:**
- [x] Tests existentes de conversaciones/imágenes que mockean extra_body siguen verdes
- [x] Añadir o ajustar un test de unidad/API que fije que se llama con model_id
- [x] `make test`

**Dependencies:** Task 6

**Files likely touched:**
- `app/routers/api_conversations.py`
- `app/routers/api_images.py`
- `tests/test_api_conversations.py` y/o `tests/test_api_images.py`

**Estimated scope:** S

---

### Checkpoint: Send path

- [x] `think` sale del backend
- [x] Chat sin overlay = igual que hoy
- [x] `make test`

---

## Phase 4: Composer thinking

### Task 8: Frontend carga el contrato

**Description:** Al cambiar proveedor/modelo (y al abrir conversación), GET contract y guardar en memoria.

**Acceptance criteria:**
- [x] Fetch a `.../models/{id}/contract` con id URL-encoded
- [x] Fallo de red: contrato nulo, UI como ahora (sin knob)
- [x] No ramificar por nombre de modelo

**Verification:**
- [x] Manual: cambiar de modelo dispara el GET (network)
- [x] No hay tests JS en el repo; no inventar runner. Verificación = browser + no romper `make test`

**Dependencies:** Task 4

**Files likely touched:**
- `app/static/js/app.js`

**Estimated scope:** S

---

### Task 9: Knob think en el composer

**Description:** Control de primer nivel visible solo si `thinking.kind !== "none"`. Widget según kind/values/`can_disable`.

**Acceptance criteria:**
- [x] Markup en `composer-panel` (no en el acordeón Ajustes)
- [x] `kind: levels` + `can_disable: false` → no opción off (GPT-OSS)
- [x] DeepSeek permite apagar y `max`
- [x] Modelo sin thinking: control `hidden` / no en DOM activo
- [x] Accesible: label + `aria-*` en el control

**Verification:**
- [x] Browser: los dos modelos cloud + un local sin overlay
- [x] Viewport desktop del composer (el knob no rompe el send)

**Dependencies:** Task 8

**Files likely touched:**
- `app/static/index.html`
- `app/static/js/app.js`
- CSS del composer si hace falta (archivo de estilos existente, no uno nuevo si se puede evitar)

**Estimated scope:** M

---

### Task 10: Persistir think en model_params

**Description:** `buildModelParams` / controles incluyen `think` cuando el contrato lo define. PUT conversación como el resto de params.

**Acceptance criteria:**
- [x] Cambiar el knob persiste (debounce existente)
- [x] Recargar conversación restaura el nivel
- [x] Si coincide con default del contrato, se puede omitir del payload de **chat** (baseline), igual que temperature; la UI igual muestra el valor

**Verification:**
- [x] Browser: recargar conversación mantiene think
- [x] Enviar mensaje: body incluye `think` solo si toca / receta / distinto del baseline
- [x] `make test` (regresión backend)

**Dependencies:** Task 9, Task 7

**Files likely touched:**
- `app/static/js/app.js`

**Estimated scope:** S

---

### Checkpoint: UI think

- [x] Tabla GPT-OSS vs DeepSeek de la spec, en UI
- [x] Sin knob en modelo sin overlay
- [x] Verificado en navegador, no solo screenshot

---

## Phase 5: Recetas

### Task 11: Chips de receta + no clobber

**Description:** Pintar `recipes` del contrato. Aplicar params en lote. Si origen es user, confirmar.

**Acceptance criteria:**
- [x] Chips solo si hay recetas
- [x] Click aplica `recipe.params` (think, temperature, num_ctx, …) a controles existentes
- [x] Origen user → diálogo de confirmación; cancelar no cambia nada
- [x] Tras aplicar, origen user y persistencia en la conv
- [x] Distinto de «Cargar preset»

**Verification:**
- [x] Browser: recetas DeepSeek (Rápido/Coding/Máximo) y GPT-OSS (Rápido/Análisis/Máximo) visibles
- [x] Confirmación implementada si origen user (`window.confirm`)
- [x] `make test`

**Dependencies:** Task 8, Task 10

**Files likely touched:**
- `app/static/index.html`
- `app/static/js/app.js`

**Estimated scope:** M

---

### Checkpoint: Complete

- [x] Success criteria de la spec
- [x] `make test` (~619 passed, e2e excluidos)
- [x] Este checklist actualizado
- [x] Sin `if` por nombre de modelo en JS
- [x] Review + PR #36 mergeado en `main`

---

## Explicitamente no hacer en v1 (aplazado a v2)

- [ ] Renderer de todo Ajustes → **v2 Phase D** (parcial hide/show primero)
- [x] ~~Overlays del resto de cloud~~ (hecho en v1+)
- [ ] Upload de imágenes al LLM → **v2 Phase F**
- [ ] Mostrar `message.thinking` → **v2 Phase E**
- [ ] Adelgazar `config/ollama.json` → **v2 Phase G**
- [x] ~~Clase `GptOssAdapter` / similar~~ (no se hará; anti-patrón)

---

## v2 — siguientes pasos

Seguir el [plan v2](../plans/PLAN_MODEL_CONTRACT_2026-09-02.md#plan-v2--siguientes-pasos). Marcar aquí al implementar.

### Phase A: Quirks de historial

- [x] A1: `omit_prior_thinking` al construir mensajes hacia el LLM
- [x] A2: Tests unitarios del builder (con/sin quirk)
- [x] Checkpoint: Gemma multi-turn OK; resto intacto; `make test`

### Phase B: Cromos en selector

- [x] B1: Cromos vision / thinking / tools / ventana desde el contrato
- [x] B2: Sin hardcode de nombres de modelo
- [x] Checkpoint: cambio de modelo actualiza cromos (barra de estado + Ajustes)

### Phase C: Verificación

- [ ] C1: Manual — confirm receta cancelada; round-trip think
- [ ] C2 (opcional): e2e chat con think si se toca el endpoint
- [ ] Checkpoint: QA anotado

### Phase D: Renderer Ajustes (parcial)

- [ ] D1: Mostrar/ocultar controles según `contract.params`
- [ ] D2: Progressive disclosure sin reescribir todo el HTML
- [ ] Checkpoint: sin params fantasma; sin `if model ==`

### Phase E: Stream + UI thinking

- [ ] E1: Chunks `message.thinking`
- [ ] E2: Panel colapsable; respetar quirk de no reenviar
- [ ] Open: ¿persistir CoT en BD?
- [ ] Checkpoint: modelos sin thinking no rompen

### Phase F: Visión usuario→LLM

- [ ] F1: Adjunto solo si `capabilities.vision`
- [ ] F2: Quirk `image_before_text` si aplica
- [ ] Checkpoint: GPT-OSS sin adjunto; Gemma/Mistral con él

### Phase G: Más tarde

- [ ] Gating tools/MCP por `capabilities.tools`
- [ ] Coste estimado en UI
- [ ] Adelgazar `config/ollama.json` hacia overlays
- [ ] Overlays locales bajo demanda
- [ ] Generador de overlays (stub auto + propuesta research): ver [`SPEC_OVERLAY_GENERATOR_2026-09-02.md`](../specs/SPEC_OVERLAY_GENERATOR_2026-09-02.md) / rama `feat/overlay-generator`
