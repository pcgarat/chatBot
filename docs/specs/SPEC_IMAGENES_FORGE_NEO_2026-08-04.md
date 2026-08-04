Última modificación: 2026-08-04

# Spec: Ilustración de respuestas con Forge Neo

Intent de referencia: [`docs/intent/imagenes-forge-neo_2026-08-04.md`](../intent/imagenes-forge-neo_2026-08-04.md)

**Estado:** aprobada (2026-08-04) — siguiente: plan + checklist / implementación.

---

## Decisión: ReplayLastGeneration (máximo de parámetros)

Forge Neo **no** expone “get last request”. La estrategia elegida maximiza fidelidad al último gen del usuario y **no decide** por el chatBot si el modo es txt2img o img2img: eso lo fija lo último que hiciste en Forge.

### Fuentes (en orden)

1. **Última imagen en `FORGE_DATA_PATH/output/`** → `POST /sdapi/v1/png-info` (infotext estructurable: steps, sampler, schedule, CFG, seed, size, model, modules, denoising, etc.).
2. **`params.txt`** en `FORGE_DATA_PATH` como respaldo / cruce (misma generación reciente).
3. **`GET /sdapi/v1/options`** para alinear checkpoint / modules cargados si el infotext no basta.

### Modo de API

- Detectar por carpeta de salida (`txt2img-images` vs `img2img-images`) y/o presencia de `Denoising strength` en el infotext.
- Llamar **exactamente** ese endpoint (`/sdapi/v1/txt2img` o `/sdapi/v1/img2img`).
- El chatBot **no** convierte img2img→txt2img ni al revés.

### Qué se copia vs qué se cambia

| Campo | Comportamiento |
|-------|----------------|
| prompt | **Único campo sustituido** por el prompt de escena del LLM |
| negative_prompt | Heredado del último gen (el LLM de escenas no lo pisa) |
| steps, sampler, scheduler, CFG, width, height, seed, batch, denoising, restore_faces, etc. | Todos los que se puedan parsear del último gen → se reenvían |
| model / modules | Se fuerza vía options o campos del payload para coincidir con el último gen |
| init_images (solo img2img) | Ver abajo |

### Init images (img2img) — mejor opción viable

La UI de Forge **no deja** las init images originales accesibles por API tras generar. Opciones evaluadas:

| Opción | Pros | Contras |
|--------|------|---------|
| Carpeta manual de refs | Refs exactas de entrada | Fricción; rompe el ritual “afino y uso” |
| Fallar si no hay refs | Honesto | Inútil tras afinar en UI img2img |
| **Usar la última salida como `init_images`** | Automático; el resultado afinado *es* el look; cero setup | No son las entradas originales del swap |

**Decisión v1:** si el último modo fue img2img, `init_images = [última imagen generada]` (la que acabas de afinar). Opcional: si `FORGE_STYLE_INIT_DIR` tiene archivos, **tienen prioridad** sobre la última salida (escape hatch sin obligar a usarlo).

Así el ritual queda: generas en Forge hasta que te guste → el chatBot reutiliza **el máximo de knobs** + esa imagen como ancla visual si era img2img.

### Qué no se inventa

- No hardcodear krea/Klein/steps.
- No rellenar params que no aparezcan en el último gen con “defaults de la app”.
- Si un campo no se puede recuperar, se omite y Forge usa su default de servidor; el debug log lista campos recuperados vs omitidos.

---

## Assumptions (corregir antes de implementar)

1. **ReplayLastGeneration** según la sección anterior.
2. **Preferencias del panel Imágenes:** `localStorage` + envío en el body cuando aplica; sin tabla nueva en BD para v1.
3. **Persistencia de imágenes en el mensaje:** URLs servidas por el backend; al recargar se ven.
4. **Clasificación relato/roleplay:** mismo LLM de prompts, JSON; si `illustrate: false`, no hay Forge.
5. **`FORGE_BASE_URL`** default `http://127.0.0.1:7860`; **`FORGE_DATA_PATH`** obligatorio para última salida / `params.txt`.
6. **Render:** texto escapado + `<br>`; `<img>`/placeholders controlados (sin markdown genérico).
7. **Endpoint `.../illustrate` separado** tras el `done` del chat.
8. **Anclas:** `anchor_excerpt` + fallback `paragraph_index` si el excerpt no matchea.
9. **LLM de prompts:** select independiente provider + modelo.
10. **Negative prompt:** solo el del último gen; el LLM de escenas no lo pisa.

→ Si alguna asunción es incorrecta, corregirla antes del plan/implementación.

---

## Objective

Añadir una pestaña **Imágenes** en el panel lateral (junto a Reglas y Ajustes) que orqueste:

1. Tras completar la respuesta del chat (flujo A: post-stream).
2. Un LLM secundario (provider/modelo seleccionables) decide si la respuesta es relato/roleplay y, si sí, produce hasta N escenas: prompt SD + ancla de inserción **sin alterar el texto**.
3. Generación en Forge Neo clonando el último payload (solo cambia el prompt).
4. UX: relato visible + placeholders que se rellenan; reintentos tras el primer pase completo; debug con log en ventana.

### User stories

- Como usuario, activo Imágenes, elijo N, modelo de prompts y reintentos; al chatear, si hay relato/roleplay, veo el texto ya y las imágenes van apareciendo en su sitio.
- Como usuario, afino estilo en la UI de Forge; el chatBot usa ese último setup sin pedirme steps/CFG/checkpoint.
- Como usuario, activo debug del generador y veo un log paso a paso (clasificación, prompts, llamadas Forge, reintentos, errores).

### Acceptance criteria (testables)

- [ ] Existe pestaña lateral `imagenes` junto a `reglas` / `parametros`.
- [ ] Controles: checkbox activar, integer “imágenes por respuesta” (≥1), select provider+modelo LLM de prompts, integer “reintentos” (≥0), checkbox debug generador.
- [ ] Con Imágenes off, el flujo de chat no cambia.
- [ ] Con Imágenes on y respuesta no-relato/no-roleplay (según LLM), no hay llamadas a Forge.
- [ ] Con Imágenes on y relato: aparecen N placeholders (N = min(config, escenas devueltas)) anclados sin reescribir el relato.
- [ ] Cada imagen exitosa sustituye su placeholder; fallo → mensaje de error en ese hueco; el resto sigue.
- [ ] Tras el primer pase de todas las escenas, se reintentan solo las fallidas hasta el entero de reintentos.
- [ ] Cada generación Forge usa ReplayLastGeneration: máximo de params del último gen; solo cambia el prompt de escena; modo txt2img/img2img = el del último gen.
- [ ] Si último gen fue img2img: init = `FORGE_STYLE_INIT_DIR` si tiene archivos, si no la última salida.
- [ ] Debug on → ventana/panel de log (incluye campos recuperados/omitidos del payload); debug off → sin esa UI.
- [ ] Tests unitarios del planificador de escenas, reconstrucción de payload, cliente Forge (mock), política de reintentos y anclaje; e2e del endpoint (mock Forge si hace falta).

---

## Tech Stack

- Backend: FastAPI + SQLAlchemy (existente), httpx hacia Forge.
- Frontend: `app/static/index.html` + `app/static/js/app.js` + CSS (sin framework).
- Forge Neo: API A1111-compatible (`/sdapi/v1/txt2img`, `/sdapi/v1/img2img`, `/sdapi/v1/png-info`, `/sdapi/v1/options`) en `FORGE_BASE_URL`.
- LLM de prompts: providers ya existentes vía `ProviderFactory` (ollama / mancer / openai / abliteration).

---

## Commands

```bash
# Tests habituales (sin e2e)
make test
# o
pytest tests/ -m "not e2e"

# Con cobertura
pytest tests/ -m "not e2e" --cov=app --cov-report=term-missing

# Solo e2e (cuando se pida)
make test-e2e

# Dev app
make up   # o el target habitual del Makefile del chatBot

# Forge Neo (proyecto hermano)
cd docker-neo && make up   # API en :7860
```

---

## Project Structure

```
app/
  config.py                          # + FORGE_BASE_URL, FORGE_DATA_PATH, FORGE_STYLE_INIT_DIR
  api/
    api_conversations.py             # enganche post-stream / eventos de ilustración
    api_images.py                    # (nuevo) servir imágenes / estado / health Forge opcional
  services/ o providers/ports/
    image_illustration/              # (nuevo) capa de orquestación hexagonal
      ports.py                       # ScenePlanner, ForgeGenerationPort, LastPayloadSource
      scene_planner.py               # LLM → JSON escenas / illustrate flag
      forge_client.py                # adapter HTTP txt2img/img2img
      last_payload.py                # params.txt + png-info (+ init dir)
      orchestrator.py                # lote → placeholders → generate → retry pass
      anchors.py                     # insertar marcadores sin reescribir relato
  static/
    index.html                       # pestaña Imágenes + debug UI
    js/app.js                        # tabs, prefs, placeholders, log, eventos stream
    css/style.css
config/                              # prompts de sistema del scene planner (JSON/texto)
docs/
  intent/imagenes-forge-neo_2026-08-04.md
  specs/SPEC_IMAGENES_FORGE_NEO_2026-08-04.md
  checklists/…                       # checklist de implementación (fase posterior)
tests/
  test_image_scene_planner.py
  test_forge_last_payload.py
  test_image_orchestrator.py
  test_api_images.py / extensión e2e
```

Patrones: **Ports & Adapters** (Forge + ScenePlanner), **Orchestrator/Facade** para el pipeline, **Strategy** reutilizando providers LLM. Evitar meter lógica Forge dentro de `api_conversations.py`; solo coordinar.

---

## Code Style

Seguir el estilo existente: type hints, docstrings solo donde la lógica sea no obvia, sin try/except decorativos, Pydantic en schemas, tests con mocks de httpx/`get_provider`.

Ejemplo de contrato del planificador (orientativo):

```python
class ScenePlan(BaseModel):
    illustrate: bool
    reason: str
    scenes: list[SceneSpec]  # vacío si illustrate=False

class SceneSpec(BaseModel):
    id: str
    prompt: str
    anchor_excerpt: str
    paragraph_index: int | None = None  # fallback si excerpt no matchea
```

Inserción: el backend produce `content_with_slots` sustituyendo/insertando marcadores estables (`⟦img:scene_id⟧`) **alrededor** del texto original (concatenación por ancla), nunca reescritura libre del LLM sobre el relato.

---

## Pipeline (secuencia)

```
chat stream completa
    → si images.enabled
        → ScenePlanner(LLM).plan(respuesta, max_images=N)
        → si not illustrate: fin
        → insertar placeholders en contenido (anclas)
        → emitir eventos UI (placeholders)
        → last_payload = LastPayloadSource.load()
        → para cada escena: Forge.generate(payload_with_prompt)
        → emitir imagen|error por escena
        → para attempt in 1..retries:
              reintentar solo fallidas; emitir updates
        → persistir contenido final del mensaje (+ refs imagen)
```

### Eventos hacia el frontend

Tras `done` del chat, el cliente llama `POST .../messages/{id}/illustrate` con NDJSON/SSE: `placeholder | image | error | log | done`. No se mezcla con el stream de tokens del LLM.

### Reintentos

1. Intentar todas las escenas una vez (no bloquear el lote en un fallo).
2. Recoger fallidas.
3. Repetir hasta `retries` pasadas adicionales solo sobre fallidas.
4. Las que sigan fallando quedan con placeholder de error.

### Debug generador

Checkbox junto al de debug del chat. Abre ventana/panel con log append-only: clasificación, JSON de escenas, payload Forge (sin volcar binarios enormes; sí metadatos), latencias, reintentos, errores. Los eventos `log` del backend alimentan esa UI.

---

## Testing Strategy

| Nivel | Qué |
|-------|-----|
| Unit | Parser `params.txt` / png-info → body; anclas; política de reintentos; ScenePlanner con provider mock (JSON válido / illustrate false / ancla no encontrada). |
| API | Endpoint illustrate: mocks Forge + LLM; verifica orden de eventos y persistencia. |
| E2E | Crear/modificar cobertura e2e del endpoint (Forge mockeado o skip si down); no exigir GPU en CI. |
| Frontend | Sin suite automatizada hoy; verificación manual de pestaña, placeholders y debug window. |

Por defecto ejecutar `pytest tests/ -m "not e2e"`. Al tocar endpoints, añadir/ajustar e2e según regla del repo.

---

## Boundaries

**Always**

- Tests del comportamiento nuevo antes o junto al fix/feature; pasar tests no-e2e al cerrar.
- Mantener el relato intacto (solo inserción por ancla).
- No hardcodear checkpoint/steps en el chatBot; siempre último payload.
- Logs de debug sin secretos ni base64 gigantes en persistencia.

**Ask first**

- Migración de esquema Message si se prefiere columna `images_json` en lugar de embeber URLs en `content`.
- Dependencias nuevas no triviales.
- Cambiar el contrato NDJSON del stream de chat en lugar del endpoint illustrate separado.

**Never**

- Controles SD (steps, CFG, checkpoint) en el panel v1.
- Forzar txt2img u otro modo distinto al del último gen.
- Inventar defaults de la app para params que el último gen no aporta.
- Reescribir el relato con el LLM de prompts.
- Generar imágenes durante el stream de tokens del chat.
- Commitear `.env` con rutas locales sensibles si no aplica; documentar en `.env.example`.

---

## Config (`.env.example`)

```bash
# Forge Neo (ilustración de relatos) — ReplayLastGeneration
# FORGE_BASE_URL=http://127.0.0.1:7860
# FORGE_DATA_PATH=/home/pacogarat/Applications/Data
# Opcional: refs img2img con prioridad sobre la última salida
# FORGE_STYLE_INIT_DIR=/home/pacogarat/Applications/Data/chatbot-style-init
```

---

## Success Criteria

1. Usuario puede ilustrar un relato end-to-end con Forge levantado y panel configurado.
2. Afinar en Forge (txt2img o img2img, da igual) y generar una vez cambia el resultado del chatBot en la siguiente ilustración sin tocar panel SD.
3. El debug lista el modo detectado y el máximo de campos recuperados del último gen.
4. Criterios de aceptación de arriba marcados.
5. Spec + intent versionados; checklist de implementación en fase posterior.

---

## Open Questions

Ninguna bloqueante tras la decisión ReplayLastGeneration. Si rechazas alguna asunción 7–10 (endpoint, anclas, provider, negative), dilo antes del plan.

---

## Outside this spec

- Plan de implementación detallado y checklist de tareas (`PLAN` / `TASKS`).
- UI de parámetros SD.
- Galería global de imágenes fuera del hilo del chat.
- Recuperar las init images *originales* de la sesión Gradio (no expuesto por API).
