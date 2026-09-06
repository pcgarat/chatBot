Última modificación: 2026-09-06

# Overlay proposal: `warp-fast:latest`

**Provider:** `ollama`  
**Estado stub:** escrito en overlay  
**Overlay path:** `config/model_overlays/ollama.json`  
**Contrato:** [`SPEC_MODEL_CONTRACT_2026-09-02.md`](../../specs/SPEC_MODEL_CONTRACT_2026-09-02.md)

## Resumen del stub

- `capabilities.vision`: `False`
- `capabilities.tools`: `True`
- `capabilities.thinking`: `{'kind': 'none'}`
- `params.num_ctx`: `{}`
- `recipes`: `[]` (vacío a propósito)
- `quirks`: `[]` (vacío a propósito)

## Fiable vs dudoso

| Campo | Origen | Notas |
|-------|--------|-------|
| vision / tools | show capabilities | Fiable para auto-write |
| thinking boolean\|none | flag `thinking` en show | Fiable; levels requieren review |
| num_ctx.max | show model_info/details | Fiable si presente; default ≠ max a revisar |
| temperature / top_p / … | — | Dudoso; no auto-write |
| thinking levels / true_maps_to | — | Dudoso; no inventar en JSON |
| recipes / quirks | — | Dudoso; no inventar en JSON |

## DRAFT — requiere revisión

- [ ] ¿Thinking necesita `kind: levels` y `values` / `true_maps_to` / `can_disable`?
- [ ] Defaults de sampling (`temperature`, `top_p`, …) y `num_ctx.default` ≠ max
- [ ] Recipes (plantilla opcional; no copiar sin probar)
- [ ] Quirks candidatos (nunca apply automático)

> **Aviso:** no copiar esta sección DRAFT al overlay JSON sin revisión humana.
