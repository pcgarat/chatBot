Última modificación: 2026-08-05

# Spec: UI herramienta seria (conversación + panel derecho)

Intent de referencia: [`docs/intent/ui-herramienta-seria_2026-08-05.md`](../intent/ui-herramienta-seria_2026-08-05.md)

**Estado:** aprobada (2026-08-05) — siguiente: plan + checklist / implementación.

---

## Assumptions (corregir antes de plan/implementación)

1. **Stack actual se mantiene:** HTML estático + CSS + `app.js` (sin React/Vue ni build frontend).
2. **IDs y contratos JS se preservan** (`#message-input`, `#btn-send`, tabs, params, imágenes, toggles). Se puede mover markup alrededor; no renombrar IDs sin necesidad.
3. **Foco v1:** reestructurar **panel de conversación (centro)** y **columna derecha**. Sidebar izquierdo solo hereda tokens (bordes, tipografía, densidades); sin reorganización de conversaciones.
4. **Ruptura deliberada con `demo_design` / redesign 2025:** se abandona Inter + primary índigo/púrpura como identidad. Objetivo = herramienta sobria, no SaaS chat.
5. **Modos:** light (default del sistema actual) + dark (`data-theme="dark"` / toggle existente). Ambos de primera clase.
6. **Color con intención:** neutros dominante; acentos solo para iconos semánticos, estados (ok/warn/error/conectado), separadores y CTA primario.
7. **Sin nuevas dependencias** (no Iconify CDN, no framework CSS) salvo tipografías self-hosted o Google Fonts ya usadas en el patrón del repo.
8. **Sin cambios de API/backend** en este trabajo.
9. **Tests:** sin suite visual automatizada hoy; verificación = checklist manual + `make test` (sin e2e salvo que el usuario lo pida) + e2e selectores solo si se rompen y se pide.

→ Si alguna asunción es incorrecta, corrígela antes del plan.

---

## Objective

Rediseñar y reestructurar la UI del centro + derecha para transmitir robustez profesional con estética ligera/minimalista tipo aplicación de escritorio en el navegador.

### User stories

- Como usuario, al abrir la app identifico de inmediato tres columnas con límites claros y sé dónde está el chat vs la configuración.
- Como usuario, en el panel derecho encuentro Reglas / Ajustes / Imágenes con controles agrupados por intención, no una lista plana.
- Como usuario, el composer y el stream se sienten como un panel de trabajo (toolbar + contenido + pie), no como un feed web.
- Como usuario, cambio entre dark y light y la jerarquía/contraste se mantienen profesionales en ambos.

### Acceptance criteria (testables)

- [ ] Existen tokens CSS documentados para light y dark: superficies, bordes, texto, muted, primary, success, warning, destructive, icon-* semánticos.
- [ ] Las tres columnas se distinguen por borde y/o superficie distinta (no solo padding/gap).
- [ ] Header del chat separado en: (1) título/sesión, (2) meta/estado/ctx, (3) acciones de sesión — sin mezclar controles sueltos al mismo nivel visual que el título.
- [ ] “History messages” vive en la toolbar del chat (junto a ctx / controles de stream), no en el header primario ni en Ajustes.
- [ ] Controles de tipografía/colapso del stream viven en una toolbar del panel de chat, no flotando sin ancla.
- [ ] Composer es un bloque con borde/superficie propia: instrucción temporal | mensaje | acciones.
- [ ] Panel derecho: tabs segmentados (no pills consumer); cada tabpanel con secciones etiquetadas.
- [ ] Tab Reglas: secciones “Activas” | “Añadir existente” | “Crear nueva”.
- [ ] Tab Ajustes: acordeones densos; fila label/control alineada; bloque Payload como sección propia.
- [ ] Tab Imágenes: secciones “Activación” | “Planificador LLM” | “Límites” | “Prompt Forge”.
- [ ] Preferencias repartidas por alcance (ver decisión § Toggles): dark mode en chrome global; auto-scroll en toolbar del chat; debug(s) en footer derecho “Diagnóstico”.
- [ ] Iconos de acción usan color semántico (p. ej. destructive en borrar, success en conectado, accent en enviar) — no monocromo total ni arcoíris decorativo.
- [ ] Tipografía distinta de Inter; stack legible en UI densa (ver Design system).
- [ ] Radios ≤ 6px en chrome de paneles (sensación herramienta, no app consumer con pills 999px salvo toggles segmentados existentes).
- [ ] Sidebar izquierdo no reorganizado; solo alineado a tokens.
- [ ] Comportamiento funcional existente intacto (enviar, reglas, params, imágenes, dark mode, debug).
- [ ] `make test` (sin e2e) pasa tras los cambios.

---

## Tech Stack

| Capa | Tecnología |
|------|------------|
| UI | `app/static/index.html`, `app/static/css/style.css`, `app/static/js/app.js` |
| Temas | `data-theme="dark"` + `:root` light |
| Backend | Sin cambios previstos |
| Tests | pytest (`make test` / `pytest tests/ -m "not e2e"`) |

---

## Commands

```bash
make start          # servidor local (puerto 8000)
make test           # tests unitarios/integración, sin e2e
pytest tests/ -m "not e2e"
# Solo si el usuario lo pide:
make test-e2e
```

Verificación visual: abrir `http://127.0.0.1:8000`, recorrer light/dark, tabs derecha, enviar mensaje, toggles footer.

---

## Project Structure

```
docs/intent/ui-herramienta-seria_2026-08-05.md   → intent confirmado
docs/specs/SPEC_UI_HERRAMIENTA_SERIA_2026-08-05.md → esta spec
docs/plans/…                                       → plan (tras aprobar spec)
docs/checklists/…                                  → checklist implementación
app/static/index.html                              → reestructuración markup
app/static/css/style.css                           → tokens + layouts
app/static/js/app.js                               → solo si hace falta por selectors/DOM
```

---

## Design system (propuesta)

### Tipografía

- **UI:** `Source Sans 3` — evita Inter.
- **Mono / labels técnicos:** `Source Code Pro` para meta, badges payload, ctx.
- Tamaños densos: body 13–14px, labels 11–12px, títulos de sección 12px medium.

### Neutros y superficies

| Token | Light (intención) | Dark (intención) |
|-------|-------------------|------------------|
| `--bg-app` | gris muy claro frío | near-black frío |
| `--bg-panel` | blanco / off-white | slate profundo |
| `--bg-panel-elevated` | ligeramente más claro/oscuro que panel | un step up |
| `--border-panel` | borde visible 1px | borde visible 1px |
| `--text` / `--text-muted` | alto contraste / secundario | idem |

### Color con intención (acentos)

| Uso | Rol |
|-----|-----|
| `--accent` | foco/CTA **azul-acero** sobrio (familia ~`#3b82f6` desaturada en light/dark) — **no** índigo/púrpura |
| `--icon-action` | iconos neutros de chrome |
| `--icon-success` / status ok | conexión, éxito |
| `--icon-warning` | ctx alto, avisos |
| `--icon-danger` | borrar, stop destructivo |
| `--separator` | divisores de panel (sutil, no decorativo) |

Regla: si un color no comunica estado, acción o jerarquía, no se usa.

### Geometría

- Separación entre columnas: borde 1px continuo (estilo IDE), no solo `gap` con aire grande.
- Radios: 2–6px en paneles/inputs; evitar cards con `radius-xl` + sombra múltiple.
- Densidad: padding de sección 8–12px; filas de control compactas.

### Patrón de layout (referencia mental)

```
┌──────────┬────────────────────────────┬─────────────────┐
│ Sidebar  │ Chat panel                 │ Right panel     │
│ (tokens) │ ┌ toolbar título/meta ┐    │ [Reglas|Aj|Img] │
│          │ │ stream + chat tools │    │ § secciones     │
│          │ │ composer            │    │ …               │
│          │ └─────────────────────┘    │ ── prefs ──     │
└──────────┴────────────────────────────┴─────────────────┘
│ status bar                                                      │
```

---

## Code Style

- Preferir clases BEM-lite ya usadas (`.composer-*`, `.sidebar-*`, `.param-*`); nuevas: `.panel-*`, `.toolbar-*`, `.section-*`.
- Tokens en `:root` / `[data-theme="dark"]`; evitar hex sueltos en reglas de componente.
- No comentar lo obvio; comentarios solo si la agrupación DOM no es evidente.
- Ejemplo de sección en panel derecho:

```html
<section class="panel-section" aria-labelledby="rules-active-heading">
  <h3 id="rules-active-heading" class="panel-section-title">Activas</h3>
  <div id="rules-list" class="rules-list" role="list"></div>
</section>
```

---

## Testing Strategy

| Nivel | Qué |
|-------|-----|
| Manual | Checklist visual light/dark; tabs; enviar mensaje; reglas; params; imágenes; toggles |
| Automatizado | `make test` — regresión backend/contratos |
| E2E | Solo si el usuario lo pide; actualizar selectores si el markup rompe tests e2e existentes |
| No | Suite Percy/Chromatic en v1 |

---

## Boundaries

**Always**

- Preservar IDs usados por `app.js`.
- Mantener a11y de tabs (`role="tab"`, `aria-selected`, paneles `hidden`).
- Actualizar checklist de implementación al cerrar tareas.
- Pasar `make test` al terminar.

**Ask first**

- Cambiar tipografía final si no gusta Plex/Source.
- Tocar estructura profunda del sidebar izquierdo.
- Añadir dependencias npm/CDN nuevas.
- Cambiar comportamiento (no solo presentación) de controles.

**Never**

- Reintroducir primary púrpura/índigo “SaaS” como identidad.
- Cards con sombra/glow como recurso principal.
- Renombrar endpoints o schemas por un cambio visual.
- Commits/push sin pedirlo el usuario.

---

## Success Criteria

1. Mirada de 3 segundos: se lee como herramienta de escritorio (paneles, densidad, tipografía), no como landing/chat consumer.
2. Conversación y derecha reestructuradas según acceptance criteria.
3. Dark y light usables y coherentes.
4. Cero regresiones funcionales obvias; `make test` verde.

---

## Decisiones de diseño (2026-08-05)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Tipografía | **Source Sans 3** + **Source Code Pro** |
| 2 | Acento | **Azul-acero** |
| 3 | History messages | **Toolbar del chat** (con ctx / controles de stream) |
| 4 | Toggles del footer | **Partir por alcance** (OK 2026-08-05) — ver abajo |

### #4 — Toggles por alcance (aprobado)

| Control | Dónde | Por qué |
|---------|--------|---------|
| **Modo oscuro** | Chrome global: extremo derecho de la **status bar** | Preferencia de app |
| **Auto-scroll al generar** | **Toolbar del chat** | Comportamiento del stream |
| **Debug** + **Debug imágenes** | Footer derecho, sección **Diagnóstico** | Herramientas de potencia del panel |

**Descartado en v1:** modal/popover único de Preferencias.

---

## Open Questions

Ninguna abierta. Decisiones 1–4 cerradas el 2026-08-05.

---

## Crítica / riesgos

- El redesign previo (`REDESIGN_UI` + Inter/índigo) ya intentó “pulir” y acabó en look SaaS. Repetir tokens del demo sería un error respecto a este intent.
- “Minimalista” no es “borrar jerarquía”: hay que **agrupar**, no solo reducir padding.
- Reestructurar HTML grande en `index.html` + CSS 3k+ líneas es frágil: conviene tokens primero, luego markup por zona, verificando JS tras cada zona.
- Sin tests visuales, el “se siente robusto” depende de tu OK en revisión visual — la spec fija criterios estructurales observables para no debatir solo gustos.
