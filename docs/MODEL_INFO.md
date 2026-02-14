# Ficha de modelo (provider_info + user_info)

Cada modelo (por proveedor y nombre) tiene una **ficha** con:

- **provider_info:** datos que expone el proveedor (ej. Ollama `POST /api/show`): family, parameter_size, context_length, template, license, etc. Se actualiza con el botón "Refrescar desde proveedor" en la UI.
- **user_info:** datos que asocia el usuario:
  - `uncensored` (bool)
  - `instructions` (lista de instrucciones que funcionan bien con ese modelo)
  - `tags` (lista libre; el autocompletado en la UI usa los tags ya existentes en otras fichas)

## Persistencia

- **Archivo:** `data/model_info.json`
- **Clave por modelo:** `"{provider}:{model_name}"` (ej. `ollama:llama3.2:latest`). El `model_name` puede contener `:`.
- **Escritura:** atómica (se escribe en `data/model_info.json.tmp` y luego se reemplaza el archivo definitivo).

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/providers/{provider}/capabilities` | Capacidades del proveedor (show_model, unload_model, …) |
| GET | `/api/providers/{provider}/models/{model_id}/info` | Obtener ficha (provider_info + user_info). Si no existe, devuelve user_info por defecto y provider_info vacío. |
| PUT | `/api/providers/{provider}/models/{model_id}/info` | Actualizar solo user_info (uncensored, instructions, tags). |
| POST | `/api/providers/{provider}/models/{model_id}/info/refresh` | Refrescar provider_info desde el proveedor (show_model). Si falla, no se sobrescribe lo guardado. |
| GET | `/api/models/tags` | Listar todos los tags únicos (para autocompletado). |

El `model_id` en la URL puede contener `:`; debe ir URL-encoded.

## UI

- **Entrada:** botón "Info del modelo" (icono ℹ️) junto al selector de modelo en la cabecera del chat.
- **Modal:** bloque de solo lectura con provider_info, botón "Refrescar desde proveedor" (solo si el proveedor tiene capacidad `show_model`), bloque editable (Uncensored, Instrucciones, Tags con chips y autocompletado), Guardar y Cerrar.
