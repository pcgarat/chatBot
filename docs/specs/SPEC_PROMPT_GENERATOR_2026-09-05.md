Última modificación: 2026-09-05

# Spec: Prompt generator (entrevista → prompt FLUX)

**Estado:** **implementada** (2026-09-05) — `make test` verde; smoke manual pendiente.

**Intent:** [`docs/intent/prompt-generator_2026-09-05.md`](../intent/prompt-generator_2026-09-05.md)

**Plan:** [`docs/plans/PLAN_PROMPT_GENERATOR_2026-09-05.md`](../plans/PLAN_PROMPT_GENERATOR_2026-09-05.md)

**Checklist:** [`docs/checklists/CHECKLIST_PROMPT_GENERATOR_2026-09-05.md`](../checklists/CHECKLIST_PROMPT_GENERATOR_2026-09-05.md)

**Rama:** `feat/prompt-generator`

---

## Assumptions (validadas 2026-09-05)

1. **Superficie:** mismo layout de chat (columna central + composer). No panel modal. El listado izquierdo muestra estos hilos junto a los normales, con icono/etiqueta distinta.
2. **Discriminador:** columna `conversations.kind` (`chat` | `prompt_generator`), default `chat`. Sin mezclar con `images` JSON ni con títulos mágicos.
3. **Brief tipado en la conversación:** columna `conversations.prompt_brief` (JSON Text). Es la fuente de verdad del slot-filling; el historial de mensajes es solo UX.
4. **Contrato del brief (v1, FLUX):**
   ```json
   {
     "prompt_language": null,
     "image_type_subject": null,
     "action_pose_expression": null,
     "environment": null,
     "composition_framing_angle": null,
     "lighting": null,
     "visual_style": null,
     "materials_color_atmosphere": null,
     "visible_text": null,
     "force_generate": false,
     "latest_prompt": null
   }
   ```
   Campos `null` = desconocidos. `visible_text` puede quedar `null`/`""` si no aplica. `latest_prompt` es el último prompt emitido (para copiar / refinar).
5. **Turno del agente = salida estructurada**, no prosa libre sola. Cada respuesta del backend incluye al menos: `assistant_text` (pregunta o explicación), `brief` actualizado, `phase` (`interview` | `prompt`), y si `phase=prompt` el string `prompt`. Sin structured output, el brief se corrompe en 3 turnos.
6. **Endpoint dedicado** (no reutilizar a ciegas el stream del chat): p. ej. `POST /api/conversations/{id}/prompt-generator/turn` con body `{ "message"?: string, "force"?: bool }`. Reutiliza provider/modelo/params de la conversación; **no** concatena reglas `scope=chat` del usuario (contaminan al entrevistador). System fijo + guía FLUX (secciones/plantilla, adaptada: aquí SÍ se pregunta).
7. **Arranque:** al crear el hilo, el servidor inserta un **primer mensaje assistant con template fijo** (sin LLM) preguntando el idioma del prompt. Título inicial acorde al botón (`txt2img` o «Prompt generator» interno); sin auto-title de chat.
8. **UI botón sidebar:** texto visible **`txt2img`** (debajo de Nueva). Crea `kind=prompt_generator`.
9. **UI composer:** en `kind=prompt_generator` aparece botón **Generar prompt** (`force=true`) además de enviar. Detección de «genera ya» (y variantes razonables) en el mensaje del usuario → `force=true` en servidor.
10. **UI resultado:** si `phase=prompt`, el mensaje assistant se renderiza con bloque de prompt + botón **Copiar**. Refinar = seguir enviando mensajes; el brief se actualiza y puede volver a `phase=prompt`.
11. **Idioma:** la entrevista del agente en **español**; el prompt final en el idioma elegido en `prompt_language` (p. ej. inglés, español). Si fuerza sin idioma, default inglés (alineado a la guía FLUX).
12. **Criterio “ya puedo generar”:** el agente puede pasar a `phase=prompt` cuando considere el brief suficiente (no hace falta llenar los 8 slots). `force=true` genera siempre con lo que haya (aunque sea pobre).
13. **Fork:** habilitado en hilos `prompt_generator` (mismo comportamiento que chat). Illustrate / panel Imágenes / Forge: **sin cambios de producto en v1** (no se dispara generación desde este flujo; no hace falta ocultar el panel).
14. **Tests:** `make test` (sin e2e por defecto). Endpoint nuevo → test API + e2e del endpoint. UI: asserts estáticos en HTML/JS como el resto del repo.
15. **Migración de esquema:** patrón actual del proyecto (startup / migrate script), no Alembic.

---

## Objective

Permitir crear un hilo **Prompt generator** donde un agente entrevista al usuario sobre la imagen deseada, mantiene un **PromptBrief** tipado según la guía FLUX, y muestra el prompt resultante en pantalla con botón de copiar; el usuario puede forzar la generación y seguir refinando.

**Usuario:** quien ya usa el chat y quiere prompts de imagen sin redactar la plantilla a mano.

### User stories

- Como usuario, pulso **Prompt generator** bajo **Nueva** y se abre un hilo especial en el listado.
- Como usuario, el agente me pregunta (empezando por el idioma del prompt) hasta poder proponer un prompt FLUX, o yo fuerzo con el botón / «genera ya».
- Como usuario, veo el prompt en pantalla y lo copio al portapapeles.
- Como usuario, sigo chateando para pedir cambios y obtengo una nueva versión.

### Acceptance criteria (testables)

- [x] Existe botón `#btn-prompt-generator` (o id equivalente) inmediatamente debajo del de nueva conversación, con texto visible **`txt2img`**.
- [x] El botón crea `POST` conversación con `kind=prompt_generator`, título distinto de chat normal, y un mensaje assistant inicial **template fijo** (sin llamada LLM en el create).
- [x] `conversations.kind` y `conversations.prompt_brief` persisten y vuelven en `GET /api/conversations/{id}`.
- [x] En hilos `prompt_generator`, enviar mensaje o pulsar **Generar prompt** llama al endpoint de turn y actualiza `prompt_brief`.
- [x] Respuesta de turn con `phase=prompt` incluye `prompt` no vacío; la UI muestra bloque + **Copiar** (clipboard).
- [x] `force=true` (botón o frase «genera ya») produce `phase=prompt` aunque el brief esté incompleto.
- [x] Tras un prompt, un mensaje de refinamiento puede producir otro `phase=prompt` con `latest_prompt` actualizado.
- [x] Hilos `kind=chat` no cambian de comportamiento.
- [x] No se llama a Forge ni se encola imagen desde este flujo.
- [x] Tests API (+ e2e del endpoint) y `make test` verde.

---

## Tech Stack

| Capa | Tecnología |
|------|------------|
| UI | `app/static/index.html`, `app/static/css/style.css`, `app/static/js/app.js` |
| API | FastAPI; router dedicado o extensión de `api_conversations.py` si no hincha el archivo |
| Dominio | servicio pequeño tipo `app/services/prompt_generator/` (brief, system prompt, parse/merge) |
| Datos | SQLAlchemy `Conversation` (+ columnas); mensajes existentes |
| LLM | mismo provider/modelo/params de la conversación; salida estructurada (JSON) |
| Guía | contenido derivado de `config/seed/planner_flux_prompts.md` (secciones/plantilla; **sin** la regla «no preguntes») |
| Tests | pytest (`make test` / `pytest tests/ -m "not e2e"`); e2e del endpoint nuevo |

---

## Commands

```bash
make start
make test
pytest tests/ -m "not e2e"
pytest -m e2e   # solo cuando se pida / para el endpoint nuevo
```

---

## Project Structure

```
docs/intent/prompt-generator_2026-09-05.md   → intent confirmado
docs/specs/SPEC_PROMPT_GENERATOR_2026-09-05.md → este spec
app/models.py                                 → kind, prompt_brief
app/schemas.py                                → DTOs Conversation + Turn
app/services/prompt_generator/                → brief schema, system, merge, force
app/routers/...                               → create kind + turn endpoint
app/static/index.html                         → botón sidebar + Generar prompt
app/static/js/app.js                          → create/open/turn/render/copy
app/static/css/style.css                      → bloque prompt + botón
tests/                                        → API, unit brief, UI estática; e2e turn
```

---

## Code Style

Patrón hexagonal ligero ya usado en servicios: dominio sin FastAPI; router delgado; UI vanilla como el resto.

Ejemplo de merge de brief (ilustrativo):

```python
@dataclass
class PromptBrief:
    prompt_language: str | None = None
    image_type_subject: str | None = None
    # ...

    def merge(self, patch: dict) -> "PromptBrief":
        data = {**asdict(self), **{k: v for k, v in patch.items() if v is not None}}
        return PromptBrief(**{k: data.get(k) for k in asdict(self)})
```

Convenciones:

- `kind` explícito en create; default `chat` en lecturas legacy.
- No guardar el prompt solo en el texto del mensaje sin actualizar `prompt_brief.latest_prompt`.
- Una pregunta por turno de entrevista (salvo force).

---

## Testing Strategy

| Nivel | Qué |
|-------|-----|
| Unit | merge/patch del brief; detección de force («genera ya»); decisión `phase` con force |
| API | create `kind=prompt_generator`; turn actualiza brief; force → `phase=prompt`; chat normal intacto |
| UI estática | botón bajo Nueva; en modo prompt_generator existe Generar prompt; render de bloque + Copiar |
| e2e | happy path del endpoint turn (mock LLM si el proyecto ya lo hace en e2e similares) |

Cobertura: no bajar la del paquete tocado; priorizar servicio + API.

---

## Boundaries

- **Always:** brief tipado como fuente de verdad; structured turn; tests sin e2e en el flujo diario; no tocar Forge.
- **Ask first:** ocultar illustrate/Imágenes en estos hilos; añadir dependencias; cambiar el system base del entrevistador tras merge; selector de guía no-FLUX; renombrar el label `txt2img` si confunde con generación real.
- **Never:** enviar el prompt a Forge desde este flujo; mezclar reglas `scope=chat` del usuario en el system del entrevistador; inventar guía Krea en v1; persistir el brief solo en el cliente.

---

## Success Criteria

1. Desde frío: botón → hilo → entrevista → prompt en pantalla → copiar funciona.
2. Force con brief vacío/parcial → igual hay prompt (aunque flojo) + se puede refinar.
3. Reabrir el hilo restaura mensajes y `prompt_brief`.
4. Conversaciones normales sin regresión.
5. `make test` verde; e2e del endpoint nuevo escrito.

---

## Open Questions

Ninguna bloqueante (2026-09-05): botón `txt2img`; fork sí; primer mensaje template fijo.

---

## Critica de diseño (consciente)

- **Por qué no solo el historial:** sin `PromptBrief`, «genera ya» y el refinamiento dependen de que el modelo re-extraiga todo cada vez → frágil.
- **Por qué endpoint dedicado:** el stream del chat actual asume prosa; forzar JSON + force sin mensaje de usuario ensucia ese camino. Mejor un puerto claro; el chat sigue igual.
- **Por qué no meter reglas del usuario:** el entrevistador tiene un contrato fijo; las reglas de chat (tono, tools, etc.) lo rompen.
- **Riesgo:** structured output mal parseado → turn debe fallar de forma visible o reintentar una vez, no silenciar y seguir con brief viejo.
- **Label `txt2img`:** en muchas UIs implica lanzar generación; aquí solo abre el entrevistador de prompts. Aceptado por producto; si confunde en uso real, renombrar sin cambiar el `kind`.
