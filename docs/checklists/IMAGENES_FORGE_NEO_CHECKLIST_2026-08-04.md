Última modificación: 2026-08-04 (`make start-verbose` en primer plano; log Forge con VERBOSE=1)

# Checklist: Ilustración de respuestas con Forge Neo

**Objetivo:** Pestaña Imágenes + pipeline post-chat que clasifica relato/roleplay, genera prompts/anclas, llama a Forge Neo con ReplayLastGeneration e inserta imágenes en placeholders.

**Referencias:**

- Intent: `[docs/intent/imagenes-forge-neo_2026-08-04.md](../intent/imagenes-forge-neo_2026-08-04.md)`
- Spec: `[docs/specs/SPEC_IMAGENES_FORGE_NEO_2026-08-04.md](../specs/SPEC_IMAGENES_FORGE_NEO_2026-08-04.md)`
- Plan: `[docs/plans/PLAN_IMAGENES_FORGE_NEO_2026-08-04.md](../plans/PLAN_IMAGENES_FORGE_NEO_2026-08-04.md)`

**Verificación habitual:** `pytest tests/ -m "not e2e"` (e2e solo si se pide o al cerrar endpoints).

---

## 1. Configuración

- [x] **1.1** En `app/config.py`: `forge_base_url`, `forge_data_path`, `forge_style_init_dir` (opcional), timeout Forge.
- [x] **1.2** Actualizar `.env.example` con esas variables documentadas.
- [x] **1.3** Tests en `tests/test_config.py` para defaults / lectura de env.

**Verify:** `pytest tests/test_config.py -q` ✅

---

## 2. ReplayLastGeneration (LastPayload + ForgeClient)

- [x] **2.1** Crear paquete `app/services/image_illustration/` con ports: `LastPayloadSource`, `ForgeGenerationPort`.
- [x] **2.2** `last_payload.py` + `infotext.py`: última imagen, png-info, params.txt, options; modo txt2img/img2img; máximo de campos.
- [x] **2.3** Init img2img: `FORGE_STYLE_INIT_DIR` prioritario; si no, última salida.
- [x] **2.4** `forge_client.py`: POST txt2img/img2img.
- [x] **2.5** Fixtures en `tests/fixtures_forge_infotext.py`.
- [x] **2.6** Tests: modo, parse, init dir vs última salida, sin inventar defaults.
- [x] **2.7** Log Forge en stderr solo con `VERBOSE=1`; `make start-verbose` en primer plano.

**Verify:** `pytest tests/test_forge_last_payload.py tests/test_forge_client.py -q` ✅

---

## 3. ScenePlanner + anclas

- [x] **3.1** `config/image_scene_planner_system.txt`.
- [x] **3.2** `scene_planner.py`.
- [x] **3.3** `anchors.py` con marcadores `⟦img:id⟧`.
- [x] **3.4** Tests scene planner + anchors.

**Verify:** ✅

---

## 4. Orquestador (lote + reintentos)

- [x] **4.1** `orchestrator.py`.
- [x] **4.2** Eventos: log, placeholder, image, error, done.
- [x] **4.3** Tests reintentos / fallo parcial / skip.
- [x] **4.4** `compose_forge_prompt`: concatena prompt del panel (`escena. extra`); vacío no altera.

**Verify:** ✅

---

## Checkpoint A (tras 1–4)

- [x] `pytest tests/ -m "not e2e"` en verde para los módulos nuevos.
- [x] Núcleo usable por API/tests.

---

## 5. API

- [x] **5.1** `IllustrateRequest` en schemas (incl. `prompt` opcional).
- [x] **5.2** `POST /api/conversations/{id}/messages/{message_id}/illustrate` NDJSON.
- [x] **5.3** Persistencia de content ilustrado + `data/illustrated/`.
- [x] **5.4** `GET /api/illustrated-images/{filename}`.
- [x] **5.5** Router en `main.py`.
- [x] **5.6** `tests/test_api_images.py` (forward de `prompt` al orquestador).
- [x] **5.7** E2E: `test_e2e_illustrate_rejects_non_assistant`.

**Verify:** ✅ (suite no-e2e)

---

## 6. Frontend — pestaña Imágenes

- [x] **6.1** Tab `imagenes`.
- [x] **6.2** Controles: activar, N, provider+modelo, reintentos, **prompt** (Forge), **instrucciones de sistema** (LLM planificador).
- [x] **6.3** Prefs en `localStorage` (incl. `prompt`, `prompt_system_instructions`, `use_chat_config`).
- [x] **6.4** Tras `done` del stream → `illustrate` (envía `prompt` + `prompt_system_instructions` / o chat config).
- [x] **6.5** `prompt_system_instructions` se concatena al system base del ScenePlanner (no lo sustituye).
- [x] **6.6** Check «Utilizar configuración del chat»: planificador usa provider/modelo/reglas/params de la conversación; deshabilita provider, modelo e instrucciones del panel.

**Verify:** manual pendiente en smoke.

---

## 7. Frontend — placeholders, render e debug

- [x] **7.1** `formatMessageHtml` + placeholders con prompt Forge / img / error.
- [x] **7.2** Persistencia en content del mensaje (también en cada evento del stream) → se ve al recargar.
- [x] **7.3** Debug imágenes + ventana de log.
- [x] **7.4** Con Imágenes off no se llama illustrate.
- [x] **7.5** Icono en footer de respuestas assistant: genera e incrusta imágenes para ese mensaje (force; ignora toggle auto). Usa prefs del panel (N, provider, modelo, reintentos, prompt). Re-ilustrar limpia artefactos previos en backend.
- [x] **7.6** Placeholder mientras genera: recuadro de color distinto con el prompt compuesto enviado a Forge; se sustituye por la imagen al completar.
- [x] **7.7** Con debug de conversación ON: por cada escena, mensaje efímero tipo respuesta con Request/Response del LLM planificador (`include_prompt_debug`).
- [x] **7.8** Re-ilustrar acumula imágenes (conserva imgs previas; ids de escena únicos). Stop en ventana debug aborta todas las generaciones en curso.

**Verify:** manual pendiente en smoke.

---

## Checkpoint B (cierre)

- [x] `pytest tests/ -m "not e2e"` verde.
- [x] Smoke manual: afinar en Forge → chat relato → imágenes (requiere `FORGE_DATA_PATH` en `.env` y Forge up). Verificado 2026-08-04: conversación `2b910fd5…`, relato farero/tormenta no sexual, planner `abliteration/abliterated-model`, `ReplayLastGeneration mode=txt2img`, imagen `…_s1.png` 768×768 insertada en el mensaje.
- [x] Checklist actualizado.
- [ ] Spec acceptance criteria marcados en la spec (opcional tras smoke).

---

## Config local requerida para smoke

```bash
# En .env del chatBot
FORGE_BASE_URL=http://127.0.0.1:7860
FORGE_DATA_PATH=/home/pacogarat/Applications/Data
# opcional:
# FORGE_STYLE_INIT_DIR=/home/pacogarat/Applications/Data/chatbot-style-init
```

---

## Fuera de alcance (no marcar aquí)

- Controles SD en el panel.
- Recuperar init images originales de Gradio.
- Markdown genérico en el chat.
- Galería global fuera del hilo.

