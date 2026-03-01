# Última modificación: 2026-02-28

# Checklist: Layout básico (según lo que me dijiste)

**Origen:** Tu mensaje: *"empecemos por el layout básico ... rellena un checklist con los cambios que hay que hacer. El primer checklist es el del layout ..."*

**Diseño de referencia:** `app/static/img/image.png`. Revisar la foto por si se te olvidó algo (ej. colores) y meterlo aquí.

**Criterio:** No cambiar diseño; este checklist solo lista los cambios a hacer. Muy detallado.

---

## 1. LAYOUT BÁSICO (tres columnas y barras)

- [ ] **1.1** **Tres columnas.** La central es la más grande: la del chat.
- [ ] **1.2** **Cada columna tiene su propia barra superior.** Aunque tengan la misma altura, **no es una barra para las tres** (son tres barras, una por columna).
- [ ] **1.3** **No hay márgenes ni recuadros flotantes entre ellas.** Las columnas van pegadas entre sí; separación solo por línea si se desea, no bandas vacías ni cajas entre medias.

---

## 2. COLUMNA IZQUIERDA

### 2.1 Barra superior de la columna izquierda

- [ ] **2.1.1** En la barra superior: el **logo** — archivo `app/static/img/logo.png` (habrá que **redimensionarlo** para que encaje).
- [ ] **2.1.2** En la barra superior: el **nombre** de la app — por ahora **"Chat AI"**.

### 2.2 Debajo de la barra

- [ ] **2.2.1** Una **línea de separación** (no un rectángulo).
- [ ] **2.2.2** Un **botón de nueva conversación**.
- [ ] **2.2.3** El **listado de conversaciones**.
- [ ] **2.2.4** **Cada título de conversación tiene un icono delante** (p. ej. icono de documento como en la foto).

### 2.3 Colores / foto (si no lo habías dicho)

- [ ] **2.3.1** Fondo del área de contenido de la columna: gris claro (como en la foto).
- [ ] **2.3.2** Botón "Nueva conversación": texto en azul o estilo coherente con la foto.
- [ ] **2.3.3** Conversación activa: resaltada (p. ej. fondo azul claro) sin recuadro pesado.
- [ ] **2.3.4** Texto del listado: gris oscuro / negro sobre fondo claro.

---

## 3. COLUMNA CENTRAL (chat — columna principal)

- [ ] **3.0** Es la columna principal y **mucho más ancha** que las otras.

### 3.1 Barra superior del chat

- [ ] **3.1.1** **Título de la conversación en grande** (tamaño de fuente destacado).
- [ ] **3.1.2** **Debajo del título:**  
  - **Nombre del proveedor** y **nombre del modelo** (solo texto, no selectores aquí).  
  - **Icono verde o rojo** según se haya podido conectar o no al proveedor.  
  - **Contexto:** mostrar la información del contexto usado como se hace ahora, **ajustándola al nuevo diseño** (misma barra, sin recuadros extra).
- [ ] **3.1.3** **A la derecha en esa barra superior del chat:**  
  - **Iconos** para hacer **más grande o más pequeña la tipografía del chat** (solo del chat, no del resto de la app).  
  - **Slider** (o control equivalente) para decidir **cuántos mensajes anteriores** (mensaje y respuesta) se meten en cada prompt como contexto (equivalente a "history messages").  
  - **Iconos de borrar conversación** (papelera).  
  - **Check de debug** que amplía la información de los mensajes del chat como se hace ahora.

### 3.2 Debajo de la barra: área de conversación

- [ ] **3.2.1** Lo que sigue es **la conversación** (mensajes).
- [ ] **3.2.2** **Si no se ha iniciado** la conversación: mostrar **centrado** el **mismo recuadro que sale en la foto**, pero **cambiando su icono por nuestro logo** (`app/static/img/logo.png`, redimensionado).
- [ ] **3.2.3** Texto del recuadro: tipo "Agente de IA Listo" y mensaje de que el entorno está listo (ajustar al copy de la foto o al que definamos).

### 3.3 Parte inferior de la columna central

- [ ] **3.3.1** **Abajo, los controles para escribir mensajes** (campo de texto / textarea, botón enviar, y si aplica: instrucción opcional, adjuntar, etc., como ahora ajustado al diseño).

### 3.4 Colores / foto (si no lo habías dicho)

- [ ] **3.4.1** Fondo del área de chat: blanco o gris muy claro.
- [ ] **3.4.2** Recuadro centrado "Agente de IA Listo": fondo gris muy claro, esquinas redondeadas, sin caja pesada.
- [ ] **3.4.3** Icono de conexión: **verde** = conectado, **rojo** = no conectado.
- [ ] **3.4.4** Botón enviar: azul o color de acento como en la foto.
- [ ] **3.4.5** Barra superior del chat: sin recuadro flotante; misma altura que las otras barras (p. ej. 72px) para que coincida la línea inferior.

---

## 4. TERCERA COLUMNA (derecha)

### 4.1 Barra superior

- [ ] **4.1.1** En la barra superior: **las diferentes pestañas que se pueden abrir**.
- [ ] **4.1.2** **Solo el texto** en las pestañas; **sin recuadros** (sin cajas alrededor de cada pestaña).
- [ ] **4.1.3** **Una línea debajo del que está activo** (underline) para indicar la pestaña activa.
- [ ] **4.1.4** Las pestañas son: **Reglas** y **Ajustes** (solo esas dos).

### 4.2 Contenido y colores / foto

- [ ] **4.2.1** Contenido de Reglas y de Ajustes según el diseño actual, adaptado al layout; sin recuadros flotantes entre barra y contenido.
- [ ] **4.2.2** Línea bajo la pestaña activa: color de acento (p. ej. azul) como en la foto.
- [ ] **4.2.3** Fondo y texto coherentes con el resto (blanco / gris claro, texto gris oscuro).

---

## 5. REVISIÓN CON LA FOTO

- [ ] **5.1** Revisar la foto `app/static/img/image.png` y comprobar que no quede **ningún margen ni recuadro flotante** entre las tres columnas.
- [ ] **5.2** Comprobar que **cada barra superior** sea claramente de **su columna** (misma anchura que la columna, no una barra única continua).
- [ ] **5.3** Cualquier **color o detalle** que aparezca en la foto y no esté listado arriba, añadirlo a la sección correspondiente (2, 3 o 4) y cumplirlo.

---

## Resumen en una frase (tuyo)

**Tres columnas (central más grande, la del chat); cada una con su barra superior, misma altura pero no una barra única; sin márgenes ni recuadros flotantes. Izquierda: logo + Chat AI, línea, botón nueva conversación, listado con icono por conversación. Centro: barra con título en grande; debajo proveedor, modelo, icono verde/rojo, contexto; derecha de la barra: iconos tipografía, slider mensajes, borrar, check debug; luego conversación; si vacío recuadro centrado con nuestro logo; abajo controles. Derecha: pestañas Reglas y Ajustes, solo texto, línea bajo la activa.**
