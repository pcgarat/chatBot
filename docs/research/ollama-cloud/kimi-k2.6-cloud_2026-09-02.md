Última modificación: 2026-09-02

# kimi-k2.6:cloud

Modelo cloud Moonshot AI — multimodal agéntico open-source para coding de largo horizonte.

## Ficha técnica

| Campo | Valor |
|-------|-------|
| **Identificador Ollama** | `kimi-k2.6:cloud` |
| **Modelo remoto** | `kimi-k2.6` |
| **Arquitectura** | kimi-k2 (MoE) |
| **Parámetros totales** | ~1.04T |
| **Cuantización cloud** | INT4 |
| **Contexto** | 262 144 tokens (256K) |
| **Embedding length** | 2048 |
| **Capacidades** | vision, thinking, completion, tools |
| **Autor** | Moonshot AI |

## Descripción

Kimi K2.6 es un modelo **multimodal agéntico open-source** de Moonshot AI, sucesor de Kimi K2/K2.5 (retiro K2.5 previsto julio 2026). Avanza en coding de largo horizonte, diseño guiado por código, ejecución autónoma proactiva y orquestación tipo *swarm* (hasta 300 sub-agentes en documentación del fabricante).

En Ollama Cloud equilibra capacidad frontier con precio intermedio-alto.

## Fortalezas

- **Coding long-horizon**: generaliza en Rust, Go, Python, frontend, DevOps, optimización.
- **Coding-driven design**: prompts simples → interfaces production-ready con animaciones.
- **Multimodal nativo**: visión + texto para diseño y revisión visual.
- **Agent swarm** (según Moonshot): descomposición paralela de tareas complejas.
- **Thinking + tools**: cadena de razonamiento auditable.
- **Open weights** con licencia Moonshot (consultar Kimi license para restricciones comerciales).
- **Precio intermedio**: $0.95 / $4.00 por 1M tokens — más barato que K3.

## Debilidades

- **Contexto 256K** vs 1M de K3 o DeepSeek V4 Flash — limitante en monorepos gigantes.
- **1T parámetros INT4**: nivel de uso **high** — consume cuota más rápido que Flash.
- **Menor que K3** en frontier absoluto (K3 es el flagship Moonshot).
- **Swarm/orquestación**: capacidades máximas requieren harness externo, no solo chat plano.
- **Licencia**: no es Apache/MIT estándar — revisar Kimi K2 license antes de producto comercial.

## Precio y nivel de uso

| Concepto | Valor |
|----------|-------|
| Input | $0.95 / 1M tokens |
| Input cacheado | $0.16 / 1M tokens |
| Output | $4.00 / 1M tokens |
| Nivel de uso estimado | **High** (nivel 3) |
| Plan mínimo práctico | Pro ($20/mes) para uso moderado |

## Parámetros de la API Ollama

| Parámetro | Soporte |
|-----------|---------|
| `think` | `true`/`false`, `low`/`medium`/`high`/`max` |
| `tools` | function calling |
| `messages[].images` | entrada visual |
| `format` | `"json"` |
| `stream` | recomendado |

### Opciones típicas

| Parámetro | Valor sugerido |
|-----------|----------------|
| `temperature` | 0.3–0.7 (coding: 0.2–0.4) |
| `top_p` | 0.9 |
| `num_ctx` | hasta 262144 |
| `num_predict` | -1 para agentes |

### Ejemplo diseño UI + código

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "kimi-k2.6:cloud",
  "think": "high",
  "stream": false,
  "messages": [
    {"role": "user", "content": "Crea un dashboard React con dark mode a partir de este wireframe.", "images": ["<base64>"]}
  ],
  "options": {"temperature": 0.4, "num_ctx": 131072}
}'
```

## Configuraciones recomendadas

| Caso de uso | think | temperature | num_ctx |
|-------------|-------|-------------|---------|
| Iteración UI/UX + código | `high` | 0.4 | 65536 |
| Sesión coding larga | `high` | 0.3 | 131072–262144 |
| Agente autónomo | `max` | 0.2 | 262144 |
| Chat multimodal rápido | `low` | 0.6 | 32768 |

## Mejores usos

- Desarrollo **full-stack visual** (mockup → código → refinamiento).
- Proyectos multi-lenguaje de larga duración.
- Agentes que combinan **visión y terminal** (coding-driven design).
- Sustituto de Kimi K2.5/K2 en Ollama Cloud.
- Orquestación compleja cuando el harness soporta sub-agentes.

## Comparativa rápida con Kimi K3

| Aspecto | K2.6 | K3 |
|---------|------|-----|
| Parámetros | ~1.04T | ~2.81T |
| Contexto | 256K | 1M |
| Precio output | $4/M | $15/M |
| Extra credits | Incluido en plan | **Siempre extra** (Pro/Max) |
| Rol | Agente coding multimodal | Frontier absoluto Moonshot |

## Integración en chatBot

- Buen candidato para **ilustración + código** (vision + relatos interactivos).
- Existe preset legacy `kimi-k2.5:cloud` en `config/ollama.json` — migrar a K2.6.
- Mostrar thinking en streaming para sesiones largas de planner.
- `num_ctx` max 262144 en preset dedicado.

## Referencias

- [kimi-k2.6:cloud — Ollama](https://ollama.com/library/kimi-k2.6:cloud)
- [Retiro kimi-k2.5 → k2.6](https://docs.ollama.com/cloud#retirements)
- [Ollama pricing](https://ollama.com/pricing)
