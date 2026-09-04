Última modificación: 2026-09-04

# Plan: Historial de mensajes

**Spec:** [`docs/specs/SPEC_HISTORIAL_MENSAJES_2026-09-04.md`](../specs/SPEC_HISTORIAL_MENSAJES_2026-09-04.md)

## Overview

Añadir `GET /api/messages` (respuestas assistant de conversaciones activas, tope 200) y un modo del historial izquierdo: el botón Mensajes sustituye la lista de hilos por ese índice; un clic carga la conversación existente y pinta solo el turno (pregunta + respuesta) con el composer oculto.

Cortes verticales: primero el contrato API verificable con tests, luego la lista, luego la consulta y las salidas.

## Architecture Decisions

- **Sin migración.** `Message` / `Conversation` ya tienen `role`, `parent_id`, `deleted_at`.
- **Sin router nuevo.** `GET /api/messages` vive en `api_conversations.py` (`prefix=/api`). Un endpoint no justifica `api_messages.py`.
- **Preview en servidor.** `strip_illustration_artifacts` + primera línea recortada a 80 caracteres. El listado no arrastra bodies completos.
- **Consulta en el cliente.** Clic → `GET /api/conversations/{id}` (ya existe) + filtro `consultaAssistantId` en `renderMessages()`. No hay GET de un mensaje suelto.
- **Un solo list container.** Reutilizar `#conversations-list`. Flag `leftHistoryMode` (`conversations` | `messages`) + `localStorage`.
- **TDD en API.** Tests que fallan primero; después crud + schema + ruta.

## Grafo de dependencias

```
MessageHistoryItem + crud.list_assistant_messages
        │
        ▼
GET /api/messages  (tests API → e2e GET)
        │
        ▼
Botón Mensajes + toggle lista (fetch + render ítems)
        │
        ├── Clic → turno aislado + composer oculto + encender chat si hace falta
        │
        └── Salidas: apagar modo, Nueva, ocultar papelera, persistir modo
        │
        ▼
Checkpoint: make test + smoke UI
```

No hay trabajo en paralelo útil: la UI depende del contrato.

## Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| `api_conversations.py` ya es grande (~830 líneas) | Med | El GET es corto; extraer router solo si el diff se dispara (Ask first en spec) |
| `renderMessages()` asume el hilo completo (colapso, scroll, acciones) | Med | Filtro al inicio de render; al salir de consulta se llama `openConversation` sin filtro |
| Preview feo por HTML de ilustración | Bajo | Reusar `strip_illustration_artifacts` antes del recorte |
| Composer / «Escribir» siguen accesibles | Alto | Ocultar `#composer-panel` y `#btn-expand-composer` mientras `leftHistoryMode === "messages"` |
| Recarga en modo Mensajes | Med | Leer `leftHistoryMode` en init; no pintar hilos ni mostrar composer hasta cargar la lista |

## Task List

### Phase 1: Contrato API

- [x] **Task 1: Tests que fallen de `GET /api/messages`**
  - Acceptance: tests que describen vacío, orden desc, solo assistant, sin papelera, preview ≤80, clamp `limit`, `parent_id` y `conversation_title`.
  - Verify: `pytest tests/test_api_messages.py -m "not e2e"` **falla** (endpoint/schema ausentes).
  - Files: `tests/test_api_messages.py`
  - Scope: S
  - Dependencies: ninguna

- [x] **Task 2: Schema + crud + ruta hasta que Task 1 pase**
  - Acceptance: `GET /api/messages?limit=200` (default 200, máximo 200) devuelve `list[MessageHistoryItem]`; join con conversaciones `deleted_at IS NULL`; orden `Message.created_at` desc.
  - Verify: `pytest tests/test_api_messages.py -m "not e2e"` verde.
  - Files: `app/schemas.py`, `app/crud.py`, `app/routers/api_conversations.py`
  - Scope: S
  - Dependencies: Task 1

- [x] **Task 3: E2E del GET**
  - Acceptance: crear conversación, enviar un turno (mock o patrón e2e existente), `GET /api/messages` incluye esa respuesta.
  - Verify: el test e2e existe; **no** se ejecuta en el flujo diario (`make test` lo excluye).
  - Files: `tests/test_e2e_api.py`
  - Scope: S
  - Dependencies: Task 2

### Checkpoint: Foundation

- [x] `pytest tests/test_api_messages.py -m "not e2e"` verde
- [x] No hay migración
- [x] Revisar payload (campos, preview) antes de pintar UI

### Phase 2: Lista

- [x] **Task 4: Botón + modo historial + pintar índice**
  - Acceptance: botón `#btn-history-messages` entre Conversación y Galería; `aria-pressed` ⇔ lista de respuestas; Conversación/Galería/Cola intactos; grupos Hoy/Ayer/Semana/Antes; papelera oculta en modo Mensajes.
  - Verify: smoke manual (activar/desactivar lista) + `make test`.
  - Files: `app/static/index.html`, `app/static/js/app.js`, `app/static/css/style.css`
  - Scope: M
  - Dependencies: Task 2

### Checkpoint: Lista

- [x] Mensajes on → índice; off → conversaciones
- [x] Galería/Cola no se alteran

### Phase 3: Consulta y salidas

- [x] **Task 5: Clic aísla el turno y oculta composer**
  - Acceptance: clic carga la conversación, `renderMessages` pinta user padre + assistant (o solo assistant si no hay padre); composer y «Escribir» ocultos; si el chat estaba off, se enciende.
  - Verify: smoke: clic con chat visible y con chat oculto.
  - Files: `app/static/js/app.js`
  - Scope: M
  - Dependencies: Task 4

- [x] **Task 6: Salidas (apagar, Nueva, persistencia)**
  - Acceptance: apagar Mensajes restaura lista de hilos y **no** el composer hasta `openConversation`; «Nueva» sale del modo y crea hilo; `localStorage leftHistoryMode` sobrevive recarga.
  - Verify: smoke recarga + Nueva + abrir hilo; `make test`.
  - Files: `app/static/js/app.js`
  - Scope: S
  - Dependencies: Task 5

### Checkpoint: Complete

- [x] Criterios de aceptación del spec cubiertos
- [x] `make test` verde
- [x] Smoke: lista → clic → consulta sin composer → off → abrir hilo → composer + transcripción

## Verificación global

```bash
make test
pytest tests/test_api_messages.py -m "not e2e"
```

Smoke UI (no automatizado): light/dark, Mensajes↔Conversaciones, clic, chat oculto, Nueva, recarga.

## Open Questions

Ninguna de producto (spec aprobada). Pendiente de implementación: **¿crear rama `feat/historial-mensajes`?**
