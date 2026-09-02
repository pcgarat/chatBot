Última modificación: 2026-09-02

# Spec: Contrato de modelo (capacidades, params, recetas)

**Diseño:** [`docs/DESIGN_MODEL_CONTRACT_2026-09-02.md`](../DESIGN_MODEL_CONTRACT_2026-09-02.md)  
**Plan:** [`docs/plans/PLAN_MODEL_CONTRACT_2026-09-02.md`](../plans/PLAN_MODEL_CONTRACT_2026-09-02.md)  
**Checklist:** [`docs/checklists/MODEL_CONTRACT_CHECKLIST_2026-09-02.md`](../checklists/MODEL_CONTRACT_CHECKLIST_2026-09-02.md)

**Estado:** v1 implementada — pendiente de revisión humana / commit.

---

## Assumptions (corregir antes de implementar)

1. El MVP es **contrato + thinking + recetas + overlay**, no redibujar el acordeón de Ajustes ni migrar `config/ollama.json`.
2. Los overlays son **aditivos** (`config/model_overlays/{provider}.json`). El botón «Cargar preset» sigue leyendo `config/{provider}.json`.
3. Solo se curan en v1 dos modelos antagónicos: `gpt-oss:120b-cloud` y `deepseek-v4-flash:cloud`. El resto usa schema de proveedor + `show_model` si existe.
4. **No hay adjunto de imagen usuario→LLM** en el producto hoy. No se inventa multimodal en este trabajo; se aplaza el cromo/visión.
5. `think: false` en un modelo con `can_disable: false` se **coacciona** a `true_maps_to` (no 422). Conversaciones viejas no rompen.
6. No se persiste ni se pinta `message.thinking` de Ollama. El knob de thinking solo controla el payload de envío.
7. `model_params` de la conversación sigue siendo un `dict` opaco. No hay tabla nueva ni Pydantic por modelo.
8. `model_info` (tags, uncensored, reglas) **no** se mezcla con el contrato.
9. Tests habituales: `make test` (excluye e2e). El endpoint nuevo lleva test e2e escrito; no se ejecuta e2e salvo petición explícita.
10. Implementación en rama `feat/model-contract` partiendo de `main` remoto, si el usuario confirma.

→ Si alguna asunción es incorrecta, corregirla antes del código.

---

## Objective

Que al elegir un modelo la app sepa **qué puede hacer**, **qué params existen y cómo van a la API**, y ofrezca **recetas de uso** coherentes — sin una clase por modelo.

**Usuario:** quien chatea con modelos Ollama (locales y cloud) y ajusta params por conversación.

**Éxito v1:**

- `GET /api/providers/ollama/models/gpt-oss:120b-cloud/contract` y el equivalente DeepSeek devuelven thinking distinto y el mismo shape.
- Enviar un mensaje con `model_params.think` mete `think` **top-level** en el payload de Ollama (no dentro de `options`).
- GPT-OSS no ofrece «off»; DeepSeek sí. La UI no tiene `if (model.startsWith("gpt-oss"))`.
- Chips de receta aplican un set; si la conversación ya tiene overrides de usuario, no se pisan sin confirmación.
- Un modelo sin overlay no revienta: schema del proveedor + capabilities de `show` si hay.

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
# o el test concreto del endpoint contract
```

---

## Project Structure

```
app/services/model_contract/   → dominio: tipos, merge, thinking, overlays
config/model_overlays/         → JSON sparse por proveedor (v1: ollama.json)
app/routers/api_models.py      → GET .../contract
app/provider_params.py         → build_extra_body usa specs del contrato
app/static/js/app.js           → carga contrato, knob think, chips receta
tests/test_model_contract.py   → merge + thinking + builder
tests/test_api_models.py       → endpoint contract
tests/test_e2e_api.py          → e2e del GET contract
docs/                          → spec / plan / checklist / diseño
```

No tocar `app/model_info.py` salvo lectura puntual de `provider_info` si el resolver ya pasa por `show_model`.

---

## Code Style

Dataclasses de dominio (como `WorkspaceProfile`), funciones puras de merge, sin jerarquía de adapters por modelo. Overlay sparse: solo deltas.

```python
@dataclass(frozen=True)
class ThinkingCapability:
    kind: str  # "none" | "boolean" | "levels"
    values: tuple[str, ...] = ()
    can_disable: bool = True
    true_maps_to: str | None = None
    default: str | bool | None = None
```

`think` en schema: `"api_key": "think"` (raíz del payload, no `options.think`).

---

## Testing Strategy

| Nivel | Qué |
|-------|-----|
| Unitario | Merge (prioridad), overlay ausente, thinking coerce, `build_extra_body` con `think` top-level |
| API | GET contract 200 + shape; modelo desconocido = contrato degradado, no 500 |
| E2E | GET contract para Ollama (escrito; no correr en el flujo diario) |
| No | Clase de test por modelo cloud; no e2e de chat con Ollama cloud real para think |

TDD: test que falle del comportamiento (p. ej. `think` no sale en extra_body) **antes** de cambiar `build_extra_body`.

---

## Boundaries

- **Always:** tests sin e2e al cerrar cada slice; overlay sparse; UI según contrato, no según nombre de modelo; `make test` antes de dar por cerrado un checkpoint.
- **Ask first:** migrar/adelgazar `config/ollama.json`; renderer completo de Ajustes; overlays del resto de cloud; persistir/pintar traces de thinking; adjunto multimodal; cambiar firma pública de APIs existentes de params/presets.
- **Never:** una clase por modelo; `if model == "gpt-oss"` en JS; mezclar contrato con `model_info`; default `num_ctx = max` (1M); pisar `model_params` de usuario al cambiar de modelo o al aplicar receta sin confirmación; meter `think` en `options`.

---

## API (contrato primero)

```
GET /api/providers/{provider}/models/{model_id}/contract
```

`model_id` puede contener `:` (URL-encoded), igual que la ficha.

Respuesta 200 (campos aditivos; no sustituye `/params` ni `/presets` en v1):

```json
{
  "provider": "ollama",
  "model": "deepseek-v4-flash:cloud",
  "capabilities": {
    "vision": false,
    "tools": true,
    "structured_output": true,
    "thinking": {
      "kind": "levels",
      "values": ["false", "true", "max"],
      "can_disable": true,
      "default": "true"
    }
  },
  "params": {
    "temperature": { "api_key": "options.temperature", "type": "float", "default": 0.3, "min": 0, "max": 2 },
    "think": { "api_key": "think", "type": "enum", "values": ["false", "true", "max"], "default": "true" }
  },
  "recipes": [
    { "id": "fast", "label": "Rápido", "params": { "think": false, "temperature": 0.5, "num_ctx": 16384 } }
  ],
  "quirks": []
}
```

Sin overlay y sin `show`: `capabilities.thinking.kind = "none"`, `recipes = []`, `params` = schema del proveedor. HTTP 200, no 404.

Errores: proveedor desconocido → 404 (igual que otros endpoints de provider). Fallo de `show_model` → se omite capa live, no se falla el GET.

`GET /params` y `GET /presets` se mantienen (Hyrum: el frontend actual depende de ellos).

---

## Thinking (semántica v1)

| Contrato | UI | Payload |
|----------|----|---------|
| `kind: none` | no hay knob | no se envía `think` |
| `kind: boolean` | on/off | `true` / `false` |
| `kind: levels` + `can_disable` | selector de `values` | el valor elegido (string o bool JSON) |
| `can_disable: false` | no hay «off» | `false` del cliente → `true_maps_to` |

GPT-OSS: `values: ["low","medium","high"]`, `can_disable: false`, `true_maps_to: "medium"`.  
DeepSeek: `values` incluyen apagado (`false` o equivalente), `can_disable: true`, incluye `max`.

---

## Recetas

- Chips junto al composer, solo si `recipes.length > 0`.
- Aplicar receta = fusionar `recipe.params` en los controles y persistir en `model_params` de la conversación.
- Si origen actual es **user** (ya hay overrides), pedir confirmación.
- No confundir con «Cargar preset» (elige otro modelo/schema completo).

Default de `num_ctx` en overlay: **32768** (techo en `max`, nunca default = max del modelo).

---

## Success Criteria

- [ ] Mismo renderer/backend cubre GPT-OSS y DeepSeek sin ramificar por nombre.
- [ ] `think` viaja top-level en extra_body cuando el contrato lo define y el usuario lo envía (o receta).
- [ ] Modelo sin overlay: chat igual que hoy.
- [ ] Presets y ficha de modelo intactos.
- [ ] Tests unitarios del merge y del builder en verde con `make test`.
- [ ] Test e2e del GET contract escrito.

---

## Out of scope (v1)

- Renderer schema-driven de todo el acordeón Ajustes.
- Overlays del resto de cloud / locales.
- Subir imágenes al chat (visión).
- Pintar o guardar chain-of-thought.
- `omit_prior_thinking` / reordenar imagen-antes-de-texto (quirks de historial).
- Gating de tools/MCP por `capabilities.tools`.
- Estimación de coste.
- Adelgazar `config/ollama.json`.

---

## Open Questions

- ¿Confirmas rama `feat/model-contract` al implementar, o se hace en la rama actual?
- ¿Los valores de thinking en JSON como strings (`"false"`) o tipos nativos (`false` / `"max"`)? Recomendación: nativos en recetas y `model_params`; `values` del contrato admite ambos y el builder normaliza.
- ¿El knob de think se persiste siempre (aunque coincida con el default del contrato) para que al recargar la conversación se vea el nivel? Recomendación: sí, como el resto de params «tocados»; receta cuenta como toque.
