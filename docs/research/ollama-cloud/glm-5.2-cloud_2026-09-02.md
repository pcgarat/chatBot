Última modificación: 2026-09-02

# glm-5.2:cloud

Modelo cloud flagship de Z.ai (智谱) — coding open-source de largo horizonte con contexto ~1M.

## Ficha técnica

| Campo | Valor |
|-------|-------|
| **Identificador Ollama** | `glm-5.2:cloud` |
| **Modelo remoto** | `glm-5.2` |
| **Arquitectura** | glm5.2 (MoE) |
| **Parámetros totales** | ~756B |
| **Contexto** | 1 048 576 tokens (1M usable según Z.ai; Ollama UI: ~976K) |
| **Embedding length** | 0 (no expuesto en metadatos locales) |
| **Capacidades** | thinking, completion, tools |
| **Licencia** | MIT |
| **Estado** | Flagship pre-Flash; superseded en parte por GLM-5.3-Flash |

## Descripción

GLM-5.2 es el modelo **flagship** de Z.ai para tareas de **largo horizonte**: contexto de 1M tokens entrenado específicamente en trayectorias de agentes de coding (implementación a escala, research automático, optimización, debugging complejo).

Es el **open-source más fuerte en coding estándar** según benchmarks Z.ai (Terminal-Bench 81.0, SWE-bench Pro 62.1), aunque GLM-5.3-Flash lo supera con ~10× menos coste en muchos escenarios.

Sustituye GLM-4.7/GLM-5 en la hoja de retiros Ollama (julio 2026).

## Fortalezas

- **1M contexto “usable”**: entrenado para agentes reales, no solo spec sheet.
- **Coding frontier open-source**: compite con Opus 4.7–4.8 en Terminal-Bench y SWE-Marathon.
- **Effort levels**: thinking **High** y **Max** para balance latencia/capacidad.
- **PostTrainBench #2** open (solo detrás de Opus 4.8 según Z.ai).
- **MIT license**: máxima libertad de uso.
- **Tools nativos** para agent harnesses.

## Debilidades

- **Sin visión** en Ollama (GLM-5.3-Flash añade multimodal).
- **Coste alto**: $1.40 / $4.40 por 1M tokens — ~10× GLM-5.3-Flash.
- **Nivel de uso high**: agota cuota Pro más rápido que DeepSeek Flash.
- **756B MoE**: latencia superior a Flash con 18B activos.
- **Parcialmente obsoleto** frente a GLM-5.3-Flash para la mayoría de casos nuevos.

## Precio y nivel de uso

| Concepto | Valor |
|----------|-------|
| Input | $1.40 / 1M tokens |
| Input cacheado | $0.26 / 1M tokens |
| Output | $4.40 / 1M tokens |
| Nivel de uso estimado | **High** (nivel 3) |

## Parámetros de la API Ollama

| Parámetro | Valores |
|-----------|---------|
| `think` | `true`/`false`, `low`, `medium`, `high`, **`max`** |
| `tools` | function calling |
| `format` | `"json"` |
| `stream` | recomendado |

### Effort levels (Z.ai)

| Nivel | Uso |
|-------|-----|
| `low` / `medium` | Iteración rápida |
| `high` | Coding agent estándar |
| `max` | Proyectos multi-hora, debugging profundo |

### Opciones de generación

| Parámetro | Recomendación |
|-----------|---------------|
| `temperature` | 0.2–0.5 (coding) |
| `top_p` | 0.9–0.95 |
| `num_ctx` | 131072–1048576 |
| `num_predict` | -1 en agentes |
| `repeat_penalty` | 1.0–1.1 |

### Ejemplo agente largo

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "glm-5.2:cloud",
  "think": "max",
  "stream": true,
  "messages": [
    {"role": "system", "content": "Eres un agente de ingeniería. Sigue el estilo del repo."},
    {"role": "user", "content": "Implementa el módulo de autenticación JWT completo."}
  ],
  "options": {"temperature": 0.25, "num_ctx": 524288}
}'
```

## Configuraciones recomendadas

| Caso de uso | think | temperature | num_ctx |
|-------------|-------|-------------|---------|
| Refactor repo completo | `max` | 0.2 | 1048576 |
| Terminal / DevOps agent | `high` | 0.3 | 262144 |
| Debugging complejo | `max` | 0.2 | 131072 |
| Chat general | `medium` | 0.6 | 32768 |
| **Nuevo proyecto** | — | — | **Preferir glm-5.3-flash:cloud** |

## Benchmarks destacados (GLM-5.2)

| Benchmark | Score |
|-----------|-------|
| Terminal-Bench 2.1 | 81.0 |
| SWE-bench Pro | 62.1 |
| FrontierSWE | ~1% detrás Opus 4.8 |
| SWE-Marathon | 2º solo detrás Opus |

## Mejores usos

- Sesiones de **ingeniería multi-hora** (compiladores, servicios production-grade).
- Cuando necesitas máximo coding open-source **sin multimodal**.
- Agentes con contexto de proyecto completo (1M).
- Comparación A/B vs GLM-5.3-Flash en tareas donde 5.2 aún gane.
- Migración desde GLM-4.7/GLM-5 cloud.

## GLM-5.2 vs GLM-5.3-Flash (decisión rápida)

| Criterio | GLM-5.2 | GLM-5.3-Flash |
|----------|---------|---------------|
| Coste | Alto | Muy bajo |
| Visión | No | Sí |
| Terminal-Bench | 81.0 | 84.3 |
| Activos MoE | — | 18B |
| Recomendación 2026 | Casos legacy / max quality sin vision | **Default Z.ai** |

## Integración en chatBot

- Candidato para **planner** y tareas de refactor masivo.
- Si el usuario elige GLM, preferir **5.3-Flash** salvo necesidad explícita de 5.2.
- Preset en `config/ollama.json` con `num_ctx` 1048576 recomendado.
- Activar `think: max` solo bajo demanda (coste tokens).

## Referencias

- [glm-5.2:cloud — Ollama](https://ollama.com/library/glm-5.2:cloud)
- [Retiro glm-4.7/glm-5 → glm-5.2](https://docs.ollama.com/cloud#retirements)
- [Ollama pricing](https://ollama.com/pricing)
- [GLM-5.3-Flash (sucesor multimodal)](https://ollama.com/library/glm-5.3-flash:cloud)
