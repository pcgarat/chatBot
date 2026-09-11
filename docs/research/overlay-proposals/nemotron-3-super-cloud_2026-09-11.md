Última modificación: 2026-09-11

# Overlay proposal: `nemotron-3-super:cloud`

**Provider:** `ollama`  
**Estado stub:** escrito en overlay  
**Overlay path:** `config/model_overlays/ollama.json`  
**Contrato:** [`SPEC_MODEL_CONTRACT_2026-09-02.md`](../../specs/SPEC_MODEL_CONTRACT_2026-09-02.md)

## Resumen del stub

- `capabilities.vision`: `False`
- `capabilities.tools`: `True`
- `capabilities.thinking`: `{'kind': 'boolean', 'can_disable': True, 'default': True}`
- `params.num_ctx`: `{'max': 262144}`
- `recipes`: `[]` (vacío a propósito)
- `quirks`: `[]` (vacío a propósito)

## Fiable vs dudoso

| Campo | Origen | Notas |
|-------|--------|-------|
| vision / tools | show capabilities | Fiable para auto-write |
| thinking boolean\|none | flag `thinking` en show | Fiable; levels requieren review |
| num_ctx.max | show `nemotron_h_moe.context_length` | Fiable (256K en ficha Ollama Cloud) |
| temperature / top_p / … | — | Dudoso; no auto-write |
| thinking levels / true_maps_to | — | Dudoso; no inventar en JSON |
| recipes / quirks | — | Dudoso; no inventar en JSON |

## Fuentes (2026-09-11)

- [ollama.com/library/nemotron-3-super](https://ollama.com/library/nemotron-3-super) — text-only, tools, 256K ctx cloud, thinking configurable
- [NVIDIA NIM reference](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-super-120b-a12b) — `enable_thinking` True/False; opcional `low_effort` y `reasoning_budget` (256–16384) en chat template kwargs
- Show live: caps `completion`/`thinking`/`tools`; `nemotron_h_moe.context_length` = 262144

## DRAFT — requiere revisión

- [x] Thinking en Ollama: **dejar `kind: boolean`** (on/off). NIM expone low_effort/budget, pero Ollama `show` solo declara flag `thinking`; no inventar `levels` en el JSON hasta probar la API cloud.
- [ ] `num_ctx.default` (p. ej. 32768) ≠ max 262144
- [ ] Sampling NIM (razonamiento on): temperature ~0.6, top_p ~0.95; off: temperature 0 — validar en Ollama Cloud antes de fijar defaults
- [ ] Recipes candidatas (no apply sin probar):
  - `fast`: think off, temp baja, ctx 32k
  - `agent`: think on, temp 0.6, ctx 128k
  - `hard`: think on, ctx 256k
- [ ] Quirks: ninguno observado; NIM usa kwargs de plantilla distintos del `think` enum de otros modelos Ollama — verificar mapeo runtime

> **Aviso:** no copiar esta sección DRAFT al overlay JSON sin revisión humana.
