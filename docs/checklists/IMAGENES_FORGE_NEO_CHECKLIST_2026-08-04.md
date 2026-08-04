Última modificación: 2026-08-04

# Checklist: Ilustración de respuestas con Forge Neo

**Objetivo:** Pestaña Imágenes + pipeline post-chat que clasifica relato/roleplay, genera prompts/anclas, llama a Forge Neo con ReplayLastGeneration e inserta imágenes en placeholders.

**Referencias:**
- Intent: [`docs/intent/imagenes-forge-neo_2026-08-04.md`](../intent/imagenes-forge-neo_2026-08-04.md)
- Spec: [`docs/specs/SPEC_IMAGENES_FORGE_NEO_2026-08-04.md`](../specs/SPEC_IMAGENES_FORGE_NEO_2026-08-04.md)
- Plan: [`docs/plans/PLAN_IMAGENES_FORGE_NEO_2026-08-04.md`](../plans/PLAN_IMAGENES_FORGE_NEO_2026-08-04.md)

**Verificación habitual:** `pytest tests/ -m "not e2e"` (e2e solo si se pide o al cerrar endpoints).

---

## 1. Configuración

- [ ] **1.1** En `app/config.py`: `forge_base_url`, `forge_data_path`, `forge_style_init_dir` (opcional), timeout Forge.
- [ ] **1.2** Actualizar `.env.example` con esas variables documentadas.
- [ ] **1.3** Tests en `tests/test_config.py` para defaults / lectura de env.

**Verify:** `pytest tests/test_config.py -q`

---

## 2. ReplayLastGeneration (LastPayload + ForgeClient)

- [ ] **2.1** Crear paquete `app/services/image_illustration/` (o ruta alineada al repo) con ports: `LastPayloadSource`, `ForgeGenerationPort`.
- [ ] **2.2** `last_payload.py`: localizar última imagen bajo `FORGE_DATA_PATH/output/`, `png-info`, cruzar `params.txt`, alinear `options`; detectar modo txt2img vs img2img; construir body API con **máximo** de campos parseables; prompt como único campo a sustituir después; negative heredado.
- [ ] **2.3** Init img2img: si `FORGE_STYLE_INIT_DIR` tiene ficheros → usarlos; si no → última salida como `init_images`.
- [ ] **2.4** `forge_client.py`: `generate(mode, body)` → POST txt2img/img2img; devolver imagen(es) bytes/base64; errores tipados.
- [ ] **2.5** Fixtures de test con `params.txt` / infotext de ejemplo (basados en datos reales locales, sin binarios enormes).
- [ ] **2.6** Tests: detección de modo, parse de campos, prioridad init dir vs última salida, omitir campos no recuperables sin inventar defaults de app.

**Verify:** `pytest tests/test_forge_last_payload.py tests/test_forge_client.py -q` (nombres finales según implementación)

---

## 3. ScenePlanner + anclas

- [ ] **3.1** Prompt de sistema del planificador en `config/` (JSON/texto).
- [ ] **3.2** `scene_planner.py`: llama al provider elegido; parsea JSON → `illustrate`, `reason`, `scenes[]` (`id`, `prompt`, `anchor_excerpt`, `paragraph_index?`); respeta `max_images`.
- [ ] **3.3** `anchors.py`: inserta marcadores `⟦img:id⟧` tras ancla sin reescribir el relato; fallback `paragraph_index`; si ambos fallan → al final.
- [ ] **3.4** Tests: illustrate false; N escenas; ancla ok / fallback / fail-safe final; JSON malformado manejado.

**Verify:** `pytest tests/test_image_scene_planner.py tests/test_image_anchors.py -q`

---

## 4. Orquestador (lote + reintentos)

- [ ] **4.1** `orchestrator.py`: plan → anchors → load last payload → generar todas → emitir eventos → reintentar solo fallidas hasta `retries`.
- [ ] **4.2** Eventos internos: `log`, `placeholder`, `image`, `error`, `done`.
- [ ] **4.3** Tests: orden de reintentos (no reintentar hasta acabar el primer pase); fallo parcial; skip si not illustrate.

**Verify:** `pytest tests/test_image_orchestrator.py -q`

---

## Checkpoint A (tras 1–4)

- [ ] `pytest tests/ -m "not e2e"` en verde para los módulos nuevos.
- [ ] Sin cambios de UI aún; núcleo usable por API/tests.

---

## 5. API

- [ ] **5.1** Schemas request: enabled ya validado en cliente; body con `images_per_response`, `prompt_provider`, `prompt_model`, `retries`, `debug` (o subset).
- [ ] **5.2** `POST /api/conversations/{id}/messages/{message_id}/illustrate` → NDJSON de eventos del orquestador.
- [ ] **5.3** Persistir contenido del assistant con slots resueltos / URLs de imagen; guardar ficheros en dir de la app.
- [ ] **5.4** Endpoint o static para servir esas imágenes.
- [ ] **5.5** Registrar router en `main.py`.
- [ ] **5.6** Tests API con mocks de Forge + LLM provider.
- [ ] **5.7** Ampliar `tests/test_e2e_api.py` (Forge mockeado o skip condicional) al crear/modificar el endpoint.

**Verify:** `pytest tests/ -m "not e2e" -q` y, si se pide, e2e del endpoint.

---

## 6. Frontend — pestaña Imágenes

- [ ] **6.1** Tab `imagenes` en sidebar (`index.html` + `SIDEBAR_TAB_IDS` en `app.js` + CSS).
- [ ] **6.2** Controles: activar, imágenes por respuesta, provider+modelo LLM prompts, reintentos.
- [ ] **6.3** Persistencia prefs en `localStorage`.
- [ ] **6.4** Tras `done` del stream de chat, si enabled → llamar `illustrate` y procesar eventos.

**Verify:** manual — pestaña visible, prefs sobreviven reload.

---

## 7. Frontend — placeholders, render e debug

- [ ] **7.1** Render de marcadores/placeholders → spinners; al `image` sustituir por `<img>`; al `error` mensaje en hueco.
- [ ] **7.2** Al recargar conversación, mostrar imágenes ya persistidas.
- [ ] **7.3** Checkbox debug generador (junto al debug del chat) + ventana/panel de log alimentado por eventos `log`.
- [ ] **7.4** Con Imágenes off, comportamiento del chat idéntico al actual.

**Verify:** manual — relato + placeholders + debug log; charla no-relato sin llamadas Forge (ver log/red).

---

## Checkpoint B (cierre)

- [ ] `pytest tests/ -m "not e2e"` verde.
- [ ] Smoke manual: afinar en Forge → chat relato → imágenes con mismo look/params.
- [ ] Spec acceptance criteria revisados y marcados en la spec si aplica.
- [ ] Actualizar este checklist al 100% de ítems hechos.

---

## Fuera de alcance (no marcar aquí)

- Controles SD en el panel.
- Recuperar init images originales de Gradio.
- Markdown genérico en el chat.
- Galería global fuera del hilo.
