Última modificación: 2026-09-02

# Checklist: Generador de overlays Ollama

**Spec:** [`docs/specs/SPEC_OVERLAY_GENERATOR_2026-09-02.md`](../specs/SPEC_OVERLAY_GENERATOR_2026-09-02.md)  
**Plan:** [`docs/plans/PLAN_OVERLAY_GENERATOR_2026-09-02.md`](../plans/PLAN_OVERLAY_GENERATOR_2026-09-02.md)

**Rama:** `feat/overlay-generator`  
**Verificación:** `make test` / `pytest tests/test_overlay_generator.py -m "not e2e"`

---

## Phase 0: Spec

- [x] Spec escrita con assumptions, boundaries y tabla fiable vs propuesta
- [x] Review humana de la spec (gate antes de código)

---

## Phase 1: Dominio del generador

### Task 1: stub_from_show + merge_overlay

**Description:** Funciones puras: show → stub; existing ⊕ stub con preserve de curado.

**Acceptance criteria:**
- [x] Stub solo vision/tools/thinking boolean|none/`num_ctx.max`
- [x] `recipes: []`, `quirks: []` en stub nuevo
- [x] Merge no pisa recipes/quirks/`thinking.kind == levels`

**Verification:**
- [x] `pytest tests/test_overlay_generator.py -m "not e2e"` (tests rojos primero)

**Files:** `app/tools/overlay_generator/stub.py` (o similar), `tests/test_overlay_generator.py`

**Estimated scope:** S

---

### Task 2: proposal markdown

**Description:** Render de propuesta DRAFT bajo `docs/research/overlay-proposals/`.

**Acceptance criteria:**
- [x] Path sanitizado (`:` → `-`) + fecha en nombre y primera línea
- [x] Secciones: escrito/fiable, DRAFT dudoso, aviso no-apply
- [x] Dry-run imprime contenido/ruta sin escribir

**Verification:** tests de render + path; tmpdir

**Dependencies:** Task 1

**Estimated scope:** S

---

### Checkpoint: Dominio

- [x] Tests verdes sin I/O real a Ollama
- [x] Review: forma del stub vs overlays cloud existentes

---

## Phase 2: CLI + Make

### Task 3: CLI un modelo

**Description:** `python -m app.tools.overlay_generator --model …` dry-run / `--write`.

**Acceptance criteria:**
- [x] Sin `--write`: no modifica `ollama.json` ni crea md
- [x] Con `--write`: merge en JSON + escribe propuesta
- [x] Show falla → error claro, exit ≠ 0, sin escritura parcial

**Verification:** tests con show mockeado + tmp paths

**Dependencies:** Task 1, Task 2

**Estimated scope:** M

---

### Task 4: Batch missing (+ opcional all)

**Description:** `--batch-missing` lista Ollama ∩ ¬ overlay keys; `--batch-all` opcional con preserve.

**Acceptance criteria:**
- [x] Dry-run resume modelos afectados
- [x] Write aplica stub+propuesta por cada uno
- [x] Un fallo de show en batch no corrompe el JSON entero (best-effort documentado)

**Verification:** tests con list/show mock

**Dependencies:** Task 3

**Estimated scope:** M

---

### Task 5: Makefile

**Description:** `make overlay MODEL=…` y `make overlay-batch` con `WRITE=1`.

**Acceptance criteria:**
- [x] Documentado en help del Makefile
- [x] Default dry-run

**Dependencies:** Task 3, Task 4

**Estimated scope:** XS

---

### Checkpoint: CLI

- [ ] Manual dry-run contra un modelo listado
- [x] Manual write en tmp o rama (no pisar Gemma en prueba real sin backup mental)
- [x] `make test`

---

## Phase 3: Docs de cierre

- [x] `docs/research/overlay-proposals/README_YYYY-MM-DD.md` (índice + flujo de revisión)
- [x] Enlace desde checklist/plan del model contract Phase G
- [x] Spec success criteria marcados al implementar

---

## Explicitamente no hacer (MVP)

- [ ] Auto-aplicar DRAFT al overlay
- [ ] Inventar levels/quirks/recipes en JSON
- [ ] Endpoint HTTP de generación
- [ ] Actualizar README cloud automáticamente
- [ ] Otros providers
