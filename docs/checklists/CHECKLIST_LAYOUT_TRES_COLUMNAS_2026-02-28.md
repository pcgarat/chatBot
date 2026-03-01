# Última modificación: 2026-02-28

# Checklist: Layout básico y contenido por columna (tres columnas)

Checklist detallado para implementar el layout de tres columnas con sus barras superiores independientes y el contenido de cada columna según especificación y fotos de referencia. **No aplicar cambios de diseño fuera de este checklist.**

---

## PARTE 1: LAYOUT BÁSICO

### 1.1 Estructura de tres columnas

- [ ] **1.1.1** La aplicación tiene exactamente **tres columnas verticales** en el área principal.
- [ ] **1.1.2** La **columna central es la más ancha** (es la del chat).
- [ ] **1.1.3** Las dos columnas laterales tienen ancho fijo o controlado (no crecen igual que la central).
- [ ] **1.1.4** No hay cuarta columna ni paneles flotantes fuera de estas tres.

### 1.2 Barras superiores (una por columna)

- [ ] **1.2.1** **Cada columna tiene su propia barra superior** (header).
- [ ] **1.2.2** Las tres barras pueden tener la **misma altura** entre sí, pero **no es una única barra compartida**: son tres barras distintas, cada una perteneciente a su columna.
- [ ] **1.2.3** La barra de la columna izquierda solo cubre el ancho de esa columna.
- [ ] **1.2.4** La barra de la columna central solo cubre el ancho de la columna del chat.
- [ ] **1.2.5** La barra de la columna derecha solo cubre el ancho de la tercera columna.
- [ ] **1.2.6** Visualmente queda claro que cada barra “sale” de su columna (misma anchura, sin continuidad de fondo con las otras).

### 1.3 Separación entre columnas (sin recuadros flotantes)

- [ ] **1.3.1** **No hay márgenes** que generen “huecos” o bandas vacías entre las tres columnas (o se reducen al mínimo necesario para una línea de separación).
- [ ] **1.3.2** **No hay recuadros o cajas flotantes** entre columnas (ni fondos extra que simulen paneles entre medias).
- [ ] **1.3.3** La separación entre columnas es una **línea** (borde) o equivalente, no un espacio “en caja”.
- [ ] **1.3.4** El contenido de cada columna va de borde a borde de su zona (salvo padding interno que se defina en el checklist de contenido).

### 1.4 Colores y aspecto del layout (según fotos)

- [ ] **1.4.1** Definir/validar color de fondo del **shell** (área general): en las fotos se ve blanco/gris muy claro.
- [ ] **1.4.2** Las **barras superiores** pueden tener un color distinto al del contenido (p. ej. barra izquierda más oscura en una de las fotos; barras central y derecha más claras).
- [ ] **1.4.3** Las **líneas de separación** entre columnas son discretas (gris oscuro/claro según tema), sin dar sensación de “caja”.
- [ ] **1.4.4** No se introducen sombras o bordes que generen efecto de “recuadros flotantes” entre las tres columnas.

---

## PARTE 2: COLUMNA IZQUIERDA (conversaciones / navegación)

### 2.1 Barra superior de la columna izquierda

- [ ] **2.1.1** En la barra superior **izquierda** se muestra el **logo**: archivo `app/static/img/logo.png`.
- [ ] **2.1.2** El logo se **redimensiona** para que encaje en la barra (tamaño coherente con la altura de la barra; en fotos suele verse pequeño, tipo 24–32px de altura).
- [ ] **2.1.3** Junto al logo se muestra el **nombre de la aplicación**: por ahora **"Chat AI"** (texto).
- [ ] **2.1.4** No hay recuadro alrededor del logo+nombre; es contenido de la barra sobre el fondo de la barra.

### 2.2 Separación bajo la barra

- [ ] **2.2.1** Debajo de la barra superior de la columna izquierda hay una **línea de separación** (no un rectángulo con relleno).
- [ ] **2.2.2** La línea es un borde o un divisor de 1px (o equivalente), sin “caja” visible.

### 2.3 Botón “Nueva conversación”

- [ ] **2.3.1** Debajo de la línea de separación aparece un botón **“Nueva conversación”** (o “+ Nueva conversación” según diseño).
- [ ] **2.3.2** El botón es claramente clickable y tiene estilo coherente con el resto (en fotos suele ser gris claro o con borde, no necesariamente azul fuerte).

### 2.4 Listado de conversaciones

- [ ] **2.4.1** Debajo del botón va el **listado de conversaciones** (las sesiones guardadas o recientes).
- [ ] **2.4.2** **Cada título de conversación** tiene un **icono delante** (p. ej. icono de documento o de chat).
- [ ] **2.4.3** El listado puede agrupar por tiempo (HOY, AYER, 7 DÍAS ANTERIORES u otro) si así se ve en las fotos.
- [ ] **2.4.4** La conversación activa puede resaltarse con un fondo distinto (p. ej. gris/azul muy suave) sin crear un recuadro pesado.
- [ ] **2.4.5** Colores de texto y fondo del listado coherentes con las fotos (gris oscuro sobre fondo claro, o claro sobre oscuro en modo oscuro).

### 2.5 Pie / opción inferior (si aplica)

- [ ] **2.5.1** Si en las fotos aparece algo al pie de la columna izquierda (p. ej. “Configuración del sistema” con icono de engranaje), incluirlo en el checklist y colocarlo sin recuadros innecesarios.

---

## PARTE 3: COLUMNA CENTRAL (chat – columna principal)

### 3.1 Ancho

- [ ] **3.1.1** La columna central es **claramente más ancha** que las otras dos (flex o porcentaje mayor).
- [ ] **3.1.2** En viewports normales se percibe como “columna principal”.

### 3.2 Barra superior del chat

- [ ] **3.2.1** **Título de la conversación en grande** (tamaño de fuente destacado) en la barra superior del chat.
- [ ] **3.2.2** **Debajo del título** (o en la misma barra, en una segunda línea o zona): **nombre del proveedor** y **nombre del modelo**.
- [ ] **3.2.3** **Icono de estado de conexión** (verde = conectado al proveedor, rojo = no conectado) junto al proveedor/modelo.
- [ ] **3.2.4** **Información de contexto usado**: mostrar la información de “contexto usado” como se hace ahora, pero **ajustada al nuevo diseño** (misma barra, sin recuadros extra).
- [ ] **3.2.5** A la **derecha** de la barra superior del chat:
  - [ ] **Iconos de tamaño de tipografía**: hacer **más grande** y **más pequeña** la tipografía **solo del chat** (no del resto de la app).
  - [ ] **Slider** (o control numérico) para elegir **cuántos mensajes anteriores** (mensaje + respuesta) se envían como contexto en cada prompt (equivalente a “history messages” actual).
  - [ ] **Icono de borrar conversación** (papelera).
  - [ ] **Checkbox de debug** que amplía la información de los mensajes del chat (comportamiento actual de “mostrar debug”).
- [ ] **3.2.6** La barra no tiene recuadro flotante; es la barra de la columna con su fondo y posible línea inferior.

### 3.3 Área de conversación

- [ ] **3.3.1** Debajo de la barra va el **área de la conversación** (mensajes).
- [ ] **3.3.2** Si **no se ha iniciado** la conversación: mostrar **centrado** un **recuadro** similar al de la foto de referencia.
- [ ] **3.3.3** En ese recuadro de “sin conversación” **cambiar el icono** por **nuestro logo** (`app/static/img/logo.png`, redimensionado).
- [ ] **3.3.4** Texto del recuadro: tipo “Agente de IA Listo” y la frase de que el entorno está listo para procesar solicitudes (ajustar al copy que se defina).
- [ ] **3.3.5** Colores del área de mensajes y del recuadro centrado coherentes con las fotos (fondo blanco/gris muy claro, texto gris oscuro).

### 3.4 Controles de escritura (parte inferior)

- [ ] **3.4.1** En la parte **inferior** de la columna central: **controles para escribir mensajes** (campo de texto / textarea y botón de enviar).
- [ ] **3.4.2** Si hay “instrucción temporal (opcional)” o similar, colocarla arriba del campo principal, sin recuadros pesados (línea o texto pequeño).
- [ ] **3.4.3** Botón de envío visible (en fotos suele ser azul o destacado) con icono (flecha/avión).
- [ ] **3.4.4** Opcional: iconos de adjuntar y micrófono si aparecen en las fotos; incluirlos en la misma zona de controles.

### 3.5 Colores columna central (según fotos)

- [ ] **3.5.1** Fondo del área de chat: blanco o gris muy claro.
- [ ] **3.5.2** Barra superior del chat: fondo blanco o ligeramente distinto, sin caja flotante.
- [ ] **3.5.3** Bordes/líneas: gris claro/oscuro, finos.
- [ ] **3.5.4** Acentos (botón enviar, estado conectado): azul y verde según corresponda.

---

## PARTE 4: TERCERA COLUMNA (derecha – Reglas y Ajustes)

### 4.1 Barra superior (pestañas)

- [ ] **4.1.1** En la barra superior de la **tercera columna** solo hay **pestañas** (tabs).
- [ ] **4.1.2** Pestañas: **“Reglas”** y **“Ajustes”** (solo estas dos; si había “Conversaciones” o “Parámetros”, quitar o mover según este checklist).
- [ ] **4.1.3** **Solo texto** en las pestañas: sin recuadros alrededor de cada tab, sin cajas.
- [ ] **4.1.4** **Línea debajo de la pestaña activa** (underline) para indicar cuál está seleccionada (en fotos suele ser una línea azul o oscura).
- [ ] **4.1.5** La barra tiene la misma altura que las otras o la definida en el layout, sin elementos extra que la conviertan en “caja”.

### 4.2 Contenido bajo las pestañas

- [ ] **4.2.1** Contenido de **Reglas**: el que corresponda (listado/editor de reglas) sin recuadros flotantes innecesarios.
- [ ] **4.2.2** Contenido de **Ajustes**: proveedor, modelo, historial de mensajes, Chroma, parámetros de inferencia, preset, etc., según diseño actual pero adaptado al nuevo layout; sin recuadros entre la barra y el contenido.
- [ ] **4.2.3** Colores: fondo y texto coherentes con el resto (en fotos, fondo blanco/gris claro, texto gris oscuro).

### 4.3 Colores tercera columna

- [ ] **4.3.1** Misma paleta que el resto: fondos claros, texto oscuro, línea de pestaña activa en color de acento (p. ej. azul).

---

## PARTE 5: REVISIÓN GLOBAL (fotos y detalles)

### 5.1 Comprobaciones desde las fotos

- [ ] **5.1.1** Revisar **primera foto** (vista con “Chat IA”, tres columnas, Agente de IA Listo): comprobar que no queden márgenes ni recuadros entre columnas y que cada barra sea de su columna.
- [ ] **5.1.2** Revisar **segunda foto** (vista “Agente de órdenes”, barra oscura arriba, Reglas/Parámetros): asegurar que pestañas sean solo “Reglas” y “Ajustes”, con línea bajo la activa; que la barra superior izquierda lleve logo + “Chat AI” y línea de separación + botón nueva conversación + listado con iconos.
- [ ] **5.1.3** Cualquier detalle adicional visible en las fotos (iconos, espaciados, alturas) que no esté listado arriba, añadirlo como ítem en la sección correspondiente (1, 2, 3 o 4).

### 5.2 Colores no especificados

- [ ] **5.2.1** Definir o documentar color de la **barra superior izquierda** (en una foto es oscura: azul/gris oscuro con texto blanco).
- [ ] **5.2.2** Definir color del **botón “Nueva conversación”** (en fotos suele ser gris claro o neutro).
- [ ] **5.2.3** Definir color del **recuadro centrado** “Agente de IA Listo” (en fotos suele ser gris muy claro con borde sutil).
- [ ] **5.2.4** Mantener **verde** para estado “conectado” y **rojo** para “no conectado” en el icono de la barra del chat.
- [ ] **5.2.5** **Modo oscuro** (si aplica): repetir estas comprobaciones con la paleta oscura para que no aparezcan recuadros flotantes ni márgenes raros.

---

## Resumen de entregables

1. **Layout**: tres columnas, central más ancha; tres barras superiores independientes; sin márgenes ni recuadros flotantes entre columnas.
2. **Columna izquierda**: barra con logo + “Chat AI”; línea de separación; botón Nueva conversación; listado de conversaciones con icono por título.
3. **Columna central**: barra con título de conversación en grande; debajo proveedor, modelo (icono verde/rojo), contexto; a la derecha iconos tipografía, slider mensajes, borrar, debug; área de chat; estado vacío con recuadro centrado y logo; controles de escritura abajo.
4. **Columna derecha**: barra con pestañas “Reglas” y “Ajustes”, solo texto, línea bajo la activa; contenido según tab.
5. **Colores**: documentados y aplicados según fotos (y modo oscuro si aplica).
