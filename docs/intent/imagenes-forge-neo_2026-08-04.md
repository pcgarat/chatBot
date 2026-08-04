Última modificación: 2026-08-04

# Intent: Ilustración de relatos con Forge Neo

## Outcome

Con la pestaña **Imágenes** activa, tras la respuesta del chat un LLM (elegido en el panel) decide si es relato/roleplay; si sí, define N prompts de escena + anclas de inserción **sin reescribir el texto**; se generan vía Forge Neo con **ReplayLastGeneration** (máximo de parámetros del último gen; solo cambia el prompt; modo txt2img/img2img = el que usaste en Forge); las imágenes aparecen en placeholders dentro de la respuesta.

## User

Uso local: chatBot + Forge Neo en Docker (`docker-neo` → puerto 7860).

## Why now

Ilustrar relatos/roleplay con el estilo afinado en la UI de Forge, sin exponer controles SD en el chatBot.

## Success

- Relato legible de inmediato.
- Placeholders/spinners donde irán las imágenes; se sustituyen al llegar.
- Fallo parcial: placeholder de error; el resto continúa.
- Reintentos (N configurable) **después** del primer pase completo del lote.
- Debug del generador de imágenes con log en ventana (análogo al debug del chat).

## Constraint

Panel v1: activar, imágenes por respuesta, modelo LLM de prompts, reintentos, debug. Forge en `:7860`. Sin UI de params SD en el chatBot. El chatBot no elige txt2img vs img2img.

## Out of scope

- Controles SD en el panel.
- Detección de género fuera del LLM de prompts.
- Inserción en vivo durante el stream del chat.
- Reescribir el relato.
- Forzar un preset/modo distinto del último gen de Forge.
- Recuperar init images originales de la sesión Gradio (no expuestas por API).

## Confirmado

2026-08-04 — sí explícito del usuario tras entrevista (`interview-me`).
2026-08-04 — ReplayLastGeneration (máx. params; modo = último gen) aceptado como dirección.
