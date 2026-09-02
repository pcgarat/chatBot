Última modificación: 2026-09-02

# mistral-large-3:675b-cloud

Modelo cloud de [Ollama](https://docs.ollama.com/cloud) — inferencia remota en `https://ollama.com`, sin GPU local.

## Ficha técnica (instalación local)

| Campo | Valor |
|-------|-------|
| **Identificador Ollama** | `mistral-large-3:675b-cloud` |
| **Modelo remoto** | `mistral-large-3:675b` |
| **Arquitectura** | mistral3 (MoE multimodal) |
| **Parámetros totales** | ~675B |
| **Cuantización** | FP8 |
| **Contexto** | 262 144 tokens (~256K) |
| **Embedding length** | 7168 |
| **Capacidades** | completion, tools, vision |
| **Licencia** | Apache 2.0 |
| **Autor** | Mistral AI |

## Descripción

Mistral Large 3 es un modelo **multimodal Mixture-of-Experts (MoE)** de propósito general orientado a cargas de producción y entorno empresarial. Combina texto e imagen, soporte multilingüe amplio y capacidades agénticas nativas (function calling, salida JSON).

Es la alternativa recomendada por Ollama para sustituir modelos retirados como `devstral-2:123b` (retiro previsto julio 2026).

## Fortalezas

- **Multimodal nativo**: análisis de imágenes junto con texto.
- **Multilingüe**: inglés, francés, español, alemán, italiano, portugués, holandés, chino, japonés, coreano, árabe, entre otros.
- **Adherencia al system prompt**: comportamiento estable con instrucciones de sistema bien definidas.
- **Agentic / tools**: function calling y JSON estructurado de forma nativa.
- **Contexto largo**: 256K tokens, útil para documentos extensos y historiales largos.
- **Licencia permisiva**: Apache 2.0, apta para uso comercial.
- **Precio cloud moderado**: $0.50 / $1.50 por millón de tokens (input/output).

## Debilidades

- **Sin modo thinking explícito** en Ollama (no aparece en capacidades); el razonamiento es implícito, no separado en traza.
- **Modelo muy grande (675B)**: nivel de consumo de cuota cloud elevado frente a variantes Flash.
- **No es el más barato** para uso masivo diario frente a `deepseek-v4-flash` o `glm-5.3-flash`.
- **Preview/enterprise focus**: menos orientado a edge o latencia mínima que modelos Flash de Z.ai o DeepSeek.

## Precio y nivel de uso (Ollama Cloud)

| Concepto | Valor |
|----------|-------|
| Input | $0.50 / 1M tokens |
| Input cacheado | $0.50 / 1M tokens |
| Output | $1.50 / 1M tokens |
| Nivel de uso estimado | **Alto** (modelo frontier MoE) |

Requiere cuenta en [ollama.com](https://ollama.com) (`ollama signin`).

## Parámetros de la API Ollama

### Campos de nivel request (`/api/chat`)

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `model` | string | `mistral-large-3:675b-cloud` |
| `messages` | array | Roles: `system`, `user`, `assistant` |
| `stream` | bool | Streaming SSE (default `true`) |
| `format` | `"json"` \| schema | Salida estructurada |
| `tools` | array | Definiciones para function calling |
| `images` | base64[] | En mensajes multimodales (campo `images` del mensaje) |
| `think` | — | **No soportado** (modelo sin capacidad thinking en Ollama) |
| `keep_alive` | string \| number | Duración en memoria (cloud: gestionado remotamente) |

### Opciones de generación (`options`)

| Parámetro | Default Ollama | Rango típico | Notas |
|-----------|----------------|--------------|-------|
| `temperature` | 0.8 | 0–2 | Creatividad vs determinismo |
| `top_p` | 0.9 | 0–1 | Nucleus sampling |
| `top_k` | 40 | 0–100 | Candidatos por paso |
| `min_p` | 0.0 | 0–1 | Umbral mínimo de probabilidad |
| `num_predict` | 128 | -1, -2, N | Máx. tokens de salida; `-1` = sin límite explícito |
| `num_ctx` | 2048 | hasta 262144 | Ventana de contexto activa |
| `seed` | 0 | entero | Reproducibilidad (best effort) |
| `stop` | [] | string[] | Secuencias de parada |
| `repeat_penalty` | 1.1 | 1–2 | Penalización de repetición |
| `repeat_last_n` | 64 | 0–512 | Ventana para repeat_penalty |

### Ejemplo cURL

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "mistral-large-3:675b-cloud",
  "stream": false,
  "messages": [
    {"role": "system", "content": "Responde en español de forma concisa."},
    {"role": "user", "content": "Resume este contrato en 5 puntos."}
  ],
  "options": {
    "temperature": 0.3,
    "num_ctx": 131072,
    "num_predict": 2048
  }
}'
```

## Configuraciones recomendadas

| Caso de uso | temperature | top_p | top_k | num_ctx | think |
|-------------|-------------|-------|-------|---------|-------|
| Chat enterprise / soporte | 0.2–0.4 | 0.9 | 40 | 32768–131072 | — |
| Análisis de documentos + imagen | 0.3 | 0.95 | 40 | 131072–262144 | — |
| Agentes con tools | 0.2–0.5 | 0.9 | 40 | 65536+ | — |
| Creatividad / redacción | 0.7–0.9 | 0.95 | 50 | 16384 | — |

## Mejores usos

- Asistentes empresariales multilingües con documentos largos.
- Pipelines agénticos con **function calling** y salida JSON.
- Análisis multimodal (capturas, diagramas, facturas escaneadas).
- Sustituto de modelos Devstral/Mistral anteriores en tareas de código y productividad.
- Workflows donde la **adherencia al system prompt** es crítica.

## Integración en este proyecto (chatBot)

- Proveedor: `ollama` con `model_id`: `mistral-large-3:675b-cloud`.
- Parámetros UI: defaults de `config/provider_params.json` (ollama); no hay preset específico en `config/ollama.json` — conviene añadir uno con `num_ctx` hasta 262144.
- Capacidades útiles: **tools**, **vision** (ilustraciones, análisis de imagen si el frontend envía imágenes).
- Historial: respetar `OLLAMA_HISTORY_TURNS`; con 256K de contexto puedes subir el historial sin truncar tan pronto.

## Referencias

- [mistral-large-3:675b-cloud — Ollama Library](https://ollama.com/library/mistral-large-3:675b-cloud)
- [Ollama Cloud docs](https://docs.ollama.com/cloud)
- [Ollama pricing](https://ollama.com/pricing)
- [Retiros de modelos cloud](https://docs.ollama.com/cloud#retirements)
