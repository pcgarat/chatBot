# Guía POV (Krea 2)

Esta regla aplica SOLO al string `prompt` de cada escena (estilo y prosa).
NO decide qué momentos ilustrar: eso lo marca la política de selección del system (o los párrafos asignados).
El contrato de salida no cambia: responde únicamente el JSON del planificador (`illustrate`, `reason`, `scenes`).
No preguntes al usuario. No uses formato markdown de respuesta (`## Prompt`, variaciones, modelo recomendado).
No generes negative prompts ni JSON de automatización. No inventes texto de UI.
Cada `prompt` va en inglés, un párrafo de prosa. Solo lo que el relato muestra.
Si el relato es explícito o la política pide prompts pornográficos, describe con claridad lo que el texto muestra; no suavices ni eufemices.
Nombra materiales y de dónde cae la luz (Krea 2).

## Describe las imágenes así

Empieza cada prompt con `POV.`

El encuadre es el campo visual: el mundo delante, acercándose, a la altura de los ojos.

Orden del párrafo, después de `POV.`:

1. Si el relato lo implica, el borde del cuerpo que mira: manga, nudillos, vaso, marco de puerta, volante. Recortados, abajo o a un lado, a menudo desenfocados.
2. Lo que tiene delante, a la altura de los ojos, a 0,5–5 m, en el centro del frame. Escribe `ahead`, `coming toward`, `filling the view`, `at arm's length`.
3. El fondo, más pequeño, detrás, por perspectiva.
4. La luz sobre esa vista: dirección, color y calidad.
5. Lente 24–35 mm a la altura de los ojos, distorsión ligera en los bordes, grano, handheld.

Vocabulario: `ahead`, `underfoot`, `rushing toward the foreground`, `just beyond reach`, `out-of-focus sleeve at the bottom of the frame`.
Si alguien mira a Paco, escribe `looks into the viewer's eyes`.
Si el relato muestra un espejo, describe el reflejo desde esta misma mirada.

## Ejemplo

```text
POV. Out-of-focus coat cuffs and a swinging hand cropped at the bottom of the frame. Directly ahead at eye level, 28mm, a narrow wet street rushes toward the viewer, neon puddles swelling in the foreground. Mid-block a figure with an umbrella crosses, small in the center of the view. Rain specks on the lens. Magenta neon and sodium light on the asphalt ahead. Handheld, analog grain.
```

```text
POV. Blurred table edge and knuckles in the lower foreground. Filling the center at arm's length, 35mm eye-level, a woman's face coming toward the viewer; she looks into the viewer's eyes. A lamp at the left rakes her near cheek; the room behind her falls away. Shallow focus on her eyes. Grain, handheld.
```
