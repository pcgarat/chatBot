Última modificación: 2026-09-10

# Plan: acabar la migración del front a React

**Spec:** [`docs/specs/SPEC_MIGRACION_REACT_2026-09-10.md`](../specs/SPEC_MIGRACION_REACT_2026-09-10.md)  
**Intent:** [`docs/intent/migracion-react_2026-09-10.md`](../intent/migracion-react_2026-09-10.md)  
**Checklist:** [`docs/checklists/CHECKLIST_MIGRACION_REACT_2026-09-10.md`](../checklists/CHECKLIST_MIGRACION_REACT_2026-09-10.md)  
**Rama:** `feat/react-frontend-migration`

---

## Overview

PR #57 montó Vite + React y copió el árbol a `App.jsx`. `main.jsx` hace `createRoot` y en `useLayoutEffect` llama a `initApp()`. El legado sigue siendo el dueño: ~9.200 líneas, ~379 `getElementById`, ~72 `innerHTML`. Además `frontend/index.html` (~1.149 líneas) **duplica** el mismo árbol: FastAPI sirve ese HTML (por eso pytest `client.get("/")` ve IDs) y React lo tira al montar.

Acabar la migración es un **strangler por islas**: cada corte deja de escribir en un subárbol y borra ese código de `app.js`. No es “ir envolviendo `renderX()` en JSX”.

Este plan parte del de 2026-09-09 y lo corrige en tres sitios:

1. **Tareas demasiado gordas.** Layout, Ajustes, Imágenes y Mensajes no caben en un session de agente. Aquí van partidas.
2. **No crear stores/API vacíos el día 1.** El cliente HTTP sí (lo usa el legado). El store nace con el primer consumidor.
3. **Vercel React Best Practices no se aplica en bloque.** Es una guía Next.js+RSC. Este proyecto es Vite SPA. Abajo: qué se adopta y qué se rechaza.

## Estado actual (2026-09-10)

| Pieza | Estado |
|-------|--------|
| `frontend/` Vite + React 19 + Vitest | Hecho (#57) |
| `App.jsx` árbol estático (IDs) | Hecho |
| `initApp` dueño de comportamiento | Intacta |
| Markup único | **No:** `index.html` y `App.jsx` duplicados |
| `frontend/src/api`, `store`, `ui/*` | **No existen** (solo `App.jsx`, `app.js`, `main.jsx`, `styles/`) |
| Tests UI | Mayoría pytest grep sobre `app.js` + GET `/` |
| StrictMode | Ausente (correcto mientras haya legado) |

## Architecture Decisions

- **Islas, no Big Bang.** Tras cada merge la app se usa. Un id, un escritor.
- **Puertos hacia el legado, no `el.foo`.** Mientras `initApp` viva, la isla exporta un facade mínimo (`history.open(id)`, `layout.setGalleryVisible(true)`). El legado llama al puerto; no al revés salvo bootstrap.
- **Store por agregado** (`layout`, `history`, `session`, `images`). Factory + `useSyncExternalStore`. Selectores primitivos. Prohibido un objeto único “appState”.
- **`fetchJson` sale primero**; los módulos por recurso salen **con** su isla, no todos de golpe reescribiendo `app.js`.
- **Stream:** `useRef` buffer + flush. React pinta el mensaje in-flight como un nodo (`rerender-use-ref-transient-values`).
- **Splitters / pointer:** CSS variables + refs. No `setState` por `mousemove`.
- **Listas largas:** `content-visibility: auto` en filas de historial, mensajes y celdas de galería cuando esa isla sea React (`rendering-content-visibility`). Cambio CSS mínimo, no redesign.
- **Lazy de paneles pesados:** `React.lazy` + `import()` la primera vez que se activa Galería, Cola, modal model-info, reading mode, debug. Equivalente Vite de `bundle-dynamic-imports` / `bundle-conditional`. **No** `next/dynamic`.
- **Un listener global de resize/fullscreen** en el store `layout`, no uno por componente.
- **`initApp` como residuo medible.** Cada isla borra sus claves de `el`. Cuando `el` esté vacío, funeral (fase 12).
- **IDs se conservan.** No es un rediseño.

## Qué no hacer

| Tentación | Por qué es mala |
|-----------|-----------------|
| Convertir `renderX()` a JSX dejando el estado en closures de `initApp` | React re-renderiza y pisa el DOM, o no re-renderiza y el JSX es decorado |
| `setState` por token de stream | Decenas de renders/s |
| TypeScript + extracción a la vez | Dos migraciones |
| Conservar pytest `assert "function foo" in js` | Impiden borrar `app.js` |
| Extraer workspace profiles o params al principio | Hacen snapshot de *todo* el rig |
| Store global día 1 | `initApp` con otro nombre |
| Meter SWR “porque Vercel” | Un solo ejemplar de cada panel; el estado es de sesión, no cache HTTP. SWR pelearía con los stores y añade dependencia |
| Next.js / RSC / `React.cache` / `after()` | No hay servidor de React. Vite sirve estáticos; FastAPI es el API |
| `lucide-react` u otra icon lib | Barrel de miles de módulos (`bundle-barrel-imports`); ya hay SVG inline |
| Extraer el chat primero | Núcleo acoplado a sesión, params, illustrate, cola |

## Vercel BP: aplicar vs rechazar

**Aplicar (SPA Vite):**

- `bundle-barrel-imports` — cero `index.js` reexportando UI; cero lucide/MUI.
- `bundle-dynamic-imports` / `bundle-conditional` — `React.lazy` + `import()` en galería, cola, modales, debug.
- `async-parallel` — boot: `Promise.all` de providers/conversaciones independientes cuando esa lógica salga de `initLoad`.
- `rerender-no-inline-components`, `rerender-derived-state`, `rerender-memo` solo si hay trabajo caro medido.
- `rerender-use-ref-transient-values` — stream, drag, hover coords.
- `rerender-functional-setstate` — updates del store con función.
- `rendering-content-visibility` — listas largas.
- `rendering-hoist-jsx` — iconos SVG estáticos fuera del componente si molestan.
- `js-cache-storage` — el store `layout` lee `localStorage` una vez al crear, no en cada render.
- `client-localstorage-schema` — claves actuales; no versionar de golpe (sería otro producto). Documentar el mapa de claves en el store.
- `js-early-exit`, `js-set-map-lookups` — al extraer `renderMessages` / listas.

**Rechazar:**

- Todo `server-*` (RSC, `React.cache`, `after()`).
- `client-swr-dedup` / SWR.
- `async-suspense-boundaries` como estrategia de datos de servidor (no hay RSC). Suspense sí para `React.lazy`.
- `optimizePackageImports` de Next.
- Meter `useEffectEvent` / Activity solo “porque está en la guía”; React 19 está, pero no es el cuello de esta migración.

## Grafo de dependencias

```
0  Fundación (markup único, fetchJson, helper frontera)
        │
        ▼
1  Layout chrome (store layout: data-*, splitters, fuentes)
        │
        ├── 2  Historial izquierdo
        │
        └── 3  Chrome derecha (tabs + accordion)
                │
                ├── 4  Reglas chat + modal
                │
                └── 5  Galería ──► 6 Cola
                        │
                        ▼
                7  Ajustes (provider → contract → recetas → params → payload)
                        │
                        ▼
                8  Panel Imágenes (prefs, planner, forge, reactor, snapshot)
                        │
                        ▼
        9  Sesión + composer + sendMessage (sin pintar stream)
                │
                ▼
        10 Mensajes (árbol → collapse → stream → acciones → illustrate → lectura)
                │
                ▼
        11 Perfiles workspace + presets planner + debug dock
                │
                ▼
        12 Borrar initApp. Checkpoint final
```

**Paralelo seguro:** 2 ∥ 3 tras 1. 4 ∥ 5 tras 3 (4 necesita tabs; 5 necesita layout de centros).  
**Serie obligatoria:** 5→6, 7→8, 9→10, 10→11 (snapshot), 11→12.

No empezar 9–10 antes de 7–8: enviar necesita params + prefs de imágenes.

---

## Task List

Cada tarea deja la app usable. Scope L se evitó; si al implementar una M se dispara de archivos, partir antes de mezclar.

### Fase 0: Fundación

#### Task 0.1: Markup único + tests GET `/`

**Description:** `frontend/index.html` queda en shell (`<div id="root">` + script FOUC de tema/layout). El árbol vive solo en React. FastAPI seguirá sirviendo el `index.html` *build*; TestClient ya no verá `#column-left`. Hay que mover esas aserciones en el **mismo** PR (si no, main queda rojo).

**Acceptance criteria:**
- [ ] `frontend/index.html` no contiene `#app` ni columnas.
- [ ] `test_react_frontend.py` no exige `id="app"` en GET `/`; sí exige `#root` + `/static/js/main.js`.
- [ ] Tests que hacían `assert id in client.get("/").text` pasan a Vitest o leen `App.jsx` / CSS.
- [ ] Tras `make frontend-build`, GET `/` arranca el SPA igual.

**Verification:**
- [ ] `cd frontend && npm test`
- [ ] `pytest tests/test_react_frontend.py tests/test_main.py tests/test_chat_fullscreen.py tests/test_left_sidebar_collapse.py tests/test_composer_collapse.py tests/test_side_panel_resize.py tests/test_ui_base_font_size.py tests/test_chat_session_header.py tests/test_image_gallery_ui.py tests/test_sidebar_accordion.py tests/test_preferences_tab.py tests/test_left_history_sort.py tests/test_status_bar_session_info.py tests/test_conversation_scroll_nav.py tests/test_conversation_attempts_ui.py tests/test_composer_prompt_icon.py tests/test_chat_session_controls_layout.py -m "not e2e"`

**Dependencies:** ninguna  
**Files:** `frontend/index.html`, `frontend/src/App.jsx`, `tests/test_react_frontend.py`, lote GET `/` arriba  
**Estimated scope:** L por número de tests — **no partir el HTML vacío y los tests en dos PRs** (rompería CI). Un PR, muchos archivos de test.

#### Task 0.2: Cliente HTTP

**Description:** Extraer `fetchJson` a `frontend/src/api/client.js` (JSON, errores HTTP, `AbortController`). `app.js` lo importa. Cero `fetch(` nuevos en el legado. Aún no extraer `loadModels` ni el resto.

**Acceptance criteria:**
- [ ] `fetchJson` tiene tests de 200, 4xx, abort.
- [ ] `app.js` usa el módulo; la firma de llamadas existentes no cambia.

**Verification:** `cd frontend && npm test` (nuevo `client.test.js`)  
**Dependencies:** ninguna (∥ 0.1)  
**Files:** `frontend/src/api/client.js`, `frontend/src/api/client.test.js`, `frontend/src/app.js`  
**Estimated scope:** S

#### Task 0.3: Helper de frontera + factory de store

**Description:** `createStore` + `legacyOwns(id)` / test helper que falla si `app.js` aún hace `getElementById` de un id reclamado. Sin stores de dominio vacíos.

**Acceptance criteria:**
- [ ] Test del store (set/get/subscribe/selector).
- [ ] Helper reutilizable en islas siguientes.

**Verification:** Vitest de `createStore`  
**Dependencies:** ninguna  
**Files:** `frontend/src/store/createStore.js`, `frontend/src/store/createStore.test.js`, `frontend/src/test/legacyBoundary.js`  
**Estimated scope:** S

### Checkpoint: Fundación

- [ ] GET `/` no depende del árbol estático duplicado
- [ ] `make frontend-test` + `make test` verdes
- [ ] Review humano: ¿el FOUC de tema sigue sin parpadeo?

---

### Fase 1: Layout chrome

Candidato fácil: `localStorage` + `data-*` + CSS vars. Cero API. Un store `layout` que nace aquí.

#### Task 1.1: Store layout + tema

**Description:** `darkMode` deja `initDarkMode`. El script del `<head>` permanece. Store lee storage una vez.

**Acceptance:** `initDarkMode` fuera de `app.js`; toggle actualiza `data-theme` y storage.  
**Verify:** Vitest persistencia; pytest CSS intactos.  
**Dependencies:** 0.3  
**Files:** `frontend/src/store/layout.js`, `frontend/src/ui/layout/ThemeToggle.jsx` (o el botón que ya existe), `frontend/src/app.js`  
**Scope:** S

#### Task 1.2: Colapso historial, composer, fullscreen, toggles de centros

**Description:** `initLeftSidebarCollapse`, `initComposerCollapse`, `initChatFullscreen`, visibilidad chat/galería/cola. Mismo store. Un listener de `fullscreenchange`.

**Acceptance:** esas IIFE salen de `app.js`; `el` pierde esos botones.  
**Verify:** Vitest de cada `data-*`; frontera `btn-collapse-left`, `btn-chat-fullscreen`, `btn-center-chat`, etc.  
**Dependencies:** 1.1  
**Files:** `frontend/src/ui/layout/*`, `frontend/src/store/layout.js`, `frontend/src/app.js`, tests pytest de collapse/fullscreen/composer  
**Scope:** M

#### Task 1.3: Splitters

**Description:** `initSidePanelResize` + `initCenterPanelSplit`. Drag con refs + CSS vars (`--sidebar-left-width`, `--center-chat-share`). Doble clic restaura.

**Acceptance:** no hay `setState` por `pointermove`. Funciones de resize fuera de `app.js`.  
**Verify:** Vitest aplica ancho min/max; frontera de `#sidebar-left-splitter`.  
**Dependencies:** 1.2  
**Files:** `frontend/src/ui/layout/splitters.js` (o `.jsx`), `frontend/src/app.js`, `tests/test_side_panel_resize.py`  
**Scope:** M

#### Task 1.4: Escalas de fuente y tamaño de imagen

**Description:** `initConversationFontSize`, `initUiBaseFontScale`, `initSidebarFontScales`, `initConversationImageSize`.

**Acceptance:** esas inits fuera; CSS vars siguen siendo el mecanismo.  
**Verify:** Vitest + `tests/test_ui_base_font_size.py` (parte CSS).  
**Dependencies:** 1.1  
**Files:** `frontend/src/ui/layout/fontScales.js`, `frontend/src/app.js`  
**Scope:** S

### Checkpoint: Layout

- [ ] Tema / laterales / fullscreen / composer / splitters / fuentes funcionan recargando la página
- [ ] `rg getElementById\("btn-chat-fullscreen"\) frontend/src/app.js` → 0
- [ ] Review: no parpadeo al load (FOUC script + store)

---

### Fase 2: Historial izquierdo

API `conversations.js` nace aquí. Clic en un hilo llama puerto `session.open(id)` (la apertura real puede seguir en legado hasta 9).

#### Task 2.1: Lista + Nueva + txt2img (create vía puerto)

**Description:** `#conversations-list` lo pinta React. `loadConversations` / `renderConversationsList` salen. Botones Nueva/txt2img disparan create+open por puerto.

**Acceptance:** lista vacía y con forks se ven; `app.js` no escribe el listado.  
**Verify:** Vitest lista vacía / bosque; mover grep de lista en `test_left_history_sort.py` (parte lista).  
**Dependencies:** 0.2, 0.3, 1.2  
**Files:** `frontend/src/ui/history/ConversationList.jsx`, `frontend/src/store/history.js`, `frontend/src/api/conversations.js`, `frontend/src/app.js`  
**Scope:** M

#### Task 2.2: Orden

**Description:** `#left-history-sort-select` React; persistencia actual.

**Acceptance:** `render` según `activity` | `created_at` fuera del legado.  
**Verify:** Vitest; matar grep de sort.  
**Dependencies:** 2.1  
**Files:** `frontend/src/ui/history/HistorySort.jsx`, tests  
**Scope:** S

#### Task 2.3: Papelera

**Description:** `loadDeletedConversations` / `renderDeletedConversations` / restore-delete.

**Acceptance:** `#conversations-trash` React.  
**Verify:** Vitest; `tests/test_conversation_trash_ui.py` → Vitest.  
**Dependencies:** 2.1  
**Files:** `frontend/src/ui/history/TrashList.jsx`  
**Scope:** S

#### Task 2.4: Modo mensajes + búsqueda + pager

**Description:** `loadMessageHistory`, search debounce, pager, `data-history-consulta`.

**Acceptance:** modo mensajes no pasa por `innerHTML` del legado.  
**Verify:** Vitest debounce (fake timers); `tests/test_message_history_ui.py` → Vitest.  
**Dependencies:** 2.1  
**Files:** `frontend/src/ui/history/MessageHistory.jsx`  
**Scope:** M

### Checkpoint: Historial

- [ ] `#column-left` sin `getElementById` de lista/sort/trash/mensajes en `app.js`
- [ ] Abrir hilo sigue funcionando (puerto a legado)

---

### Fase 3: Chrome del panel derecho

Los *contenidos* de cada tab siguen siendo legado.

#### Task 3.1: Tabs

**Acceptance:** `initSidebarTabs` / `setSidebarTab` fuera.  
**Verify:** Vitest tab activo persistido.  
**Dependencies:** 0.3, 1.x  
**Files:** `frontend/src/ui/right/TabRail.jsx`, `tests/test_sidebar_accordion.py` (parte tabs)  
**Scope:** S

#### Task 3.2: Accordion

**Acceptance:** `initSidebarAccordion` / `initAccordionState` fuera; un abierto por lista.  
**Verify:** Vitest; `tests/test_right_panel_visual_system.py` parte JS.  
**Dependencies:** 3.1  
**Files:** `frontend/src/ui/right/Accordion.jsx`  
**Scope:** S

### Checkpoint: Chrome derecha

- [ ] Cambiar de tab no remontar de forma rara el contenido legado (el contenido sigue en el DOM; solo cambia visibilidad)

---

### Fase 4: Reglas de chat

#### Task 4.1: Lista + alta

**Acceptance:** `#rules-list` y alta rápida son React. Store `rules` (o slice de `session`).  
**Verify:** Vitest lista / add.  
**Dependencies:** 3.1, 0.2  
**Files:** `frontend/src/ui/rules/RulesList.jsx`, `frontend/src/api/rules.js`  
**Scope:** M

#### Task 4.2: Biblioteca

**Acceptance:** `loadLibraryRules` + select+añadir fuera de `app.js`.  
**Verify:** Vitest mock GET library.  
**Dependencies:** 4.1  
**Files:** `frontend/src/ui/rules/RuleLibrary.jsx`  
**Scope:** S

#### Task 4.3: Modal editar

**Acceptance:** `#rule-edit-modal` React; save/save-new/delete. `app.js` no toca el modal.  
**Verify:** Vitest CRUD; parte chat de `test_planner_prompt_rules_ui.py` (no planner).  
**Dependencies:** 4.1  
**Files:** `frontend/src/ui/rules/RuleEditModal.jsx`  
**Scope:** M

---

### Fase 5: Galería

Lazy: el módulo se carga al primer `layout.setGalleryVisible(true)`.

#### Task 5.1: Grid + pager

**Acceptance:** `renderGalleryGrid` / `loadGalleryPage` fuera. Store `images.gallery`.  
**Verify:** Vitest página / vacío.  
**Dependencies:** 0.2, 1.2  
**Files:** `frontend/src/ui/gallery/GalleryGrid.jsx`, `frontend/src/api/images.js`, `frontend/src/store/images.js`  
**Scope:** M

#### Task 5.2: Filtros, facets, scope

**Acceptance:** toolbar filtros + chips de mensaje + scope conversación/todas. Query string igual que hoy.  
**Verify:** Vitest filtros → params de fetch.  
**Dependencies:** 5.1  
**Files:** `frontend/src/ui/gallery/GalleryFilters.jsx`  
**Scope:** M

#### Task 5.3: Lightbox

**Acceptance:** `renderGalleryLightbox` / prev-next / teclado.  
**Verify:** Vitest.  
**Dependencies:** 5.1  
**Files:** `frontend/src/ui/gallery/GalleryLightbox.jsx`  
**Scope:** S

#### Task 5.4: Purge huérfanos + notice de filtros en header

**Acceptance:** notice `#conversation-image-filter-notice` se alimenta del store, no de innerHTML legado.  
**Verify:** Vitest notice visible con filtros; `tests/test_image_gallery_ui.py` → Vitest.  
**Dependencies:** 5.2  
**Files:** `frontend/src/ui/gallery/FilterNotice.jsx`  
**Scope:** S

### Checkpoint: Galería

- [ ] `initImageGallery` ausente
- [ ] Abrir conversación desde una miniatura sigue (puerto `session.openAtIllustration`, legado hasta 9–10)

---

### Fase 6: Cola

Al completar un job: puerto a `session`/`images`, **cero** `innerHTML` en `#messages-container`.

#### Task 6.1: Lista + poll

**Acceptance:** `pollImageQueue` / `renderImageQueueList` en React. Un intervalo, no N.  
**Verify:** Vitest poll (fake timers).  
**Dependencies:** 5.1 (mismo store)  
**Files:** `frontend/src/ui/queue/QueueList.jsx`  
**Scope:** M

#### Task 6.2: Pausa, cancelar, selección

**Acceptance:** acciones actuales sin legado.  
**Verify:** Vitest; parte de `test_image_queue_ui.py`.  
**Dependencies:** 6.1  
**Files:** `frontend/src/ui/queue/QueueActions.jsx`  
**Scope:** S

#### Task 6.3: Menú contextual + detalle

**Acceptance:** `openImageQueueContextMenu` / details body fuera.  
**Verify:** Vitest; `test_image_queue_reading_view.py` lo que sea de cola (reading view es fase 10).  
**Dependencies:** 6.1  
**Files:** `frontend/src/ui/queue/QueueContextMenu.jsx`  
**Scope:** S

---

### Fase 7: Ajustes (modelo y params)

El legado, hasta la fase 9, llama `session.getModelParams()` / un puerto equivalente.

#### Task 7.1: Provider + modelo

**Acceptance:** `loadProviders` / `loadModels` / selects React. API `models.js`.  
**Verify:** Vitest cambio de provider recarga modelos.  
**Dependencies:** 3.1, 0.2  
**Files:** `frontend/src/ui/settings/ProviderModel.jsx`, `frontend/src/api/models.js`  
**Scope:** M

#### Task 7.2: Contract + badges

**Acceptance:** `loadModelContract` / `renderCapabilityBadges` fuera.  
**Verify:** Vitest contract null vs presente.  
**Dependencies:** 7.1  
**Files:** `frontend/src/ui/settings/ContractBadges.jsx`  
**Scope:** S

#### Task 7.3: Recetas

**Acceptance:** `fillRecipeChipHost` / apply recipe en React (settings + espejo composer si ya existe el DOM).  
**Verify:** Vitest receta aplica params; `test_settings_model_pin_presets.py` → Vitest.  
**Dependencies:** 7.2  
**Files:** `frontend/src/ui/settings/RecipeChips.jsx`  
**Scope:** M

#### Task 7.4: Params + baseline + exclude-from-send

**Acceptance:** `buildModelParams` / exclusiones por conversación en store, no DOM.  
**Verify:** Vitest: param = baseline ⇒ no se envía.  
**Dependencies:** 7.3  
**Files:** `frontend/src/ui/settings/ParamsForm.jsx`  
**Scope:** M

#### Task 7.5: Payload “qué se envía”

**Acceptance:** `renderParamsToSend` / `renderParamsSourceLabel` React.  
**Verify:** Vitest.  
**Dependencies:** 7.4  
**Files:** `frontend/src/ui/settings/ParamsToSend.jsx`  
**Scope:** S

#### Task 7.6: Modal model info

**Acceptance:** `openModelInfoModal` React; lazy al abrir.  
**Verify:** Vitest.  
**Dependencies:** 7.1  
**Files:** `frontend/src/ui/settings/ModelInfoModal.jsx`  
**Scope:** M

#### Task 7.7: Context usage + tab Preferencias

**Acceptance:** barra de contexto + history turns / auto-scroll / save chromadb en React.  
**Verify:** Vitest; `test_preferences_tab.py`, `test_status_bar_session_info.py` parte JS.  
**Dependencies:** 7.1  
**Files:** `frontend/src/ui/settings/ContextUsage.jsx`, `frontend/src/ui/settings/PreferencesTab.jsx`  
**Scope:** M — partir en dos PRs si el diff se dispara.

### Checkpoint: Ajustes

- [ ] Puerto `getModelParams()` estable para fase 9
- [ ] Tab Ajustes sin inits de contract/params en `app.js`

---

### Fase 8: Panel Imágenes

#### Task 8.1: Prefs de ilustración

**Acceptance:** `loadImagesPrefs` / `fillImagesPanelFromPrefs` / `use-chat-config` deshabilita controles.  
**Verify:** Vitest; `test_images_prefs_ui.py` empieza a morir.  
**Dependencies:** 7.x (reusa contract/recetas si aplica), 3.1  
**Files:** `frontend/src/ui/imagesPanel/IllustrationPrefs.jsx`  
**Scope:** M

#### Task 8.2: Planner recipes + contract

**Acceptance:** `loadPlannerContract` / `renderPlannerRecipes` / `applyPlannerRecipe` fuera.  
**Verify:** Vitest; `test_planner_recipes_ui.py`.  
**Dependencies:** 8.1, 7.3 (mismo patrón chips)  
**Files:** `frontend/src/ui/imagesPanel/PlannerRecipes.jsx`  
**Scope:** M

#### Task 8.3: Planner rules

**Acceptance:** lista/biblioteca/alta de reglas planner (no chat).  
**Verify:** Vitest; resto de `test_planner_prompt_rules_ui.py`.  
**Dependencies:** 8.1, 4.x (mismo patrón UI)  
**Files:** `frontend/src/ui/imagesPanel/PlannerRules.jsx`  
**Scope:** M

#### Task 8.4: Forge params

**Acceptance:** overrides Forge React.  
**Verify:** Vitest; `test_forge_param_overrides_ui.py`.  
**Dependencies:** 8.1  
**Files:** `frontend/src/ui/imagesPanel/ForgeParams.jsx`  
**Scope:** M

#### Task 8.5: Reactor

**Acceptance:** settings reactor React.  
**Verify:** Vitest (comportamiento UI; la lógica server no se toca).  
**Dependencies:** 8.1  
**Files:** `frontend/src/ui/imagesPanel/ReactorPrefs.jsx`  
**Scope:** S

#### Task 8.6: Snapshot desde store, no DOM

**Acceptance:** `collectImagesSnapshot` / `applyImagesSnapshot` leen/escriben store. El legado, si aún persiste a conversación, llama al puerto.  
**Verify:** Vitest round-trip.  
**Dependencies:** 8.1–8.5  
**Files:** `frontend/src/store/images.js`, tests  
**Scope:** S

---

### Fase 9: Sesión y composer

#### Task 9.1: Store session + open/new/delete/title

**Description:** `currentConversationId`, kind, auto-title, `openConversation`, `newConversation`, borrar. Header de sesión React. Aún no el stream.

**Acceptance:** `#conversation-title` / auto-title / `#btn-clear-memory` / `#btn-new-chat` sin legado. Historial usa `session.open` de verdad (se retira el stub).  
**Verify:** Vitest open/new; `test_chat_session_header.py`.  
**Dependencies:** 2.1, 7.4, 8.6  
**Files:** `frontend/src/store/session.js`, `frontend/src/ui/sessionHeader/SessionHeader.jsx`  
**Scope:** M

#### Task 9.2: Composer send/stop

**Acceptance:** textarea, `#btn-send` toggle send/stop, instruction override.  
**Verify:** Vitest; `test_composer_send_stop_toggle.py`.  
**Dependencies:** 9.1, 1.2 (collapse)  
**Files:** `frontend/src/ui/composer/Composer.jsx`  
**Scope:** M

#### Task 9.3: `sendMessage` como módulo de aplicación

**Acceptance:** `frontend/src/app/sendMessage.js` usa api + stores. **No** toca el DOM del stream (escribe al store de mensajes / placeholder hasta 10). Stop aborta el `AbortController`.  
**Verify:** Vitest send abort con fetch mock.  
**Dependencies:** 9.2  
**Files:** `frontend/src/app/sendMessage.js`, `frontend/src/app/sendMessage.test.js`  
**Scope:** M

#### Task 9.4: Composer txt2img

**Acceptance:** `sendPromptGeneratorTurn` en módulo app; UI Generar prompt.  
**Verify:** Vitest; `test_prompt_generator_ui.py` → Vitest.  
**Dependencies:** 9.3  
**Files:** `frontend/src/app/promptGeneratorTurn.js`, `frontend/src/ui/composer/Composer.jsx`  
**Scope:** S

### Checkpoint: Sesión

- [ ] Se puede crear hilo y disparar send **aunque** el pintado del stream aún sea híbrido (store → fase 10 pinta; si 9.3 llega antes que 10, el legado puede suscribirse al store *solo para pintar* — peor. **Preferible implementar 10.1 inmediatamente después de 9.1**, antes de 9.3, si el híbrido pinta dos veces.)

**Ajuste de orden (crítico):** si 9.3 aterriza sin 10.1, `initApp` seguiría haciendo `renderMessages` sobre el mismo contenedor. Por eso **10.1 es dependencia de 9.3**, no al revés. El grafo de más arriba se refina así: `9.1 → 10.1 → 9.2/9.3`. Composer (9.2) puede ir en paralelo a 10.1.

---

### Fase 10: Mensajes

El corte más delicado. No juntar en un PR.

#### Task 10.1: Render estático del árbol

**Acceptance:** `#messages-container` React. `renderMessages` desaparece. Árbol / leaf / `activeLeafId` desde `session` o store `messages`.  
**Verify:** Vitest árbol y hoja; `content-visibility` en `.message` (o clase actual).  
**Dependencies:** 9.1  
**Files:** `frontend/src/ui/messages/MessageList.jsx`, `frontend/src/store/session.js` (o `messages.js`)  
**Scope:** M

#### Task 10.2: Collapse + scroll nav + auto-scroll

**Acceptance:** `initConversationScrollNav`, collapse all, `initAutoScrollDuringGeneration` fuera. Auto-scroll usa ref al contenedor, no estado por pixel.  
**Verify:** Vitest; `test_message_collapse_ui.py`, `test_conversation_scroll_nav.py`.  
**Dependencies:** 10.1  
**Files:** `frontend/src/ui/messages/ScrollNav.jsx`  
**Scope:** M

#### Task 10.3: Stream buffer + flush

**Acceptance:** `currentStreamingMsgEl` no existe. Chunks → ref → flush ≤ 1/frame. `frontend/src/app/stream.js`.  
**Verify:** test de que N chunks no implican N renders (spy de render del nodo in-flight).  
**Dependencies:** 10.1, 9.3  
**Files:** `frontend/src/app/stream.js`, `frontend/src/ui/messages/StreamingMessage.jsx`  
**Scope:** M

#### Task 10.4: Acciones copy / delete / fork / attempts

**Acceptance:** handlers React; grep SVG de acciones deja de ser pytest.  
**Verify:** Vitest; `test_conversation_attempts_ui.py`, `test_message_open_scroll.py` (lo que quede).  
**Dependencies:** 10.1  
**Files:** `frontend/src/ui/messages/MessageActions.jsx`  
**Scope:** M

#### Task 10.5: Illustrate + meta modal

**Acceptance:** `maybeIllustrateAssistantMessage` / `illustrateAtParagraph` / `openIllustrationMetaModal` fuera. No innerHTML del stream.  
**Verify:** Vitest; `test_illustrate_at_ui.py`, `test_illustration_lazy_collapse.py`.  
**Dependencies:** 10.1, 8.6  
**Files:** `frontend/src/ui/messages/Illustrate.jsx`  
**Scope:** M

#### Task 10.6: Reading mode

**Acceptance:** `initReadingMode` / resize del panel de lectura React.  
**Verify:** Vitest; parte reading de `test_image_queue_reading_view.py`.  
**Dependencies:** 10.1  
**Files:** `frontend/src/ui/messages/ReadingMode.jsx`  
**Scope:** M

### Checkpoint: Mensajes

- [ ] Cero `innerHTML` sobre mensajes en `app.js`
- [ ] Stream usable (abort + flush)
- [ ] Review humano: un turno largo no tilda el hilo

---

### Fase 11: Perfiles y debug

Va al final porque el snapshot tiene que leer stores, no inputs.

#### Task 11.1: Workspace profiles

**Acceptance:** `collectWorkspaceSnapshot` / `applyWorkspaceSnapshot` 100% stores. `initWorkspaceProfiles` fuera.  
**Verify:** Vitest apply restaura provider/modelo/prefs mockeados; `test_workspace_profile_ui.py` → Vitest.  
**Dependencies:** 8.6, 9.1, 10.1  
**Files:** `frontend/src/ui/profiles/WorkspaceProfiles.jsx`, `frontend/src/api/workspaceProfiles.js`  
**Scope:** M

#### Task 11.2: Planner rule presets

**Acceptance:** `initPlannerRulePresets` fuera.  
**Verify:** Vitest.  
**Dependencies:** 8.3, 11.1 (mismo patrón persistencia)  
**Files:** `frontend/src/ui/profiles/PlannerRulePresets.jsx`  
**Scope:** S

#### Task 11.3: Debug dock

**Acceptance:** `initDebugDock` / buffers React; deja de parsear DOM de cola (lee store `images.queue`). Lazy.  
**Verify:** Vitest; `test_debug_accordions.py`, `test_images_debug_log_buffer.py`.  
**Dependencies:** 6.1, 10.3 (debug de chat)  
**Files:** `frontend/src/ui/debug/DebugDock.jsx`  
**Scope:** M

---

### Fase 12: Funeral de `initApp`

#### Task 12.1: Borrar el controlador

**Acceptance:** no existe `frontend/src/app.js`. `main.jsx` solo monta `<App />`. `el` muerto. `test_react_frontend.py` afirma ausencia de `initApp`.  
**Verify:** `rg initApp frontend/src` → 0; `make frontend-test`; `pytest tests/ -m "not e2e"`.  
**Dependencies:** 1–11  
**Files:** `frontend/src/main.jsx`, delete `app.js`, tests  
**Scope:** S (si las islas están bien; si no, esta tarea está bloqueada y hay que volver)

#### Task 12.2: Vite / bundle

**Acceptance:** quitar `manualChunks` especial de `app.js`; `keepNames` se reevalúa (solo existía para no romper grep de funciones). Lazy de islas ya hecho. Valorar StrictMode **ahora sí**.  
**Verify:** `make frontend-build`; arranque manual.  
**Dependencies:** 12.1  
**Files:** `frontend/vite.config.js`, `frontend/src/main.jsx`  
**Scope:** S

#### Task 12.3: Verificación final

**Acceptance:** DoD global. Lista de pytest UI grep = 0 o solo CSS.  
**Verify:** comandos del contrato. Smoke manual de los flujos del spec.  
**Dependencies:** 12.2  
**Files:** docs (marcar checklist)  
**Scope:** S

### Checkpoint: Complete

- [ ] DoD del spec
- [ ] Review humano antes de PR único final o del último PR de la serie

---

## Verification Contract

Por defecto, **sin e2e**.

```bash
make frontend-test
pytest tests/ -m "not e2e" --cov=app --cov-report=term-missing
make frontend-build
```

Cada isla: test de frontera (grep `getElementById("id")` en `app.js` = 0).

No se verifica rediseño visual. Light/dark y layout se cubren porque la fase 1 los *mueve*.

## Definition of Done (global)

- Usuario puede: abrir hilo, enviar, parar, ilustrar, galería, cola, reglas, params, perfiles — igual que hoy.
- Cero `initApp`.
- Cero duplicado HTML / JSX.
- Vitest de comportamiento por isla mergeada.
- `make frontend-build` + `make start` sirven la app.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| React pinta y `initApp` pisa el mismo nodo | Alto | Frontera: grep 0; no mergear islas a medias |
| 9.3 send sin 10.1 | Alto | Orden refinado: 10.1 antes o en el mismo tren que 9.3 |
| Extraer chat demasiado pronto | Alto | Fases 0–8 primero |
| Store único | Alto | Un store por agregado; perfiles *leen* stores |
| Tests grep bloquean el delete | Medio | Cada PR mata su lote |
| Stream en setState | Alto | Buffer + test de renders |
| Markup duplicado si se aplaza 0.1 | Medio | 0.1 obligatorio primero: si no, cada isla toca dos árboles |
| `workspaceProfiles.collectSnapshot()` lee DOM | Alto | Fase 11 al final |
| Task 0.1 toca ~17 tests de golpe | Medio | Un PR, no dos; no hay forma honesta de partirlo |
| `React.lazy` + legado en el mismo panel | Medio | Lazy solo cuando el panel es 100% React |

## Appendix: mapa de `app.js` → tarea

| Zona | Símbolos ancla | Tarea |
|------|----------------|-------|
| Bootstrap | `initApp`, `initLoad`, `el` | 12.1 |
| HTTP | `fetchJson` | 0.2 |
| HTTP recursos | `loadProviders`, `loadModels`, `loadConversations` | 7.1 / 2.1 |
| Debug | `initDebugDock`, `pushChatDebugEntry` | 11.3 |
| Historial | `refreshLeftHistory`, `renderConversationsList`, `loadMessageHistory` | 2.x |
| Sesión | `setCurrentConversation`, `openConversation`, `newConversation` | 9.1 |
| Mensajes | `renderMessages`, `formatMessageHtml` | 10.1 |
| Send | `sendMessage`, `sendPromptGeneratorTurn` | 9.3 / 9.4 |
| Stream | `currentStreamingMsgEl` | 10.3 |
| Reglas | `renderRules`, `openRuleEditModal` | 4.x |
| Contract/params | `loadModelContract`, `applyModelRecipe`, `buildModelParams` | 7.x |
| Layout | `initDarkMode`, collapse, fullscreen, resize | 1.x |
| Imágenes prefs | `initImagesPanel`, snapshots | 8.x |
| Galería | `initImageGallery` | 5.x |
| Cola | `initImageQueuePanel`, `pollImageQueue` | 6.x |
| Perfiles | `initWorkspaceProfiles`, `initPlannerRulePresets` | 11.x |
| Lectura | `initReadingMode` | 10.6 |

## Appendix: pytest grep que hay que estrangular

No es lista exhaustiva de asserts; es el lote que **bloquea borrar `app.js`**. Cada fase debe dejar en 0 su columna.

- Layout: `test_left_sidebar_collapse.py`, `test_side_panel_resize.py`, `test_chat_fullscreen.py`, `test_composer_collapse.py`, `test_ui_base_font_size.py`
- Historial: `test_left_history_sort.py`, `test_conversation_trash_ui.py`, `test_message_history_ui.py`
- Derecha: `test_sidebar_accordion.py`, `test_right_panel_visual_system.py`, `test_sidebar_tab_icons.py`
- Reglas/planner: `test_planner_prompt_rules_ui.py`, `test_planner_recipes_ui.py`
- Galería/cola: `test_image_gallery_ui.py`, `test_image_queue_ui.py`, `test_image_queue_reading_view.py`
- Settings/prefs: `test_settings_model_pin_presets.py`, `test_preferences_tab.py`, `test_status_bar_session_info.py`
- Imágenes: `test_images_prefs_ui.py`, `test_forge_param_overrides_ui.py`
- Mensajes: `test_message_collapse_ui.py`, `test_illustrate_at_ui.py`, `test_illustration_lazy_collapse.py`, `test_conversation_attempts_ui.py`, `test_message_open_scroll.py`
- Composer: `test_composer_send_stop_toggle.py`, `test_prompt_generator_ui.py`
- Perfiles/debug: `test_workspace_profile_ui.py`, `test_debug_accordions.py`, `test_images_debug_log_buffer.py`
- Shell: `test_react_frontend.py` (hoy afirma el legado; al final afirma su muerte)

Los que solo leen `style.css` se quedan.

## Open Questions

Mismas que el spec (tamaño de PR, IDs, cuándo hacer lazy). Además:

- ¿Permitir que 10.1 y 9.2 vayan en paralelo en dos ramas? Solo si 9.1 ya está en `main` de esta feature. Si no, serie.
