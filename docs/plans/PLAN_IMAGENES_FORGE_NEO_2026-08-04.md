Última modificación: 2026-08-04

# Plan: Ilustración con Forge Neo

**Spec:** [`docs/specs/SPEC_IMAGENES_FORGE_NEO_2026-08-04.md`](../specs/SPEC_IMAGENES_FORGE_NEO_2026-08-04.md)  
**Intent:** [`docs/intent/imagenes-forge-neo_2026-08-04.md`](../intent/imagenes-forge-neo_2026-08-04.md)  
**Checklist:** [`docs/checklists/IMAGENES_FORGE_NEO_CHECKLIST_2026-08-04.md`](../checklists/IMAGENES_FORGE_NEO_CHECKLIST_2026-08-04.md)

## Enfoque

Cortes verticales: primero el núcleo ReplayLastGeneration + Forge (testeable sin UI), luego ScenePlanner + anclas + orquestador + API `illustrate`, después panel/placeholders/debug en el frontend.

## Grafo de dependencias

```
Config FORGE_* + .env.example
        │
        ▼
LastPayloadSource (png-info / params.txt / options / init)
        │
        ├── ForgeClient (txt2img | img2img)
        │
ScenePlanner (LLM JSON)
        │
Anchors (insertar slots sin reescribir)
        │
        ▼
Orchestrator (lote → retry pass → eventos)
        │
        ▼
API POST .../illustrate (NDJSON) + servir ficheros imagen
        │
        ▼
Frontend: pestaña Imágenes → prefs → post-done illustrate → placeholders/debug
```

## Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| Infotext incompleto / distinto por preset Forge | Parser tolerante; log de campos recuperados vs omitidos; tests con fixtures reales de `params.txt` / png-info |
| Img2img sin init originals | Última salida como init; `FORGE_STYLE_INIT_DIR` opcional |
| LLM no-JSON / ancla fallida | Schema estricto + repair/fallback paragraph_index; si ancla falla → insertar al final del bloque |
| Timeouts Forge largos | httpx timeout alto configurable; eventos por escena; no bloquear el stream del chat |
| `app.js` monolítico | Funciones/módulo claro por feature; no refactor global |

## Orden de implementación

1. Config + LastPayload + ForgeClient + tests  
2. ScenePlanner + Anchors + tests  
3. Orchestrator (reintentos) + tests  
4. API illustrate + servir imágenes + tests/e2e  
5. UI pestaña + prefs + placeholders + debug window  
6. Checkpoint final: `make test` + smoke manual con Forge

## Verificación global

```bash
pytest tests/ -m "not e2e"
# tras endpoints: ampliar test_e2e_api (Forge mockeado)
```
