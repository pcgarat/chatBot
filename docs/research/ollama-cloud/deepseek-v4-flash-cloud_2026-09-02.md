Última modificación: 2026-09-02

# deepseek-v4-flash:cloud

Modelo cloud DeepSeek V4 Flash en Ollama — MoE eficiente con 1M de contexto y tres modos de thinking.

## Ficha técnica

| Campo | Valor |
|-------|-------|
| **Identificador Ollama** | `deepseek-v4-flash:cloud` |
| **Modelo remoto** | `deepseek-v4-flash:preview` |
| **Arquitectura** | deepseek4 (MoE) |
| **Parámetros totales** | ~284–304B (Ollama API: ~158B reportado en show local; readme: 284B total) |
| **Parámetros activados** | ~13B |
| **Cuantización** | FP8 |
| **Contexto** | 1 048 576 tokens (1M) |
| **Embedding length** | 4096 |
| **Capacidades** | completion, tools, thinking |
| **Estado** | Preview de la serie DeepSeek-V4 |

## Descripción

DeepSeek-V4-Flash es la variante **rápida y eficiente** de la serie V4 de DeepSeek: MoE con ~13B parámetros activos y ventana de 1M tokens, optimizada para razonamiento eficiente en producción. Es el **reemplazo oficial** de DeepSeek V3.1/V3.2 en Ollama Cloud (retiro julio 2026).

Ofrece tres modos de pensamiento: sin thinking (respuestas rápidas), thinking estándar y **max thinking** para problemas difíciles.

## Fortalezas

- **Mejor equilibrio coste/capacidad** en Ollama Cloud para coding diario (uso **medium**, nivel 2).
- **Contexto 1M** real con buenos resultados MRCR 1M (~76.9% en max thinking).
- **Coding excepcional con thinking**: LiveCodeBench hasta ~91.6 (max), SWE Verified ~79%.
- **Tres modos thinking**: flexibilidad latencia vs calidad.
- **Precio razonable**: $0.44 / $1.32 por 1M tokens.
- **Agentic**: Terminal Bench ~56.9%, MCPAtlas ~69%, BrowseComp ~73.2% (max).
- **Sin visión**: más simple y barato que multimodal frontier cuando no necesitas imágenes.

## Debilidades

- **Preview**: API y pesos pueden cambiar antes del release final V4.
- **Sin multimodal** en Ollama (solo texto).
- **SimpleQA más débil** en modo non-think (~23%) — activar thinking para hechos difíciles.
- **Por debajo de V4-Pro** en tareas extremas (Apex, HLE máximo).
- **Confusión de tamaño**: documentación menciona 284B total; `ollama show` local puede reportar cifras distintas según metadatos.

## Precio y nivel de uso

| Concepto | Valor |
|----------|-------|
| Input | $0.44 / 1M tokens |
| Input cacheado | $0.014 / 1M tokens |
| Output | $1.32 / 1M tokens |
| Nivel de uso estimado | **Medium** (nivel 2) — sweet spot Pro $20/mes |

## Parámetros de la API Ollama

### Modos thinking

| `think` | Modo DeepSeek V4 Flash | Uso |
|---------|------------------------|-----|
| `false` | Non-Think | Latencia baja, respuestas intuitivas |
| `true` / `medium` / `high` | Thinking | Análisis lógico cuidadoso |
| `max` | Max Thinking | Matemáticas, código hard, agentes largos |

### Opciones de generación

| Parámetro | Recomendación |
|-----------|---------------|
| `temperature` | 0.2–0.6 (coding); más alto solo en brainstorming |
| `top_p` | 0.9–0.95 |
| `num_ctx` | 65536–1048576 |
| `num_predict` | -1 en agentes; límite en UI conversacional |
| `tools` | function calling nativo |
| `format` | `"json"` |

### Ejemplo SWE / coding

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "deepseek-v4-flash:cloud",
  "think": "max",
  "stream": true,
  "messages": [
    {"role": "user", "content": "Encuentra el bug en este diff y propón fix."}
  ],
  "options": {
    "temperature": 0.2,
    "num_ctx": 262144
  }
}'
```

## Configuraciones recomendadas

| Caso de uso | think | temperature | num_ctx |
|-------------|-------|-------------|---------|
| Chat rápido / resúmenes | `false` | 0.5 | 16384 |
| Coding diario | `high` | 0.2–0.3 | 131072 |
| Repos enormes / 1M context | `high` | 0.2 | 524288–1048576 |
| Matemáticas / competición | `max` | 0.1 | 65536 |
| Agentes multi-step | `max` | 0.2 | 262144 |

## Benchmarks destacados (V4-Flash Max)

| Benchmark | Score aprox. |
|-----------|--------------|
| LiveCodeBench | 91.6 |
| SWE Verified | 79.0% |
| GPQA Diamond | 88.1% |
| HMMT 2026 | 94.8% |
| MRCR 1M | 78.7 MMR |

## Mejores usos

- **Modelo principal de coding** en Ollama Cloud (recomendación comunidad).
- Agentes de software con contexto de repo largo.
- Razonamiento STEM con control de coste vs V4-Pro.
- Sustituto directo de DeepSeek V3.x en este proyecto.
- Plan Pro Ollama: uso diario sostenido sin quemar cuota como modelos extra-high.

## Integración en chatBot

- Candidato ideal para conversaciones de **desarrollo y planner** sin visión.
- Toggle thinking en UI: `false` para mensajes casuales, `max` para tareas difíciles.
- Combinar con RAG Chroma para documentación + 1M de contexto nativo.
- Preset sugerido en `config/ollama.json`: `num_ctx` hasta 1048576, `temperature` 0.3.

## Referencias

- [deepseek-v4-flash:cloud — Ollama](https://ollama.com/library/deepseek-v4-flash:cloud)
- [DeepSeek-V4 paper/blog (en readme)](https://ollama.com/library/deepseek-v4-flash:cloud)
- [Ollama cloud retirements (v3 → v4)](https://docs.ollama.com/cloud#retirements)
- [Ollama pricing](https://ollama.com/pricing)
