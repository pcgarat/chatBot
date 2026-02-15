# Checklist: Parámetros por conversación y origen (user / preset / default)

**Objetivo:** Cada conversación guarda sus propios valores de parámetros del modelo. Al activar una conversación se cargan esos valores; si no hay guardados, se usa el preset del modelo si existe, y si no, la configuración por defecto. Al modificar cualquier parámetro se guarda la nueva configuración en la conversación. Debajo del panel de parámetros se muestra en pequeño y gris el origen cargado: "user", "preset" o "default".

---

## 1. Backend: persistir model_params en la conversación

- [x] **1.1** Añadir columna `model_params` a la tabla `conversations` (TEXT/JSON). Migración en `app/db.py` (ALTER TABLE o en init_db).
- [x] **1.2** Añadir campo `model_params` al modelo SQLAlchemy `Conversation` en `app/models.py` (JSON o Text para SQLite).
- [x] **1.3** Incluir `model_params` en `ConversationUpdate` y `ConversationOut` en `app/schemas.py`.
- [x] **1.4** En `app/crud.py`, en `update_conversation`, aceptar y persistir `model_params` (serializar a JSON si es Text).
- [x] **1.5** En `app/routers/api_conversations.py`, en GET y PUT de conversación, devolver y aceptar `model_params` en el body y en la respuesta.

---

## 2. Frontend: cargar parámetros al activar conversación

- [x] **2.1** Al abrir una conversación (`setCurrentConversation(conv)` con `conv`), después de `loadParamsForProvider` y establecer modelo:
  - Si `conv.model_params` existe y tiene claves → aplicar esos valores a los controles y marcar origen **user**.
  - Si no → si existe preset para `conv.model_id` (proveedor actual) → aplicar preset y marcar origen **preset**.
  - Si no → aplicar valores por defecto del proveedor (`applyParamsConfig`) y marcar origen **default**.
- [x] **2.2** Sin conversación activa (nueva conversación o tras eliminar): aplicar por defecto y mostrar **default**.

---

## 3. Frontend: guardar parámetros al modificar

- [x] **3.1** Cuando el usuario modifique cualquier control de parámetro (`data-control-id`), guardar en la conversación actual los `model_params` actuales (los que devuelve `buildModelParams()`).
- [x] **3.2** Guardado: llamar PUT `/api/conversations/{id}` con `model_params` en el body (debounced para no saturar).
- [x] **3.3** Al guardar, marcar origen como **user** y actualizar la etiqueta en pantalla.
- [x] **3.4** Al guardar conversación (botón Guardar / título): incluir `model_params` actuales en el PUT para que al salir y volver se conserven.

---

## 4. UI: etiqueta de origen debajo del panel

- [x] **4.1** Añadir un elemento (ej. `<span>` o `<div>`) encima de la línea que separa el checkbox "Mostrar debug LLM", dentro del sidebar, en pequeño y gris.
- [x] **4.2** Mostrar el texto "user", "preset" o "default" según el origen de los parámetros cargados.
- [x] **4.3** Estilos: fuente pequeña, color gris (`var(--text-muted)` o similar), sin aumentar la altura del footer de forma notable.

---

## 5. Casos borde y coherencia

- [x] **5.1** Al cambiar de modelo dentro de la misma conversación: no sobrescribir automáticamente los params con el preset del nuevo modelo; el usuario ya tiene valores (origen **user**). Opcional: ofrecer "Aplicar preset de este modelo" si se desea.
- [x] **5.2** Parámetros que el proveedor no soporte en la conversación guardada: al cargar, ignorar claves desconocidas y dejar el control en default para ese param.
- [x] **5.3** Conversación nueva creada desde "Nueva conversación": no hay model_params; aplicar preset del modelo seleccionado si existe, si no default.
