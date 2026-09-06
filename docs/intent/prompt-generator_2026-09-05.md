Última modificación: 2026-09-05

# Intent: Prompt generator (entrevista → prompt FLUX)

## Outcome

Botón «txt2img» bajo «Nueva conversación» que abre un hilo especial (`prompt_generator`); un agente entrevista sobre la imagen, rellena un brief tipado según la guía FLUX y muestra el prompt en pantalla con botón de copiar. Se puede forzar la generación (botón + «genera ya») y seguir refinando en el mismo hilo. Fork habilitado; primer mensaje = template fijo.

## User

Tú, para redactar prompts de imagen sin pelearte con la plantilla a mano.

## Why now

Quieres un flujo guiado aparte del chat normal y del illustrate: entrevista + brief estructurado + prompt copiable.

## Success

En pocos turnos (o al forzar «genera ya») tienes un prompt en el idioma elegido, visible y copiable; los ajustes posteriores regeneran otra versión en el mismo hilo.

## Constraint

- Plantilla fija FLUX (secciones de la guía del repo).
- Conversación tipada en el listado (`prompt_generator`), no panel UI aparte.
- Estado tipado del brief (no solo historial de mensajes).
- Salida en pantalla + clipboard; sin enviar a Forge.
- Disparo: botón «Generar prompt» + detección de «genera ya» en el mensaje.
- Label sidebar: `txt2img`. Fork habilitado. Primer mensaje = template fijo (sin LLM).
- Illustrate / Imágenes / Forge: sin cambios de producto en v1 (no se dispara generación desde este flujo).

## Out of scope

- Integración con generación de imagen / Forge.
- Selector de guía Krea u otras.
- Panel UI aparte del listado de chats.

## Confirmado

2026-09-05 — sí explícito del usuario tras entrevista (`interview-me`).
