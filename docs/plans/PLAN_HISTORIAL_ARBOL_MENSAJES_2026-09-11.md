Última modificación: 2026-09-11

# Plan: Historial unificado en árbol de respuestas

**Spec:** [`docs/specs/SPEC_HISTORIAL_ARBOL_MENSAJES_2026-09-11.md`](../specs/SPEC_HISTORIAL_ARBOL_MENSAJES_2026-09-11.md)

**Rama:** `feat/historial-arbol-mensajes`

## Overview

Sustituir el historial izquierdo dual (conversaciones / índice plano de mensajes) por un **bosque de respuestas**: cada `assistant` es nodo navegable; los forks cuelgan del ancla sin duplicar heredados; el clic abre el hilo editable (composer + menús) y actualiza `active_leaf`.

Cortes verticales: (1) resolución de aristas + API lazy verificable con tests, (2) builder/UI del árbol, (3) clic → sesión + deprecación del modo plano, (4) refresco tras fork/send.

## Architecture Decisions

- **Sin migración.** Reutilizar `parent_id`, `active_leaf_message_id`, `forked_from_*`.
- **Servicio de dominio** `app/services/message_tree.py` (puro + consultas vía crud). No mezclar la lógica de aristas en el router. Complementa `conversation_tree.py` (path/intentos intra-hilo); no lo reemplaza.
- **Router dedicado** `app/routers/api_message_tree.py` bajo `prefix=/api`. El listado plano `GET /api/messages` **sigue** hasta limpieza posterior; la UI deja de usarlo como vista principal.
- **Lazy por expansión (preferida del spec):**
  - `GET /api/message-tree/roots` — nodos raíz unificados (assistants sin padre unificado en conversaciones raíz activas), paginado.
  - `GET /api/message-tree/{message_id}/children` — siguientes turnos / intentos hermanos + primeros assistants propios de forks anclados ahí.
- **Preview** reutilizar `crud.message_content_preview` (ya con `strip_illustration_artifacts`).
- **Frontend:** `buildMessageForest` / helpers en `frontend/src/lib/messageForest.js` para tests de aristas en cliente si se cachea; la fuente de verdad de hijos en v1 es la API (evitar divergencia). Agrupador = cabecera de conversación colapsable encima de sus raíces locales.
- **Clic:** `openConversationAtMessage` + `PUT active_leaf` al leaf del subárbol del nodo (reutilizar `latest_leaf_in_subtree` en servidor o equivalente en cliente tras GET conversación).
- **Stores:** `historyStore` pasa a modo único `tree` (deprecar `messages` | `conversations` en UI). Persistencia: escribir `tree` en `leftHistoryMode`; valores legacy se migran a `tree` al cargar.
- **TDD:** tests API/aristas que fallen primero; luego servicio + ruta; luego Vitest UI builder/selección; después integración de clic.

### Regla de aristas (normativa)

Sea `A` un assistant. Sus hijos unificados son la unión de:

1. **Intra-hilo:** assistants `B` de la misma conversación tales que el padre user de `B` tiene `parent_id == A.id` (o, si el modelo enlaza assistant→assistant, el `parent_id` directo de `B` es `A`). Implementación: derivar del grafo `parent_id` existente + tests de caracterización sobre fixtures reales.
2. **Hermanos/intentos:** assistants con el mismo padre user que otro hijo de `A` se listan como hermanos entre sí (mismo `parent_message_id` unificado = `A`).
3. **Fork:** para cada conversación hija con `forked_from_message_id == A.id` y `deleted_at IS NULL`, el **primer** assistant propio del path (por `created_at` o por path desde su leaf) es hijo de `A` con `is_fork_edge=true`. Si no hay assistant propio → no hay nodo (fork oculto en el árbol de mensajes).

Raíces: assistants de conversaciones raíz (`forked_from_conversation_id IS NULL`, no papelera) cuyo padre unificado es `null` (no hay assistant anterior en el camino).

## Grafo de dependencias

```
message_tree (aristas + preview)
        │
        ▼
schemas MessageTreeNode + GET roots/children  (tests API)
        │
        ▼
historyStore modo tree + messageForest UI (expand lazy)
        │
        ├── Clic nodo → openConversationAtMessage + active_leaf + composer
        │
        └── Deprecar toggle Conversaciones/Mensajes + lista plana
        │
        ▼
Refresh árbol tras fork / nuevo assistant
        │
        ▼
Checkpoint: make test + smoke UI
```

## Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Ambigüedad `parent_id` (user vs assistant) | Alto | Tests de caracterización con conversación lineal, intento hermano y fork; fijar helper `unified_parent_assistant_id(msg)` en el servicio |
| N+1 al expandir muchos nodos | Med | `children` en una query por ancla (mensajes de la conv + forks por `forked_from_message_id`); índices ya existentes |
| Árbol profundo ilegible | Med | Indentación + colapso; por defecto expandir solo ancestros del nodo seleccionado |
| Duplicar heredados por error | Alto | Tests: fork no lista prefijo; `is_fork_edge` solo en primer assistant propio |
| `latest_leaf_in_subtree` al clic en nodo intermedio | Med | Reutilizar servicio existente; test API/UI de que el path del panel es el de esa hoja |
| `api_conversations.py` ya grande | Bajo | Router nuevo desde el día 1 |
| Legacy `leftHistoryMode=messages` | Bajo | Migrar a `tree` en lectura; no romper localStorage ajeno |

## Task List

### Phase 1: Dominio + API

- [x] **Task 1: Tests que fallen — aristas unificadas**
  - Acceptance: fixtures cubren (a) hilo lineal A→B→C, (b) dos intentos hermanos bajo A, (c) fork desde B con un assistant propio D hijo de B y `is_fork_edge`, (d) fork sin assistant → B sin ese hijo, (e) mensaje heredado no aparece bajo el fork.
  - Verify: `pytest tests/test_message_tree.py -m "not e2e"` **falla** (módulo ausente).
  - Files: `tests/test_message_tree.py`
  - Scope: M
  - Dependencies: ninguna

- [x] **Task 2: Servicio `message_tree` hasta Task 1 verde**
  - Acceptance: funciones `list_root_nodes`, `list_child_nodes`, `unified_parent_assistant_id`, preview ≤80; sin duplicar heredados; forks vacíos omitidos.
  - Verify: `pytest tests/test_message_tree.py -m "not e2e"` verde.
  - Files: `app/services/message_tree.py`, `app/crud.py` (helpers de query si hace falta)
  - Scope: M
  - Dependencies: Task 1

- [x] **Task 3: Schema + rutas + tests HTTP**
  - Acceptance: `GET /api/message-tree/roots?limit=&offset=` y `GET /api/message-tree/{id}/children` devuelven `MessageTreeNode` / listado paginado de roots; 404 si message_id inexistente o en papelera.
  - Verify: `pytest tests/test_api_message_tree.py -m "not e2e"` verde; registro del router en la app.
  - Files: `app/schemas.py`, `app/routers/api_message_tree.py`, `app/main.py` (include), `tests/test_api_message_tree.py`
  - Scope: M
  - Dependencies: Task 2

- [x] **Task 4: E2E mínimo del GET children con fork**
  - Acceptance: crear origen + fork + turno en fork; children del ancla incluye el assistant del fork con `is_fork_edge=true`.
  - Verify: test existe en `tests/test_e2e_api.py` (no corre en `make test` diario).
  - Files: `tests/test_e2e_api.py`
  - Scope: S
  - Dependencies: Task 3

### Checkpoint: Foundation

- [x] Contrato roots/children estable
- [x] Sin migración
- [x] Revisar payloads antes de UI

### Phase 2: UI árbol

- [x] **Task 5: Cliente API + store modo `tree`**
  - Acceptance: `messagesApi`/`messageTreeApi` fetch roots/children; `historyStore.mode === "tree"` por defecto; legacy `messages`|`conversations` → `tree`; estado `expandedIds`, `treeChildrenByParent`, `selectedMessageId`.
  - Verify: Vitest store/migración de modo.
  - Files: `frontend/src/api/messageTree.js`, `frontend/src/store/history.js`, tests asociados
  - Scope: M
  - Dependencies: Task 3

- [x] **Task 6: Vista `MessageTreeList` sustituye el dual list**
  - Acceptance: sidebar pinta grupos conversación colapsables + nodos indentados; expand llama children; selección resalta nodo; papelera de conversaciones intacta; **no** se muestra el toggle Conversaciones/Mensajes ni la lista plana como default.
  - Verify: Vitest render vacío / lineal / fork; smoke manual.
  - Files: `frontend/src/ui/history/HistoryLists.jsx` (o `MessageTreeList.jsx`), `frontend/src/app/historyActions.js`, CSS mínimo reutilizando `.conversation-item-fork`
  - Scope: L
  - Dependencies: Task 5

### Checkpoint: Lista

- [x] Árbol visible; expand lazy funciona
- [x] Galería/Cola sin cambios de semántica

### Phase 3: Navegación y sesión

- [x] **Task 7: Clic → hilo editable + `active_leaf`**
  - Acceptance: clic llama apertura en `conversation_id` dueño + foco mensaje; composer y menús visibles; `active_leaf` = leaf del subárbol del nodo; **no** vista consulta de 2 burbujas; si panel Conversación estaba off, se enciende.
  - Verify: test de sesión/actions (Vitest) + smoke; adaptar/eliminar asserts de consulta-sin-composer del modo Mensajes que choquen.
  - Files: `frontend/src/app/sessionActions.js`, `frontend/src/app/historyActions.js`, tests UI existentes (`test_message_history_ui` / Vitest)
  - Scope: M
  - Dependencies: Task 6

- [x] **Task 8: Refresh tras fork y tras nuevo assistant**
  - Acceptance: tras `forkConversationFromMessage` y tras completar un turn assistant, el árbol invalida/refresca el padre relevante (children del ancla / del assistant anterior); forks vacíos siguen ocultos hasta el primer assistant.
  - Verify: smoke fork + send; test unitario de invalidación si hay harness.
  - Files: `frontend/src/app/sessionActions.js`, `frontend/src/app/historyActions.js`
  - Scope: S
  - Dependencies: Task 7

### Checkpoint: Complete

- [x] Criterios de aceptación del spec cubiertos
- [x] `make test` verde
- [x] Smoke: expandir → clic nodo → path + composer → fork desde menú → hijo aparece bajo ancla → clic en intento hermano cambia path

## Verificación global

```bash
make test
pytest tests/test_message_tree.py tests/test_api_message_tree.py -m "not e2e"
# frontend
cd frontend && npm test -- --run messageForest messageTree history
```

Smoke manual: hilo lineal, dos intentos, fork con y sin respuesta, papelera, Nueva conversación.

## Out of scope (no hacer en este plan)

- Copy-on-write de heredados
- Buscador full-text del árbol
- Borrar `GET /api/messages` del backend
- Virtualización windowing avanzada (solo si el smoke muestra lag; entonces tarea extra)
- Cambiar Galería / Cola
