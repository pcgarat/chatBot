Última modificación: 2026-09-02

# Spec: Contrato de modelo (capacidades, params, recetas)

**Diseño:** [`docs/DESIGN_MODEL_CONTRACT_2026-09-02.md`](../DESIGN_MODEL_CONTRACT_2026-09-02.md)  
**Plan:** [`docs/plans/PLAN_MODEL_CONTRACT_2026-09-02.md`](../plans/PLAN_MODEL_CONTRACT_2026-09-02.md)  
**Checklist:** [`docs/checklists/MODEL_CONTRACT_CHECKLIST_2026-09-02.md`](../checklists/MODEL_CONTRACT_CHECKLIST_2026-09-02.md)

**Estado:** **v1 merged** en `main` (PR [#36](https://github.com/pcgarat/chatBot/pull/36), squash `0b85cc8`). Siguiente: **v2** (sección al final).

---

## Assumptions (v1 — cumplidas)

1. MVP = contrato + thinking + recetas + overlay; no redibujar Ajustes ni migrar `config/ollama.json`.
2. Overlays aditivos en `config/model_overlays/{provider}.json`. «Cargar preset» sigue en `config/{provider}.json`.
3. ~~Solo dos modelos~~ → post-v1: overlays de los **8 cloud** instalados.
4. Sin adjunto imagen usuario→LLM (aplazado a v2).
5. `think: false` + `can_disable: false` → coerce a `true_maps_to`.
6. No se pinta ni guarda `message.thinking` (aplazado a v2).
7. `model_params` sigue siendo `dict` opaco.
8. `model_info` no se mezcla con el contrato.
9. Tests: `make test` (sin e2e); e2e del GET contract escrito.
10. Rama `feat/model-contract` → mergeada.

---

## Objective

Que al elegir un modelo la app sepa **qué puede hacer**, **qué params existen y cómo van a la API**, y ofrezca **recetas de uso** coherentes — sin una clase por modelo.

**Usuario:** quien chatea con modelos Ollama (locales y cloud) y ajusta params por conversación.

**Éxito v1 (cumplido):**

- [x] `GET .../contract` mismo shape; GPT-OSS vs DeepSeek thinking distinto.
- [x] `think` top-level en payload Ollama.
- [x] UI sin `if` por nombre de modelo.
- [x] Chips de receta + confirmación si origen user.
- [x] Modelo sin overlay no revienta.
- [x] Overlays 8 cloud + defaults de contrato en UI (temperature/num_ctx) sin pisar user.

---

## Tech Stack

Python / FastAPI / SQLAlchemy (existente). Frontend: `app/static/js/app.js` + `index.html` (sin framework). Tests: pytest. Hexagonal como `app/services/workspace_profiles/`.

---

## Commands

```bash
make test
pytest tests/test_model_contract.py tests/test_provider_params.py tests/test_api_models.py -m "not e2e"
# solo si se pide e2e:
make test-e2e
```

---

## Project Structure

```
app/services/model_contract/   → dominio: tipos, merge, thinking, overlays
config/model_overlays/         → JSON sparse por proveedor (ollama: 8 cloud)
app/routers/api_models.py      → GET .../contract
app/provider_params.py         → build_extra_body usa specs del contrato
app/static/js/app.js           → carga contrato, knob think, chips, defaults
tests/test_model_contract.py   → merge + thinking + overlays
docs/                          → spec / plan / checklist / diseño
```

---

## Success Criteria (v1)

- [x] Mismo renderer/backend cubre GPT-OSS y DeepSeek sin ramificar por nombre.
- [x] `think` viaja top-level en extra_body.
- [x] Modelo sin overlay: chat igual que hoy.
- [x] Presets y ficha de modelo intactos.
- [x] Tests unitarios en verde con `make test`.
- [x] Test e2e del GET contract escrito.

---

## Decisiones cerradas (v1)

| Pregunta | Decisión |
|----------|----------|
| Rama | `feat/model-contract` → mergeada en `main` |
| Tipos think en JSON | Nativos en recetas/`model_params`; `values` admite ambos; builder normaliza |
| Persistencia del knob | Como el resto: si coincide con baseline del contrato no se envía; la UI muestra el default. Receta = toque user |
| `think` en `provider_params.json` | **No**; solo vía contrato/overlay |

---

## Out of scope (quedó fuera de v1 → candidatos v2)

- Renderer schema-driven del acordeón Ajustes.
- Quirks de historial (`omit_prior_thinking`, `image_before_text`).
- Subir imágenes al chat (visión usuario→LLM).
- Pintar / persistir chain-of-thought (`message.thinking`).
- Cromos de capacidad en el selector (visión / tools / ctx).
- Gating de tools/MCP por `capabilities.tools`.
- Estimación de coste.
- Adelgazar `config/ollama.json` (migrar presets a overlays).
- Overlays de modelos **locales** (solo cloud en v1+).

---

## Siguientes pasos (v2)

Orden recomendado (valor / riesgo). Cada corte en rama `feat/...` propia.

### Prioridad alta

1. **Quirks de historial** — aplicar `omit_prior_thinking` (Gemma) al construir mensajes hacia el LLM; tests unitarios del builder de historial.
2. **Cromos de capacidad en el selector** — vision / thinking / tools / ventana (p. ej. 1M) leídos del contrato; sin hardcode de nombres.
3. **Verificación manual / e2e light** — receta + confirmación cancelada; recargar conversación conserva think tocado; payload verbose con `think`.

### Prioridad media

4. **Renderer schema-driven de Ajustes (parcial)** — mostrar/ocultar controles según `contract.params` (no HTML por modelo); progressive disclosure: visibles vs avanzados.
5. **Stream + UI de thinking** — chunks `message.thinking` de Ollama; panel colapsable; **no** reenviar thought si quirk activo.
6. **Visión usuario→LLM** — adjuntar imagen solo si `capabilities.vision`; orden imagen-antes-de-texto si quirk.

### Prioridad baja / más tarde

7. **Gating tools/MCP** por `capabilities.tools`.
8. **Coste estimado** en UI (tokens × tarifa del research).
9. **Adelgazar `config/ollama.json`** — presets como overlays o baseline del contrato; no romper «Cargar preset».
10. **Overlays locales** (abliterated, qwen, etc.) bajo demanda.

### Éxito v2 (borrador)

- [x] Gemma multi-turn no reenvía bloques `thought` previos.
- [x] Selector muestra cromos coherentes con el contrato.
- [ ] Ajustes no muestran params que el contrato no declara.
- [ ] Con visión: adjunto visible solo si `vision`; sin visión, oculto.
- [ ] Thinking stream opcional en UI sin romper modelos sin thinking.
- [ ] `make test` verde; e2e de contract/quirks escritos donde toque endpoint.

---

## Open Questions (v2)

- ¿El CoT se guarda en el mensaje en BD o solo se muestra en vivo?
- ~~¿Los cromos van en el select del header, en Ajustes, o ambos?~~ → **ambos** (barra de estado + Ajustes).
- ¿Visión v1 del chat es solo adjunto por mensaje o también galería → prompt?
