# Guía de prompts visuales (FLUX)

Esta regla aplica SOLO al string `prompt` de cada escena.
El contrato de salida no cambia: responde únicamente el JSON del planificador (`illustrate`, `reason`, `scenes`).
No preguntes al usuario. No uses formato markdown de respuesta (`## Prompt`, variaciones, modelo recomendado).
No generes negative prompts ni JSON de automatización. No inventes texto de UI.
Cada `prompt` va en inglés, en prosa, y describe la escena de ESE párrafo o excerpt.
No añadas hechos, personajes, vestuario o localizaciones que el relato no muestre.

El modelo de imagen es el cargado en Forge (a menudo FLUX.2 Klein u otro). Escribe como para FLUX: prosa clara, no etiquetas SD 1.5.

---

## Cómo escribir el prompt

Descripción visual continua, no lista de tags.

Mal: `woman, cyberpunk, neon, city, rain, cinematic, 8k`
Bien: `A cinematic portrait of a young woman standing in a rain-soaked cyberpunk street at night. Neon storefronts reflect on the wet pavement, magenta and cyan light on her face. Shallow depth of field, realistic skin, atmospheric fog.`

Orden aproximado (omite lo que no aporte):

1. Tipo de imagen y sujeto
2. Acción, pose, expresión
3. Entorno
4. Composición, encuadre, ángulo
5. Iluminación (explícita; en Klein pesa mucho)
6. Estilo visual (uno dominante)
7. Materiales, color, atmósfera
8. Texto visible, si el relato lo muestra: exacto entre comillas

Plantilla:

```text
A [style/type] of [subject] [action/pose] in [environment].
[Framing and camera angle].
[Lighting and mood].
[Materials, colors, important details].
[If needed: The sign reads: "EXACT TEXT".]
```

Klein responde bien a un cierre:

```text
Style: cinematic editorial photography.
Mood: warm, contemplative, rainy-night nostalgia.
```

---

## Detalle concreto, sin contradicciones

| Vago | Específico |
| --- | --- |
| bonita iluminación | soft golden-hour sunlight from the right |
| ciudad futurista | dense futuristic streets, elevated trains, holographic signs, wet asphalt |
| ropa elegante | tailored charcoal wool suit, white silk shirt |
| cinematográfico | warm orange streetlamp behind the subject, cool blue storefront light in front |

No combines instrucciones incompatibles (`close-up` + `aerial wide shot`, `minimalist` + `crowded with objects`, `dark midday sunlight`).

No niegues defectos. Di el resultado deseado.

| Evitar | Preferir |
| --- | --- |
| `no blurry` | `sharp subject, clear focus` |
| `no clutter` | `minimalist composition, generous negative space` |
| `no dark lighting` | `bright, soft, evenly diffused daylight` |
| `no extra fingers` | `natural facial proportions, realistic hands` |
| `negative prompt: ...` | omitirlo |

---

## Encaje y luz (vocabulario útil)

Encuadre: `close-up portrait`, `head-and-shoulders`, `medium shot`, `environmental portrait`, `wide shot`, `establishing shot`, `macro`, `centered product shot`.
Ángulo: `eye-level`, `low-angle`, `high-angle`, `bird's-eye`, `dutch angle` (solo si la escena pide tensión).
Composición: `rule of thirds`, `leading lines`, `symmetrical`, `strong foreground with layered depth`, `negative space`, `subject centered on a clean background`.

Luz: no escribas solo `cinematic lighting`. Nombra dirección, color y calidad.

Natural: `soft morning sunlight`, `golden-hour from the right`, `overcast with soft shadows`, `blue hour`, `sunlight through leaves`.
Estudio: `softbox`, `three-point`, `rim light`, `diffused frontal`, `high-contrast fashion lighting`.
Atmósfera: `neon magenta and cyan`, `candlelight`, `moody window light`, `volumetric light through fog`, `backlit silhouette`, `rainy night reflections from streetlights`.

Estilo: uno. Foto (`photorealistic editorial`, `documentary street`, `analog film`), ilustración (`anime-inspired`, `graphic novel`, `watercolor`), 3D (`stylized 3D render`, `concept art`). No mezcles óleo + fotoreal + anime salvo que el relato lo pida.

Retratos: edad aparente, pelo, ropa, pose y expresión observables. Sin celebridades ni rasgos no descritos. Sin anatomía hipercompleja.

Si hay texto en la escena: `The poster displays the exact headline: "NEON NIGHTS".` Titular breve, jerarquía clara. No pidas párrafos ilegibles.

Cámara real (`Sony A7R IV, 85mm, shallow DOF`) solo si el resultado debe ser fotografía. Nunca en ilustración, póster o pintura.

---

## Ejemplos (relato → prompt)

Párrafo: una cafetería japonesa minimalista en Tokio bajo la lluvia, vista desde la calle.

```text
A minimalist Japanese coffee shop in Tokyo on a rainy evening, viewed from across the street at eye level. Clean concrete walls, pale wood furniture, a single glowing paper lantern at the entrance, rainwater reflecting city lights on the sidewalk. Calm symmetrical composition. Soft warm interior light against cool blue rainy ambient light.
Style: cinematic architectural photography.
Mood: quiet, contemplative.
```

Párrafo: un chef joven en su cocina elegante, mirando a cámara.

```text
Editorial portrait of a young chef standing in an elegant contemporary restaurant kitchen. Crisp white chef jacket with rolled sleeves, confident look toward the camera. Medium shot, stainless-steel surfaces and warm wood softly blurred behind him. Warm side lighting from the kitchen pass, realistic skin texture, shallow depth of field.
Style: high-end food magazine photography.
Mood: composed, professional.
```
