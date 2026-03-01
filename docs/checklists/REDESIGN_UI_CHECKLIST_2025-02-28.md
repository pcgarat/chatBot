# Última modificación: 2025-03-01

# Checklist: Rediseño UI según demo_design.html

Plan de pasos para alinear la aplicación actual con la propuesta de diseño en `docs/demo_design.html`.

---

## 1. Análisis de la propuesta (demo_design.html)

### 1.1 Estructura de componentes

| Zona | Componente | Descripción |
|------|------------|-------------|
| **Shell** | `.app-shell` | Contenedor flex: sidebar + main-pane a pantalla completa (min-height 812px). |
| **Sidebar** | `.sidebar` | 320px, `--sidebar` / `--sidebar-foreground`, borde derecho. |
| **Sidebar header** | `.sidebar-header` | 72px. Logo block (icono + título "Agente de órdenes" + subtítulo) + botón "+" (`.sidebar-add-btn`). |
| **Sidebar tabs** | `.sidebar-tabs-row` | Pills: Conversaciones \| Reglas \| Parámetros (`.sidebar-pill-tab`, `.active` con fondo card y borde). |
| **Sidebar content** | `.sidebar-content` | Scroll, padding 16px 20px. Sección "Se enviarán al modelo" + lista de acordeones. |
| **Badge / payload** | `.badge-row`, `.param-badge` | Campos activos con chips removibles (mono-label "payload"). |
| **Acordeón** | `.accordion-list` > `.accordion-item` | Título + `.accordion-caption` + body con `.field-label-row`, `.field-control`. |
| **Sidebar footer** | `.sidebar-footer` | Preset activo (nombre + botón reset), toggles con `.checkbox-box` (custom, no input nativo visible). |
| **Main** | `.main-pane` | Flex column, min-width 0. |
| **Primary header** | `.primary-header` | 72px, fondo card. Izq: `.session-title` + `.session-meta-row` (fecha, estado con icono). Der: `.selector-group` (Proveedor, Modelo), `.header-icon-buttons`, "Guardar preset". |
| **Secondary header** | `.secondary-header` | 44px, fondo background. Uso de contexto, history messages, Chroma, controles +/-. |
| **Body grid** | `.body-grid` | Flex, gap 20px, padding 20px 28px. Dos columnas: context-column (280px) + chat-column (flex 1). |
| **Context column** | `.context-column` | Cards: "Resumen de la orden" (chips: Lenguaje, Formato, Tono), "Guardrails activos" (lista con indicador verde). |
| **Chat column** | `.chat-column` | Card con radius-xl, borde. Dentro: chat-stream + composer-panel. |
| **Chat stream** | `.chat-stream` | Fondo con radial-gradient (muted top-left). Mensajes: `.message-row`, `.message-avatar`, `.message-bubble` (.assistant / .user), `.message-meta`. |
| **Composer** | `.composer-panel` | Fila superior: label + `.inline-input` (instrucción opcional). Fila principal: `.composer-textarea` + iconos (adjuntar, mic) + botón "Enviar orden". |

### 1.2 Sistema de diseño (estilo)

- **Variables CSS (tema oscuro en el demo):**  
  El archivo tiene dos bloques `:root` (uno en `#theme-vars`, otro al final). Usar como referencia el bloque final; el de `theme-vars` es coherente con tema oscuro.
  - `--background: #020617`, `--foreground: #e5f0ff` (en bloque final; en theme-vars: `#f8fafc`)
  - `--border: #1f2937` (final) / `#1e293b` (theme-vars), `--input: #020617` (final) / `#1e293b` (theme-vars)
  - `--primary: #6366f1`, `--primary-foreground: #ffffff`
  - `--card: #020617`, `--card-foreground: #e5f0ff`
  - `--sidebar: #020617`, `--sidebar-foreground: #e5f0ff`, `--sidebar-primary: #4f46e5` (final) / `#6366f1` (theme-vars)
  - `--secondary: #0f172a`, `--muted: #111827`, `--muted-foreground: #9ca3af`
  - `--success: #10b981`, `--accent: #0ea5e9`, `--destructive: #ef4444`, `--warning: #f59e0b`
  - Radios: `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`, `--radius-xl: 12px`
  - `--font-family-body: Inter`
- **Tipografía:** Inter (Google Fonts). Labels técnicos: `mono-label` (monospace, 11px, uppercase).
- **Botones:** `.btn`, `.btn-primary`, `.btn-ghost`; iconos: `.icon-btn` (32px), `.small-icon-btn` (26px).
- **Chips:** `.chip` (pill 999px), `.param-badge` (secundary), `.context-pill` (borde + secondary).
- **Iconografía:** Iconify (lucide); el demo incluye scripts 1.0.7 y 3.0.0. En la app actual se usan SVGs inline; se puede migrar a Iconify o mantener SVGs con las mismas formas.

### 1.3 Diferencias con la app actual

| Aspecto | Actual | Propuesta |
|---------|--------|-----------|
| Tema | Oscuro (#1a1d23, #0f1114) | Oscuro (#020617, card #0f172a/#020617, primary #6366f1) |
| Sidebar | 280px, tabs con borde inferior | 320px, tabs tipo pill |
| Header sidebar | "Chat IA" + botón nueva conversación | Logo + "Agente de órdenes" + subtítulo + botón + |
| Main header | Una fila: título input + provider/model + acciones | Dos bloques: izquierda (título sesión + meta), derecha (selectores + iconos + "Guardar preset") |
| Contexto | Una fila con barra de uso, history, Chroma, tamaño fuente | Barra secundaria (44px) con "Uso de contexto", badges, history, Chroma, +/- |
| Área central | Solo messages-container + input-area | Columna contexto (280px) + columna chat (card con stream + composer) |
| Mensajes | .message.user / .message.assistant | .message-row + .message-avatar + .message-bubble .user/.assistant + .message-meta |
| Composer | instruction-once-row + send-row (textarea + cancel + Enviar) | composer-top-row (label + inline-input) + composer-main-row (textarea + iconos + "Enviar orden") |
| Preset | No visible en sidebar | Footer sidebar: "Preset activo" + nombre + reset |
| Checkboxes footer | Input nativo | Custom .checkbox-box (cuadrado con check) |

---

## 2. Pasos de implementación

### Fase A: Base (tokens y shell)

- [x] **A.1** Crear/actualizar variables CSS en `style.css` según el diseño (tema oscuro): `--background: #020617`, `--foreground`, `--border`, `--primary: #6366f1`, `--card`, `--sidebar`, `--input`, `--muted`, `--radius-*`, `--font-family-body`. Unificar criterio con el bloque final de `demo_design.html` (hay dos `:root` en el demo).
- [x] **A.2** Añadir preconnect + link a Google Fonts (Inter) en `index.html`.
- [x] **A.3** Envolver contenido actual en `.app-shell` (o renombrar `#app` a clase) y aplicar estilos base: flex, min-height, colores desde variables.
- [x] **A.4** Ajustar sidebar a 320px y clases `.sidebar`, `.sidebar-header` (altura 72px), bordes y colores desde variables.

### Fase B: Sidebar

- [x] **B.1** Sidebar header: estructura con logo block (icono en caja 24px + "Agente de órdenes" + subtítulo "Configuración fina del modelo") y botón `.sidebar-add-btn` (32px, primary). **Logo:** imagen en `/static/img/logo.png` integrada en `.sidebar-logo-icon`.
- [x] **B.2** Sustituir tabs actuales por `.sidebar-tabs-row` con `.sidebar-pill-tab` y estado `.active`; mantener `role="tab"` y `aria-selected` para accesibilidad.
- [x] **B.3** Contenedor de parámetros: sección "Se enviarán al modelo" con `.sidebar-section-header` (texto + mono-label "payload") y `.badge-row` con `.param-badge` (rellenar desde `#params-to-send-container` existente).
- [x] **B.4** Acordeón: aplicar clases del demo (`.accordion-list`, `.accordion-item`, …) manteniendo IDs y lógica en JS.
- [x] **B.5** Sidebar footer: bloque "Preset activo" (nombre + botón reset `#btn-reset-params-footer`) y dos filas con `.footer-toggle-row` y `.checkbox-box` (input nativo oculto, estilo con `:has(:checked)`).
- [ ] **B.6** Reglas y conversaciones: adaptar estilos a la misma familia (cards, bordes, colores) dentro del mismo shell; no es necesario cambiar toda la lógica, solo la presentación.

### Fase C: Main pane (headers y grid)

- [x] **C.1** Renombrar/reestructurar `.chat-area` a `.main-pane` y dividir en: `.primary-header`, `.secondary-header`, `.body-grid`.
- [x] **C.2** Primary header (72px): izquierda `.header-left` con `.session-title` / `#conversation-title` y `.session-meta-row`; derecha: `.selector-group` (Proveedor, Modelo), `.header-icon-buttons`, "Guardar preset".
- [x] **C.3** Secondary header (44px): "Uso de contexto" + badge, barra de uso, "history messages:", "Chroma:", controles de tamaño de fuente.
- [x] **C.4** Crear `.body-grid` con `display: flex`, `gap: 20px`, `padding: 20px 28px`, y dos hijos: `.context-column` (280px) y `.chat-column` (flex: 1).

### Fase D: Columna de contexto y chat

- [x] **D.1** Columna contexto: dos `.context-card` ("Resumen de la orden" con chips; "Guardrails activos" con lista e indicadores verdes). Contenido estático por ahora.
- [x] **D.2** Chat column: contenedor con `.chat-column` (border-radius-xl, borde, fondo card). Dentro: `.chat-stream` (flex, scroll, radial-gradient) y `.composer-panel`.
- [x] **D.3** Mensajes: estructura `.message-row` con `.message-avatar` (IA), `.message-bubble` (.assistant / .user) y `.message-meta`. `app.js` actualizado en `renderMessages()` y en la creación del mensaje en streaming.
- [x] **D.4** Composer: `.composer-top-row` + `.inline-input`, `.composer-main-row` con `.composer-textarea` y botón "Enviar orden". Mantenidos `#message-input`, `#btn-send`, `#btn-cancel-message`.

### Fase E: Estilos globales y detalles

- [x] **E.1** Clases utilitarias: `.btn`, `.btn-primary`, `.chip`, `.mono-label`, `.icon-btn`, `.small-icon-btn`, `.selector-control`, `.divider-vertical`, `.context-badge`, etc.
- [ ] **E.2** Scrollbars: opcional adaptar al tema claro (track/thumb con variables).
- [ ] **E.3** Modales (model-info, rule-edit): aplicar variables de color/radio para coherencia; no es obligatorio cambiar estructura.
- [ ] **E.4** Responsive: el demo es 1440px; definir comportamiento en pantallas menores (sidebar colapsable o body-grid en columna).

### Fase F: JS y accesibilidad

- [x] **F.1** Revisar `app.js`: selectores por ID válidos; referencias a `.chat-area`, `.message` actualizadas a la nueva estructura.
- [x] **F.2** Tabs: `aria-selected` y clase `.active` en pills actualizados en `switchSidebarTab()`.
- [ ] **F.3** Acordeón: mantener `aria-expanded` y `aria-controls` en los botones del acordeón.
- [x] **F.4** Checkboxes footer: input nativo oculto con `.footer-checkbox-input`, estilo con `.checkbox-box` y `:has(:checked)`; focus en el label.

### Fase G: Contenido y copy

- [x] **G.1** Sustituir "Chat IA" por "Agente de órdenes" y añadir subtítulo en el sidebar.
- [x] **G.2** Título de sesión en header: placeholder "Chat de órdenes", `#conversation-title`; `.session-meta-row` con `#session-created-label` y `#session-status`.
- [x] **G.3** Botón envío: texto "Enviar orden".
- [x] **G.4** Placeholder del textarea y del inline-input según el demo.

### Fase H: Pruebas y limpieza

- [x] **H.1** Ejecutar tests no e2e: 193 passed.
- [ ] **H.2** Probar en navegador: cambio de tabs, acordeón, envío de mensaje, selectores de proveedor/modelo, presets, reglas.
- [ ] **H.3** Revisar contraste (WCAG) con tema oscuro (fondos #020617 / #0f172a, texto claro).
- [ ] **H.4** Actualizar este checklist marcando tareas completadas.

---

## 3. Orden sugerido

1. **A** (tokens, shell, sidebar width)  
2. **B** (sidebar completo)  
3. **C** (headers del main)  
4. **D** (grid, contexto, chat, mensajes, composer)  
5. **E** (utilidades y detalles)  
6. **F** (JS y a11y)  
7. **G** (textos)  
8. **H** (tests y revisión)

---

## 4. Notas

- **Iconify:** El demo usa `<iconify-icon icon="lucide:...">` (incluye scripts 1.0.7 y 3.0.0). Puedes mantener SVGs inline y solo unificar estilos (tamaño, color con variables) para no añadir dependencia externa.
- **Tema:** La propuesta es **tema oscuro** (slate/indigo). Si más adelante se quiere ofrecer tema claro, definir un segundo juego de variables (ej. `[data-theme="light"]`) y reutilizar las mismas clases.
- **Dos bloques :root en el demo:** En `demo_design.html` hay variables en `#theme-vars` (dentro de `<head>`) y otro `:root` al final del archivo con valores ligeramente distintos (p. ej. `--foreground`, `--input`, `--sidebar-primary`). Al implementar, elegir un único conjunto y documentarlo (recomendado: el bloque final para coincidir con lo que se ve al abrir el HTML).
- **Columna contexto:** "Resumen de la orden" y "Guardrails activos" pueden ser placeholders hasta que exista lógica de negocio; el layout ya puede implementarse.
- **Archivo de referencia:** Todas las clases y variables están en `docs/demo_design.html` (bloques `#base-styles`, `#sidebar-styles`, `#main-layout-styles` y el `:root` final). Título de la página en el demo: "Agent Config".
