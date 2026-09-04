Última modificación: 2026-09-04

# Spec: Historial de mensajes (índice global de turnos)

**Estado:** **aprobada** (2026-09-04) — siguiente: plan.

**Plan:** [`docs/plans/PLAN_HISTORIAL_MENSAJES_2026-09-04.md`](../plans/PLAN_HISTORIAL_MENSAJES_2026-09-04.md)

**Intent confirmado (2026-09-04):** botón Mensajes cambia solo el historial izquierdo; clic aísla pregunta+respuesta en consulta; composer oculto; al apagar Mensajes vuelve la lista de conversaciones; abrir un hilo restaura transcripción y composer.

---

## Assumptions (corregir ahora o se implementan así)

1. **Stack actual:** HTML + CSS + `app.js` (sin framework). Backend FastAPI + SQLAlchemy + `crud.py` como conversaciones. No hexagonal nuevo: un listado no justifica puerto/adaptador.
2. **Mensajes es modo del historial izquierdo**, no un panel central. Convive en el mismo grupo visual que Conversación / Galería / Cola porque el usuario lo pidió ahí, pero su semántica es distinta (`aria-pressed` = lista de respuestas vs lista de hilos). Conversación / Galería / Cola no cambian.
3. **API nueva** `GET /api/messages`: respuestas `role=assistant` de conversaciones **no** eliminadas, más recientes primero. El turno (pregunta+respuesta) se arma en el cliente con `GET /api/conversations/{id}` ya existente; no hace falta un GET de un mensaje suelto.
4. **Tope v1: 200 ítems**, sin paginador. Un listado ilimitado de todas las respuestas crece mucho más rápido que el de conversaciones; 200 cubre consulta reciente. Si hace falta el resto, es v2.
5. **Ítem de lista:** primera línea / ~80 caracteres de la respuesta + título de la conversación + fecha. Mismos grupos Hoy / Ayer / Semana / Antes.
6. **Sin mensajes de conversaciones en papelera.** Sin ítems `role=user`. Cada rama (fork/`parent_id`) cuenta como respuesta propia.
7. **Clic con el panel Conversación oculto:** se enciende el chat. Si no, la consulta no se ve. Única excepción al «no tocar interruptores del centro».
8. **«Nueva» en modo Mensajes:** sale del modo Mensajes y crea conversación como hoy. Si no, creas un hilo con composer oculto y la lista no lo muestra.
9. **Papelera:** solo en modo conversaciones (ocultar en modo Mensajes).
10. **Preferencia:** `localStorage` `leftHistoryMode` = `conversations` | `messages`.
11. **Rama:** `feat/historial-mensajes` al implementar (no en este documento).
12. **Tests:** `make test` (sin e2e por defecto). Endpoint nuevo → test API + e2e del GET.

→ Corrige estas asunciones antes del plan. Si valen, el spec queda cerrado.

---

## Objective

Poder **encontrar una respuesta del LLM** sin abrir hilos enteros, y **consultar ese turno** (pregunta + respuesta) sin poder seguir escribiendo desde ahí.

**Usuario:** quien usa el chat y genera muchas respuestas a lo largo de varias conversaciones.

### User stories

- Como usuario, activo Mensajes y el historial izquierdo pasa a listar respuestas del LLM de todas las conversaciones activas.
- Como usuario, hago clic en una respuesta y el chat muestra solo ese turno (mi pregunta + esa respuesta), sin composer.
- Como usuario, desactivo Mensajes, veo otra vez las conversaciones; al abrir un hilo recupero el hilo completo y el composer.

### Acceptance criteria (testables)

- [ ] Existe el botón **Mensajes** debajo de Conversación y encima de Galería.
- [ ] `aria-pressed=true` en Mensajes ⇔ el `#conversations-list` pinta respuestas, no hilos.
- [ ] Conversación / Galería / Cola siguen siendo interruptores independientes del centro.
- [ ] La lista son `assistant` de conversaciones con `deleted_at IS NULL`, orden `created_at` desc, máximo 200.
- [ ] Cada ítem muestra preview de la respuesta, título de conversación y fecha; grupos Hoy/Ayer/Semana/Antes.
- [ ] Clic en un ítem: el stream pinta exactamente 2 burbujas (user padre + assistant clicado) si el padre existe; si no hay padre, solo la respuesta.
- [ ] Composer (`#composer-panel`) y el botón «Escribir» están ocultos mientras Mensajes está activo.
- [ ] No se puede enviar un mensaje en modo Mensajes (el control no está en el DOM visible / no hay send).
- [ ] Apagar Mensajes restaura la lista de conversaciones; el composer **no** vuelve hasta abrir un hilo.
- [ ] Abrir una conversación (modo conversaciones) pinta el hilo completo y muestra el composer.
- [ ] Clic en un mensaje con el chat oculto enciende el panel Conversación.
- [ ] «Nueva» en modo Mensajes desactiva Mensajes y crea conversación.
- [ ] Papelera no se muestra en modo Mensajes.
- [ ] `GET /api/messages` cubierto por test de API y e2e de endpoint.
- [ ] `make test` verde.

---

## Tech Stack

| Capa | Tecnología |
|------|------------|
| UI | `app/static/index.html`, `app/static/css/style.css`, `app/static/js/app.js` |
| API | FastAPI, `app/routers/api_conversations.py` o router `api_messages.py` si el de conversaciones se hincha |
| Datos | SQLAlchemy `Message` + `Conversation` existentes; **sin migración** |
| Tests | pytest (`make test` / `pytest tests/ -m "not e2e"`); e2e del GET nuevo |

---

## Commands

```bash
make start
make test
pytest tests/ -m "not e2e"
pytest tests/test_api_messages.py tests/test_e2e_api.py -k messages -m "not e2e"
# Solo si se pide:
make test-e2e
```

---

## Project Structure

```
app/crud.py                         → list_assistant_messages(...)
app/schemas.py                      → MessageHistoryItem
app/routers/api_conversations.py    → GET /api/messages  (o api_messages.py si el archivo supera ~400 líneas nuevas)
app/static/index.html               → botón #btn-history-messages
app/static/js/app.js                → modo historial, lista, vista consulta
app/static/css/style.css            → ítem de mensaje (reutilizar conversation-item)
tests/test_api_messages.py          → contrato del GET
tests/test_e2e_api.py               → e2e del GET
docs/specs/                         → este spec
```

---

## Code Style

Contrato del listado (nombres alineados al resto de schemas):

```python
class MessageHistoryItem(BaseModel):
    id: str                          # message assistant
    conversation_id: str
    conversation_title: str
    parent_id: str | None            # mensaje user del turno, si existe
    content_preview: str             # recorte servidor, no el body entero
    created_at: datetime

    class Config:
        from_attributes = True
```

```http
GET /api/messages?limit=200
```

- `limit` default 200, máximo 200 en v1 (ignorar valores mayores o clamp).
- 200 OK + `list[MessageHistoryItem]`.
- No filtrar por conversación en v1.

Frontend: un flag `leftHistoryMode`, no un segundo `<aside>`. Reutilizar `#conversations-list`. Vista consulta = filtro en `renderMessages()` (`consultaAssistantId`), no un panel nuevo.

---

## Testing Strategy

| Nivel | Qué | Dónde |
|-------|-----|--------|
| Unidad / API | GET vacío; GET con 2 conversaciones y 3 respuestas → 3 ítems, orden desc, preview, sin user, sin papelera, clamp limit | `tests/test_api_messages.py` |
| E2E endpoint | Crear conv, enviar mensaje real o mock, GET `/api/messages` incluye esa respuesta | `tests/test_e2e_api.py` (regla del repo: endpoint nuevo → e2e) |
| UI | Sin suite visual; verificación manual del checklist + `make test` | — |

No hace falta test de JS de `app.js` si no hay harness; el contrato vive en API. Si se extrae la función de recorte/preview al backend, se testa ahí.

---

## Boundaries

- **Always:** `make test` antes de dar por cerrado; no migrar BD; no cambiar IDs existentes de Conversación/Galería/Cola; Composer oculto en modo Mensajes.
- **Ask first:** paginación UI, buscador, subir el tope 200, extraer router nuevo, persistir el mensaje aislado en URL.
- **Never:** mezclar ítems user en la lista; mostrar mensajes de papelera; enviar al LLM desde la vista consulta; ocultar el panel Conversación al activar Mensajes; añadir dependencias frontend.

---

## Decisiones cerradas (entrevista)

| Pregunta | Decisión |
|----------|----------|
| Alcance de la lista | Todas las conversaciones activas |
| Qué cambia el botón | Solo el historial izquierdo |
| Clic | Turno aislado: pregunta + respuesta |
| Composer | Solo consulta; oculto en modo Mensajes |
| Salida | Apagar Mensajes → lista de hilos; abrir hilo → transcripción + composer |
| Buscador / filtros | Fuera |
| Botón «ver conversación» | Fuera |

---

## Success Criteria

- Puedo alternar historial conversaciones ↔ respuestas sin que Galería/Cola se inmuten.
- Encuentro una respuesta de otro hilo, la abro, veo pregunta+respuesta, no puedo escribir.
- Vuelvo a conversaciones, abro el hilo, sigo chateando con el historial completo.
- Tests del GET en verde; `make test` verde.

---

## Open Questions

Ninguna de producto. Solo las asunciones 4 (tope 200), 7 (encender chat si estaba oculto) y 8 (Nueva sale del modo): si las rechazas, se ajusta el spec antes del plan.

---

## Out of scope (v1)

- Buscador, filtros por modelo/conversación, paginador.
- Papelera o borrado de mensajes desde la lista.
- Modo lectura nuevo (el actual de burbuja se puede quedar).
- Cambiar semántica de Galería / Cola / Conversación como paneles.
- Hexagonal / servicio de dominio propio.
- Mensajes heredados de un fork listados otra vez en el fork (viven en la conversación original).
