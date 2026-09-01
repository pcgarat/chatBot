# Guía de prompts POV (Krea 2)

Esta regla aplica SOLO al string `prompt` de cada escena.
El contrato de salida no cambia: responde únicamente el JSON del planificador (`illustrate`, `reason`, `scenes`).
No preguntes al usuario. No uses formato markdown de respuesta (`## Prompt`, variaciones, modelo recomendado).
No generes negative prompts ni JSON de automatización. No inventes texto de UI.
Cada `prompt` va en inglés, en un párrafo de prosa densa. No uses listas de tags tipo SD 1.5.
No añadas hechos, personajes, vestuario o localizaciones que el relato no muestre.

El modelo de imagen es Krea 2 (Large para fotoreal). Escribe como para Krea 2: lenguaje natural largo y concreto. Tres ejes que el modelo pesa mucho: medio fotográfico, cámara+luz, materialidad. Cuanto más específico, menos «look de IA» pulido.

---

## POV: la cámara son los ojos de Paco

Todas las imágenes son lo que Paco está viendo. Primera persona inmersiva. Nunca una foto DE Paco.

Obligatorio:

- Empieza el prompt con `First-person POV from Paco's eyes:`
- Describe el mundo DELANTE de él en ESE párrafo.
- Encuadre a la altura de los ojos, gran angular ligero, como su mirada.
- Manos, brazos, hombros o lo que sujete pueden entrar en primer plano SOLO si el relato lo implica (coger, tocar, empujar, caminar, mirar hacia abajo).
- Cara de Paco: prohibida, salvo espejo u objeto reflectante que el propio relato muestre.

Prohibido:

- Tercera persona: retrato, plano medio, cuerpo entero, Paco de espaldas como sujeto, cámara que le rodea o le sigue.
- `looking at the camera`, `portrait of Paco`, `cinematic shot of Paco`, `over-the-shoulder watching Paco`.
- Establishing shot aéreo, bird's-eye, wide shot externo, cobertura cinematográfica del personaje.

---

## Cómo escribir el prompt

Prosa visual continua. Lo más importante primero: el POV. Krea 2 rellena huecos con un promedio estético; hay que romperlo con detalles imperfectos y luz motivada.

Mal: `pov, cafe, cinematic, dramatic lighting, 8k, photoreal`
Bien: un párrafo que nombra lo que hay delante, el primer plano, la lente, de dónde viene la luz y de qué material es cada superficie.

Orden aproximado (omite lo que no aporte):

1. POV y lo que ve (el sujeto o espacio delante)
2. Primer plano / manos / objeto si el relato lo pone ahí
3. Entorno en capas, de cerca a lejos
4. Lente, encuadre, profundidad de campo
5. Iluminación: dirección, color, calidad, contraste
6. Materiales, clima, imperfectos reales
7. Estilo fotográfico (uno)
8. Texto visible, si el relato lo muestra: exacto entre comillas

Plantilla:

```text
First-person POV from Paco's eyes: [what he sees ahead]. [Optional: his hands or a held object in the lower foreground]. [Environment layered near to far]. Shot on a 28mm lens at eye level, slight wide-angle stretch at the edges, [shallow DOF or deep focus]. [Lighting: direction, color, quality, contrast]. [Materials, weather, imperfect real details]. Handheld documentary-cinematic still on fast analog film, visible grain, natural low dynamic range.
```

---

## Encuadre y composición

El drama está en la profundidad y en lo que invade el primer plano, no en sacar a Paco de su cuerpo.

Usar:

- Gran angular a la altura de los ojos: `28mm eye-level POV`, `24-35mm`, `slight wide-angle distortion`
- Primer plano pesado: marco de puerta, cristal, mano, vaso, volante, lluvia en el objetivo (`strong foreground with layered depth`)
- Líneas que empujan la mirada hacia lo que Paco mira (`leading lines` desde el suelo, un pasillo, una mesa)
- Manos en el tercio inferior; lo que importa, en el centro o al fondo
- `shallow depth of field` si mira a alguien o algo cerca; `deep focus` si recorre un espacio
- `dutch angle` solo si el relato pide amenaza o desequilibrio
- Presencia física: `rain on the lens`, `breath fog at the edges`, `handheld micro-shake`, viñeta suave

No combines instrucciones incompatibles (`extreme close-up` + `establishing wide of the same subject`, `creamy bokeh` + `deep focus`, `aerial` + `eye-level`).

---

## Iluminación

Nombra dirección, color y calidad. Contraste alto = drama. Suciedad de la luz = realismo. No escribas solo `cinematic lighting`.

| Vago | Específico |
| --- | --- |
| bonita iluminación | raking late-day sun from the right, long shadows on the floor ahead |
| oscuro | low-key interior, crushed blacks, a single motivated practical |
| dramático | hard key from a doorway on the left, deep falloff, hot rim on the person ahead |
| neon | magenta storefront spill on wet asphalt, cool cyan from a sign above |

Natural: `soft overcast with almost no shadow`, `golden-hour rake across the street ahead`, `blue hour through wet glass`, `sun shafts through dust in the room he is entering`.
Prácticos: `bare bulb overhead`, `candlelight on the table in the lower frame`, `car headlights blooming in rain`, `neon mixed with sodium streetlight`.
Dramático realista: `chiaroscuro from an open door`, `volumetric light through rain or smoke`, `window glare and mild lens flare`, `mixed color temperatures, tungsten near and cold far`.

No niegues defectos. Di el resultado deseado.

| Evitar | Preferir |
| --- | --- |
| `no blurry` | `tack-sharp focus on what he is looking at, slight handheld motion in the periphery` |
| `no dark lighting` | `a bright motivated key, readable midtones, deep but not empty shadows` |
| `no extra fingers` | `natural hands in the lower foreground, realistic proportions` |
| `negative prompt: ...` | omitirlo |

---

## Estilo y materialidad (Krea 2 Large)

Un estilo. Fotografía inmersiva. Krea 2 Large rinde grano, motion blur y rango dinámico sucio; pídeselo en positivo.

Preferir: `immersive first-person photography`, `handheld documentary-cinematic still`, `raw analog film`, `visible grain`, `natural low dynamic range`, `slight motion blur` si hay movimiento.

Materialidad: nombra la superficie (`wet asphalt`, `scuffed wood`, `fogged glass`, `wool sleeve`, `skin with pores and flyaway hair` en la persona de delante). Mete un imperfecto observable: charco irregular, bombilla que quema, vaho, polvo, una grieta.

Retratos: nunca de Paco. Si hay alguien delante, edad aparente, pelo, ropa, pose y expresión observables. Sin celebridades ni rasgos no descritos.

Si hay texto en la escena: `The sign reads: "EXACT TEXT".` Titular breve. No pidas párrafos ilegibles.

Cierre útil, tejido al final del párrafo (no como tags):

```text
Shot as a still from a handheld 28mm on fast analog film. Mood: tense, intimate, physically present.
```

---

## Ejemplos (relato → prompt)

Párrafo: Paco entra en una cafetería japonesa mínima, de noche y bajo la lluvia; ve el mostrador desde la puerta.

```text
First-person POV from Paco's eyes: a minimalist Japanese coffee shop interior opening ahead as he steps in from the rainy street. His wet coat sleeve and the edge of the glass door sit in the lower-left foreground. Pale wood counter, a single paper lantern glowing over the barista, empty stools receding in a quiet line. Shot on a 28mm lens at eye level, slight wide-angle stretch, sharp focus on the lantern and the person behind the counter, rain-beaded glass at the frame edge. Soft warm tungsten from the lantern against cool blue night through the windows, wet floor reflecting both. Handheld documentary-cinematic still on fast analog film, visible grain, natural low dynamic range. Mood: hushed, intimate, physically present.
```

Párrafo: cruza una calle estrecha de noche, lluvia, neón; avanza a pie.

```text
First-person POV from Paco's eyes walking a narrow rainy night street: wet asphalt stretching ahead, neon storefronts stacking into the distance, a figure with an umbrella crossing through a puddle of magenta light. His coat cuff and a hand at his side occupy the bottom of the frame. Shot on a 24mm lens at eye level, strong foreground with layered depth, rain hitting the lens, mild handheld shake. Mixed neon magenta and cyan bouncing off black water, a hard sodium streetlight further down the block, crushed blacks between the signs, volumetric rain in the beams. Handheld documentary-cinematic still, analog grain, low dynamic range, slight motion blur from the step. Mood: tense, nocturnal, immediate.
```

Párrafo: alguien le habla de cerca, a la luz de una sola lámpara; él la mira a la cara.

```text
First-person POV from Paco's eyes: a woman standing close in front of him in a dim room, speaking, her face filling the center of the frame. The lower foreground holds the blurred edge of a table and, if he is seated, his own knuckles resting on the wood. Medium-close, 35mm at eye level, shallow depth of field locked on her eyes, the room falling off behind her. A single warm practical lamp camera-left rakes across her cheek, the far side of her face in deep shadow, a faint rim from a distant window. Real skin texture, flyaway hair, no retouching. Handheld intimate still on fast film, visible grain. Mood: close, dramatic, physically present.
```
