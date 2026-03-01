# Última modificación: 2026-02-28

# Checklist de implementación: Layout tres columnas (chat en el centro)

Checklist **muy detallado** para implementar paso a paso el layout de tres columnas: **izquierda (conversaciones) | centro (chat, más ancho) | derecha (Reglas y Ajustes)**. Cada ítem es una tarea comprobable. Actualizar este checklist al ir completando cada parte.

---

## 1. ESTRUCTURA HTML (`app/static/index.html`)

### 1.1 Contenedor principal `#app`

- [ ] **1.1.1** El contenedor `#app.app-shell` tiene exactamente **tres hijos** en este orden: columna izquierda, columna central, columna derecha.
- [ ] **1.1.2** No queda ningún `<aside class="sidebar">` único que agrupe izquierda y derecha; las columnas son elementos hermanos.

### 1.2 Columna izquierda (conversaciones)

- [ ] **1.2.1** Existe un `<aside class="column-left sidebar-column" aria-label="Conversaciones">` como **primer hijo** de `#app`.
- [ ] **1.2.2** Dentro de la columna izquierda: bloque `.sidebar-header` con logo, título de la app y botón nueva conversación (mismo contenido que antes).
- [ ] **1.2.3** No hay pestañas (tabs) en la columna izquierda; no existe `tab-btn-conversaciones` ni `tab-conversaciones` en esta columna.
- [ ] **1.2.4** Existe un contenedor de lista con clase `.conversations-list-wrap` que envuelve el listado de conversaciones.
- [ ] **1.2.5** Dentro de `.conversations-list-wrap` está el elemento `#conversations-list` (con clase `.conversations-list`) para que el JS siga rellenando el listado.
- [ ] **1.2.6** El botón `#btn-new-chat` está en la columna izquierda (dentro del header de esa columna).
- [ ] **1.2.7** En la columna izquierda **no** está el contenido de Reglas ni el de Parámetros/Ajustes; solo header + listado de conversaciones.

### 1.3 Columna central (chat)

- [ ] **1.3.1** El **segundo hijo** de `#app` es `<main class="column-center chat-area main-pane">` (columna central).
- [ ] **1.3.2** Dentro del main: `header.primary-header.chat-header` con título de conversación, meta (fecha, estado), selectores de proveedor/modelo e iconos (refresco, limpiar memoria, info modelo).
- [ ] **1.3.3** Dentro del main: `div.secondary-header#context-usage-row` con uso de contexto, barra de tokens, controles de tamaño de fuente, history messages, Chroma, etc.
- [ ] **1.3.4** Dentro del main: un contenedor (p. ej. `div.body-grid`) que contiene **una sola** sección: la columna del chat (no dos columnas: contexto + chat).
- [ ] **1.3.5** La sección del chat tiene clase `.chat-column` y dentro contiene, en este orden:
  - [ ] **1.3.5a** Un bloque de contexto (p. ej. `div.context-block`) con las tarjetas “Resumen de la orden” y “Guardrails activos” (contenido que antes estaba en `.context-column`).
  - [ ] **1.3.5b** El área de mensajes: `div.chat-stream#messages-container`.
  - [ ] **1.3.5c** El área de entrada: `div.input-area.composer-panel` con instrucción opcional, textarea del mensaje, botones adjuntar/micrófono, cancelar y enviar.
- [ ] **1.3.6** No existe ya un `section.context-column` como **hermano** de `.chat-column` dentro del mismo grid; el contexto está **dentro** de `.chat-column`.
- [ ] **1.3.7** Los IDs críticos siguen presentes: `#conversation-title`, `#session-meta-row`, `#provider-select`, `#model-select`, `#model-select-input`, `#model-select-list`, `#message-input`, `#btn-send`, `#instruction-override`, `#messages-container`, etc.

### 1.4 Columna derecha (Reglas y Ajustes)

- [ ] **1.4.1** El **tercer hijo** de `#app` es `<aside class="column-right sidebar-column" aria-label="Reglas y ajustes">`.
- [ ] **1.4.2** Dentro de la columna derecha: una fila de pestañas (`.sidebar-tabs-row.sidebar-tabs`) con **solo dos** botones: “Reglas” y “Parámetros” (o “Ajustes”), con `id="tab-btn-reglas"` y `id="tab-btn-parametros"`, y `data-tab="reglas"` / `data-tab="parametros"`.
- [ ] **1.4.3** No hay pestaña “Conversaciones” en la columna derecha.
- [ ] **1.4.4** Contenedor `.sidebar-tabpanels` con exactamente **dos** tabpanels: `#tab-reglas` y `#tab-parametros` (sin `#tab-conversaciones`).
- [ ] **1.4.5** El panel `#tab-reglas` está visible por defecto: tiene clase `is-active` y **no** tiene atributo `hidden` (o el JS lo muestra al cargar).
- [ ] **1.4.6** El panel `#tab-parametros` tiene `hidden` por defecto (o el JS lo oculta si no es el activo).
- [ ] **1.4.7** Contenido de `#tab-reglas`: listado de reglas, añadir desde biblioteca, crear regla (mismos IDs: `#rules-list`, `#rule-library-select`, `#btn-add-library-rule`, `#rule-new-title`, `#rule-new-input`, `#btn-add-rule`, etc.).
- [ ] **1.4.8** Contenido de `#tab-parametros`: sección “Se enviarán al modelo”, acordeones (Modelo y contexto, Instrucción, Longitud, Aleatoriedad, Seguridad), `#params-to-send-container`, controles de parámetros (IDs `#param-*`), fila de preset y botón reset.
- [ ] **1.4.9** Al final de la columna derecha: `.sidebar-footer` con preset activo, opciones “Mostrar debug”, “Auto-scroll”, “Modo oscuro” (mismos IDs que antes).

### 1.5 Modales y scripts (sin cambios de estructura)

- [ ] **1.5.1** Los modales (`#model-info-modal`, `#rule-edit-modal`) siguen fuera de `#app` y no se han movido de sitio.
- [ ] **1.5.2** El script `app/static/js/app.js` se carga al final del body sin cambios.

---

## 2. ESTILOS CSS (`app/static/css/style.css`)

### 2.1 Contenedor `#app` y columnas

- [ ] **2.1.1** `#app` (y `.app-shell`) tiene `display: flex; flex-direction: row;` para disponer los tres hijos en fila.
- [ ] **2.1.2** `#app` tiene `flex: 1; min-width: 0; min-height: 0;` (o equivalente) para ocupar todo el espacio disponible y permitir que el contenido central haga shrink correctamente.
- [ ] **2.1.3** Existe la regla para `.column-left`: ancho controlado (p. ej. `width: 300px; min-width: 280px; max-width: 360px`), `flex-shrink: 0`, `background: var(--sidebar)`, `display: flex; flex-direction: column; overflow: hidden`, y `border-right: 1px solid var(--border)`.
- [ ] **2.1.4** Existe la regla para `.column-right`: mismo ancho/estilo que la izquierda (o simétrico), con `border-left: 1px solid var(--border)` en lugar de border-right.
- [ ] **2.1.5** Existe la regla para `.column-center`: `flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden` para que la columna central sea la que crece y el chat no desborde.
- [ ] **2.1.6** No se usa ya una única clase `.sidebar` que ocupe todo el lateral; las clases `.column-left` y `.column-right` son las que definen los laterales (se puede mantener `.sidebar-column` como alias si se desea reutilizar estilos de header/tabs).

### 2.2 Columna izquierda: listado de conversaciones

- [ ] **2.2.1** Existe `.conversations-list-wrap`: `flex: 1; min-height: 0; overflow-y: auto;` (y opcionalmente padding) para que el listado scrollee y ocupe el espacio entre header y (si hubiera) footer.
- [ ] **2.2.2** Los estilos de `.sidebar-header`, `.sidebar-logo-block`, `.sidebar-add-btn`, etc., se aplican correctamente cuando están dentro de `.column-left` (no dependen de una clase `.sidebar` que ya no envuelve todo).

### 2.3 Columna central: body-grid y chat-column

- [ ] **2.3.1** `.body-grid` sigue con `flex: 1; display: flex; …` pero ahora tiene **un solo hijo** (`.chat-column`), por lo que no hace falta un grid de dos columnas; un solo hijo con `flex: 1` es suficiente.
- [ ] **2.3.2** `.chat-column` tiene `flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden` (y los estilos de borde/fondo que se deseen para el área del chat).
- [ ] **2.3.3** Existe `.context-block` dentro de `.chat-column`: `flex-shrink: 0; display: flex; flex-direction: column; gap: 12px;` (y padding si se define) para que las tarjetas de contexto no desaparezcan y no ocupen más de lo necesario.
- [ ] **2.3.4** Las clases `.context-card`, `.context-card-header`, `.context-pill`, `.context-guardrails-list`, etc., siguen aplicándose al contenido dentro de `.context-block` (no hace falta duplicar estilos; solo el contenedor `.context-block` es nuevo).
- [ ] **2.3.5** `.chat-stream` y `.input-area` siguen con sus estilos (flex, overflow, padding) para que el flujo de mensajes scrollee y el composer quede abajo.

### 2.4 Columna derecha: tabs y tabpanels

- [ ] **2.4.1** `.sidebar-tabs-row` y `.sidebar-tabpanels` siguen funcionando dentro de `.column-right` (mismos estilos que antes; el contenedor es otro pero las clases son las mismas).
- [ ] **2.4.2** Si había estilos que dependían de `.sidebar > .sidebar-tabpanels`, comprobar que aplican a `.column-right .sidebar-tabpanels` (o ajustar el selector si es necesario).

### 2.5 Eliminación o reutilización de estilos antiguos

- [ ] **2.5.1** La regla antigua `.sidebar { width: 320px; … }` se ha sustituido o eliminado para no fijar ancho a un elemento que ya no existe como único sidebar.
- [ ] **2.5.2** `.context-column` puede mantenerse en el CSS por si se reutiliza en otro contexto, o eliminarse si ya no hay ningún elemento con esa clase; el contenido de contexto ahora está en `.context-block` dentro de `.chat-column`.

---

## 3. JAVASCRIPT (`app/static/js/app.js`)

### 3.1 Tabs del panel derecho (solo Reglas y Parámetros)

- [ ] **3.1.1** La constante `SIDEBAR_TAB_IDS` contiene **solo** `["reglas", "parametros"]` (se ha eliminado `"conversaciones"`).
- [ ] **3.1.2** La función `getStoredSidebarTab()` devuelve por defecto `"reglas"` (no `"conversaciones"`); si en localStorage había `"conversaciones"`, se puede mapear a `"reglas"` para la primera carga tras el cambio.
- [ ] **3.1.3** En `switchSidebarTab(tabId)` la lógica de qué panel mostrar solo considera `tab-reglas` y `tab-parametros`; no se referencia `tab-conversaciones` (que ya no existe en el DOM de la columna derecha).
- [ ] **3.1.4** Al inicializar (p. ej. `initSidebarTabs()`), se llama a `switchSidebarTab(getStoredSidebarTab())` y el panel visible por defecto es Reglas (o el guardado en localStorage si es reglas/parametros).
- [ ] **3.1.5** Los listeners de los tabs (click y teclado) siguen funcionando: al hacer clic en “Reglas” o “Parámetros” se cambia el panel visible en la columna derecha.

### 3.2 Listado de conversaciones y nueva conversación

- [ ] **3.2.1** El código que rellena `#conversations-list` sigue funcionando (el elemento está ahora dentro de `.column-left .conversations-list-wrap`).
- [ ] **3.2.2** El botón `#btn-new-chat` sigue en el DOM y los listeners asociados (crear nueva conversación) funcionan.
- [ ] **3.2.3** No hay referencias rotas a `#tab-conversaciones` en el JS (p. ej. no se intenta mostrar/ocultar ese panel en la columna derecha).

### 3.3 Resto de funcionalidad

- [ ] **3.3.1** Selectores de proveedor, modelo, envío de mensajes, reglas, parámetros, preset, footer (debug, auto-scroll, dark mode) siguen enlazados a los mismos IDs y no dependen de que exista un único `.sidebar` que contenga todo.
- [ ] **3.3.2** Si algún código buscaba nodos dentro de `.sidebar`, comprobar que sigue encontrando los elementos (p. ej. `.column-left` para conversaciones y `.column-right` para reglas/parámetros), o actualizar los selectores a `.column-right` cuando sea necesario.

---

## 4. COMPROBACIONES VISUALES Y DE COMPORTAMIENTO

### 4.1 Orden de columnas

- [ ] **4.1.1** En la ventana del navegador, de izquierda a derecha se ve: **primero** el panel de conversaciones (logo, nueva conversación, listado), **segundo** el chat (título, mensajes, composer), **tercero** el panel de Reglas/Ajustes (pestañas y contenido).
- [ ] **4.1.2** La columna del **chat es claramente la más ancha** (ocupa el espacio central entre las dos laterales).
- [ ] **4.1.3** No aparece el chat a la derecha del todo (no es la tercera columna visual).

### 4.2 Columna izquierda

- [ ] **4.2.1** Se ve el logo y el nombre de la aplicación en la parte superior.
- [ ] **4.2.2** El botón de nueva conversación funciona y el listado de conversaciones se rellena o se actualiza según la lógica existente.
- [ ] **4.2.3** No hay pestañas “Conversaciones | Reglas | Parámetros” en esta columna; solo header + listado.

### 4.3 Columna central

- [ ] **4.3.1** El header del chat muestra título de conversación, proveedor, modelo e iconos.
- [ ] **4.3.2** La barra secundaria (contexto, tamaño de fuente, history messages, Chroma) se ve y funciona.
- [ ] **4.3.3** Las tarjetas “Resumen de la orden” y “Guardrails activos” aparecen en la parte superior del área de chat (dentro de la columna central), no en una columna a la izquierda del chat.
- [ ] **4.3.4** Los mensajes y el composer están debajo; se puede escribir y enviar un mensaje.

### 4.4 Columna derecha

- [ ] **4.4.1** Solo se ven dos pestañas: “Reglas” y “Parámetros” (o “Ajustes”).
- [ ] **4.4.2** Por defecto está activa “Reglas” y se ve el contenido de reglas.
- [ ] **4.4.3** Al hacer clic en “Parámetros” se muestra el contenido de parámetros y se oculta el de reglas.
- [ ] **4.4.4** El footer (preset, debug, auto-scroll, modo oscuro) está al pie de la columna derecha y funciona.

### 4.5 Responsive y modos

- [ ] **4.5.1** En viewport normal (desktop) no hay solapamientos ni columnas que desaparezcan de forma incorrecta.
- [ ] **4.5.2** Si existe modo oscuro, comprobar que las tres columnas se ven correctamente y que los bordes entre columnas siguen siendo visibles.

---

## 5. TESTS Y REGRESIÓN

- [ ] **5.1** Los tests unitarios/integración que no dependen del layout (p. ej. lógica de reglas, parámetros, API) siguen pasando.
- [ ] **5.2** Si hay tests e2e que comprueban la presencia de elementos en el DOM (por selector o por texto), actualizar los selectores si han cambiado (p. ej. de `.sidebar` a `.column-left` / `.column-right`) y volver a ejecutarlos.
- [ ] **5.3** No se han introducido errores en consola del navegador al cargar la app y al cambiar de pestaña Reglas/Parámetros o al crear una nueva conversación.

---

## 6. DOCUMENTACIÓN Y LIMPIEZA

- [ ] **6.1** Este checklist se ha ido marcando según se completaban ítems (actualizar `[ ]` a `[x]`).
- [ ] **6.2** La fecha de “Última modificación” al inicio del archivo se actualiza cuando se hacen cambios relevantes en el checklist o en el diseño.
- [ ] **6.3** Si en el repo existía otro documento que describía el layout antiguo (una sola barra lateral), actualizarlo o dejar una nota de que el layout actual es el de tres columnas con chat en el centro.

---

## Resumen de entregables

- **HTML**: Tres columnas como hermanas bajo `#app`; izquierda = conversaciones (header + listado); centro = chat (header, secondary, body-grid con una sola `.chat-column` que incluye `.context-block` + mensajes + composer); derecha = tabs Reglas/Parámetros + contenido + footer.
- **CSS**: Estilos para `.column-left`, `.column-center`, `.column-right`, `.conversations-list-wrap`, `.context-block`; eliminación o sustitución de la antigua regla única `.sidebar`; resto de estilos coherentes con el nuevo DOM.
- **JS**: `SIDEBAR_TAB_IDS` solo con reglas y parametros; `getStoredSidebarTab()` por defecto `"reglas"`; `switchSidebarTab` sin referencia a conversaciones; listado y botón nueva conversación siguen funcionando.
- **Verificación**: Orden visual izquierda | centro | derecha; chat en el centro; pestañas solo en la columna derecha; sin errores en consola y tests pasando.
