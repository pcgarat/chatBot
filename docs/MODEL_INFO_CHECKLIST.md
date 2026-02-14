# Checklist: Información de modelos (provider + usuario)

**Objetivo:** Mantener por cada modelo (ollama u otro proveedor) una ficha con:
- **Datos del proveedor:** información que expone el propio provider (ej. Ollama `POST /api/show`).
- **Datos del usuario:** `uncensored` (bool), lista de instrucciones que funcionan bien con ese modelo, y tags libres con autocompletado a partir de los existentes.

**Referencia API Ollama:** `POST /api/show` con `{"model": "modelo"}` devuelve, entre otros: `details` (format, family, parameter_size, quantization_level, context_length…), `parameters`, `template`, `license`, `modified_at`, `capabilities`, `model_info` (arquitectura, tokenizer, etc.). Ver [Ollama API - Show model details](https://docs.ollama.com/api-reference/show-model-details).

**Glosario (alineado con el resto del proyecto):**
- **model_id:** identificador con el que la app trabaja; puede ser `"provider:model_name"` (ej. `mancer:mytholite`) o solo `"model_name"` (ej. `llama3.2:latest`), en cuyo caso se usa el proveedor por defecto. Ver `ProviderFactory.parse_model_id()`.
- **provider:** nombre del proveedor (`ollama`, `mancer`, …).
- **model_name:** nombre del modelo en el proveedor; puede contener `:` (ej. `llama3.2:latest`). Para la ficha se usa la tupla `(provider, model_name)` con el provider resuelto (si model_id no lleva prefijo, usar default provider).

---

## 1. Modelo de datos

- [x] **1.1** Definir estructura por modelo. Clave siempre `(provider, model_name)` con `ProviderFactory.parse_model_id(model_id)`.
  - **provider_info** (dict): copia o normalización del provider (Ollama show u otro). Incluir **fetched_at** (ISO). Campos típicos: `details`, `parameters`, `template`, `license`, `modified_at`, `capabilities`, `model_info`.
  - **user_info** (objeto):
    - `uncensored`: bool (default false).
    - `instructions`: list[str]. Definir límites (ej. máx. 50 ítems).
    - `tags`: list[str]. Definir límites (ej. máx. 100 tags, 50 chars por tag). Autocompletado desde tags existentes.

- [x] **1.2** Persistencia: **Opción A (JSON)**. Ruta: **`data/model_info.json`** (datos de usuario; `config/` para configuración). Crear `data/` si no existe.
  - **Escritura atómica:** escribir a `data/model_info.json.tmp` y luego `os.replace(tmp, definitive)`.
  - **Esquema:** objeto con claves `"{provider}:{model_name}"` (model_name puede tener `:`, ej. `ollama:llama3.2:latest`); cada valor es la ficha:
    ```json
    {
      "ollama:llama3.2": {
        "provider_info": { "details": {...}, "template": "...", ... },
        "user_info": { "uncensored": false, "instructions": [], "tags": [] }
      },
      "ollama:mistral:latest": { ... }
    }
    ```
  - Los tags se obtienen recorriendo todas las fichas y recogiendo los valores únicos de `user_info.tags`.

- [x] **1.3** Schemas Pydantic (o equivalentes) para:
  - Request/response de “obtener info de un modelo” (provider_info + user_info).
  - Request de “actualizar user_info” (uncensored, instructions, tags).
  - Response de “listar tags” (lista de strings únicos).

---

## 2. Mecanismo de capacidades por proveedor (patrón strategy)

Cada proveedor expone distinta información, endpoints o acciones: Ollama tiene **show** (detalles del modelo) y **unload** (descargar modelo de memoria); otros proveedores pueden no tenerlo o ofrecer cosas distintas. Necesitamos un mecanismo donde cada provider implementa solo las capacidades que tiene sentido para él.

- [x] **2.0** Diseñar e implementar el mecanismo de capacidades opcionales (Opción A: métodos opcionales; `app/providers/capabilities.py`):
  - **Catálogo de capacidades:** identificar nombres estables (ej. `show_model`, `unload_model`). Cada capacidad es una operación que algunos proveedores soportan y otros no.
  - **Contrato por capacidad:** para cada capacidad, definir una interfaz mínima (signatura y tipo de retorno). Ejemplos:
    - `show_model(provider, model_name) -> dict | None`: devuelve detalles del modelo para rellenar `provider_info`; `None` si no soportado o error.
    - `unload_model(provider, model_name) -> bool`: descarga el modelo de memoria (solo tiene sentido donde el modelo se carga en RAM/VRAM); devuelve éxito/fallo.
  - **Estrategia:** elegir y documentar. **Opción A (recomendada para 2–3 capacidades):** métodos opcionales en el provider; `hasattr(provider, "show_model")` o `supports_capability(name) -> bool`; type checker: Protocol extendido o casting. **Opción B:** registry en `app/providers/capabilities.py` por `(provider_type, capability_name)`.
  - **API unificada:** ej. `get_model_details(provider_type, model_name) -> dict | None`; si no soporta, `None`. Igual para `unload_model`.
  - **Capacidades al frontend:** `GET /api/providers/{provider}/capabilities` → `["show_model", "unload_model"]` (o en listado de proveedores) para mostrar/ocultar botones en la UI.
  - Documentar: opción A/B elegida y lista de capacidades.

---

## 3. Backend: datos del proveedor — capacidad «show_model»

- [x] **3.1** Implementar la capacidad **show_model** en el proveedor Ollama (POST /api/show con `{"model": "model_name"}`): llamada a `POST /api/show` con `{"name": "model_name"}`, parsear respuesta y devolver un dict normalizado (ej. `details`, `parameters`, `template`, `license`, `modified_at`, `capabilities`, `model_info`) para almacenar en `provider_info`. Otros proveedores que no tengan equivalente no implementan esta capacidad (o devuelven `None`).

- [x] **3.2** Refresco de `provider_info` (POST `.../info/refresh`; si show falla no se sobrescribe): que sea una acción explícita (ej. botón "Refrescar desde proveedor" en la ficha) que llame a show_model, persista y recargue. Si show falla (modelo borrado, timeout, proveedor caído): no sobrescribir el `provider_info` existente; devolver error claro a la UI y opcionalmente mostrar aviso "No se pudo actualizar; se muestra información anterior".

---

## 4. Backend: persistencia y API de user_info

- [x] **4.1** Módulo de acceso a datos (`app/model_info.py`): (ej. `app/model_info.py` o dentro de `app/crud.py`): leer/guardar por `(provider, model_name)` la estructura completa (provider_info + user_info). Implementar al menos: get_model_info(provider, model_name), set_model_info(provider, model_name, ...), update_user_info(provider, model_name, uncensored=None, instructions=None, tags=None).

- [x] **4.2** Endpoints (en `api_models.py`; model_id en path con `:path` para permitir `:`): o router dedicado):
  - **GET** `/api/providers/{provider}/models/{model_id}/info` — devuelve la ficha. Si no existe: devolver ficha con user_info por defecto y provider_info vacío; **no** llamar a show en el GET (botón "Refrescar desde proveedor" en la UI dispara show, guarda y recarga).
  - **PUT** (o **PATCH**) `/api/providers/{provider}/models/{model_id}/info` — actualiza solo `user_info`. Body: JSON con campos opcionales.
  - **model_id en la URL:** si contiene `:` (ej. `ollama:llama3.2:latest`) decidir y documentar: (1) segmento URL-encoded y decodificar en backend, (2) query `?model_id=...`, o (3) base64. Aplicar en GET y PUT.

- [x] **4.3** Lista de tags para autocompletado: **derivar al vuelo** leyendo todas las fichas y extrayendo `user_info.tags` únicos. No hace falta almacenar por separado; así se evita desincronización.

---

## 5. Backend: tags y autocompletado

- [x] **5.1** Función que devuelve la lista de todos los tags existentes (únicos) a partir de las fichas guardadas.

- [x] **5.2** Endpoint **GET** `/api/models/tags` (o `/api/tags`) que devuelva `{ "tags": ["tag1", "tag2", ...] }` para que el frontend autocomplete al escribir un tag.

- [x] **5.3** Normalización de tags al guardar (trim, duplicados; capitalización mantenida por ahora): trim, unificación de duplicados. **Decidir** si se guardan en lowercase (entonces "Cine" y "cine" son el mismo tag; autocompletado más simple) o se mantiene capitalización (mejor para lectura; duplicados tipo "Cine"/"cine" hay que evitarlos por otro medio).

---

## 6. Frontend: ficha del modelo

- [x] **6.1** Punto de entrada a la ficha: desde el selector de modelo o desde la cabecera del chat (ej. enlace/icono “Info del modelo” o “Editar ficha”) que abra un panel o modal con la información del modelo seleccionado (provider + model_name).

- [x] **6.2** Mostrar en la ficha:
  - Bloque de solo lectura con `provider_info` (resumen legible: family, parameter_size, context_length, template, license, etc., según lo que exista).
  - Bloque editable: checkbox **Uncensored**, lista de **Instrucciones que funcionan bien** (añadir/quitar líneas), y **Tags** (input con autocompletado).

- [x] **6.3** Al editar uncensored / instructions / tags, enviar **PUT** (o PATCH) al endpoint de actualización de `user_info` y refrescar la vista o mostrar confirmación.

---

## 7. Frontend: autocompletado de tags

- [x] **7.1** Al escribir en el campo de tags, obtener sugerencias vía **GET** `/api/models/tags` (o endpoint de tags). Filtrar en cliente por prefijo (o enviar query si el backend lo soporta) y mostrar lista desplegable.

- [x] **7.2** Comportamiento: al elegir un tag de la lista, añadirlo al modelo; si el usuario escribe un tag nuevo (no existente), permitir añadirlo igualmente (tags libres). Separar tags con comas o chips según diseño.

- [x] **7.3** Persistir los tags del modelo al guardar la ficha (igual que instructions y uncensored).

---

## 8. Integración y casos borde

- [x] **8.1** Modelo sin ficha previa: al abrir la ficha (GET info), devolver ficha con provider_info vacío (o lo que se tenga de list_models) y user_info por defecto (uncensored: false, instructions: [], tags: []), y persistirla. El usuario puede pulsar "Refrescar desde proveedor" para rellenar provider_info si el proveedor soporta show_model. Así el GET sigue siendo rápido y predecible.

- [x] **8.2** Si Ollama (u otro) no está disponible al refrescar provider_info: mantener el último provider_info guardado y mostrar aviso en la UI si se intenta “refrescar desde proveedor”.

- [ ] **8.3** Considerar permisos/lectura: por ahora todo en local; si en el futuro hay multi-usuario, definir si model_info es global o por usuario.

---

## 9. Tests

- [x] **9.1** Test unitario o de integración: obtener info de un modelo (ollama) con show mockeado; comprobar estructura provider_info + user_info (tests/test_api_models.py::test_post_info_refresh_updates_provider_info, test_model_info).

- [x] **9.2** Test: actualizar user_info (uncensored, instructions, tags) y leer de nuevo (test_model_info.py, test_put_model_info_updates_user_info).

- [x] **9.3** Test: listado de tags devuelve todos los tags únicos de las fichas (test_model_info.py::test_get_all_tags_*, test_get_models_tags_empty_then_after_put).

- [x] **9.4** Test: GET info para modelo inexistente devuelve ficha con user_info por defecto y provider_info vacío (test_get_model_info_returns_defaults_when_missing, test_get_model_info_missing_returns_defaults).

- [x] **9.5** Test: provider sin capacidad show_model devuelve None (test_capabilities.py::test_get_model_details_returns_none_when_provider_has_no_show).

- [x] **9.6** Test: model_id con `:` en la URL (test_model_info.py::test_storage_key_includes_colon_in_model_name; API usa :path).

---

## 10. Documentación y limpieza

- [x] **10.1** Documentar en README o en docs la existencia de la ficha de modelo (provider_info + user_info), dónde se persiste y cómo se obtiene/actualiza. Ver **docs/MODEL_INFO.md**.

- [x] **10.2** Comentar en código que los tags son libres y el autocompletado se basa en tags ya usados en otras fichas. Comentario en **app/model_info.py** (docstring del módulo).

---

## Resumen de estructura de datos (propuesta)

**Persistencia:** archivo JSON en **`data/model_info.json`**. Clave en archivo: `"{provider}:{model_name}"`. Escritura atómica (tmp + replace).

```text
Clave: (provider: str, model_name: str)

Valor:
  provider_info: { fetched_at?: str (ISO), details, parameters, template, license, ... }
  user_info: { uncensored: bool, instructions: [str], tags: [str] }  # con límites definidos
```

**Endpoints resumidos:**

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/providers/{provider}/capabilities` | Capacidades del proveedor (show_model, unload_model, …) |
| GET | `/api/providers/{provider}/models/{model_id}/info` | Obtener ficha (provider_info + user_info) |
| PUT/PATCH | `/api/providers/{provider}/models/{model_id}/info` | Actualizar user_info |
| POST | `/api/providers/{provider}/models/{model_id}/info/refresh` | Refrescar provider_info desde el proveedor (show_model) |
| GET | `/api/models/tags` | Listar todos los tags (para autocompletado) |

---

## Orden sugerido de implementación

1. Modelo de datos y persistencia (sección 1).  
2. Mecanismo de capacidades por proveedor (sección 2).  
3. Capacidad show_model y guardado de provider_info (sección 3).  
4. Módulo de acceso y endpoints de info (sección 4).  
5. Tags y endpoint de tags (sección 5).  
6. Frontend: ficha del modelo (sección 6).  
7. Frontend: autocompletado de tags (sección 7).  
8. Casos borde e integración (sección 8).  
9. Tests (sección 9).  
10. Documentación (sección 10).

---

## Notas de diseño integradas (resumen)

- **Clave de ficha:** Siempre `ProviderFactory.parse_model_id(model_id)` para no duplicar (ej. default ollama + llama3.2 → una sola ficha `ollama:llama3.2`).
- **GET info:** No llamar a show en el GET; devolver ficha vacía o por defecto. Refresco con botón "Refrescar desde proveedor".
- **Tags:** Lista derivada al vuelo (no almacenar por separado). Decidir y documentar normalización (lowercase vs capitalización).
- **Riesgos:** Con muchos modelos el JSON puede ser lento (aceptable aquí; si crece, valorar SQLite). Diseño actual: un solo usuario/local; multi-usuario requeriría decidir scope de model_info.
- **MVP vs Fase 2:** MVP: show_model, ficha (uncensored, instructions, tags), autocompletado tags, endpoint capacidades. Fase 2: unload_model y botón "Descargar de memoria".
