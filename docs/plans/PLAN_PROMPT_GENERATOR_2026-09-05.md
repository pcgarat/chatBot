Última modificación: 2026-09-05

# Plan: Prompt generator (txt2img)

**Spec:** [`docs/specs/SPEC_PROMPT_GENERATOR_2026-09-05.md`](../specs/SPEC_PROMPT_GENERATOR_2026-09-05.md)  
**Intent:** [`docs/intent/prompt-generator_2026-09-05.md`](../intent/prompt-generator_2026-09-05.md)  
**Checklist:** [`docs/checklists/CHECKLIST_PROMPT_GENERATOR_2026-09-05.md`](../checklists/CHECKLIST_PROMPT_GENERATOR_2026-09-05.md)  
**Rama:** `feat/prompt-generator`

## Overview

Añadir hilos `kind=prompt_generator` creados desde el botón **txt2img**: brief tipado FLUX en la conversación, turno estructurado vía endpoint dedicado (sin reglas de chat del usuario), UI de entrevista + **Generar prompt** + bloque copiable, refinamiento en el mismo hilo. Fork se mantiene.

Cortes verticales: dominio del brief → persistencia/create con template → turn API (LLM mock) → UI create → UI turn/copy → e2e.

## Architecture Decisions

- **Columnas** `conversations.kind` + `conversations.prompt_brief`; migración idempotente en `app/db.py` (`ALTER TABLE` try/except como el resto).
- **Servicio** `app/services/prompt_generator/`: `PromptBrief`, merge, force-detect, system prompt (guía FLUX adaptada), parse JSON del modelo, `run_turn`. Router delgado.
- **Salida LLM:** JSON (como `scene_planner.extract_json_object`); no depender de `structured_output` del contrato de modelo. Un reintento si el parse falla.
- **Create:** `ConversationCreate.kind` opcional (`chat` default). Si `prompt_generator`: título `txt2img`, brief vacío, mensaje assistant template fijo (constante en servicio), **sin** LLM.
- **Turn:** `POST /api/conversations/{id}/prompt-generator/turn` body `{ message?: str, force?: bool }`. Persiste user (si hay) + assistant; actualiza `prompt_brief`; respuesta con `phase`, `prompt?`, mensajes.
- **Chat stream intacto** para `kind=chat`. Hilos prompt_generator **no** usan `/messages/stream` desde la UI (solo el endpoint turn).
- **Fork:** copia `kind` + `prompt_brief` al nuevo hilo (mismo comportamiento de historial que hoy).
- **TDD:** tests que fallan primero en dominio y API.

## Grafo de dependencias

```
PromptBrief + force + merge + system  (unit)
        │
        ▼
kind + prompt_brief (model/schema/db) + create con template
        │
        ▼
run_turn + POST .../prompt-generator/turn  (API + mock LLM)
        │
        ├── UI: botón txt2img + create/open
        │
        └── UI: Generar prompt + turn + render/copiar + list icon
        │
        ▼
e2e endpoint + checkpoint make test
```

Paralelo útil tras el contrato API: icono de lista vs wiring del composer (bajo acoplamiento).

## Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Modelo no devuelve JSON válido | Alto | `extract_json_object` + 1 retry; error HTTP claro si sigue fallando |
| `api_conversations.py` ya es grande | Med | Extraer `api_prompt_generator.py` si el diff del router > ~80 líneas |
| UI sigue usando stream de chat en estos hilos | Alto | Branch en `sendMessage`: si `kind===prompt_generator` → turn |
| Label `txt2img` confunde con Forge | Bajo | Aceptado en spec; solo crea el entrevistador |
| Brief solo en cliente | Alto | Siempre persistir en `prompt_brief` en cada turn |

## Task List

### Phase 1: Dominio

- [x] **Task 1: PromptBrief + force + merge (TDD)**
  - Acceptance: modelo/dataclass del brief; `merge(patch)`; `detect_force(text)` reconoce «genera ya» y variantes; brief vacío serializable a JSON.
  - Verify: `pytest tests/test_prompt_generator_brief.py -m "not e2e"` verde (tras implementar; primero rojo).
  - Files: `app/services/prompt_generator/brief.py`, `tests/test_prompt_generator_brief.py` (+ `__init__.py` del paquete)
  - Scope: S
  - Dependencies: ninguna

- [x] **Task 2: System prompt + parse de respuesta agente**
  - Acceptance: system incluye secciones FLUX y contrato JSON (`assistant_text`, `brief_patch`, `phase`, `prompt`); parser tolera fences; phase inválida rechazada.
  - Verify: `pytest tests/test_prompt_generator_agent.py -m "not e2e"`
  - Files: `app/services/prompt_generator/system.py`, `app/services/prompt_generator/parse.py`, `tests/test_prompt_generator_agent.py`
  - Scope: S
  - Dependencies: Task 1

### Checkpoint: Dominio

- [x] Unit tests del paquete `prompt_generator` verdes
- [x] Sin tocar FastAPI ni UI

### Phase 2: Persistencia + create

- [x] **Task 3: Columnas + schemas + create template (TDD API)**
  - Acceptance: `kind` default `chat`; create con `kind=prompt_generator` → título `txt2img`, `prompt_brief` vacío, 1 mensaje assistant = template fijo; GET conversación incluye `kind` y `prompt_brief`.
  - Verify: `pytest tests/test_api_prompt_generator_create.py -m "not e2e"`
  - Files: `app/models.py`, `app/db.py`, `app/schemas.py`, `app/crud.py`, `app/routers/api_conversations.py`, `tests/test_api_prompt_generator_create.py`
  - Scope: M (si se pasa de 5 archivos útiles, partir: primero model/db/schema, luego create)
  - Dependencies: Task 1

### Checkpoint: Create

- [x] Create `prompt_generator` sin LLM
- [x] Create `chat` sin regresión

### Phase 3: Turn API

- [x] **Task 4: `run_turn` + endpoint (TDD, LLM mock)**
  - Acceptance: turn con mensaje actualiza brief y guarda mensajes; `force=true` o texto «genera ya» → `phase=prompt` y `prompt` no vacío; conversación `chat` → 400; no concatena reglas scope=chat.
  - Verify: `pytest tests/test_api_prompt_generator_turn.py -m "not e2e"`
  - Files: `app/services/prompt_generator/turn.py`, router (conversations o `api_prompt_generator.py`), `tests/test_api_prompt_generator_turn.py`
  - Scope: M
  - Dependencies: Task 2, Task 3

- [x] **Task 5: Fork preserva kind + brief**
  - Acceptance: fork desde hilo `prompt_generator` crea hijo con mismo `kind` y `prompt_brief` (estado al forkear).
  - Verify: test en `tests/test_api_conversations.py` o archivo prompt_generator.
  - Files: `app/crud.py` / fork en router, test
  - Scope: S
  - Dependencies: Task 3

### Checkpoint: API

- [x] Create + turn + force verdes con mock
- [x] Revisar payload UI antes de pintar

### Phase 4: UI

- [x] **Task 6: Botón txt2img + create/open**
  - Acceptance: `#btn-prompt-generator` debajo de Nueva, texto `txt2img`; crea y abre hilo; lista muestra el hilo (icono distinto opcional pero recomendado).
  - Verify: test UI estático + smoke manual
  - Files: `app/static/index.html`, `app/static/js/app.js`, `app/static/css/style.css`, `tests/test_prompt_generator_ui.py`
  - Scope: M
  - Dependencies: Task 3

- [x] **Task 7: Composer Generar + turn + bloque Copiar**
  - Acceptance: en `kind=prompt_generator`, send → turn (no stream chat); botón Generar prompt con `force=true`; `phase=prompt` → bloque + Copiar al clipboard; refinamiento vuelve a llamar turn.
  - Verify: asserts JS/HTML + smoke manual
  - Files: `app/static/index.html`, `app/static/js/app.js`, `app/static/css/style.css`, ampliar `tests/test_prompt_generator_ui.py`
  - Scope: M
  - Dependencies: Task 4, Task 6

### Checkpoint: UI

- [x] Flujo frío: txt2img → responder → prompt → copiar
- [x] Force y refinamiento

### Phase 5: E2E + cierre

- [x] **Task 8: E2E del endpoint turn**
  - Acceptance: e2e create + turn con mock/patrón existente; **no** corre en `make test` diario.
  - Verify: test marcado `e2e` existe
  - Files: `tests/test_e2e_api.py` (o archivo e2e dedicado)
  - Scope: S
  - Dependencies: Task 4

- [x] **Task 9: Checklist/spec al día + `make test`**
  - Acceptance: checklist actualizado; spec estado «plan listo / en implementación»; `make test` verde.
  - Verify: `make test`
  - Files: docs
  - Scope: S
  - Dependencies: Task 7, Task 8

### Checkpoint: Complete

- [x] Criterios de aceptación de la spec cubiertos
- [x] Listo para review / `/cerrar-feature` cuando el usuario lo pida

## Open Questions

Ninguna bloqueante.
