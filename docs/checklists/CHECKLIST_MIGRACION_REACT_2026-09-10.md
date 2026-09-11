Última modificación: 2026-09-10

# Checklist: acabar la migración del front a React

**Plan:** [`docs/plans/PLAN_MIGRACION_REACT_2026-09-10.md`](../plans/PLAN_MIGRACION_REACT_2026-09-10.md)  
**Spec:** [`docs/specs/SPEC_MIGRACION_REACT_2026-09-10.md`](../specs/SPEC_MIGRACION_REACT_2026-09-10.md)  
**Intent:** [`docs/intent/migracion-react_2026-09-10.md`](../intent/migracion-react_2026-09-10.md)  
**Rama:** `feat/react-frontend-migration`

Marcar al cerrar cada tarea. No avanzar de checkpoint sin `make frontend-test` + `pytest tests/ -m "not e2e"`.

---

## Fase 0 — Fundación

- [ ] **0.1** Markup único: `index.html` = `#root` + FOUC; tests GET `/` que buscan IDs → Vitest / `App.jsx`
- [ ] **0.2** `frontend/src/api/client.js` (`fetchJson`, 200/4xx/abort); `app.js` lo importa
- [ ] **0.3** `createStore` + helper de frontera (`legacyOwns` / grep `getElementById`)

### Checkpoint 0

- [ ] Sin árbol duplicado HTML/JSX
- [ ] FOUC de tema OK
- [ ] Tests verdes

---

## Fase 1 — Layout chrome

- [ ] **1.1** Store `layout` + tema (`initDarkMode` fuera)
- [ ] **1.2** Colapso historial, composer, fullscreen, toggles chat/galería/cola
- [ ] **1.3** Splitters laterales + centro (refs + CSS vars, no setState por pixel)
- [ ] **1.4** Escalas de fuente + tamaño de imagen en chat

### Checkpoint 1

- [ ] Recargar persiste layout
- [ ] Frontera: `btn-chat-fullscreen` y splitters no están en `app.js`

---

## Fase 2 — Historial izquierdo

- [ ] **2.1** Lista + Nueva + txt2img (puerto `session.open` / create)
- [ ] **2.2** Orden (`activity` / `created_at`)
- [ ] **2.3** Papelera
- [ ] **2.4** Modo mensajes + búsqueda + pager

### Checkpoint 2

- [ ] `#column-left` sin renders del legado
- [ ] Abrir hilo sigue funcionando

---

## Fase 3 — Chrome derecha

- [ ] **3.1** Tabs
- [ ] **3.2** Accordion (un abierto por lista)

### Checkpoint 3

- [ ] Contenido de tabs sigue siendo legado y no se rompe al cambiar de tab

---

## Fase 4 — Reglas de chat

- [ ] **4.1** Lista + alta
- [ ] **4.2** Biblioteca
- [ ] **4.3** Modal editar

---

## Fase 5 — Galería

- [ ] **5.1** Grid + pager (`React.lazy` al primer open)
- [ ] **5.2** Filtros, facets, scope
- [ ] **5.3** Lightbox
- [ ] **5.4** Purge huérfanos + notice de filtros en header

### Checkpoint 5

- [ ] `initImageGallery` ausente

---

## Fase 6 — Cola

- [ ] **6.1** Lista + poll (un intervalo)
- [ ] **6.2** Pausa / cancelar / selección
- [ ] **6.3** Menú contextual + detalle
- [ ] Job done **no** hace `innerHTML` en `#messages-container`

---

## Fase 7 — Ajustes

- [ ] **7.1** Provider + modelo
- [ ] **7.2** Contract + badges
- [ ] **7.3** Recetas
- [ ] **7.4** Params + baseline + exclude-from-send
- [ ] **7.5** Payload “qué se envía”
- [ ] **7.6** Modal model info (lazy)
- [ ] **7.7** Context usage + tab Preferencias
- [ ] Puerto `getModelParams()` listo para fase 9

---

## Fase 8 — Panel Imágenes

- [ ] **8.1** Prefs ilustración (`use-chat-config` deshabilita)
- [ ] **8.2** Planner recipes + contract
- [ ] **8.3** Planner rules
- [ ] **8.4** Forge params
- [ ] **8.5** Reactor
- [ ] **8.6** Snapshot collect/apply desde store (no DOM)

---

## Fase 9 — Sesión y composer

- [ ] **9.1** Store session + open/new/delete/title
- [ ] **10.1** (bloqueante para send) Render estático del árbol de mensajes — ver fase 10
- [ ] **9.2** Composer send/stop + instruction
- [ ] **9.3** `app/sendMessage.js` (api + stores, sin DOM de stream)
- [ ] **9.4** Turno txt2img

### Checkpoint 9

- [ ] 10.1 existe **antes** de 9.3 (evitar dos pintores en `#messages-container`)

---

## Fase 10 — Mensajes

- [ ] **10.1** `renderMessages` fuera; lista React + `content-visibility`
- [ ] **10.2** Collapse + scroll nav + auto-scroll (refs)
- [ ] **10.3** Stream: buffer en ref + flush ≤ 1/frame; sin `currentStreamingMsgEl`
- [ ] **10.4** Acciones copy / delete / fork / attempts
- [ ] **10.5** Illustrate + meta modal
- [ ] **10.6** Reading mode

### Checkpoint 10

- [ ] Cero `innerHTML` de mensajes en `app.js`
- [ ] Turno largo no tilda el hilo

---

## Fase 11 — Perfiles y debug

- [ ] **11.1** Workspace profiles (snapshot 100% stores)
- [ ] **11.2** Planner rule presets
- [ ] **11.3** Debug dock (lee store de cola, no el DOM)

---

## Fase 12 — Funeral de `initApp`

- [ ] **12.1** Borrar `frontend/src/app.js`; `main.jsx` solo `<App />`; tests afirman ausencia de `initApp`
- [ ] **12.2** Vite: quitar `manualChunks` de `app`; reevaluar `keepNames`; valorar StrictMode
- [ ] **12.3** DoD: flujos manuales + `make frontend-test` + `make frontend-build` + `make test`

### Checkpoint final

- [ ] Cero `initApp`
- [ ] Cero markup duplicado
- [ ] Pytest UI grep muerto o solo CSS
- [ ] Listo para review / PR
