# Checklist: RAG con ChromaDB e embeddings OpenAI

## Sugerencias antes de implementar (sin complicar)

- **Una sola colección + metadata `conversation_id`**: En vez de una colección por conversación, usar una colección (ej. `chat_history`) y guardar cada documento con metadata `conversation_id`. Así se puede filtrar por conversación al consultar y es más fácil de mantener.
- **Documento = un mensaje o par user/assistant**: Guardar cada mensaje (o cada par user+assistant) como un documento. Así el RAG recupera “trozos” de historial relevantes. Más simple que hacer chunking de textos largos.
- **Embeddings solo de contenido de texto**: Usar el campo `content` (y opcionalmente `role`) para el texto a embeber. Modelo recomendado: `text-embedding-3-small` (OpenAI), barato y suficiente.
- **Inyectar contexto al prompt, no reemplazar historial**: Seguir enviando a Ollama solo instrucciones + mensaje actual (como ahora); añadir un bloque tipo “Contexto relevante del historial: …” construido con los resultados de Chroma, para no alargar demasiado el contexto del modelo.
- **Chroma en Docker, app en local**: El `docker-compose` levanta solo Chroma. La app FastAPI sigue con `make start` y se conecta a Chroma por HTTP (ej. `CHROMA_HOST=http://localhost:8001`).

---

## Pasos de implementación

### 1. Infraestructura

- [x] **1.1** Crear `docker-compose.yml` con el servicio ChromaDB (imagen oficial, persistencia en volumen, puerto distinto al de la app, ej. 8001).
- [x] **1.2** Documentar en README o en este checklist: `docker compose up -d` para Chroma y que la app use `CHROMA_HOST` (y puerto) para conectarse.
- [x] **1.3** Añadir `OPENAI_API_KEY` y `CHROMA_HOST` (y puerto si aplica) a `.env.example`.

### 2. Configuración y dependencias

- [x] **2.1** En `app/config.py`: añadir `openai_api_key: str = ""` y `chroma_host: str = "http://localhost:8001"` (o leer de env).
- [x] **2.2** En `requirements.txt`: añadir `chromadb`, `openai` (y versión que use el modelo de embeddings que elijas).

### 3. Cliente Chroma y embeddings

- [x] **3.1** Crear módulo (ej. `app/rag.py` o `app/chroma_client.py`) que:
  - Inicialice el cliente HTTP de Chroma apuntando a `CHROMA_HOST`.
  - Defina/obtenga una colección con metadata `conversation_id` (y si quieres `role`, `created_at`).
- [x] **3.2** Implementar función de embeddings con OpenAI (modelo `text-embedding-3-small` o similar) usando `OPENAI_API_KEY`. Chroma puede usar una “embedding function” que llame a la API de OpenAI.
- [x] **3.3** Asegurar que la colección use esa embedding function (o embeber en la app y pasar vectores a Chroma).

### 4. Guardar historial en Chroma

- [x] **4.1** Decidir qué se indexa: cada mensaje por separado (recomendado) o pares user+assistant. Definir estructura: `id` (único por mensaje), `conversation_id`, `role`, `content`, y opcionalmente `created_at` / `message_id`.
- [x] **4.2** Después de guardar cada mensaje en SQLite (user y assistant), añadir el mismo contenido a Chroma (add documents + metadatas + ids). Reutilizar el mismo `conversation_id` que en la app.
- [x] **4.3** Punto de integración: llamar a “añadir a Chroma” desde el flujo que ya persiste mensajes (stream y no-stream), una vez el mensaje está en BD (evitar duplicar lógica en muchos sitios).

### 5. Consulta RAG al enviar mensaje

- [x] **5.1** Antes de construir los mensajes para Ollama, tomar el contenido del mensaje actual (y opcionalmente instrucciones globales) y hacer una query por similitud a Chroma filtrando por `conversation_id` de la conversación actual (y límite de resultados, ej. top 5 o 10).
- [x] **5.2** Con los documentos/metadatos devueltos, construir un texto “Contexto relevante del historial: …” (solo contenido, sin duplicar el mensaje actual).
- [x] **5.3** Inyectar ese bloque en el prompt a Ollama (por ejemplo como parte del system prompt o como primer mensaje de contexto) en `_build_ollama_messages` o equivalente, sin cambiar la lógica actual de “solo instrucciones + mensaje nuevo”.

### 6. Eliminación y consistencia

- [x] **6.1** Al eliminar una conversación (DELETE conversación), borrar también sus documentos en Chroma (query/delete by metadata `conversation_id`), para no dejar datos huérfanos.
- [ ] **6.2** Opcional: si añades “editar mensaje” o “borrar mensaje” en el futuro, decidir si borrar/actualizar también el documento correspondiente en Chroma (puede dejarse para una fase posterior).

### 7. Tests y validación

- [x] **7.1** Añadir test(s) que mockeen Chroma y OpenAI y comprueben que se llama a “add” al guardar mensajes y a “query” al construir el contexto (o tests de integración con Chroma en Docker).
- [ ] **7.2** Probar manualmente: crear conversación, enviar varios mensajes, verificar en Chroma que existen documentos con ese `conversation_id`, y que la respuesta del modelo refleja contexto del historial cuando sea relevante.

### 8. Documentación y despliegue

- [x] **8.1** Actualizar README: requisitos (Docker para Chroma), variables de entorno (`OPENAI_API_KEY`, `CHROMA_HOST`), y orden de arranque (Chroma primero, luego la app).
- [x] **8.2** Si usas `make`: opcionalmente añadir `make chroma-up` / `make chroma-down` que ejecuten `docker compose` para Chroma.

---

## Orden sugerido

1. Infraestructura (1.1 – 1.3)  
2. Config y deps (2.1 – 2.2)  
3. Cliente Chroma + embeddings (3.1 – 3.3)  
4. Guardar historial (4.1 – 4.3)  
5. Consulta RAG (5.1 – 5.3)  
6. Eliminación (6.1)  
7. Tests (7.1 – 7.2)  
8. Documentación (8.1 – 8.2)
