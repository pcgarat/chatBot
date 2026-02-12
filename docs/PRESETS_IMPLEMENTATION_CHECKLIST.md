# Checklist: Presets de modelos por proveedor

**Objetivo:** Permitir cargar presets de parámetros desde archivos por proveedor (`config/{provider}.json`). Un botón "Cargar preset" en el panel izquierdo (fuera de las categorías) lista las entradas del archivo y, al elegir una, aplica sus valores a los controles de la UI. Un botón "Limpiar" junto a él restaura todos los controles a los valores por defecto del proveedor (como si no se hubieran tocado), de modo que no se envíe ningún parámetro extra. Los presets **no** se cargan automáticamente al iniciar ni al cambiar de modelo.

**Referencia:** `config/ollama.json` ya existe; claves = nombres de modelo (mismo formato que devuelve Ollama en `list_models`).

**Estado:** Implementación completada: backend (get_presets, GET presets), frontend (botones Cargar preset + Limpiar, modal, aplicar preset, reset a defaults), tests. Pendiente: verificación 1.1, documentación 5.2, opcionales 2.4, 4.3, 6.3.

---

## 1. Verificación de nombres de modelo (Ollama)

- [ ] **1.1** Comprobar que las claves de `config/ollama.json` coinciden con los nombres que devuelve Ollama:
  - En `app/providers/ollama.py`, `list_models()` usa `_extract_model_name(m)` con `m.get("model")` o `m.get("name")`.
  - Las claves del JSON deben ser exactamente ese valor (ej. `llama3.1:8b-instruct-q4_K_M`, `qwen3:8b`).
  - Opción: añadir test o script que llame a `list_models()` y compare con las claves del JSON; o documentar en README que deben coincidir.

- [ ] **1.2** (Opcional) Si hay discrepancia (ej. Ollama devuelve con/sin tag), decidir convención (siempre con tag, o normalizar) y actualizar presets o código.

---

## 2. Backend: lectura de presets por proveedor

- [x] **2.1** Ubicación: `config/{provider}.json`; formato como en `ollama.json`.

- [x] **2.2** En `app/provider_params.py`: `get_presets(provider_name)` lee `config/{provider}.json`, caché en memoria; devuelve `{}` si no existe o falla.

- [x] **2.3** GET `/api/providers/{provider}/presets` en `api_models.py`; respuesta `{ "provider", "presets" }`; `presets: {}` si no hay archivo.

- [ ] **2.4** (Opcional) GET `/api/providers/{provider}/presets/{model_id}`; no implementado, el frontend usa el listado completo.

---

## 3. Frontend: botones "Cargar preset" y "Limpiar"

- [x] **3.1** Dos botones en `sidebar-presets-actions` (entre header y acordeón): "Cargar preset" y "Limpiar"; estilo btn-secondary.

- [x] **3.2** Clic "Cargar preset": GET `/api/providers/{provider}/presets`; modal con lista de presets (nombres de modelo); si vacío, mensaje "No hay presets para este proveedor".

- [x] **3.3** Al seleccionar preset: se aplican valores con `applyPresetToControls()`; se actualiza el selector de modelo si el nombre está en la lista; se cierra el modal. Solo se afectan controles en `paramsConfig.params`.

- [x] **3.4** Presets no se cargan al iniciar ni al cambiar proveedor/modelo; solo al elegir uno en el modal.

- [x] **3.5** "Limpiar" llama a `resetParamsToDefaults()` → `applyParamsConfig()`; aviso al usuario; `buildModelParams()` devuelve `{}`.

---

## 4. Formato de valores al aplicar preset

- [x] **4.1** Numéricos: valor `default` asignado al input en `applyPresetToControls()`.

- [x] **4.2** `string_list`: array → `join("\n")` al rellenar; coherente con `buildModelParams()`.

- [ ] **4.3** (Opcional) Recortar valor al min/max del control; no implementado.

---

## 5. Estructura de archivos y convenciones

- [x] **5.1** Un archivo por proveedor: `config/ollama.json`; `provider_params.json` separado (esquema).

- [ ] **5.2** Documentar en README o docs: `config/{provider}.json` para presets; claves = nombres de modelo del proveedor.

---

## 6. Tests

- [x] **6.1** `test_get_provider_presets_ollama`: GET `/api/providers/ollama/presets` → 200, estructura con `presets` y entrada con temperature/max_tokens.

- [x] **6.2** `test_get_provider_presets_unknown`: proveedor sin archivo → 200, `presets: {}`.

- [ ] **6.3** (Opcional) Test unitario de `get_presets("ollama")`; no implementado.

---

## 7. Mejoras futuras (no en este checklist)

- Importar/exportar preset: exportar configuración actual de la UI como una entrada tipo preset (un modelo + valores) y poder importarla después.
- Cargar preset automáticamente al seleccionar modelo (opción de preferencias): dejado explícitamente fuera de alcance por ahora.

---

## Orden sugerido de ejecución

1. Verificación nombres (1.1, 1.2).  
2. Backend: lectura de presets (2.1 → 2.2 → 2.3, opcional 2.4).  
3. Tests backend (6.1, 6.2).  
4. Frontend: botones "Cargar preset" y "Limpiar" (3.1).  
5. Frontend: lista de presets y aplicar al seleccionar (3.2 → 3.3, 4.1–4.3).  
6. Frontend: acción "Limpiar" = reset a defaults (3.5).  
7. Comportamiento “no auto-cargar” (3.4).  
8. Documentación (5.2).

---

## Archivos afectados

| Archivo | Estado |
|---------|--------|
| `config/ollama.json` | ✅ Existente; verificación 1.1 pendiente |
| `app/provider_params.py` | ✅ `get_presets()`, caché |
| `app/routers/api_models.py` | ✅ GET `/api/providers/{provider}/presets` |
| `app/static/index.html` | ✅ `sidebar-presets-actions`, modal presets |
| `app/static/js/app.js` | ✅ openPresetModal, closePresetModal, applyPresetToControls, resetParamsToDefaults |
| `app/static/css/style.css` | ✅ .sidebar-presets-actions, .modal-overlay, .preset-list |
| `tests/test_api_models.py` | ✅ test_get_provider_presets_ollama, test_get_provider_presets_unknown |
