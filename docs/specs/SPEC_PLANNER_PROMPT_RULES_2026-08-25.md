Última modificación: 2026-08-25

# Spec: Reglas de sistema del planificador de prompts

## Objective

Sustituir el textarea de instrucciones del planificador LLM (panel Imágenes) por un sistema de reglas igual al del chat: biblioteca, chips, reordenar, editar. Bibliotecas independientes (`scope=chat` vs `scope=planner`). La selección vive en el panel (prefs + perfiles de workspace), no en la conversación.

Con «Utilizar configuración del chat», el planificador sigue usando provider/modelo/params y reglas del chat, **y** las reglas del planificador se concatenan también.

## Tech Stack

Python / FastAPI, SQLAlchemy, SQLite, JS vanilla en `app/static/js/app.js`.

## Commands

```
make test
pytest tests/ -m "not e2e"
```

## Project Structure

- `app/models.py`, `app/db.py` — columna `rules.scope`
- `app/services/rules/` — ámbitos y concatenación de textos
- `app/crud.py`, `app/routers/api_rules.py` — CRUD filtrado por scope
- `app/routers/api_images.py` — merge chat + planificador
- `app/services/workspace_profiles/` — snapshot con lista de reglas del planificador
- `app/static/` — UI del panel Imágenes
- `tests/` — unit/API/UI; e2e del endpoint de reglas

## Code Style

Una tabla `rules` con discriminador `scope`. `GET /api/rules` sin query equivale a `scope=chat` (compatibilidad). POST lleva `scope` (default `chat`). No duplicar tabla ni router.

## Testing Strategy

- CRUD: listar/crear no mezclan scopes; scope inválido 422
- Illustrate: con `use_chat_config` se concatenan reglas de chat **y** del planificador
- Snapshot: string legado → una regla inline; lista se conserva
- UI estática: el panel Imágenes tiene el RuleSet, no el textarea; no se deshabilita con el checkbox de config del chat

## Boundaries

- Always: filtrar por scope en list/create; tests sin e2e en el flujo diario
- Ask first: cambiar el system base del planificador (`_DEFAULT_SYSTEM`)
- Never: mezclar bibliotecas; ligar reglas del planificador a la conversación; duplicar tabla/API/UI

## Success Criteria

- Crear una regla `scope=planner` no aparece en `GET /api/rules` ni en `GET /api/rules?scope=chat`
- El panel muestra chips/biblioteca/crear como el chat; prefs y perfiles guardan la lista seleccionada
- Un string antiguo de `prompt_system_instructions` se muestra como una regla inline
- `use_chat_config=true` + texto del planificador → ambos en el system extra del LLM
- Cambiar de conversación no cambia las reglas del planificador

## Open Questions

Ninguna (intent confirmado 2026-08-25).
