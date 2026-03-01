# Última modificación: 2026-02-28

# Checklist: Órdenes y requisitos del usuario (layout y diseño)

**Diseño de referencia:** `app/static/img/image.png` — Es la imagen que seguimos. Si algo no coincide con lo que ves en esa foto, tiene razón la foto.

**Este documento recoge las órdenes que me has dado.** Hay que ceñirse a esto y revisar componente a componente. No inventar nada que no esté aquí.

---

## 1. ESTRUCTURA DE TRES COLUMNAS

- [ ] **1.1** La aplicación tiene **exactamente tres columnas** en este orden de izquierda a derecha:
  1. **Columna izquierda**: conversaciones (logo, nombre app, botón nueva conversación, listado).
  2. **Columna central**: **el chat** (la más ancha). Es la columna principal.
  3. **Columna derecha**: Reglas y Ajustes (solo pestañas y su contenido).

- [ ] **1.2** El **chat va en el centro**, no a la derecha. Si el chat aparece como tercera columna (a la derecha), está mal.

- [ ] **1.3** No hay cuarta columna. No hay columna de “contexto” entre conversaciones y chat.

---

## 2. COLUMNA IZQUIERDA

- [ ] **2.1** Solo contiene:
  - Logo (`app/static/img/logo.png`).
  - Nombre de la aplicación: **"Chat AI"**.
  - Línea de separación bajo la barra.
  - Botón **Nueva conversación**.
  - Listado de conversaciones (con icono por conversación si se definió).

- [ ] **2.2** **No** contiene: selector de proveedor/modelo, history messages, Chroma, ni el panel de escritura del chat (composer). Eso va solo en la columna central.

- [ ] **2.3** La columna izquierda va **pegada al borde izquierdo** de la ventana (sin márgenes/padding que la separen del borde).

---

## 3. COLUMNA CENTRAL (CHAT)

- [ ] **3.1** Es la **más ancha** (flex o equivalente).

- [ ] **3.2** Contiene:
  - **Una sola barra superior** (no dos): título de conversación, meta (fecha), uso de contexto, tamaño de fuente, history messages, Chroma e iconos. Misma altura (72px) que las barras de las otras dos columnas para que coincida la línea inferior. **Sin** selector de proveedor/modelo en esta barra. **Sin** el texto "Listo para recibir órdenes" (no lo pediste).
  - Área de mensajes (chat stream).
  - **Un solo** panel de escritura (composer): instrucción opcional + textarea + botón enviar + iconos (adjuntar, micrófono, cancelar).
- [ ] **3.2b** **Sin recuadros**: la columna central no tiene cajas/bordes alrededor del chat ni del composer (no recuadros flotantes).

- [ ] **3.3** **No** hay “Resumen de la orden” ni “Guardrails activos” en esta columna (no inventar esa columna/bloque).

- [ ] **3.4** El panel de chat (composer) aparece **una sola vez** en toda la app, y está **solo** en la columna central. Si aparece dos veces (p. ej. en izquierda y derecha), hay que eliminar el duplicado.

---

## 4. COLUMNA DERECHA

- [ ] **4.1** Solo contiene:
  - Pestañas: **"Reglas"** y **"Ajustes"** (solo esas dos; si pone "Parámetros" debe decir "Ajustes"). **Solo texto, sin botones ni recuadros** alrededor de cada pestaña; **línea debajo de la pestaña activa** (underline) para indicar cuál está seleccionada.
  - Contenido de Reglas (listado, añadir, crear).
  - Contenido de Ajustes (parámetros, acordeones, preset, etc.).
  - Footer (preset activo, debug, auto-scroll, modo oscuro).

- [ ] **4.2** **No** contiene: header del chat, proveedor/modelo, área de mensajes ni composer. Eso va solo en la columna central.

- [ ] **4.3** La columna derecha va **pegada al borde derecho** de la ventana (sin márgenes/padding que la separen del borde).

---

## 5. LO QUE NO SE DEBE HACER

- [ ] **5.1** No inventar una columna o bloque de “contexto” con “Resumen de la orden” y “Guardrails activos” si el usuario no lo ha pedido.

- [ ] **5.2** No duplicar el panel de chat (un solo composer en toda la página, dentro de la columna central).

- [ ] **5.3** No poner el chat a la derecha: el chat es la columna del **centro**.

- [ ] **5.4** No dejar márgenes/huecos que separen la columna izquierda del borde izquierdo ni la columna derecha del borde derecho.

---

## 6. CÓMO TRABAJAR CON ESTE CHECKLIST

- [ ] **6.1** Revisar **componente a componente** como te he citado: comprobar cada ítem de este checklist antes de dar por cerrado el layout.

- [ ] **6.2** No aplicar cambios de diseño que no estén en este checklist (no añadir elementos “por si acaso”).

- [ ] **6.3** Si algo no está claro, preguntar; no inventar.

---

## Resumen en una frase

**Tres columnas: izquierda = conversaciones (pegada a la izquierda); centro = chat, más ancho y un solo composer (pegado entre ambas); derecha = Reglas y Ajustes (pegada a la derecha). Sin columna de contexto inventada y sin duplicar el chat.**
