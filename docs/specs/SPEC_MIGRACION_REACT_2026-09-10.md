Última modificación: 2026-09-10

# Spec: acabar la migración del front a React

**Estado:** en curso (shell Vite+React mergeado en #57; controlador legado intacto).

**Intent:** [`docs/intent/migracion-react_2026-09-10.md`](../intent/migracion-react_2026-09-10.md)

**Plan:** [`docs/plans/PLAN_MIGRACION_REACT_2026-09-10.md`](../plans/PLAN_MIGRACION_REACT_2026-09-10.md)

**Checklist:** [`docs/checklists/CHECKLIST_MIGRACION_REACT_2026-09-10.md`](../checklists/CHECKLIST_MIGRACION_REACT_2026-09-10.md)

**Rama:** `feat/react-frontend-migration`

Supersede el plan de `origin/cursor/plan-react-migration-1943` (`PLAN_MIGRACION_REACT_2026-09-09.md`): mismo enfoque strangler, cortes más pequeños y reglas Vercel filtradas a un SPA Vite.

---

## Assumptions (corregir ahora si no)

1. **Superficie:** SPA Vite + React 19 ya existente en `frontend/`. No es un rewrite a Next.js ni a un design system.
2. **Producto intacto:** mismos flujos, mismos IDs de DOM mientras vivan pytest/e2e que los usan, mismo CSS (`frontend/src/styles/style.css`).
3. **Backend fuera:** cero cambios de contrato `/api`. El front solo cambia *quién pinta* y *dónde vive el estado*.
4. **TypeScript fuera:** JS + JSDoc en módulos nuevos. Mezclar TS aquí duplica el coste.
5. **Una isla = un dueño:** o React pinta ese subárbol o `initApp` lo pinta. Nunca los dos. Si ambos escriben el mismo nodo, el corte no ha terminado.
6. **Stores por agregado**, no un Context en `#root`. Implementación: módulo + `useSyncExternalStore` (~50 líneas). No Zustand, Redux ni SWR.
7. **Stream fuera de `useState` por token:** buffer en ref + flush (`rAF` o N ms) al mensaje en curso.
8. **Tests:** isla nueva = Vitest. Pytest que hacen `assert "function foo" in js` se matan o se mueven en el mismo PR. Sin e2e salvo que se pida.
9. **FOUC:** el script inline de `localStorage` → `data-*` en `<head>` se queda; no es React.
10. **Sin StrictMode** hasta borrar `initApp` (el efecto de bootstrap se dispararía dos veces).

→ Si alguna es falsa, dilo antes de implementar.

---

## Objective

Terminar de extraer `frontend/src/app.js` (`initApp`, `el = {…}`, ~379 `getElementById`, ~72 `innerHTML`) a componentes React y módulos de aplicación, sin cambiar el comportamiento visible.

**Usuario:** el mismo de siempre. El éxito no es “usar React”; es que el DOM tenga un solo escritor y el legado desaparezca.

### User stories

- Como usuario, abro un hilo, envío, paro, ilustró, veo galería/cola, cambio reglas/params/perfiles — igual que hoy.
- Como desarrollador, un panel nuevo se toca en `frontend/src/ui/<isla>/`, no añadiendo closures a `initApp`.
- Como CI, los tests de UI describen comportamiento (render, click, estado), no la existencia de un nombre de función en un archivo de 9k líneas.

### Acceptance criteria (testables)

- [ ] No existe `frontend/src/app.js` ni `export function initApp`.
- [ ] `frontend/index.html` no duplica el árbol: `#root` vacío + script FOUC + módulo Vite.
- [ ] `App.jsx` (o los componentes que cuelga) es la única fuente de markup.
- [ ] Cada isla mergeada cumple la regla de frontera (abajo).
- [ ] Vitest cubre cada isla; pytest grep de esa isla está muerto o apunta al módulo extraído.
- [ ] `make frontend-test`, `make frontend-build` y `pytest tests/ -m "not e2e"` verdes.
- [ ] Flujos: nueva conversación, enviar/parar, txt2img, ilustrar, galería, cola, reglas, params, perfiles.

---

## Tech Stack

| Pieza | Versión / decisión |
|-------|-------------------|
| React / react-dom | ^19.1 (ya) |
| Bundler | Vite 7, plugin React |
| Tests UI | Vitest 3 + Testing Library + jsdom |
| Tests backend/contrato | pytest, **sin e2e** por defecto |
| Estado | stores por agregado + `useSyncExternalStore` |
| HTTP | `frontend/src/api/client.js` (`fetch` + `AbortController`) |
| Estilos | CSS actual; no Tailwind / CSS-in-JS |
| Iconos | SVG inline actuales; **no** `lucide-react` ni barrels |

No se añade: Next.js, SWR, Zustand, Redux, React Query, MUI, router (la app es una sola pantalla).

---

## Commands

```bash
make frontend-install
make frontend-dev          # Vite :5173, proxy /api → :8000
make frontend-test         # cd frontend && npm test   (vitest run)
make frontend-build        # emite app/static/
make test                  # pytest tests/ -m "not e2e"  (y vitest si está instalado)
```

Verificación de frontera de una isla (el id ya no lo pinta el legado):

```bash
rg -n 'getElementById\("ID_DEL_PANEL"\)' frontend/src/app.js
# debe ser 0 cuando el archivo aún exista; 0 absoluto cuando se borre
```

---

## Project Structure

```
frontend/
  index.html                 # solo shell: head FOUC + <div id="root">
  src/
    main.jsx                 # createRoot → <App />; sin initApp al acabar
    App.jsx                  # composición del shell (columnas)
    app.js                   # legado; se encoge hasta desaparecer
    api/
      client.js              # fetchJson, errores, abort
      conversations.js
      models.js
      images.js
      rules.js
      workspaceProfiles.js
    store/
      createStore.js         # factory subscribe/get/set + hook
      layout.js
      session.js
      history.js
      images.js
    ui/
      layout/                # chrome: tema, colapso, splitters, fuentes
      history/
      right/                 # tabs + accordion (contenedor)
      rules/
      gallery/
      queue/
      settings/
      imagesPanel/
      composer/
      sessionHeader/
      messages/
      profiles/
      debug/
    app/                     # lógica de aplicación, no UI
      sendMessage.js
      stream.js
    styles/style.css
    test/setup.js
```

**Prohibido:** `ui/index.js` u otros barrels (`export * from …`). Importar el archivo del componente.

---

## Code Style

Módulos nuevos: funciones puras + componentes de módulo (nunca definidos dentro de otro componente). Store mínimo:

```js
import { useSyncExternalStore } from "react";

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const get = () => state;
  const set = (patch) => {
    state = typeof patch === "function" ? patch(state) : { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  const useStore = (selector = (s) => s) =>
    useSyncExternalStore(subscribe, () => selector(get()), () => selector(get()));
  return { get, set, subscribe, useStore };
}
```

El componente se suscribe a **booleanos/primitivos derivados**, no al objeto entero del store (`rerender-derived-state`).

JSX: IDs y clases CSS actuales. Props explícitas; nada de componentes inline para “cerrar sobre theme”.

---

## Testing Strategy

| Nivel | Dónde | Qué cubre |
|-------|--------|-----------|
| Vitest componente | `frontend/src/ui/**/*.test.jsx` | Render, click, estados vacío/error/lista |
| Vitest store/api | `frontend/src/store/*.test.js`, `frontend/src/api/*.test.js` | set/get/subscribe; fetch mock 200/4xx/abort |
| Vitest frontera | junto a la isla | `app.js` no contiene `getElementById("id")` (mientras exista el archivo) |
| Pytest CSS | `tests/test_*` que leen `style.css` | Intactos: el CSS no se migra |
| Pytest grep `function foo` en `app.js` | los `test_*_ui.py` actuales | **Mueren en el PR de esa isla** o pasan a leer el módulo extraído |
| Pytest GET `/` buscando IDs | ~17 tests | Fase 0: pasan a Vitest o a leer `App.jsx`. TestClient **no ejecuta JS** |
| e2e | `pytest -m e2e` | Fuera de esta migración salvo petición |

`tests/test_react_frontend.py` hoy **congela el legado** (`initApp` en `main.jsx`, bundle `app.js`). Hay que ir relajándolo por fase; al final afirma lo contrario: no hay `initApp`.

---

## Boundaries

- **Always:** regla de frontera por isla; Vitest de la isla en el mismo PR; `make frontend-test` + `pytest tests/ -m "not e2e"`; IDs existentes; sin barrels; stream con buffer, no `setState` por chunk.
- **Ask first:** añadir dependencia npm; cambiar CSS de layout; StrictMode; code-splitting que altere `vite.config.js` de forma visible al usuario (lazy de galería/cola sí está previsto, confirmar si cambia TTI de forma rara); borrar un pytest grep sin equivalente Vitest.
- **Never:** pintar el mismo id desde React y desde `initApp`; Next.js / SWR / Redux / TS “de paso”; meter el stream en Context; un store global con 80 campos; extraer mensajes (fase 10) antes de sesión+settings+imágenes; e2e por defecto; rediseño visual.

---

## Regla de frontera (isla)

Un `id` es de React cuando se cumplen las tres:

1. Un componente lo renderiza.
2. `frontend/src/app.js` no contiene `getElementById("ese-id")` ni escribe `innerHTML` / `textContent` sobre ese nodo (si `app.js` ya no existe, esta cláusula está vacía).
3. Hay un Vitest que monta el componente.

Hasta entonces, React **no** pone estado que re-renderice ese subárbol. Puede existir el markup estático en `App.jsx` (como hoy) para que el legado haga bind.

---

## Success Criteria

- DoD de producto: ver Intent.
- DoD técnico: `initApp` ausente; markup único; stores por agregado; api client; Vitest por isla; build a `app/static/`.
- DoD de rendimiento (SPA, no Next):
  - Abrir galería/cola no está en el critical path del primer JS (lazy al primer toggle).
  - N chunks de stream ⇒ ≤ 1 render por frame del mensaje en curso.
  - Drag de splitters no hace `setState` por pixel (refs + CSS vars).

---

## Open Questions

1. ¿Un PR por isla (recomendado) o PRs más grandes (fase entera)? El plan asume **un PR por tarea M o por 2–3 XS/S**.
2. ¿Se puede relajar la conservación de IDs en islas ya cubiertas solo por Vitest? Por defecto **no** en esta migración.
3. ¿Code-splitting de galería/cola en la fase de esa isla o solo en la 12? Recomendado: **en la isla**, con host estático hasta el primer open.
