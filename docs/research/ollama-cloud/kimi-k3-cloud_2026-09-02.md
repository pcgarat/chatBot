Última modificación: 2026-09-02

# kimi-k3:cloud

Modelo cloud flagship de Moonshot AI — ~2.8T parámetros, multimodal nativo, 1M de contexto.

## Ficha técnica

| Campo | Valor |
|-------|-------|
| **Identificador Ollama** | `kimi-k3:cloud` |
| **Modelo remoto** | `kimi-k3` |
| **Arquitectura** | kimi-k3 (MoE + KDA + AttnRes) |
| **Parámetros totales** | ~2.81T |
| **Expertos activos** | 16 / 896 (LatentMoE) |
| **Cuantización cloud** | MXFP4 |
| **Contexto** | 1 048 576 tokens (1M) |
| **Embedding length** | 7168 |
| **Capacidades** | vision, thinking, completion, tools |
| **Licencia** | Kimi K3 License (open weights con condiciones) |

## Descripción

Kimi K3 es el modelo **más capaz** de Moonshot AI en open weights: primera familia open ~3T-class con Kimi Delta Attention (KDA), Attention Residuals y Stable LatentMoE. Multimodal nativo (texto, imagen, vídeo) y 1M de contexto para coding extremo, investigación y trabajo de conocimiento agéntico.

En Ollama Cloud es un modelo **premium**: requiere plan Pro/Max y consume **créditos extra** además de la cuota incluida.

## Fortalezas

- **Frontier open-source**: GPU kernels, compiladores, game dev, CAD, chip design (según Moonshot).
- **1M contexto** con arquitectura eficiente (~2.5× scaling vs K2).
- **Multimodal completo**: texto + imagen + vídeo en un solo modelo.
- **Knowledge work agéntico**: investigación profunda, dashboards, motion design.
- **Thinking + tools + vision**: stack completo para agentes autónomos.
- **Pesos abiertos** para investigación y despliegue propio (fuera de Ollama).

## Debilidades

- **Coste muy alto**: $3.00 input / $15.00 output por 1M tokens + créditos extra siempre.
- **No apto como driver diario** sin presupuesto explícito.
- **Nivel extra-high** de consumo de cuota Ollama.
- **Licencia Kimi K3**: más restrictiva que Apache/MIT — revisar antes de producto comercial.
- **Latencia**: modelo enorme; respuestas más lentas que Flash/31B.
- **Overkill** para chat simple, resúmenes o coding rutinario.

## Precio y nivel de uso

| Concepto | Valor |
|----------|-------|
| Input | $3.00 / 1M tokens |
| Input cacheado | $0.30 / 1M tokens |
| Output | $15.00 / 1M tokens |
| Nivel de uso | **Extra high** (nivel 4) |
| Requisito | Plan **Pro o Max** + créditos adicionales |

Ejemplo de coste: sesión intensiva 500K input + 100K output ≈ $1.50 + $1.50 = $3 solo en tokens, más cuota del plan.

## Parámetros de la API Ollama

| Parámetro | Soporte |
|-----------|---------|
| `think` | `true`/`false`, niveles `low`–`max` |
| `tools` | sí |
| `messages[].images` | sí (multimodal) |
| `format` | `"json"` |
| `stream` | recomendado (respuestas largas) |

### Opciones recomendadas

| Parámetro | Valor |
|-----------|-------|
| `temperature` | 0.2–0.5 (tareas serias) |
| `num_ctx` | 262144–1048576 según job |
| `num_predict` | -1 o alto para investigación |
| `top_p` | 0.9 |

### Ejemplo investigación larga

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "kimi-k3:cloud",
  "think": "max",
  "stream": true,
  "messages": [
    {"role": "system", "content": "Investigador experto. Cita fuentes y estructura en secciones."},
    {"role": "user", "content": "Analiza el estado del mercado de LLM open-source en 2026."}
  ],
  "options": {"temperature": 0.3, "num_ctx": 524288}
}'
```

## Configuraciones recomendadas

| Caso de uso | think | temperature | num_ctx |
|-------------|-------|-------------|---------|
| Investigación profunda | `max` | 0.3 | 524288–1048576 |
| Repo masivo + refactor | `high` | 0.2 | 1048576 |
| Análisis vídeo/imagen + informe | `high` | 0.4 | 262144 |
| Prototipo rápido | — | — | **Usar K2.6 o DeepSeek Flash** |

## Mejores usos

- Tareas **frontier puntuales** donde el coste se justifica (auditorías, arquitectura, investigación).
- Proyectos de ingeniería extremos (compiladores, kernels, EDA).
- Multimodal avanzado con vídeo + documentación masiva.
- Cuando K2.6 o DeepSeek V4 Flash no alcanzan calidad en evaluación A/B.
- Investigación académica con pesos abiertos K3.

## Cuándo NO usarlo

- Chat diario, roleplay, resúmenes cortos.
- Coding rutinario (preferir **DeepSeek V4 Flash** o **GLM-5.3-Flash**).
- Usuarios en plan Free de Ollama.
- Flujos con alto volumen de tokens de salida (output $15/M penaliza mucho).

## Integración en chatBot

- Reservar para modo “** máxima calidad**” explícito del usuario.
- Monitorizar `eval_count` / tokens en UI para evitar sorpresas de coste.
- No usar como modelo por defecto de conversación.
- Combinar con planner solo en tareas multi-hora justificadas.

## Referencias

- [kimi-k3:cloud — Ollama](https://ollama.com/library/kimi-k3:cloud)
- [Moonshot Kimi K3 announcement (readme Ollama)](https://ollama.com/library/kimi-k3:cloud)
- [Ollama pricing — kimi-k3](https://ollama.com/pricing)
- [Análisis coste Ollama Cloud (comunidad)](https://fernando-nog.netlify.app/how-ollama-cloud-pricing-works-plans-usage-levels-and-costs/)
