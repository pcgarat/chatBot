Última modificación: 2026-09-06

# Checklist: Prompt generator (txt2img)

**Plan:** [`docs/plans/PLAN_PROMPT_GENERATOR_2026-09-05.md`](../plans/PLAN_PROMPT_GENERATOR_2026-09-05.md)  
**Spec:** [`docs/specs/SPEC_PROMPT_GENERATOR_2026-09-05.md`](../specs/SPEC_PROMPT_GENERATOR_2026-09-05.md)  
**Rama:** `feat/prompt-generator`

---

## Phase 1 — Dominio

- [x] **1.1** `PromptBrief` + merge + serialización JSON
- [x] **1.2** `detect_force` («genera ya» y variantes)
- [x] **1.3** Tests `tests/test_prompt_generator_brief.py` verdes
- [x] **1.4** System prompt FLUX adaptado (sí pregunta) + contrato JSON
- [x] **1.5** Parser de respuesta agente (+ fences)
- [x] **1.6** Tests `tests/test_prompt_generator_agent.py` verdes

## Phase 2 — Persistencia / create

- [x] **2.1** Columnas `kind` + `prompt_brief` en model + `db.py`
- [x] **2.2** Schemas create/out con `kind` y `prompt_brief`
- [x] **2.3** Create `prompt_generator`: título `txt2img`, brief vacío, template fijo assistant
- [x] **2.4** Create `chat` sin regresión
- [x] **2.5** Tests create API verdes

## Phase 3 — Turn API

- [x] **3.1** `run_turn` (merge brief, force, LLM mockeable, 1 retry parse)
- [x] **3.2** `POST .../prompt-generator/turn`
- [x] **3.3** `force` / «genera ya» → `phase=prompt`
- [x] **3.4** `kind=chat` → 400; sin reglas scope=chat en system
- [x] **3.5** Fork preserva `kind` + `prompt_brief`
- [x] **3.6** Tests turn (+ fork) verdes

## Phase 4 — UI

- [x] **4.1** Botón `#btn-prompt-generator` bajo Nueva, texto `txt2img`
- [x] **4.2** Create/open hilo desde el botón
- [x] **4.3** Icono/etiqueta distinta en lista (badge `txt2img`)
- [x] **4.4** En estos hilos: send → turn (no stream chat)
- [x] **4.5** Botón **Generar prompt** (`force=true`)
- [x] **4.6** Bloque prompt + **Copiar**
- [x] **4.7** Refinamiento regenera prompt (mismo turn)
- [x] **4.8** Tests UI estáticos

## Phase 5 — Cierre

- [x] **5.1** E2E endpoint (marcado `e2e`, no en `make test` diario)
- [x] **5.2** `make test` verde (820 passed, 2026-09-06)
- [x] **5.3** Spec/plan/checklist sincronizados

---

## Smoke manual (al acabar UI)

- [ ] txt2img → mensaje inicial template → responder idioma → más preguntas → prompt + copiar
- [ ] Generar prompt / «genera ya» con brief pobre → hay prompt
- [ ] Pedir cambio → nuevo prompt
- [ ] Fork del hilo sigue siendo `prompt_generator`
