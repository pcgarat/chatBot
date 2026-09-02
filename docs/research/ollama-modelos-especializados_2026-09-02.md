Última modificación: 2026-09-02

# Mejores modelos especializados en Ollama

Guía práctica (no catálogo exhaustivo): modelos **útiles por especialidad**, con foco en lo que aporta a un chatBot / RAG / coding / multimodal. Incluye cloud y local.

Fuentes: [Ollama Library](https://ollama.com/search), [cloud](https://ollama.com/search?c=cloud), fichas oficiales y los modelos ya instalados en este entorno.

---

## Criterio de selección

Priorizo:

1. **Especialización clara** (coding, embeddings, visión, reasoning…).
2. **Utilidad real** en 2026 (no modelos legacy solo por popularidad histórica).
3. **Coste / VRAM / cuota** razonables.
4. Encaje con este proyecto (RAG Chroma, planner, Forge, providers Ollama).

Si un modelo es “bueno en todo”, no es especialista: va al final como *generalista recomendado*.

---

## 1. Coding / agentes de software

| Modelo | Tipo | Por qué destaca | Cuándo usarlo | Evitar si… |
|--------|------|-----------------|---------------|------------|
| **`deepseek-v4-flash:cloud`** | Cloud MoE (~13B activos, 1M ctx) | Mejor balance calidad/coste para coding diario; modos think none/high/max | Driver principal de código y refactor | Necesitas visión |
| **`glm-5.3-flash:cloud`** | Cloud MoE multimodal (18B activos) | Coding + visión a coste Flash; cerca de Opus en agentic | Frontend, UI, agentes con captura de pantalla | Solo quieres máximo SWE sin mirar precio de tokens |
| **`kimi-k2.7-code:cloud`** | Cloud coding-focused (~1T) | Especialista Moonshot sobre K2.6: +SWE, −30% thinking tokens | Sesiones agentic largas (Claude Code / OpenCode) | Presupuesto ajustado (high usage, $4/M out) |
| **`glm-5.2:cloud` / `glm-5.3`** | Cloud flagship | Largo horizonte, contexto ~1M, MIT | Refactors multi-hora, monorepos | Uso diario: Flash suele bastar |
| **`qwen3-coder:30b`** | Local MoE (3.3B activos) | Mejor coding **local** agentic Qwen; 256K ctx | Laptop/GPU sin cloud | Necesitas frontier cloud |
| **`qwen3-coder:480b`** | Local/cloud-scale | Máximo Qwen coder | Servidor potente | VRAM insuficiente |
| **`qwen2.5-coder:7b`** | Local denso | Muy popular, ligero, FIM/tools; ya lo tienes | Autocomplete, scripts, low latency | Tareas agentic difíciles |
| **`warp-coder:latest`** | Local (basado en qwen2.5-coder 7B) | Tu variante local ya tuneada | Coding offline rápido | Calidad frontier |

### Recomendación crítica (coding)

- **Cloud diario:** `deepseek-v4-flash:cloud` o `glm-5.3-flash:cloud` (si hay imagen/UI).
- **Cloud “especialista puro”:** `kimi-k2.7-code:cloud` (mejor que K2.6 genérico para ingeniería).
- **Local:** `qwen3-coder:30b` si cabe; si no, `qwen2.5-coder:7b` / `warp-coder`.
- **No uses** `codellama` / `starcoder` antiguos salvo legacy: están superados en agentic y contexto.

---

## 2. Embeddings / RAG

| Modelo | Tamaño aprox. | Por qué destaca | Mejor uso |
|--------|---------------|-----------------|-----------|
| **`qwen3-embedding:8b`** | 8B | Top multilingual / retrieval / code retrieval; dims flexibles | RAG serio ES+EN+código |
| **`qwen3-embedding:4b`** | 4B | Balance calidad/VRAM | RAG diario |
| **`qwen3-embedding:0.6b`** | 0.6B | Ligero, aún de la familia Qwen3 | Edge / CPU |
| **`nomic-embed-text-v2-moe`** | ~305M activos | Multilingual MoE, Matryoshka 768→256 | RAG multiidioma eficiente |
| **`mxbai-embed-large`** | 335M / ~670MB | Clásico SOTA Bert-large; default de este repo | RAG inglés/general (ya documentado en `.env.example`) |
| **`nomic-embed-text`** | pequeño | 84M+ pulls, simple, contexto amplio | Prototipos y compatibilidad |
| **`embeddinggemma`** | 300M | Google, compacto | Alternativa ligera moderna |
| **`snowflake-arctic-embed2`** | 568M | Multilingual sin perder EN | Enterprise retrieval |

### Recomendación crítica (RAG en chatBot)

- Hoy el proyecto apunta a **`mxbai-embed-large`**: sólido y estable.
- Si el corpus es **español + código + docs largos**, tiene más sentido migrar a **`qwen3-embedding:4b` o `:8b`** (mejor retrieval moderno). Cambio de embedding ⇒ **reindexar Chroma** (`make chroma-clean` + reingest).
- No mezclar dimensiones/modelos en la misma colección.

---

## 3. Visión / multimodal

| Modelo | Tipo | Especialidad | Notas |
|--------|------|--------------|-------|
| **`glm-5.3-flash:cloud`** | Cloud | Visión + coding en el mismo loop | Mejor pick multimodal “útil” de tu set |
| **`gemma4:31b-cloud`** | Cloud | Visión + reasoning barato ($0.14/M in) | OCR/docs; sampling oficial temp=1.0 |
| **`kimi-k2.6:cloud` / `kimi-k2.7-code:cloud`** | Cloud | Diseño guiado por código + imagen/vídeo | UI → código |
| **`kimi-k3:cloud`** | Cloud | Frontier multimodal (texto/imagen/vídeo, 1M) | Solo tareas premium ($15/M out) |
| **`mistral-large-3:675b-cloud`** | Cloud | Visión enterprise + tools + multilingüe | Sin thinking explícito |
| **`minimax-m3:cloud`** | Cloud | Coding + agentic + multimodal 1M | Candidato a probar si no tienes Kimi/GLM |
| **`llama3.2-vision`** | Local 11B/90B | Captioning / Q&A de imagen | Bueno local; inferior a Gemma4/GLM-5.3 cloud en 2026 |
| **`gemma4:12b` / `:26b`** | Local | Multimodal workstation | Si quieres visión offline |

### Recomendación crítica (visión)

Para este chatBot (ilustraciones Forge + análisis):

1. **`glm-5.3-flash:cloud`** — visión + código barato.
2. **`gemma4:31b-cloud`** — documentos/OCR económicos.
3. **`kimi-k2.7-code:cloud`** — cuando el objetivo es *implementar* desde wireframe/captura.

---

## 4. Reasoning / thinking

| Modelo | Especialidad | Control thinking |
|--------|--------------|------------------|
| **`gpt-oss:120b-cloud`** | CoT auditable, barato, light usage | Solo `low`/`medium`/`high` (no se apaga) |
| **`deepseek-v4-flash:cloud`** | STEM + código con modos none/high/max | Mejor control latencia/calidad |
| **`deepseek-v4-pro:cloud`** | Reasoning frontier (más caro) | Cuando Flash no llega |
| **`gpt-oss:20b`** | Reasoning local pequeño | Debug CoT en máquina propia |
| **`nemotron-3-super:cloud`** | Multi-agente eficiente (120B / 12B activos) | Workflows agent NVIDIA |
| **`nemotron-3-ultra:cloud`** | Reasoning throughput alto | Agentes largos |

### Recomendación crítica

- **Razonamiento diario barato:** `gpt-oss:120b-cloud`.
- **Razonamiento + código:** `deepseek-v4-flash` con `think: max` solo cuando haga falta.
- Evitar pagar K3/Pro por “pensar más” si un Flash con `max` ya resuelve el 90%.

---

## 5. Velocidad / edge / local ligero

| Modelo | Rol | Notas |
|--------|-----|-------|
| **`warp-fast:latest`** | Chat ultra-rápido local (phi4-mini) | Ya lo tienes; drafts y UI snappy |
| **`nemotron-3-nano:4b`** | Agentic ligero cloud/local | Plan Free-friendly |
| **`gemma4:e2b` / `:e4b`** | Edge multimodal (+ audio en E*) | Móvil / NUC |
| **`qwen3.5:0.8b`–`:4b`** | Utilidad general pequeña | Prototipos |
| **`phi4-mini`** | Base de warp-fast | Alternativa oficial |

Útiles para **primera respuesta / routing**, no para SWE difícil.

---

## 6. Nichos concretos

| Especialidad | Modelo | Comentario |
|--------------|--------|------------|
| **SQL** | `sqlcoder:7b` / `:15b` | Sigue siendo el niche SQL más claro en Ollama; limitado vs frontier generalistas |
| **Fill-in-the-middle** | `qwen2.5-coder` / `codegemma` | Compleción estilo IDE |
| **Uncensored coding** | `dolphincoder`, variantes abliterated | Solo si el producto lo requiere; peor calidad agentic |
| **Enterprise multilingüe** | `mistral-large-3:675b-cloud` | System prompt + tools + vision |
| **Productividad agentic** | `minimax-m2.7:cloud` / `minimax-m3:cloud` | Alternativa a Kimi/GLM |

---

## 7. Top picks por trabajo (2026)

| Trabajo | Mejor pick | Alternativa |
|---------|------------|-------------|
| Coding diario cloud | `deepseek-v4-flash:cloud` | `glm-5.3-flash:cloud` |
| Coding agentic “especialista” | `kimi-k2.7-code:cloud` | `glm-5.3` / `glm-5.2` |
| Coding local | `qwen3-coder:30b` | `qwen2.5-coder:7b` / `warp-coder` |
| RAG embeddings | `qwen3-embedding:4b` o `:8b` | `mxbai-embed-large` (actual) |
| Visión + UI/código | `glm-5.3-flash:cloud` | `kimi-k2.7-code:cloud` |
| Documentos / OCR barato | `gemma4:31b-cloud` | `mistral-large-3:675b-cloud` |
| Reasoning barato | `gpt-oss:120b-cloud` | `deepseek-v4-flash` think high |
| Latencia local | `warp-fast` | `nemotron-3-nano` |
| “Máxima potencia” puntual | `kimi-k3:cloud` | `deepseek-v4-pro:cloud` |

---

## 8. Encaje con tu instalación actual

Ya tienes:

| Instalado | Rol útil |
|-----------|----------|
| `deepseek-v4-flash:cloud` | Driver coding |
| `glm-5.3-flash:cloud` | Coding + visión Flash |
| `glm-5.2:cloud` | Largo horizonte (casi reemplazado por 5.3-Flash) |
| `gpt-oss:120b-cloud` | Reasoning económico |
| `gemma4:31b-cloud` | Multimodal barato |
| `mistral-large-3:675b-cloud` | Enterprise / multilingüe |
| `kimi-k2.6:cloud` | Multimodal agentic (mejorar a **k2.7-code** para coding) |
| `kimi-k3:cloud` | Solo premium |
| `warp-coder` / `qwen2.5-coder:7b` | Coding local |
| `warp-fast` | Velocidad local |

### Huecos más útiles a valorar (pull)

1. **`kimi-k2.7-code:cloud`** — especialista coding mejor que tu K2.6.
2. **`qwen3-embedding:4b`** (o 8b) — si quieres mejorar RAG frente a mxbai.
3. **`qwen3-coder:30b`** — si quieres agentic local sin cloud.
4. **`minimax-m3:cloud`** — alternativa multimodal 1M si quieres diversificar proveedores.

---

## 9. Parámetros API relevantes por especialidad

| Especialidad | Parámetros clave |
|--------------|------------------|
| Coding agentic | `think` (`high`/`max`), `tools`, `num_ctx` alto, `temperature` 0.2–0.4 |
| Embeddings | endpoint `/api/embed` o `/api/embeddings`; **no** temperature |
| Visión | `messages[].images` (base64); imagen **antes** del texto (Gemma) |
| Reasoning | `think: low\|medium\|high\|max` (GPT-OSS: solo niveles) |
| Local rápido | `num_ctx` bajo (4k–16k), `num_predict` acotado |

Detalle de tus cloud: `docs/research/ollama-cloud/`.

---

## 10. Opinión directa

- **Especialista ≠ más grande.** K3 y GLM-5.2 son potentes, pero para el día a día pierden frente a Flash/coder específicos.
- **El mayor ROI** en este proyecto no es otro LLM de chat, sino: (a) **coder cloud Flash** bien elegido, (b) **embedding moderno** si el RAG duele, (c) **visión Flash** para el flujo Forge.
- Mantener 8 cloud “casi generalistas” diluye criterio: conviene **1 default coding**, **1 visión**, **1 reasoning barato**, **1 local fast**, y el resto bajo demanda.

---

## Referencias

- [Ollama Cloud](https://docs.ollama.com/cloud)
- [Pricing](https://ollama.com/pricing)
- [Search: coder](https://ollama.com/search?q=coder)
- [Search: embedding](https://ollama.com/search?c=embedding)
- [Thinking capability](https://docs.ollama.com/capabilities/thinking)
- Fichas cloud locales: [`docs/research/ollama-cloud/`](./ollama-cloud/README_2026-09-02.md)
