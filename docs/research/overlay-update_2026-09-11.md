Última modificación: 2026-09-11

Fuentes consultadas el 2026-09-11. Overlays en `config/model_overlays/{provider}.json`.

## Alcance

- **Sí:** contrato sparse (capacidades, thinking, recetas, `api_key` de think) **y** presets de contexto (`config/openai.json`, `config/abliteration.json`) para la barra de ctx.
- **No:** catálogo vivo de Ollama Cloud entero, audio/realtime/legacy de OpenAI.

## Ollama

Fuentes: [library cloud](https://ollama.com/search?c=cloud), fichas [glm-5.3-flash](https://ollama.com/library/glm-5.3-flash), [glm-5.3](https://ollama.com/library/glm-5.3), [glm-5.2](https://ollama.com/library/glm-5.2), [kimi-k3](https://ollama.com/library/kimi-k3), [Moonshot K3](https://github.com/MoonshotAI/Kimi-K3), [thinking Ollama](https://docs.ollama.com/capabilities/thinking), [gpt-oss](https://ollama.com/library/gpt-oss), [Gemma 4](https://ai.google.dev/gemma/docs/core/model_card_4).

| Modelo | Cambio | Por qué |
|--------|--------|---------|
| `glm-5.3-flash:cloud` | thinking siempre on; `low`/`high`/`max`; `can_disable: false` | Ficha Ollama: «Reasoning is always on… low, high, and max» |
| `glm-5.3:cloud` | **nuevo** overlay; text-only; default `max` | Flagship Z.ai; `reasoning_effort` low/high/max, default max; sin visión en Ollama |
| `glm-5.2:cloud` | effort `high`/`max`; `can_disable: false` | Readme Ollama: High y Max |
| `kimi-k3:cloud` | siempre on; `low`/`high`/`max`; default `max` | Docs Moonshot (`reasoning_effort`, default max) |
| gpt-oss, DeepSeek V4 Flash, Gemma 4 31B, Mistral Large 3, Kimi K2.6 | sin cambio de contrato | Confirmado: gpt-oss low/med/high no-off; DeepSeek 3 modos; Gemma temp 1.0 / top_p 0.95 / top_k 64 + quirk historial; Mistral visión+tools sin thinking |

No se añadieron minimax, nemotron, qwen3.5 ni `deepseek-v4.1-flash` (visión): no estaban en el overlay curado. Stub locales (warp, qwen) intactos.

## OpenAI

Fuentes: [catálogo](https://developers.openai.com/api/docs/models/all), [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol), [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4), [upgrade 5.6](https://developers.openai.com/api/docs/guides/upgrading-to-gpt-5p6-sol.md), [Azure reasoning](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning).

`think.api_key` = `reasoning_effort` (Chat Completions).

| Familia | Thinking | Notas |
|---------|----------|-------|
| `gpt-6-astra` | low…max, **sin** `none` | 1.05M ctx, visión |
| GPT-5.6 sol/terra/luna | none…max, default **medium** | Luna: guía de upgrade cita 400K ctx; ficha Luna dice 1.05M — overlay no pinta ctx |
| GPT-5.4 | none…xhigh, default none | |
| GPT-5.2 | none…xhigh, default none | |
| GPT-5.1 | none/low/medium/high, default none | |
| GPT-5 | minimal/low/medium/high | `none` no aplica |
| `gpt-5-pro` | solo `high` | |
| `*-chat-latest` | `kind: none` | no exponen effort útil |
| o-series | low/medium/high, no off | |
| GPT-4.1 / 4o | sin thinking, visión | |

**gpt-5.4-pro** (ficha oficial): `medium` (default), `high`, `xhigh`; sin `none`; 1.05M ctx. Responses API only según OpenAI — el overlay igual cubre Chat Completions por si el proxy lo acepta.

`config/openai.json` incluye presets de ctx para GPT-6 Astra, GPT-5.6 (sol/terra/luna) y GPT-5.4 (incl. pro/mini/nano). Luna: 400K según guía de upgrade (la ficha del modelo dice 1.05M).

## Mancer

Fuente: [mancer.tech/models](https://mancer.tech/models) (el HTML de neuro.mancer.tech devolvió 500). Contexto y tags de la tabla pública. **No** se inventó thinking: el catálogo no lo declara.

- Tools solo donde la ficha dice Tools: `glm-4.7`, `danspe-v1-3-0-12b`.
- `goliath-120b`: stub vacío; no aparece en el catálogo actual.
- IDs nuevos en la web (Gemma 4 31B, GPT OSS 120B, DeepSeek V4 Flash) **no** se añadieron al overlay: no están en `MANCER_KNOWN_MODEL_IDS`.

## Abliteration

Fuentes: [models](https://docs.abliteration.ai/models), [thinking](https://docs.abliteration.ai/capabilities/thinking).

| Modelo | Visión | Thinking |
|--------|--------|----------|
| `abliterated-model` | sí (+ vídeo en Chat Completions) | none…max, se puede apagar |
| `abliterated-model-large` | no | none / high / max (el resto se mapea); default high |
| `abliterated-model-large-v2` | no (GLM-5.3) | low/high/max, **no se apaga**; default max |

`config/abliteration.json` y `ABLIT_KNOWN_MODELS` incluyen los tres. Precio large-v2: $5 / 1M input y output (igual que large).

## Crítica

1. Restringir GLM-5.2 a high/max es fiel a Ollama; si la API sigue aceptando `low`, la UI lo oculta a propósito.
2. GPT-5.4-pro es Responses-only en docs OpenAI; si Chat Completions lo rechaza, el overlay no arregla el endpoint.
3. Luna 400K vs 1.05M: prioricé la guía de upgrade, que contrasta Luna contra Sol/Terra.
4. No copié el catálogo cloud entero de Ollama.
