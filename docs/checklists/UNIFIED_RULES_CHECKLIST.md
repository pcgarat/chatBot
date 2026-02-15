# Checklist: Reglas unificadas (conversaciones + ficha de modelo)

**Objetivo:** Unificar las reglas/instrucciones de las conversaciones y las de la ficha de cada modelo en una misma entidad reutilizable. Las reglas se podrán crear una vez, reutilizar en varias conversaciones y asociar a modelos. En la pestaña Reglas del panel: listado como tags, controles para añadir reglas ya creadas y formulario de nueva regla accesible desde un botón. La fila que indica el origen de los parámetros (user / preset / default) solo debe mostrarse en la pestaña Parámetros.

---

## 1. Entidad unificada "Regla" y biblioteca (backend)

- [ ] **1.1** Definir modelo de datos para **Regla** como entidad global (biblioteca):
  - Opción A: nueva tabla `rules` (id, title, content, created_at, updated_at).
  - Opción B: archivo `data/rules.json` con array de `{ id, title, content }`.
  - Misma estructura que el actual `RuleItem` (title + content); id único para referencias.

- [ ] **1.2** Persistencia: si tabla, migración en `app/db.py`; si JSON, módulo tipo `app/model_info.py` con lectura/escritura atómica.

- [ ] **1.3** API CRUD para reglas:
  - `GET /api/rules` → listar todas las reglas (id, title, content).
  - `GET /api/rules/{id}` → una regla.
  - `POST /api/rules` → crear regla (title, content); devolver con id.
  - `PUT /api/rules/{id}` → actualizar regla.
  - `DELETE /api/rules/{id}` → eliminar regla.

- [ ] **1.4** Schemas Pydantic: `RuleOut`, `RuleCreate`, `RuleUpdate` (title opcional, content opcional).

---

## 2. Conversaciones: usar reglas de la biblioteca

- [ ] **2.1** Decidir modelo de relación conversación ↔ reglas:
  - **Opción A (referencias):** En `conversations.system_instructions` guardar lista de `{ rule_id?: string, title?, content? }`. Si hay `rule_id`, resolver contenido desde la biblioteca al enviar al LLM; si no, usar title+content inline (regla ad-hoc).
  - **Opción B (copias):** Mantener solo lista de `{ title, content }`; "añadir regla existente" = copiar title+content de la biblioteca a la conversación (sin vínculo posterior).

- [ ] **2.2** Si se elige referencias: en `_effective_system_instructions` (api_conversations) resolver `rule_id` contra la biblioteca y devolver content; si la regla fue borrada, ignorar o usar título como fallback.

- [ ] **2.3** API de conversaciones: aceptar en create/update `system_instructions` con ítems que puedan tener `rule_id` (y opcionalmente title/content para inline o override). Respuesta: devolver ítems con rule_id + title + content (resueltos) para que la UI muestre títulos y sepa cuáles son referencias.

---

## 3. Ficha de modelo: misma entidad Regla

- [ ] **3.1** Cambiar `user_info.instructions` en `data/model_info.json` de `list[str]` a lista de referencias a reglas:
  - Opción A: `instruction_ids: list[str]` (ids de la tabla/archivo de reglas). Al leer la ficha, resolver ids a { title, content } para la UI.
  - Opción B: mantener `instructions` como lista de `{ title, content }` pero con convención de que si existe una regla en biblioteca con mismo title/content se considera "la misma"; más ambiguo.

- [ ] **3.2** API `GET /api/providers/{provider}/models/{model_id}/info`: en `user_info`, devolver instrucciones como lista de reglas (title, content, rule_id si aplica). Si se usa solo rule_ids, resolver desde la biblioteca.

- [ ] **3.3** API `PUT .../info`: aceptar en user_info `instruction_ids: list[str]` (o instrucciones como lista de { rule_id } o { title, content } para crear inline y opcionalmente guardar en biblioteca). Persistir en model_info la lista de rule_ids (o el formato elegido).

- [ ] **3.4** UI del modal "Ficha del modelo": en la sección de instrucciones/reglas, mostrar reglas de la biblioteca asociadas a ese modelo (por título) y permitir añadir/quitar referencias a reglas existentes o crear nuevas y guardarlas en la biblioteca.

---

## 4. UI: pestaña Reglas (panel lateral)

- [ ] **4.1** Listado de reglas de la conversación actual: mostrar como **tags** (solo título + x para quitar). Cada tag puede ser una regla referenciada (rule_id) o inline (solo title+content). El **título del tag es clicable** para abrir el popup de edición (ver 4.5).

- [ ] **4.2** **Creación de reglas:** La forma de crear reglas es **solo para la conversación** (no hay flujo separado "guardar en biblioteca" al crear). El usuario añade una regla nueva con título y contenido; esa regla se asocia a la conversación actual (inline o como nueva regla en biblioteca según el modelo elegido en 2.1). El formulario de nueva regla va en/tras un **botón** del panel (no siempre visible): botón "Añadir regla" que muestra el formulario (desplegable, bloque colapsable o modal) con título, contenido y acción "Añadir a esta conversación".

- [ ] **4.3** **Añadir regla existente:** Control(es) en la pestaña Reglas para elegir reglas ya creadas (biblioteca): lista desplegable, selector o lista con "Añadir". Al elegir una o varias reglas de la biblioteca, se añaden a la conversación actual (referencia o copia según 2.1).

- [ ] **4.4** Cargar la lista de reglas de la biblioteca al entrar en la pestaña Reglas (o al abrir el desplegable "Añadir existente") vía `GET /api/rules`.

- [ ] **4.5** **Edición: popup al hacer clic en el título de una regla.** Cuando el usuario hace **clic en el título** de una regla aplicada en la conversación (en el tag), se abre un **popup** (modal) que permite:
  - Editar **título** y **texto/contenido** de la regla.
  - **Tres botones:**
    1. **Eliminar regla:** quita la regla de la conversación actual (y, si aplica, la elimina de la biblioteca cuando ya no esté en uso; o solo la desvincula de la conversación según el modelo de 2.1).
    2. **Guardar:** actualiza la regla con el título y el texto del formulario (la misma regla se modifica en la conversación y, si existe en biblioteca, también allí).
    3. **Guardar nuevo:** quita esta regla de las reglas aplicadas en la conversación **sin eliminarla** (la regla original sigue existiendo en la biblioteca si estaba ahí); crea una **nueva regla** con los datos actuales del formulario (título y contenido) y la añade a la conversación en su lugar. Así el usuario puede "duplicar" una regla con cambios sin modificar la original.
  - El popup debe recibir el índice o id de la regla en la conversación para saber qué ítem actualizar o eliminar.

---

## 5. UI: fila "origen de parámetros" solo en pestaña Parámetros

- [ ] **5.1** La fila que muestra el texto "user" / "preset" / "default" (id `params-source-label` / clase `params-source-row`) debe mostrarse **solo cuando la pestaña activa del panel es "Parámetros"**.

- [ ] **5.2** Opción A: Mover en el HTML la `params-source-row` dentro del `tabpanel` de Parámetros (id `tab-parametros`), para que solo sea visible cuando ese tab esté activo.
  - Opción B: Dejar el nodo donde está pero en JS, al cambiar de pestaña, mostrar/ocultar la fila según si la pestaña activa es Parámetros.

- [ ] **5.3** El checkbox "Mostrar debug LLM" (sidebar-footer) puede seguir debajo de todo; no debe duplicarse. Solo la fila de origen de parámetros se restringe a la pestaña Parámetros.

---

## 6. Tests y coherencia

- [ ] **6.1** Tests unitarios/integración para CRUD de reglas (si aplica router nuevo).
- [ ] **6.2** Tests para conversación con system_instructions que incluyan rule_id (resolución al construir mensajes).
- [ ] **6.3** Tests para ficha de modelo con instruction_ids (GET/PUT y resolución).
- [ ] **6.4** Migración de datos: conversaciones existentes con system_instructions sin rule_id siguen funcionando (reglas inline). Fichas de modelo existentes con `instructions: list[str]`: plan de migración a instruction_ids o a lista de { title, content } y opcionalmente creación de reglas en biblioteca.

---

## Resumen de decisiones a tomar

| Tema | Opciones / Especificación |
|------|---------------------------|
| Persistencia biblioteca reglas | Tabla SQL vs `data/rules.json` |
| Conversación ↔ regla | Referencias (rule_id) vs copias al añadir |
| Modelo ↔ regla | instruction_ids (referencias) vs instrucciones libres con mismo formato |
| Creación de reglas | Solo para la conversación; formulario accesible desde botón "Añadir regla" |
| Edición de regla | Clic en título del tag → popup con título y contenido editables; botones: **Eliminar regla** (quitar de conversación), **Guardar** (actualizar en sitio), **Guardar nuevo** (quitar actual, crear nueva con datos del formulario y añadirla a la conversación) |
