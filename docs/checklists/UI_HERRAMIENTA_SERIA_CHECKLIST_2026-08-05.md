Última modificación: 2026-08-05 (status bar dark: navy Win11 #0a1830)

# Checklist: UI herramienta seria

**Objetivo:** Reestructurar panel de conversación + lateral derecho; sistema visual Source Sans 3 / azul-acero; dark+light; toggles por alcance; sensación de herramienta de escritorio.

**Referencias:**

- Intent: [`docs/intent/ui-herramienta-seria_2026-08-05.md`](../intent/ui-herramienta-seria_2026-08-05.md)
- Spec: [`docs/specs/SPEC_UI_HERRAMIENTA_SERIA_2026-08-05.md`](../specs/SPEC_UI_HERRAMIENTA_SERIA_2026-08-05.md)
- Plan: [`docs/plans/PLAN_UI_HERRAMIENTA_SERIA_2026-08-05.md`](../plans/PLAN_UI_HERRAMIENTA_SERIA_2026-08-05.md)

**Verificación habitual:** `make test` / `pytest tests/ -m "not e2e"`. E2E solo si se pide.

---

## 1. Tipografía y tokens

- [x] **1.1** Sustituir Inter por Source Sans 3 + Source Code Pro en `index.html` / CSS.
- [x] **1.2** Redefinir `:root` y `[data-theme="dark"]`: superficies, bordes, texto, accent azul-acero, success/warning/destructive, `--icon-*` semánticos.
- [x] **1.3** Eliminar primary índigo/púrpura como identidad; radios de panel ≤ 6px.
- [x] **1.4** Smoke: light y dark cargan tipografía y contraste legible.

**Verify:** apertura en navegador light/dark. ✅

---

## 2. Shell y columnas

- [x] **2.1** Bordes 1px / superficies distintas entre columna izq, centro y derecha.
- [x] **2.2** Reducir aire “SaaS” (gaps/padding excesivos) hacia densidad de herramienta.
- [x] **2.3** Status bar coherente con tokens (preparada para toggle dark).

**Verify:** las tres columnas se leen a simple vista. ✅

---

## 3. Panel de conversación

- [x] **3.1** Header: título/sesión separado de meta/estado/ctx y de acciones destructivas.
- [x] **3.1b** Header con superficie propia (`--chat-header-bg`), rail accent inset, título+meta en bloque de identidad; botón borrar con color danger siempre visible (chip).
- [x] **3.1c** Quitar proveedor/modelo/dot del header; Ctx fuera de la toolbar. Ambos a la derecha de la status bar (junto a Oscuro). Header meta solo fecha de sesión.
- [x] **3.1e** Eliminar `#session-created-label` / meta residual bajo el título (el «—» confuso). Ctx usado/disponible solo en status bar (badge + detalle + barra).
- [x] **3.1f** Zoom/colapso flotantes en esquina superior derecha del stream (`.chat-font-size-corner`): opacity baja en reposo, opacos en hover/focus-within.
- [x] **3.2** Toolbar de chat eliminada (controles reubicados).
- [x] **3.3** IDs preservados (`#history-turns-input`, `#btn-font-size-*`, `#btn-collapse-all-messages`).
- [x] **3.4** Composer como bloque con borde/superficie: instrucción | mensaje | acciones.
- [x] **3.5** Iconos con color semántico (enviar/accent, borrar/danger, etc.).

**Verify:** IDs preservados; smoke navegador. ✅

---

## 4. Modo oscuro → status bar

- [x] **4.1** Quitar toggle dark del footer derecho.
- [x] **4.2** Colocar control compacto en status bar (mismo `#dark-mode-toggle`).
- [x] **4.3** Persistir comportamiento actual (`localStorage` / `data-theme`).
- [x] **4.4** Cluster derecho status bar: modelo activo + Ctx + Auto-scroll + Oscuro.
- [x] **4.5** Paneles laterales en dark: paleta Windows 11 (bloom azul fuerte `#0078d4`/`#0063b1` + mica oscura + acento `#60cdff`), no modo claro.
- [x] **4.6** Panel central en dark: superficie blanca + tokens light (header título, mensajes mica acero Win11 `#c5daf0`/`#e4ebf3`, composer, controles flotantes).
- [x] **4.7** Composer: un solo `#btn-send` que pasa a stop (`is-stop`) mientras hay respuesta en curso; sin `#btn-cancel-message`.

**Verify:** toggle dark desde status bar. ✅

---

## 5. Panel derecho

- [x] **5.1** Tabs con subrayado primary (estilo herramienta).
- [x] **5.2** Reglas: secciones Activas | Añadir existente | Crear nueva.
- [x] **5.3** Ajustes: Payload como sección propia.
- [x] **5.3b** Subacordeones de Ajustes colapsables: CSS con `>` (no descendente) para no forzar abiertos los paneles anidados.
- [x] **5.4** Imágenes: Activación | Planificador LLM | Límites | Prompt Forge.
- [x] **5.5** Footer derecho: Debug + Debug imágenes (sin título «Diagnóstico»; switches compactos).

**Verify:** pestañas + debug footer. ✅

---

## 6. Sidebar izquierdo (solo tokens)

- [x] **6.1** Alinear colores, bordes, tipografía y densidades al nuevo sistema.
- [x] **6.2** Sin reorganizar lista de conversaciones ni flujos.

**Verify:** lista de conversaciones intacta. ✅

---

## 7. Cierre

- [x] **7.1** Recorrer acceptance criteria de la spec (estructura + tokens + toggles).
- [x] **7.2** `make test` verde (277 passed, e2e excluidos).
- [x] **7.3** Actualizar este checklist al 100% y fecha de última modificación.

**Verify:** `make test` ✅
