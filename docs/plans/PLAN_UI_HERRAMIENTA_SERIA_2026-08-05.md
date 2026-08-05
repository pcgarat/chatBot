Última modificación: 2026-08-05

# Plan: UI herramienta seria

**Spec:** [`docs/specs/SPEC_UI_HERRAMIENTA_SERIA_2026-08-05.md`](../specs/SPEC_UI_HERRAMIENTA_SERIA_2026-08-05.md)  
**Intent:** [`docs/intent/ui-herramienta-seria_2026-08-05.md`](../intent/ui-herramienta-seria_2026-08-05.md)  
**Checklist:** [`docs/checklists/UI_HERRAMIENTA_SERIA_CHECKLIST_2026-08-05.md`](../checklists/UI_HERRAMIENTA_SERIA_CHECKLIST_2026-08-05.md)

## Enfoque

Cortes verticales por zona visible: primero **tokens + tipografía** (toda la app hereda sin romper layout), luego **shell/columnas**, después **panel de conversación** (header → toolbar → composer + relocación de toggles/history), luego **panel derecho** (tabs → secciones por tab → Diagnóstico), cierre con alineación ligera del sidebar izquierdo y verificación.

No tocar backend. Preservar IDs de `app.js`.

## Grafo de dependencias

```
Tokens CSS (Source Sans 3 / Code Pro, azul-acero, light+dark)
        │
        ▼
Shell: bordes de columnas / superficies de panel
        │
        ├── Conversación: header + toolbar (ctx, history, font, auto-scroll)
        │         │
        │         └── Composer como bloque de panel
        │
        ├── Status bar: toggle modo oscuro
        │
        └── Panel derecho: tabs segmentados
                  │
                  ├── Reglas (secciones)
                  ├── Ajustes (densidad + Payload)
                  ├── Imágenes (secciones)
                  └── Footer Diagnóstico (debug ×2)
        │
        ▼
Sidebar izquierdo: solo tokens
        │
        ▼
Checkpoint: make test + smoke visual light/dark
```

## Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| `app.js` acoplado a estructura DOM (querySelector padres/hermanos) | Mover nodos con los mismos IDs; grep de selectores antes de cada zona; smoke tras cada corte |
| CSS monolítico (~3.4k líneas) | Nuevos tokens al inicio; overrides por bloque `.panel-*` / `.toolbar-*`; no reescribir todo de golpe |
| Regresión visual “SaaS” (Inter/índigo) | Checklist explícito: sin Inter, sin primary índigo |
| Status bar estrecha para dark toggle | Control compacto (icono o segmented pequeño); no duplicar label largo |
| E2E frágiles por selectores | No ejecutar e2e por defecto; si se piden, actualizar selectores |

## Orden de implementación

1. Tipografía + tokens light/dark (azul-acero, iconos semánticos)  
2. Delimitación visual de columnas / paneles  
3. Reestructurar panel conversación (header, toolbar, history, auto-scroll, composer)  
4. Mover modo oscuro a status bar  
5. Reestructurar panel derecho (tabs + secciones Reglas/Ajustes/Imágenes + Diagnóstico)  
6. Alinear sidebar izquierdo a tokens  
7. Checkpoint: `make test` + revisión visual

## Verificación global

```bash
make test
# o: pytest tests/ -m "not e2e"
```

Smoke manual: light/dark, enviar mensaje, tabs derecha, reglas, params, imágenes, debug windows, auto-scroll.
