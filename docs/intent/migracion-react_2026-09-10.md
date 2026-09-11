Última modificación: 2026-09-10

# Intent: acabar la migración del front a React

## Outcome

Que la UI deje de ser un controlador imperativo (`initApp` ~9.200 líneas) montado *después* de React, y pase a ser un SPA React de verdad: componentes + stores por agregado + cliente HTTP. Misma apariencia, mismos IDs, mismo backend.

## User

Quien usa el chat a diario. El cambio no se tiene que notar en producto; se tiene que notar en que ya no pelean dos pintores por el mismo DOM.

## Why now

PR #57 dejó toolchain + shell. React pinta el árbol y se aparta. Eso no es una app React: es HTML en JSX con el legado igual de dueño. Cada feature nueva en `app.js` encarece el corte.

## Success

`frontend/src/app.js` no existe. Un solo markup. Cada panel es un componente con Vitest de comportamiento. Enviar, parar, ilustrar, galería, cola, reglas, params y perfiles funcionan como hoy.

## Constraint

- Sin rediseño visual ni reescritura de CSS.
- Sin TypeScript en esta migración.
- Sin Next.js, SWR, Redux ni librería de iconos.
- Sin cambiar contratos `/api`.
- Islas (strangler): un panel usable tras cada corte.
- No extraer el chat (stream/mensajes) hasta que existan stores de sesión, settings e imágenes.

## Out of scope

- Backend, providers, Forge, planner server-side.
- Migración a TypeScript.
- Design system / Tailwind / component library.
- StrictMode mientras quede legado.
- Tests e2e salvo petición explícita.
