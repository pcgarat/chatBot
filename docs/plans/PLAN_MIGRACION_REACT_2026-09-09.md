Última modificación: 2026-09-09

# Plan: resto de la migración a React

**Estado actual:** fases 0–12 hechas en `cursor/react-islands-1943`. No existe `frontend/src/app.js` ni `initApp`. `main.jsx` monta `<App />`. Markup único en `App.jsx` (`index.html` solo `#root` + FOUC). Stores por agregado + `frontend/src/api/*` + acciones en `frontend/src/app/*`. El chrome estático vive en `App.jsx` con delegación (`shellEvents.js`); las listas (historial, mensajes, galería, cola, reglas) son islas React. Stream: buffer + `requestAnimationFrame`.
**Fuera de alcance:** backend, contratos API, CSS redesign, TypeScript (otra migración; mezclarla aquí duplica el coste).
**Hecho cuando:** `initApp` no existe, no hay markup duplicado, cada panel es un componente con estado React, y los tests de UI son de comportamiento (Vitest), no grep de nombres de función. Los pytest de UI que quedan leen `frontend_source()` / `frontend_markup()` (no el bundle).

## Overview

El primer corte dejó **toolchain + shell**. Eso no es una app React: React monta el DOM y se aparta para no pelearse con mutaciones imperativas. El resto de la migración es ir **quitándole islas a `initApp`** hasta que no quede nada.

Criterio de cada corte: al acabar, `initApp` **ya no escribe** en ese subárbol. Si el componente React y el JS legado pintan el mismo nodo, el corte no ha terminado (es peor que el estado actual).

No empezar por el chat. El stream, el árbol de mensajes, ilustrar, fork y el composer son el núcleo acoplado. Extraer primero lo que es lista + localStorage + fetch JSON.

## Qué no hacer

| Tentación | Por qué es mala |
|-----------|-----------------|
| Convertir `renderX()` a JSX dejando el estado en closures de `initApp` | React re-renderizará y pisará el DOM; o no re-renderizará y el JSX es decorado |
| Meter cada token del stream en `setState` | Decenas de renders/s; el chat actual ya hace innerHTML dirigido |
| TypeScript + extracción a la vez | Dos migraciones. JS + JSDoc en módulos nuevos basta |
| Conservar los tests pytest que hacen `assert "function foo" in js` como contrato eterno | Impiden borrar `app.js`. Cada isla sustituye grep por Vitest |
| Extraer workspace profiles o params al principio | Hacen snapshot de *todo* el rig; hasta que el store exista, son el peor candidato |
| Un store global gigante día 1 con 80 campos | Acaba siendo `initApp` con otro nombre. Store por agregado (sesión, historial, layout, imágenes) |

## Architecture Decisions

- **Islas, no Big Bang.** Un panel por PR. La app tiene que seguir usable tras cada merge.
- **Puertos, no `el.foo`.** Cada isla expone un puerto mínimo que el legado puede llamar (`session.getId()`, `layout.setGalleryVisible(true)`) hasta que deje de necesitarlo. Patrón Adapter hacia `/api` (`frontend/src/api/`) y Facade que se encoge (`initApp`).
- **Estado por agregado**, no un Context en `#root`. Context en el shell re-renderiza columnas enteras. Store ligero (Zustand o un observable propio de ~50 líneas) **por dominio**: `session`, `history`, `layout`, `images`. Sin librería nueva si el observable propio cabe; no introducir Redux.
- **Stream fuera de React state.** Buffer de texto + `requestAnimationFrame` / flush al store cada N ms. React pinta el mensaje en curso como *un* nodo, no un setState por token.
- **Un solo markup.** Hoy `frontend/index.html` (HTML estático para GET `/`) y `App.jsx` duplican el árbol. Eso es deuda del primer PR. Fase 0: el HTML de Vite es `<div id="root">` vacío; los tests de IDs leen `App.jsx` (ya casi) o Vitest. Quitar aserciones pytest sobre `client.get("/").text` que buscan IDs (TestClient no ejecuta JS).
- **`initApp` como residuo explícito.** Lista de `el.*` que aún usa. Cada isla borra sus claves. Cuando `el` esté vacío, se borra el módulo.
- **Tests: strangler también.** Isla nueva = Vitest del componente + del store. Pytest grep se borra o se apunta al módulo extraído, nunca al bundle. No e2e salvo que el usuario lo pida.
- **IDs se conservan** mientras existan tests/e2e que los usen. No es un rediseño visual.

## Grafo de dependencias

```
Fase 0  Fundación (api client, stores vacíos, markup único, islands host)
        │
        ▼
Fase 1  Layout chrome (tema, colapso, anchos, fuentes, fullscreen, composer collapse)
        │
        ├── Fase 2  Historial izquierdo (lista, sort, papelera, modo mensajes)
        │
        └── Fase 3  Chrome derecha (tabs + accordion) — aún sin reglas/params
                │
                ├── Fase 4  Reglas + modal editar
                │
                └── Fase 5  Galería  ──► Fase 6  Cola
                        │
                        ▼
                Fase 7  Ajustes (provider/modelo/contract/params/payload)
                        │
                        ▼
                Fase 8  Panel Imágenes (prefs, planner, reactor, forge params)
                        │
                        ▼
        Fase 9  Sesión + composer + send/stop + txt2img
                │
                ▼
        Fase 10 Mensajes (árbol, collapse, ilustrar, stream, lectura)
                │
                ▼
        Fase 11 Perfiles de workspace + presets planner + debug dock
                │
                ▼
        Fase 12 Borrar initApp, el{}, HTML duplicado. Checkpoint
```

Fases 2 y 3 pueden ir en paralelo tras 0–1. 5 y 6 en serie (la cola refresca mensajes). 9 antes que 10: el composer dispara el stream; el store de sesión tiene que existir. 11 al final: snapshot de todo lo anterior.

## Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| React pinta y `initApp` pisa el mismo nodo | Alto (UI “parpadea” o se resetea) | Criterio de salida de isla: grep `getElementById("…")` del panel = 0 en `app.js` |
| Extraer chat demasiado pronto | Alto | Prohibido antes de fases 0–8 |
| Store único con todo el rig | Alto | Un store por agregado; perfiles (fase 11) *leen* stores, no al revés |
| Tests grep bloquean borrar funciones | Medio | Cada PR de isla mueve o mata los pytest de ese subárbol |
| Stream en setState | Alto | Buffer + flush; test de que N chunks no implican N renders |
| Markup duplicado index.html / App.jsx | Medio | Fase 0 obligatoria; si se aplaza, cada isla toca *dos* árboles |
| Hydration / StrictMode | Medio | Seguir sin StrictMode mientras quede legado. No hidratar |
| `workspaceProfiles.collectSnapshot()` asume DOM | Alto | Snapshot desde stores, no desde inputs. Por eso va al final |

## Task List

### Fase 0: Fundación

- [x] **Task 0.1: Markup único**
  - Acceptance: `frontend/index.html` solo tiene `#root` vacío + script de tema en `<head>` (evita FOUC). `App.jsx` es la única fuente del árbol. Tests que hacían `assert id in client.get("/").text` pasan a Vitest o a leer `App.jsx`.
  - Verify: `pytest tests/test_react_frontend.py tests/test_main.py -m "not e2e"`; `cd frontend && npm test`
  - Files: `frontend/index.html`, `frontend/src/App.jsx`, `frontend/src/main.jsx`, `tests/test_react_frontend.py`, tests UI que pegan a GET `/`
  - Dependencies: ninguna

- [x] **Task 0.2: Cliente HTTP**
  - Acceptance: `frontend/src/api/client.js` (`fetchJson`, errores, abort). Módulos por recurso (`conversations.js`, `models.js`, `images.js`, `rules.js`, `workspaceProfiles.js`) que envuelven `/api`. `app.js` usa el cliente; cero `fetch(` sueltos nuevos.
  - Verify: Vitest del client (mock fetch); un test por recurso de happy path + 4xx.
  - Files: `frontend/src/api/*`, `frontend/src/api/*.test.js`, `frontend/src/app.js`
  - Dependencies: 0.1 opcional (puede ir en paralelo)

- [x] **Task 0.3: Stores vacíos + regla de isla**
  - Acceptance: `frontend/src/store/{layout,session,history,images}.js` con estado mínimo y `subscribe`. Documento corto en este plan (abajo) es la regla; no hace falta otro doc. Helper `legacyOwns(id)` / comentario `LEGACY_OWNED` en nodos que `initApp` aún pinta. Prohibido que React tenga estado *y* el legado haga `innerHTML` en el mismo id.
  - Verify: unit del store (set/get/subscribe); grep de convención en PR.
  - Files: `frontend/src/store/*`
  - Dependencies: ninguna

### Fase 1: Layout chrome

Candidato fácil: casi todo es `localStorage` + `data-*` en `<html>`. Cero API.

- [x] **Task 1: Tema, colapso laterales, anchos, fuentes, fullscreen, composer collapse**
  - Acceptance: esos `initDarkMode` / `initLeftSidebarCollapse` / `initSidePanelResize` / font scales / `initChatFullscreen` / `initComposerCollapse` desaparecen de `app.js`. React + store `layout`. El script del `<head>` (FOUC) se queda: no es React.
  - Verify: Vitest de persistencia localStorage y de `data-theme` / `data-sidebar-left`. Pytest CSS intactos (siguen leyendo `frontend/src/styles/style.css`).
  - Files: `frontend/src/store/layout.js`, `frontend/src/ui/layout/*`, `frontend/src/app.js`, `frontend/src/ui/layout/*.test.jsx`
  - Dependencies: 0.3

### Fase 2: Historial izquierdo

- [x] **Task 2: Lista de conversaciones, sort, papelera, modo mensajes**
  - Acceptance: `#column-left` lo pinta React. `loadConversations`, `renderConversationsList`, `loadDeletedConversations`, `loadMessageHistory`, sort, restore/delete salen de `app.js`. Clic emite `session.open(id)` (puerto; la apertura real puede seguir en legado hasta fase 9).
  - Verify: Vitest lista vacía / bosque con fork / papelera / modo mensajes. Mover pytest de `test_left_history_sort.py`, `test_conversation_trash_ui.py`, `test_message_history_ui.py` a Vitest o a leer JSX.
  - Files: `frontend/src/ui/history/*`, `frontend/src/store/history.js`, `frontend/src/api/conversations.js`
  - Dependencies: 0.2, 0.3, 1 (ancho/colapso)

### Fase 3: Chrome del panel derecho

- [x] **Task 3: Tabs + accordion**
  - Acceptance: `initSidebarTabs` + `initSidebarAccordion` + persistencia accordion fuera de `app.js`. Los *contenidos* de cada tab siguen siendo legado.
  - Verify: Vitest de tab activo y un accordion abierto por lista.
  - Files: `frontend/src/ui/right/TabRail.jsx`, `frontend/src/ui/right/Accordion.jsx`
  - Dependencies: 0.3, 1

### Fase 4: Reglas

- [x] **Task 4: Reglas de chat + modal editar**
  - Acceptance: lista, biblioteca, crear, editar, borrar. `rules` vive en store `session` (o `rules`). `app.js` no toca `#rules-list` ni `#rule-edit-modal`.
  - Verify: Vitest CRUD local + mock API. Sustituir grep de `test_planner_prompt_rules_ui.py` solo en la parte de *chat* rules (planner rules van en fase 8).
  - Files: `frontend/src/ui/rules/*`, `frontend/src/api/rules.js`
  - Dependencies: 3, 0.2

### Fase 5: Galería

- [x] **Task 5: Galería + lightbox + filtros + scope**
  - Acceptance: `initImageGallery` y renders asociados fuera de `app.js`. Filtros, pager, lightbox, purge huérfanos, notice de filtros en el header.
  - Verify: Vitest filtros → query string; lightbox prev/next; scope conversación vs todas.
  - Files: `frontend/src/ui/gallery/*`, `frontend/src/store/images.js`, `frontend/src/api/images.js`
  - Dependencies: 0.2, 0.3, 1 (paneles centrales)

### Fase 6: Cola

- [x] **Task 6: Cola de generación**
  - Acceptance: poll, pausa, cancelar, selección, menú contextual. `initImageQueuePanel` fuera. Al completar un job, notifica a `session`/`images` (puerto), no hace `innerHTML` en `#messages-container`.
  - Verify: Vitest poll + pause + delete selección. Mover `test_image_queue_ui.py` a Vitest.
  - Files: `frontend/src/ui/queue/*`
  - Dependencies: 5 (mismo store `images`)

### Fase 7: Ajustes (modelo y params)

- [x] **Task 7: Provider, modelo, contract, recetas, params, payload**
  - Acceptance: tab Ajustes es React. `loadModelContract`, chips, recetas, `buildModelParams`, payload “qué se envía”. El legado llama `session.getModelParams()` al enviar (fase 9).
  - Verify: Vitest: receta aplica params; param igual al baseline no se envía; exclude-from-send.
  - Files: `frontend/src/ui/settings/*`, `frontend/src/api/models.js`
  - Dependencies: 3, 0.2

### Fase 8: Panel Imágenes

- [x] **Task 8: Prefs ilustración, planner, reglas planner, forge, reactor**
  - Acceptance: tab Imágenes es React. Snapshot `collectImagesSnapshot` / `applyImagesSnapshot` leen el store, no el DOM.
  - Verify: Vitest snapshot round-trip; `use-chat-config` deshabilita controles.
  - Files: `frontend/src/ui/imagesPanel/*`
  - Dependencies: 7 (reusa contract/recetas), 4 (mismo patrón de reglas)

### Fase 9: Sesión y composer

- [x] **Task 9: Título, auto-title, composer, send/stop, txt2img**
  - Acceptance: header de sesión + composer son React. `sendMessage` / `sendPromptGeneratorTurn` / `cancelLastMessage` viven en un módulo de aplicación (`frontend/src/app/sendMessage.js`) que usa api + stores, **no** el DOM del stream (el stream escribe al store; fase 10 pinta).
  - Verify: Vitest send abort; txt2img oculta send y muestra generar prompt.
  - Files: `frontend/src/ui/composer/*`, `frontend/src/ui/sessionHeader/*`, `frontend/src/app/sendMessage.js`
  - Dependencies: 2 (open conversation), 7 (params), 8 (images enabled)

### Fase 10: Mensajes

El corte más grande. No juntar con 9.

- [x] **Task 10: Lista, árbol, collapse, ilustrar, stream, modo lectura**
  - Acceptance: `#messages-container` es React. `renderMessages` desaparece. Stream: chunks → buffer → flush al mensaje en curso. Acciones (copy, delete, fork, illustrate, reading) son handlers React. `currentStreamingMsgEl` no existe.
  - Verify: Vitest árbol/leaf; collapse all; N chunks → ≤ M renders (M acordado, p.ej. 1 por frame). No pytest grep de SVG de acciones: Vitest del markup.
  - Files: `frontend/src/ui/messages/*`, `frontend/src/app/stream.js`
  - Dependencies: 9

### Fase 11: Perfiles y debug

- [x] **Task 11: Workspace profiles, planner rule presets, debug dock**
  - Acceptance: snapshot/apply leen stores (layout + session + images). Debug dock React; deja de parsear DOM de cola.
  - Verify: Vitest apply perfil restaura provider/modelo/prefs mockeados.
  - Files: `frontend/src/ui/profiles/*`, `frontend/src/ui/debug/*`
  - Dependencies: 8, 9, 10 (si el snapshot incluye algo del chat)

### Fase 12: Funeral de `initApp`

- [x] **Task 12: Borrar el controlador legado**
  - Acceptance: no existe `frontend/src/app.js` ni `initApp`. `main.jsx` solo monta `<App />`. `el = {…}` muerto. Bundle sin el chunk legado o irrelevante.
  - Verify: grep `initApp` / `getElementById` en `frontend/src/app.js` → archivo ausente. `cd frontend && npm test`. `pytest tests/ -m "not e2e"` verde (los grep que queden apuntan a módulos nuevos).
  - Files: `frontend/src/main.jsx`, `frontend/vite.config.js`, tests
  - Dependencies: 1–11

## Verification Contract

Por defecto, **sin e2e**.

```bash
cd frontend && npm test
pytest tests/ -m "not e2e" --cov=app --cov-report=term-missing
make frontend-build
```

Cada isla: test que **falla** si el legado aún pinta ese id (grep `getElementById("id-del-panel")` en `app.js` debe ser 0). Eso es el test de frontera, no un nice-to-have.

No verificar el rediseño visual en este plan. Light/dark y layout se cubren porque la fase 1 los mueve, no porque se redibujen.

## Definition of Done (global)

- Usuario puede: abrir hilo, enviar, parar, ilustrar, galería, cola, reglas, params, perfiles — igual que hoy.
- Cero `initApp`.
- Cero duplicado HTML / JSX.
- Tests de UI de comportamiento en Vitest para cada isla mergeada. Los pytest grep de UI apuntan a `frontend_source()` / `frontend_markup()`, nunca a `app.js` (el archivo ya no existe).
- `make frontend-build` + `make start` sirven la app.

## Notas de implementación (2026-09-09)

- Chrome (tabs, accordion, ajustes, imágenes, composer, debug, perfiles) está en `App.jsx` + `shellEvents.js` + `StoreDomSync`; no hay carpetas `ui/right`, `ui/settings`, `ui/imagesPanel`, `ui/profiles`, `ui/debug` aparte. Las islas con lista React son historial, mensajes, galería, cola y reglas.
- Logos en `frontend/public/img/` para que `emptyOutDir` no borre `app/static/img/` en el build.

## Appendix: mapa de `app.js` hoy (para no extraer a ciegas)

| Zona | Símbolos ancla | Isla destino |
|------|----------------|--------------|
| Bootstrap | `initApp`, `initLoad`, `el` | desaparece en 12 |
| HTTP | `fetchJson`, `loadProviders`, `loadModels` | api/* (0.2) |
| Debug | `initDebugDock`, `pushChatDebugEntry` | fase 11 |
| Historial | `refreshLeftHistory`, `renderConversationsList`, `loadMessageHistory` | fase 2 |
| Sesión | `setCurrentConversation`, `openConversation`, `newConversation` | fase 9 |
| Mensajes | `renderMessages`, `sendMessage`, `formatMessageHtml` | fases 9–10 |
| Reglas | `renderRules`, `openRuleEditModal` | fase 4 |
| Contract/params | `loadModelContract`, `applyModelRecipe`, `buildModelParams` | fase 7 |
| Layout | `initDarkMode`, `initLeftSidebarCollapse`, `initChatFullscreen` | fase 1 |
| Imágenes prefs | `initImagesPanel`, `collectImagesSnapshot` | fase 8 |
| Galería | `initImageGallery` | fase 5 |
| Cola | `initImageQueuePanel`, `pollImageQueue` | fase 6 |
| Perfiles | `initWorkspaceProfiles`, `initPlannerRulePresets` | fase 11 |
| Lectura | `initReadingMode` | fase 10 |

## Appendix: regla de frontera (isla)

Un id es de React cuando se cumplen las tres:

1. Un componente lo renderiza.
2. `frontend/src/app.js` no contiene `getElementById("ese-id")` ni `innerHTML` sobre ese nodo.
3. Hay un Vitest que monta el componente.

Hasta entonces, React **no** pone estado en ese subárbol.
