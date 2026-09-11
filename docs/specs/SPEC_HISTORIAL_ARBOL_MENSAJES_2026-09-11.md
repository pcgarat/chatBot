Última modificación: 2026-09-11

# Spec: Historial unificado en árbol de respuestas

**Estado:** **aprobada** (2026-09-11) — siguiente: ejecución del plan. **Ajuste UX (2026-09-11):** mismo nivel intra-conversación; nest solo en forks.

**Plan:** [`docs/plans/PLAN_HISTORIAL_ARBOL_MENSAJES_2026-09-11.md`](../plans/PLAN_HISTORIAL_ARBOL_MENSAJES_2026-09-11.md)

**Rama:** `feat/historial-arbol-mensajes`

**Supersede parcial:** el modo Mensajes de [`SPEC_HISTORIAL_MENSAJES_2026-09-04.md`](./SPEC_HISTORIAL_MENSAJES_2026-09-04.md) (índice plano + vista consulta sin composer). Ese modo deja de ser la UX principal del historial izquierdo.

**Intent confirmado (2026-09-11):**

- Unificar historial de conversaciones/mensajes en un **árbol**.
- Cada **respuesta** (`role=assistant`) es un **nodo navegable**.
- El panel Conversación muestra la **vista de hilo completa**: path visible (carga bajo demanda hacia atrás), composer y menús de mensaje (abajo a la derecha).
- Los **forks** cuelgan del mensaje ancla; no se duplican mensajes heredados en el árbol.

---

## Assumptions (corregir ahora o se implementan así)

1. **Stack:** frontend React (`frontend/src`), backend FastAPI + SQLAlchemy. Sin migración de BD en v1: se reutilizan `Message.parent_id`, `Conversation.active_leaf_message_id`, `forked_from_conversation_id`, `forked_from_message_id`.
2. **Un solo historial izquierdo:** desaparece (o queda oculto/deprecado) el toggle `conversations` | `messages`. Una vista árbol. Preferencia `leftHistoryMode` se migra a `tree` o se ignora.
3. **Nodo = solo `assistant`.** El `user` no es nodo; su texto puede ir en subtítulo/preview del assistant hijo (“↩ …”).
4. **Conversación = agrupador colapsable**, no nodo de chat. Cabecera con título del hilo; dentro, el spine/árbol de assistants de ese hilo + forks colgando del ancla.
5. **Sin duplicar heredados:** un mensaje físico aparece una sola vez (en su `conversation_id` dueño). Un fork solo aporta nodos de mensajes **propios**.
6. **Aristas del árbol:**
   - *Intra-hilo:* los assistants de la **misma conversación** salen al **mismo nivel** (lista plana; no hay nest por turnos ni intentos).
   - *Fork:* los assistants propios del fork cuelgan del mensaje ancla un **nivel más** (`is_fork_edge=true`), planos entre sí. Un fork anclado en un mensaje del fork anida otro nivel.
7. **Clic en nodo:** `openConversationAtMessage(ownerConversationId, messageId)` → panel Conversación ON, path del hilo (no turno aislado), ventana centrada en ese mensaje, **composer visible**, menús de mensaje activos. Si la hoja activa del hilo no es ese nodo ni un descendiente, se actualiza `active_leaf` al leaf del subárbol de ese nodo (o al propio nodo si es hoja).
8. **No hay modo consulta por defecto.** Alt+clic o “Solo este turno” en menú contextual = out of scope v1 (se puede reintroducir después).
9. **Lazy del árbol ≠ lazy del chat:**
   - Chat: ventana cliente actual (`messageWindow`) sin cambiar el contrato de “GET conversación trae mensajes del hilo”.
   - Árbol: no cargar todo el grafo global de golpe. v1: construir bosque en cliente a partir de listado de conversaciones + endpoints de hijos por nodo / por conversación; o un `GET /api/message-tree` paginado por raíces + expand.
10. **Papelera:** sigue siendo de conversaciones; visible junto al árbol (raíces soft-deleted no entran en el bosque activo).
11. **«Nueva»:** crea conversación raíz vacía como hoy; aparece como grupo nuevo en el árbol.
12. **Tests:** API del árbol + Vitest del builder de bosque de mensajes + pytest UI/contrato donde ya existan patrones; `make test` verde.

→ Corrige estas asunciones antes del plan. Si valen, el spec queda cerrado.

---

## Objective

Navegar el historial como **grafo de respuestas y forks**, y al elegir un nodo **continuar o ramificar** desde ese punto en el panel de conversación, sin alternar mentalmente entre “lista de hilos” y “lista plana de mensajes”.

**Usuario:** quien genera muchas respuestas, forks e intentos y necesita ver de dónde salió cada rama.

### User stories

- Como usuario, veo el historial izquierdo como árbol de respuestas agrupadas por conversación, con forks colgando del mensaje ancla.
- Como usuario, hago clic en una respuesta y el panel Conversación abre ese hilo en ese punto, con composer y acciones de mensaje.
- Como usuario, creo un fork desde el menú de un mensaje y el nuevo hilo aparece como hijo de ese nodo en el árbol.
- Como usuario, veo intentos hermanos (mismas alternativas bajo un padre) como nodos hermanos, y al elegir uno activo esa rama.

### Acceptance criteria (testables)

- [ ] El historial izquierdo principal es un **árbol** (no el índice plano de `GET /api/messages` como vista default).
- [ ] Cada nodo visible es un `assistant` con preview (~80 chars), fecha y, si aplica, marca de fork/intento.
- [ ] Mensajes heredados de un fork **no** se listan otra vez bajo el fork.
- [ ] Un fork con al menos un assistant propio aparece colgando del ancla; si el fork aún no tiene assistant, el agrupador del fork puede mostrarse vacío o con placeholder “sin respuestas” (decidir en plan; default: ocultar nodos mensaje hasta que exista uno).
- [ ] Clic en nodo → conversación dueña abierta, mensaje enfocado, composer visible, menús de mensaje disponibles.
- [ ] Clic no pinta solo 2 burbujas de consulta; pinta el path del hilo (sujeto a ventana bajo demanda).
- [ ] “Nueva conversación desde aquí” refresca el árbol: el primer assistant del fork (cuando exista) es hijo del ancla.
- [ ] Intentos hermanos aparecen como hermanos; activar uno cambia la hoja activa y el path del panel.
- [ ] Conversaciones en papelera no aportan nodos al bosque activo.
- [ ] `make test` verde; cobertura API del endpoint(s) de árbol + test del builder de relaciones padre/hijo (incl. arista de fork).

---

## Modelo de dominio (vista)

```text
ConversationGroup (colapsable, título)
  └─ AssistantNode            ← mensajes propios de esa conv
       ├─ AssistantNode       ← siguiente turno / intento hermano
       └─ AssistantNode       ← primer assistant de un fork anclado aquí
            └─ …              ← solo propios del fork (grupo visual del fork opcional)
```

**Identidad del nodo:** `message_id` (único).  
**Contexto de apertura:** `{ conversation_id: owner, message_id }`.  
**Selección UI:** resaltar nodo seleccionado + ancestros del path.

Patrones:

- **Composite** para nodos del árbol.
- **Tree Data Provider** (índice) separado de **Active Path Session** (panel chat).
- Selección compartida `{ conversationId, messageId }`.

---

## API (propuesta v1)

Contrato orientado a expansión lazy. Nombres alineados a schemas existentes.

```http
GET /api/message-tree/roots?limit=50&offset=0
```

Raíces = assistants que son raíz de path en conversaciones no eliminadas que son raíz de bosque de forks (sin `forked_from_*`), o el primer assistant del path activo de cada conversación raíz — **detalle a fijar en plan**. Respuesta: lista de nodos + `has_children`.

```http
GET /api/message-tree/{message_id}/children
```

Hijos = (1) siguientes assistants intra-hilo / intentos hermanos según reglas de aristas, (2) primeros assistants propios de forks cuyo `forked_from_message_id == message_id`.

```python
class MessageTreeNode(BaseModel):
    id: str
    conversation_id: str
    conversation_title: str
    content_preview: str
    created_at: datetime
    parent_message_id: str | None  # padre en el árbol unificado (assistant o ancla)
    is_fork_edge: bool             # True si la arista viene de fork, no de parent_id
    has_children: bool
    sibling_index: int | None      # para intentos; opcional v1
    sibling_count: int | None
```

Alternativa aceptable en v1 si el volumen es bajo en dev: un único `GET /api/message-tree` que devuelve el bosque completo de conversaciones activas (cap duro, p.ej. 500 nodos) y expansión solo en cliente. **Preferida la lazy** si el cap se supera en uso real; el plan elige una y no ambas.

Reutilizar `GET /api/conversations/{id}` + `openConversationAtMessage` para el panel. No hace falta GET de mensaje suelto.

---

## UI

| Zona | Comportamiento |
|------|----------------|
| Sidebar | Bosque virtualizado o lista indentada; grupos por conversación; expand/collapse |
| Clic nodo | Abre hilo editable en panel Conversación |
| Panel | Path + ventana bajo demanda + composer + footers de mensaje |
| Toggle Conversaciones/Mensajes | Eliminado o sustituido por un solo “Historial” |
| Papelera | Como hoy, a nivel conversación |
| Galería / Cola | Sin cambios de semántica |

Archivos previstos (orientativos):

```text
frontend/src/lib/messageForest.js          → buildMessageForest / aristas fork
frontend/src/ui/history/HistoryLists.jsx   → vista árbol
frontend/src/store/history.js              → selección + expansión
frontend/src/app/sessionActions.js         → clic → openConversationAtMessage + active_leaf
app/services/message_tree.py               → resolución de hijos
app/routers/api_message_tree.py            → endpoints
tests/test_api_message_tree.py
frontend/src/lib/messageForest.test.js
```

---

## Boundaries

- **Always:** un mensaje = un nodo en el bosque; clic → hilo editable; forks sin duplicar heredados; tests del builder de aristas.
- **Ask first:** copy-on-write al mutar heredados; URL profunda por `message_id`; reintroducir vista consulta; virtualización obligatoria vs indentación simple.
- **Never:** volver al default “consulta sin composer”; listar user como nodos; mostrar mensajes de papelera en el bosque activo; clonar mensajes al forkar en v1.

---

## Decisiones cerradas (entrevista)

| Pregunta | Decisión |
|----------|----------|
| Forma del historial | Árbol unificado |
| Qué es un nodo | Cada respuesta `assistant` |
| Panel al clic | Vista conversación completa + composer + menús |
| Forks | Cuelgan del ancla; sin duplicar heredados |
| Conversación en el árbol | Agrupador colapsable, no nodo de chat |
| Modo consulta del spec 2026-09-04 | Deja de ser el default (supersede parcial) |
| Intentos hermanos | Mismo nivel que el resto de la conversación (sin nest) |
| Nest / indentación | Solo al expandir un fork desde el ancla |
| Raíces del API | Todos los assistants de conversaciones raíz (planos) |
| Fork sin assistant propio | Ocultar hasta que exista al menos un assistant |
| Clic en intento no activo | Siempre `PUT active_leaf` al leaf del subárbol (o al nodo si es hoja) |
| Índice plano `GET /api/messages` | Deprecar UI plana; el endpoint puede quedarse hasta limpiar clientes |

---

## Success Criteria

- Puedo ver de un vistazo qué forks salieron de qué respuesta.
- Puedo saltar a cualquier respuesta y seguir escribiendo desde ese hilo.
- No veo el mismo mensaje heredado repetido bajo cada fork.
- El chat sigue cargando mensajes hacia atrás bajo demanda; el árbol no obliga a pintar todo el path de golpe.

---

## Open Questions

Ninguna. Cerradas el 2026-09-11 (defaults validados).

---

## Out of scope (v1)

- Copy-on-write / clonar historial al mutar heredados.
- Buscador full-text, filtros por modelo.
- Vista consulta aislada (2 burbujas) como modo default.
- Cambiar semántica de Galería / Cola.
- Paginar por HTTP el path del chat (sigue siendo GET de conversación + ventana cliente).
- Hexagonal completo solo por este listado (servicio `message_tree` sí; puertos nuevos no obligatorios).
