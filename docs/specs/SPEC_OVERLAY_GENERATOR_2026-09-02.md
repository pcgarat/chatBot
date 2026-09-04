Última modificación: 2026-09-02

# Spec: Generador de overlays Ollama

**Checklist:** [`docs/checklists/OVERLAY_GENERATOR_CHECKLIST_2026-09-02.md`](../checklists/OVERLAY_GENERATOR_CHECKLIST_2026-09-02.md)  
**Plan:** [`docs/plans/PLAN_OVERLAY_GENERATOR_2026-09-02.md`](../plans/PLAN_OVERLAY_GENERATOR_2026-09-02.md)  
**Contrato (contexto):** [`docs/specs/SPEC_MODEL_CONTRACT_2026-09-02.md`](./SPEC_MODEL_CONTRACT_2026-09-02.md)

**Estado:** implementado MVP en `feat/overlay-generator` (review Phase 0 aprobada).

---

## Assumptions

1. Herramienta **CLI / Make**, no endpoint HTTP en cada `GET /contract`.
2. Proveedor objetivo MVP: **ollama** (`config/model_overlays/ollama.json`).
3. Ollama alcanzable en el host configurado (`settings.ollama_host` / env habitual).
4. **Dry-run por defecto**; persistir solo con `--write`.
5. Modos: **un modelo** (`--model`) y **batch** (modelos de `list` sin entrada de overlay, o todos listados).
6. Auto-write **solo datos fiables** desde `POST /api/show`.
7. Lo dudoso va a **propuesta en `docs/research/`** con revisión humana obligatoria antes de mergear al overlay.
8. No inventar `recipes`, `quirks`, ni `thinking.levels` / `can_disable` / `true_maps_to` en el JSON persistido.
9. No pisar campos ya curados en un overlay existente (merge aditivo / preserve).

→ Corregir ahora si alguna asunción falla.

---

## Objective

Onboarding de **cualquier modelo nuevo** de Ollama: en segundos un stub de overlay usable (cromos / ctx / thinking boolean si aplica) y un documento de propuesta para completar lo que `show` no garantiza.

**Usuario:** quien mantiene `config/model_overlays/` y el contrato de modelo.

**Éxito:**

- [x] `make overlay MODEL=foo` (dry-run) muestra stub + ruta de propuesta sin tocar disco.
- [x] `make overlay MODEL=foo WRITE=1` escribe stub en `ollama.json` (merge seguro) y crea/actualiza markdown de propuesta en `docs/research/`.
- [x] `make overlay-batch` (dry-run / write) cubre modelos listados que faltan en el overlay.
- [x] Modelo ya curado (p. ej. Gemma con quirks/recipes): `--write` **no** borra recipes/quirks/levels.
- [x] Tests unitarios del merge stub + preserve; `make test` verde.
- [x] Sin `if model ==` en el **runtime** de la app (heurísticas, si las hay, solo en el generador / propuesta).

---

## Tech Stack

Python (mismo proyecto), reutilizar `OllamaProvider.show_model` / `list_models` y dominio `model_contract` donde encaje. CLI vía `python -m …` + targets Make. Tests: pytest (`not e2e`).

---

## Commands

```bash
# Un modelo — dry-run (default)
make overlay MODEL=gemma4:31b-cloud
# o
python -m app.tools.overlay_generator --provider ollama --model gemma4:31b-cloud

# Un modelo — persistir
make overlay MODEL=gemma4:31b-cloud WRITE=1
python -m app.tools.overlay_generator --provider ollama --model gemma4:31b-cloud --write

# Batch: modelos en ollama list sin clave en overlay (dry-run)
make overlay-batch
python -m app.tools.overlay_generator --provider ollama --batch-missing

# Batch + write
make overlay-batch WRITE=1

# Tests
make test
pytest tests/test_overlay_generator.py -m "not e2e"
```

---

## Project Structure

```
app/tools/overlay_generator/   → CLI + build stub + merge + emit proposal
config/model_overlays/ollama.json  → destino del stub (con --write)
docs/research/overlay-proposals/   → propuestas markdown (revisión humana)
docs/specs/SPEC_OVERLAY_GENERATOR_2026-09-02.md
docs/checklists/OVERLAY_GENERATOR_CHECKLIST_2026-09-02.md
docs/plans/PLAN_OVERLAY_GENERATOR_2026-09-02.md
tests/test_overlay_generator.py
Makefile                       → overlay / overlay-batch
```

Nombre de propuesta:  
`docs/research/overlay-proposals/{model_id_sanitizado}_YYYY-MM-DD.md`  
(sanitizar `:` → `-`; primera línea = fecha de última modificación).

---

## Code Style

Stub mínimo generado (ejemplo):

```python
def stub_from_show(model_id: str, show: dict) -> dict:
    """Solo campos fiables. Sin recipes/quirks/levels inventados."""
    live = live_caps_from_show(show)  # vision, tools, thinking_flag, context_length
    caps: dict = {
        "vision": live["vision"],
        "tools": live["tools"],
    }
    if live["thinking_flag"]:
        caps["thinking"] = {"kind": "boolean", "can_disable": True, "default": True}
    else:
        caps["thinking"] = {"kind": "none"}
    params: dict = {}
    if live["context_length"]:
        params["num_ctx"] = {"max": live["context_length"]}
    return {
        "capabilities": caps,
        "params": params,
        "recipes": [],
        "quirks": [],
    }
```

Merge al existente:

```python
def merge_overlay(existing: dict | None, stub: dict) -> dict:
    """
    - Si no hay existing → stub.
    - Si hay curado (recipes no vacías, quirks, thinking.kind == levels, …)
      → rellenar solo huecos fiables (vision/tools/num_ctx.max ausentes);
        no reemplazar thinking levels ni recipes/quirks.
    """
    ...
```

---

## Testing Strategy

| Nivel | Qué |
|-------|-----|
| Unit | `stub_from_show` con fixtures de show (con/sin thinking, con/sin ctx) |
| Unit | `merge_overlay`: vacío; stub sobre {}; preserve recipes/quirks/levels |
| Unit | dry-run no escribe archivos (tmpdir) |
| Unit | sanitizado de path de propuesta |
| No e2e obligatorio | Llamada real a Ollama opcional / skip si down |

---

## Boundaries

**Always**

- Dry-run si no hay `--write`.
- Solo persistir campos fiables en el overlay JSON.
- Preserve curado al mergear.
- Propuesta markdown marcada como DRAFT / requiere revisión.
- Tests del merge antes de mergear la feature.

**Ask first**

- Ampliar auto-write a defaults de temperature / parseo de Modelfile.
- Heurísticas por familia de nombre en el **JSON** (en la propuesta DRAFT sí se pueden sugerir).
- Otros proveedores (mancer, …).

**Never**

- Inventar `true_maps_to`, levels o quirks en el archivo de overlay sin review.
- Auto-aplicar la propuesta al JSON.
- Hardcode de nombres de modelo en el path de chat/runtime.
- `--write` por defecto.

---

## Datos fiables vs propuesta

| Campo | Overlay auto (`--write`) | Propuesta research (revisión) |
|-------|--------------------------|--------------------------------|
| `capabilities.vision` | Sí | Confirmar |
| `capabilities.tools` | Sí | Confirmar |
| `thinking.kind` boolean / none | Sí (si flag show) | Si hace falta levels / can_disable |
| `thinking.values` / `true_maps_to` | No | Sugerir solo como DRAFT |
| `params.num_ctx.max` | Sí (si show) | Confirmar default ≠ max |
| `params.*.default` (temp, top_p…) | No | Sugerir desde research / parameters |
| `recipes` | No (dejar `[]`) | Plantilla DRAFT opcional |
| `quirks` | No (dejar `[]`) | Candidatos DRAFT (nunca apply) |

---

## Contenido mínimo de la propuesta (markdown)

1. Fecha de última modificación (primera línea).
2. Model id + resumen de lo escrito en overlay (si `--write`) o del stub dry-run.
3. Tabla «fiable / dudoso».
4. Sección **DRAFT — requiere revisión** con huecos: thinking levels, sampling, recipes, quirks.
5. Enlace al contrato / overlay path.
6. Aviso explícito: no copiar DRAFT al JSON sin revisión.

---

## Success Criteria

- [x] Un modelo nuevo sin overlay: tras `--write`, aparece stub y la app puede resolver cromos básicos.
- [x] Batch dry-run lista qué haría sin tocar disco.
- [x] Re-ejecutar `--write` sobre Gemma curada no elimina quirks/recipes.
- [x] Propuestas viven bajo `docs/research/overlay-proposals/`.
- [x] `make test` verde.

---

## Open Questions

- ¿Batch por defecto = solo **missing**, o flag aparte `--batch-all` para refrescar stubs de todos?
  → **Propuesta spec:** default batch = **missing**; `--batch-all` opcional (sigue respetando preserve).
- ¿Actualizar el índice `docs/research/ollama-cloud/README_*.md` desde el generador? → **No en MVP** (manual).
