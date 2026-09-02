Última modificación: 2026-09-02

# gpt-oss:120b-cloud

Modelo open-weight de OpenAI servido vía Ollama Cloud — razonamiento, agentes y desarrollo.

## Ficha técnica

| Campo | Valor |
|-------|-------|
| **Identificador Ollama** | `gpt-oss:120b-cloud` |
| **Modelo remoto** | `gpt-oss:120b` |
| **Arquitectura** | gptoss (MoE) |
| **Parámetros** | ~117B (~120B nominales) |
| **Cuantización** | MXFP4 (MoE weights ~4.25 bits/param) |
| **Contexto** | 131 072 tokens (128K) |
| **Embedding length** | 2880 |
| **Capacidades** | completion, tools, thinking |
| **Licencia** | Apache 2.0 |

## Descripción

GPT-OSS 120B es el modelo grande de la familia **open-weight** de OpenAI en Ollama. Diseñado para razonamiento potente, tareas agénticas y casos de uso de desarrollador: function calling, structured outputs, chain-of-thought completo y esfuerzo de razonamiento configurable.

La variante local 120B cabe en una GPU de 80GB gracias a MXFP4; en cloud no necesitas hardware local.

## Fortalezas

- **Razonamiento configurable**: `think`: `low`, `medium`, `high` (no booleano estándar).
- **Chain-of-thought completo**: traza de pensamiento auditable en `message.thinking`.
- **Agentic nativo**: tools, JSON, búsqueda web opcional en ecosistema Ollama.
- **Muy económico en cloud**: $0.15 / $0.60 por 1M tokens input/output.
- **Nivel de uso light**: amigable incluso con plan gratuito de Ollama Cloud.
- **Apache 2.0**: fine-tuning y despliegue comercial permitidos.
- **Hermano local 20B**: mismo stack para desarrollo local + cloud 120B para producción.

## Debilidades

- **Sin visión**: no procesa imágenes en Ollama.
- **Contexto 128K**: inferior a modelos de 1M (DeepSeek V4 Flash, GLM-5.x, Kimi K3).
- **Thinking no desactivable**: GPT-OSS ignora `think: false`; solo niveles low/medium/high.
- **Modelo de razonamiento**: mayor latencia y más tokens de salida que un chat “directo”.
- **Menor escala que frontier closed-source** en benchmarks extremos (HLE, Apex).

## Precio y nivel de uso

| Concepto | Valor |
|----------|-------|
| Input | $0.15 / 1M tokens |
| Input cacheado | $0.014 / 1M tokens |
| Output | $0.60 / 1M tokens |
| Nivel de uso estimado | **Light** (nivel 1) |

## Parámetros de la API Ollama

### Parámetro thinking (específico GPT-OSS)

| Valor `think` | Efecto |
|---------------|--------|
| `low` | Menor latencia, razonamiento breve |
| `medium` | Equilibrio (equivalente aproximado a `think: true` en otros modelos) |
| `high` | Máximo esfuerzo de razonamiento |
| `true` / `false` | **Ignorado** por GPT-OSS — usar niveles |

En endpoint OpenAI-compatible (`/v1/chat/completions`): usar `reasoning_effort`: `low` \| `medium` \| `high` \| `none` (no confundir con `think`).

### Opciones de generación

| Parámetro | Recomendación GPT-OSS |
|-----------|----------------------|
| `temperature` | 0.2–0.7 según tarea |
| `top_p` | 0.9–1.0 |
| `num_ctx` | hasta 131072 |
| `num_predict` | -1 o límite alto en tareas de razonamiento |
| `format` | `"json"` para salidas estructuradas |
| `tools` | function calling |

### Ejemplo

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "gpt-oss:120b-cloud",
  "think": "medium",
  "stream": true,
  "messages": [
    {"role": "system", "content": "Reasoning: medium. Responde en español."},
    {"role": "user", "content": "Diseña el esquema de una API REST para usuarios."}
  ],
  "options": {"temperature": 0.4, "num_ctx": 65536}
}'
```

También puedes fijar esfuerzo vía system prompt según documentación OpenAI para gpt-oss.

## Configuraciones recomendadas

| Caso de uso | think | temperature | num_ctx |
|-------------|-------|-------------|---------|
| Respuestas rápidas FAQ | `low` | 0.3 | 8192 |
| Análisis / arquitectura | `medium` | 0.4 | 32768 |
| Problemas complejos multi-paso | `high` | 0.2 | 65536–131072 |
| Agentes con tools | `medium`–`high` | 0.3 | 32768 |
| JSON estructurado | `low` | 0.1 | 16384 |

## Mejores usos

- Razonamiento con **traza auditable** (debug de agentes, educación).
- Prototipado agéntico con tools sin coste frontier.
- Desarrollo cuando quieres **paridad conceptual** con modelos o-series de OpenAI pero open-weight.
- Workflows con presupuesto ajustado (plan Free/Pro de Ollama).
- Fine-tuning posterior (pesos Apache 2.0).

## Integración en chatBot

- Mostrar u ocultar `thinking` en la UI según preferencia del usuario (`--hidethinking` en CLI).
- No usar para flujos multimodales de imagen; combinar con otro modelo vision si hace falta.
- Preset recomendado: `temperature` 1.0 si replicas defaults OpenAI locales; en cloud suele ir mejor 0.4–0.7.
- Hermano local en proyecto: variantes abliterated en `config/ollama.json`.

## Referencias

- [gpt-oss:120b-cloud — Ollama](https://ollama.com/library/gpt-oss:120b-cloud)
- [OpenAI: Introducing gpt-oss](https://openai.com/index/introducing-gpt-oss/)
- [Ollama thinking docs](https://docs.ollama.com/capabilities/thinking)
- [Ollama pricing](https://ollama.com/pricing)
