# Checklist: RAG con importancia, instrucciones desde archivo y umbral de contexto

Rama: `feature/rag-importance-and-context-instructions`

Objetivos:
- Formato de archivo de texto con bloques `importance X:` (1–10) e `instruction:`.
- **Tres separaciones** en ChromaDB (tres colecciones o una colección con tipo/source en metadata): instrucciones, contexto ingesta, historial de chats.
- **Orden de prioridad para el LLM:** (1) prompt del usuario siempre prioritario; (2) instrucciones del archivo (se envían siempre; el LLM les hace caso salvo si el prompt las contradice, entonces prioridad al prompt); (3) contexto ingesta (siguiente en importancia); (4) historial de chats (menor importancia; decirle a Ollama que es historial de chat y que es menos importante que las otras dos).
- Slider en el panel izquierdo (1–10) para el umbral del contexto de ingesta (etiquetar importante / menos importante).
- Indicar al LLM que el contexto es solo referencia y que debe ceñirse al prompt teniendo en cuenta el contexto.

---

## 0. Tres separaciones en ChromaDB y prioridad en el prompt

- **Instrucciones** (del archivo, bloques `instruction:`): se guardan aparte (BD de la conversación o colección/metadata en Chroma). Se meten **siempre** en el prompt. El LLM debe hacerles caso **a no ser que el prompt del usuario lleve la contraria** a alguna; en ese caso **prioridad al prompt del usuario**.
- **Contexto ingesta** (del archivo, bloques `importance X:`): se guarda en Chroma (contexto ingesta). Se recupera por similitud (top N) y se etiqueta en el prompt como contexto importante / menos importante según el umbral. **Siguiente en importancia** después de las instrucciones.
- **Historial de chats** (lo que se guarda del chat: mensajes usuario/asistente): se guarda **en otra colección o con otro tipo** en Chroma, de forma que no se mezcle con el contexto de ingesta. Se recupera por similitud (top N) y se inyecta en el prompt **etiquetado explícitamente como "historial de chat"**, indicando a Ollama que es **menos importante** que las instrucciones y que el contexto de ingesta.
- **Prompt del usuario:** siempre lo prioritario. Si contradice una instrucción, gana el prompt.

Implementación en Chroma: tres colecciones (p. ej. `chat_history`, `ingested_context`, `instructions`) o una sola colección con metadata `source` / `type` (`"chat_history"` | `"ingested"` | `"instruction"`) para filtrar y consultar por separado.

---

## 1. Formato del archivo de texto

- **Bloques de contexto:** comienzan con `importance X:` en una línea (X de 1 a 10). El contenido del bloque es todo lo que sigue hasta el siguiente `importance N:` o `instruction:` o fin de archivo.
- **Bloques de instrucción:** comienzan con `instruction:` en una línea. El contenido se guarda como instrucción que se envía siempre (en el system message).
- No hace falta un delimitador de cierre (`---`); el inicio del siguiente bloque o el fin de archivo cierra el bloque actual.

**Ejemplo:**

```
instruction:
Responde en español y de forma concisa.

importance 8:
Este es un párrafo que suele ser muy relevante (importancia alta).

importance 3:
Esto es contexto secundario, solo si encaja con la pregunta.
```

**Propuesta:** Si un bloque es muy largo (p. ej. > 6000 caracteres), se puede subdividir en chunks conservando la misma metadata `importance` para cada chunk, para no superar límites de embeddings.

---

## 2. Parser del archivo (ingesta)

- [ ] **2.1** En `app/rag.py` (o módulo auxiliar), implementar función que parsee el texto completo y devuelva:
  - Lista de bloques `{ "type": "instruction", "content": "..." }`.
  - Lista de bloques `{ "type": "context", "importance": int (1-10), "content": "..." }`.
- [ ] **2.2** Detección de bloques: línea que empiece por `importance ` (case-insensitive opcional) seguido de un dígito 1–9 o 10, luego `:`. Línea que empiece por `instruction:` (case-insensitive opcional). El contenido es el texto hasta la siguiente cabecera o fin de archivo.
- [ ] **2.3** Validar y normalizar importancia: si aparece 0 o fuera de rango, mapear a 1–10 (p. ej. 0 → 1).

---

## 3. ChromaDB: tres separaciones (colecciones o metadata)

- [ ] **3.1** **Contexto ingesta** (bloques `importance X:`): insertar en la colección de contexto ingesta (p. ej. `ingested_context` o misma colección con `source="ingested"`). Metadata: `importance=N` (1–10), `conversation_id`, `created_at`. No mezclar con el historial de chat.
- [ ] **3.2** **Historial de chats** (mensajes usuario/asistente que se guardan desde la UI): guardar en una colección separada (p. ej. `chat_history`) o en la misma colección con metadata `source="chat_history"`. Así las queries de "contexto ingesta" y "historial de chat" se hacen por separado (por colección o por filtro `where` en metadata).
- [ ] **3.3** **Instrucciones** (bloques `instruction:`): no es necesario embeberlas en Chroma (se envían siempre, no se recuperan por similitud). Guardar en la BD de la conversación (nuevo campo o JSON, p. ej. `ingested_instructions`) para inyectarlas siempre en el prompt.
- [ ] **3.4** Actualizar `add_ingested_document` (o crear `add_ingested_document_parsed`) para usar el parser: borrar solo documentos de contexto ingesta de la conversación; insertar bloques `importance X:` en la colección de ingesta con `importance`; persistir instrucciones en la conversación (3.3). El guardado de mensajes del chat (`add_message`) debe escribir en la colección/metadata de **historial de chats**, no en la de contexto ingesta.

---

## 4. Recuperación: dos consultas (contexto ingesta + historial de chat), top N cada una

- [ ] **4.1** **Contexto ingesta:** consultar la colección (o filtro) de contexto ingesta por similitud con la query del usuario, **top N** resultados. Cada resultado debe incluir **metadata `importance`**. Devolver estructura para separar por umbral en el prompt (p. ej. lista de `(content, importance)` o `{ "high": [...], "low": [...] }`).
- [ ] **4.2** **Historial de chats:** consultar la colección (o filtro) de historial de chat por similitud con la query del usuario, **top N** resultados. Devolver el texto concatenado (o lista) para inyectarlo en el prompt **etiquetado como "Historial de chat"** y con la indicación de que es menos importante que las instrucciones y el contexto de ingesta.
- [ ] **4.3** La API que construye el prompt debe recibir: (1) instrucciones de la conversación (ya en BD); (2) contexto ingesta con importancias (para partir por umbral); (3) historial de chat recuperado. Ninguna query debe mezclar documentos de ingesta con documentos de historial.

---

## 5. Umbral (slider 1–10) en la UI

- [ ] **5.1** Añadir en el panel izquierdo un control: label "Umbral de contexto importante (1–10):" y un `<input type="range" min="1" max="10" value="5">` con el valor visible (número al lado o dentro del slider).
- [ ] **5.2** El valor del umbral debe enviarse al backend en cada petición de mensaje (igual que `save_to_chromadb`). Añadir en el schema `MessageSend` (o en el body del stream) un campo opcional p. ej. `context_threshold: int = 5` (1–10).
- [ ] **5.3** Persistir el umbral por conversación (opcional): si se desea que cada conversación recuerde su umbral, añadir campo en el modelo `Conversation` y en `ConversationUpdate` / `ConversationOut`, y leerlo en el frontend al abrir la conversación.

---

## 6. Construcción del prompt: orden y etiquetas (prioridad usuario > instrucciones > contexto ingesta > historial)

- [ ] **6.1** Orden en el system message (de mayor a menor importancia para el LLM):
  1. **Instrucciones** (globales de la conversación + instrucciones del archivo `instruction:`). Añadir frase: el LLM debe hacerles caso **salvo si el mensaje del usuario las contradice, en cuyo caso tiene prioridad el prompt del usuario**.
  2. **Contexto de ingesta** (resultados de la query a Chroma contexto ingesta), partido por umbral: **importance >= threshold** → "Contexto importante (referencia prioritaria):" + contenido; **importance < threshold** → "Contexto adicional (referencia secundaria):" + contenido.
  3. **Historial de chat** (resultados de la query a Chroma historial). Etiquetar explícitamente: *"Historial de chat (menos importante que las instrucciones y el contexto de ingesta anterior; solo referencia):"* + contenido.
  4. Frase final: que **el mensaje del usuario es siempre lo prioritario**, que el resto es **solo contexto de referencia** y que debe **ceñirse al prompt teniendo en cuenta el contexto**.
- [ ] **6.2** Tras el system message, el único mensaje de usuario enviado a Ollama es el mensaje actual del usuario (prioridad máxima).

---

## 7. Script de ingesta

- [ ] **7.1** Actualizar `scripts/ingest_to_conversations.py` para usar el nuevo parser: leer archivo, parsear bloques, llamar a la nueva función de ingesta que guarda contexto con importance e instrucciones (y persistir instrucciones en conversación según 3.2).
- [ ] **7.2** Si las instrucciones se guardan en la conversación, al abrir/editar conversación devolverlas (p. ej. en `ConversationOut`) para que la UI pueda mostrarlas o al menos tenerlas disponibles para el backend al enviar mensajes.

---

## 8. Tests y documentación

- [ ] **8.1** Tests unitarios para el parser (casos: `instruction:`, `importance 1:` … `importance 10:`, bloques seguidos, bloques sin cabecera al inicio).
- [ ] **8.2** Tests para la función de ingesta (mock de Chroma) comprobando metadata `importance` y que las instrucciones se persisten donde corresponda.
- [ ] **8.3** Actualizar README o `docs/` con el formato del archivo de texto y el significado del slider de umbral.

---

## Resumen de flujo

1. **Ingesta de archivo:** se parsea → bloques `instruction:` se guardan en la conversación (BD); bloques `importance X:` se embeber e insertan en la **colección (o filtro) de contexto ingesta** en Chroma con metadata `importance`. Los mensajes del chat que el usuario guarda en Chroma van a la **colección (o filtro) de historial de chat**, separada.
2. **Al enviar mensaje:** el usuario elige umbral (slider 1–10). Backend: (a) lee instrucciones de la conversación; (b) query **contexto ingesta** top N por similitud → (content, importance); (c) query **historial de chat** top N por similitud.
3. **System message** (orden): instrucciones (con nota de que el prompt del usuario tiene prioridad si contradice) → contexto ingesta partido por umbral (importante / menos importante) → historial de chat etiquetado como "historial de chat, menos importante" → frase de que el mensaje del usuario es prioritario y el resto es referencia.
4. **Mensaje usuario** (solo el actual). El LLM responde con prioridad: prompt usuario > instrucciones > contexto ingesta > historial de chat.

---

## Propuestas opcionales

- **Slider 0–10:** Incluir 0 para "todo como contexto menos importante" (solo etiquetar, no filtrar).
- **Límite de caracteres por bloque:** Si un bloque supera el máximo por chunk (p. ej. 6000), trocear y asignar la misma `importance` a cada chunk.
- **Cabeceras case-insensitive:** Aceptar `Instruction:` o `IMPORTANCE 5:` para ser más tolerantes.
- **Vacíos:** Ignorar bloques con contenido vacío tras la cabecera.
