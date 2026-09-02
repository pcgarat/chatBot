Última modificación: 2026-09-02

# glm-5.3-flash:cloud

Modelo cloud de Z.ai (智谱) en Ollama — MoE multimodal de alto rendimiento con coste Flash.

## Ficha técnica

| Campo | Valor |
|-------|-------|
| **Identificador Ollama** | `glm-5.3-flash:cloud` |
| **Modelo remoto** | `glm-5.3-flash` |
| **Arquitectura** | glm5_next (MoE) |
| **Parámetros totales** | ~321B |
| **Parámetros activos** | ~18B |
| **Cuantización** | FP8 |
| **Contexto** | 1 048 576 tokens (1M) |
| **Embedding length** | 4096 |
| **Capacidades** | completion, thinking, tools, vision |
| **Licencia** | MIT |
| **Hosting** | EE.UU. y Europa (zero data retention Ollama) |

## Descripción

GLM-5.3-Flash es el **primer modelo nativamente multimodal** de la serie GLM-5 de Z.ai. Con 320B parámetros totales y solo 18B activos, supera a GLM-5.2 en benchmarks y cargas reales a ~1/10 del coste, acercándose a Claude Opus 4.8 en coding y tareas agénticas.

Incorpora atención híbrida (linear + sparse con indexer) para reducir coste de KV cache en contextos de 1M tokens. Está entrenado en bucles visuales de coding: renderiza, inspecciona y corrige interfaces frontend, juegos y simulaciones 3D.

## Fortalezas

- **Relación calidad/precio excepcional**: $0.15 input / $0.50 output por 1M tokens.
- **Coding agéntico**: Terminal Bench 2.1 ~84.3, DeepSWE v1.1 ~63.4.
- **Contexto 1M**: repos completos y sesiones largas de agente.
- **Multimodal**: texto, imagen y vídeo; lectura directa de documentos/dashboards como imagen.
- **Thinking ajustable**: niveles `low`, `high`, `max` (razonamiento siempre activo).
- **Eficiencia MoE**: 18B activos vs 32B de GLM-4.5 con menos capas (45 vs 92).
- **Licencia MIT**: muy permisiva.

## Debilidades

- **Preview reciente**: menos historial de producción que GLM-5.2 o DeepSeek V4.
- **Thinking siempre encendido**: no se desactiva por completo; sube latencia y tokens de salida.
- **Dependencia de Ollama Cloud**: sin variante local comparable en tamaño.
- **Vision coding**: excelente en frontend/UI, pero no sustituye un modelo dedicado solo a backend de baja latencia en todos los casos.

## Precio y nivel de uso

| Concepto | Valor |
|----------|-------|
| Input | $0.15 / 1M tokens |
| Input cacheado | $0.03 / 1M tokens |
| Output | $0.50 / 1M tokens |
| Nivel de uso estimado | **Medio-bajo** (Flash MoE eficiente) |

## Parámetros de la API Ollama

### Campos request

| Parámetro | Valores | Notas |
|-----------|---------|-------|
| `think` | `low`, `medium`, `high`, `max`, `true`/`false` | Razonamiento siempre activo; `low`/`high`/`max` ajustan esfuerzo |
| `tools` | array | Function calling nativo |
| `messages[].images` | base64[] | Entrada multimodal |
| `format` | `"json"` | Salida estructurada |
| `stream` | bool | Recomendado `true` en UI |

### Opciones recomendadas por Z.ai / Ollama

Para modelos GLM en general (ajustar según tarea):

| Parámetro | Valor sugerido |
|-----------|----------------|
| `temperature` | 0.6–0.8 (coding: 0.2–0.5) |
| `top_p` | 0.9–0.95 |
| `top_k` | 40 |
| `num_ctx` | 65536–1048576 según sesión |
| `num_predict` | -1 o límite alto para agentes |

### Ejemplo con thinking

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "glm-5.3-flash:cloud",
  "think": "high",
  "stream": false,
  "messages": [
    {"role": "user", "content": "Refactoriza este módulo Python siguiendo SOLID."}
  ],
  "options": {"temperature": 0.3, "num_ctx": 131072}
}'
```

## Configuraciones recomendadas

| Caso de uso | think | temperature | num_ctx |
|-------------|-------|-------------|---------|
| Coding rápido / autocompletado | `low` | 0.2–0.4 | 32768 |
| Agente de repo completo | `high` | 0.3 | 524288–1048576 |
| Frontend + captura UI | `high` | 0.4 | 65536 |
| Razonamiento difícil | `max` | 0.2 | 131072 |
| Chat creativo | `low` | 0.8 | 16384 |

## Mejores usos

- **Desarrollo diario con agentes** (Claude Code, OpenCode, etc.) cuando buscas Opus-like a coste Flash.
- Proyectos full-stack con **feedback visual** (render → inspección → corrección).
- Análisis de documentos, hojas de cálculo y dashboards vía imagen.
- Tareas de largo horizonte con contexto de 1M.
- Alternativa económica a GLM-5.2 para la mayoría de coding interactivo.

## Integración en chatBot

- Ideal como **modelo principal de coding** en conversaciones con tools.
- Activar streaming para mostrar `message.thinking` separado del contenido final.
- Para ilustraciones Forge: combinar con `vision` si envías imágenes de referencia en mensajes.
- Considerar preset en `config/ollama.json` con `num_ctx` max 1048576.

## Referencias

- [glm-5.3-flash:cloud — Ollama](https://ollama.com/library/glm-5.3-flash:cloud)
- [Blog Z.ai: GLM-5.3-Flash](https://ollama.com/library/glm-5.3-flash:cloud) (enlace en readme del modelo)
- [Ollama thinking capability](https://docs.ollama.com/capabilities/thinking)
- [Ollama pricing](https://ollama.com/pricing)
