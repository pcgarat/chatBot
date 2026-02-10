# Checklist: Refactorización SOLID, DDD, patrones de diseño y cobertura de tests

Rama: `feature/rag-importance-and-context-instructions`

Objetivos:
- Refactorizar el código existente para cumplir **SOLID** y una arquitectura **DDD** antes de desarrollar las nuevas funcionalidades RAG (importancia, tres separaciones, umbral).
- Aplicar **patrones de diseño** que encajen bien con el dominio y la infraestructura.
- Aumentar la **calidad** y la **cobertura de tests** hasta un nivel muy bueno, e incluir el **análisis de cobertura** en la salida de `make test`.

---

## Principios SOLID aplicados al código actual

| Principio | Situación actual | Objetivo |
|-----------|------------------|----------|
| **S** Single Responsibility | `rag.py`: cliente Chroma, colección, embeddings, add, query, ingest, delete. Routers: HTTP + orquestación + construcción de prompt. | Separar: infraestructura (adaptadores), dominio (reglas), aplicación (casos de uso), presentación (HTTP). |
| **O** Open/Closed | Cambiar de Ollama a otro LLM o de Chroma a otro vector store implica tocar código existente. | Abrir por abstracciones (puertos); extender con nuevos adaptadores sin modificar núcleo. |
| **L** Liskov | N/A mientras no haya jerarquías de implementaciones. | Cualquier implementación de `IVectorStore` / `ILLMClient` debe ser sustituible sin romper contratos. |
| **I** Interface Segregation | N/A (no hay interfaces aún). | Interfaces pequeñas y específicas: p. ej. solo “guardar documento” y “buscar por similitud” para el store; no una interfaz gigante. |
| **D** Dependency Inversion | Routers y lógica dependen de `app.rag` y `app.ollama_client` concretos. | La aplicación depende de abstracciones (puertos); la infraestructura implementa esas abstracciones. |

---

## Arquitectura DDD (resumen)

- **Bounded contexts:** (1) **Conversaciones**: agregado Conversation + Message; CRUD, listado, actualización. (2) **Contexto RAG**: instrucciones, contexto ingesta, historial de chat; recuperación e inyección en el prompt.
- **Agregados:** Conversation (raíz) con Message como entidades hijas; no exponer Message sin Conversation.
- **Dominio puro:** Las entidades de dominio viven en `domain/` **sin dependencias de frameworks** (no heredan de Base ni conocen SQLAlchemy). Conversation y Message son clases puras con identidad y atributos; los repositorios operan sobre estas entidades.
- **Value objects:** ContextChunk(content, importance), IngestedInstruction(text), etc., en `domain/` para no usar dicts y mantener el dominio rico.
- **Repositorios (puertos):** Interfaces en aplicación/dominio que trabajan con **entidades de dominio**. Implementaciones en infraestructura: usan modelos de persistencia (SQLAlchemy) y **mappers** que convierten entidad de dominio ↔ modelo de persistencia.
- **Servicios de aplicación:** orquestan repositorios y puertos externos (vector store, LLM); no contienen reglas de negocio complejas, solo flujos.
- **Servicios de dominio (si hace falta):** lógica que no pertenece a una sola entidad (p. ej. “calcular si inyectar instrucción global según contador de mensajes”).

---

## Patrones de diseño recomendados

| Patrón | Uso en el proyecto |
|--------|---------------------|
| **Ports & Adapters (Hexagonal)** | **Puertos:** `IVectorStore` (añadir doc, buscar por similitud, borrar por conversation_id), `ILLMClient` (chat, chat_stream). **Adaptadores:** `ChromaVectorStore`, `OllamaLLMClient`. La aplicación (casos de uso) solo usa los puertos. |
| **Repository** | Sustituir `crud` por `ConversationRepository` e implementación `SqlConversationRepository`. Idem para mensajes: `MessageRepository` + `SqlMessageRepository`. Las interfaces viven en aplicación o dominio; las implementaciones en infraestructura. |
| **Strategy** | Embeddings: estrategia Ollama vs OpenAI ya existe de facto; encapsular en `EmbeddingStrategy` o dentro del adaptador de Chroma que recibe la función de embeddings. |
| **Factory (simple)** | Creación del cliente Chroma y de la colección (según config) puede vivir en un factory o en el propio adaptador; evita repetir lógica de URL y embedding function en varios sitios. |
| **Application Service / Use Case** | `SendMessageService`, `BuildPromptService`, `IngestDocumentService`: cada uno recibe sus dependencias (repositorios, vector store, LLM client) por constructor; los routers solo llaman al servicio y mapean DTOs. |
| **Dependency Injection** | En FastAPI: `Depends()` para inyectar implementaciones concretas de los puertos (p. ej. `get_vector_store()` que devuelve `ChromaVectorStore`). Así los routers y servicios no instancian `rag` ni `ollama_client` directamente. |

---

## Estructura de carpetas propuesta (después del refactor)

```
app/
  domain/                    # Dominio puro: entidades y value objects (sin dependencias de ORM)
    entities/
      conversation.py        # Conversation (clase pura, id, title, model_id, etc.)
      message.py             # Message (clase pura, id, conversation_id, role, content, etc.)
    value_objects.py         # IngestedInstruction, ContextChunk (opcional en domain/)
  application/               # Casos de uso y puertos (interfaces)
    ports/
      vector_store.py        # IVectorStore
      llm_client.py          # ILLMClient
      repositories.py        # ConversationRepository, MessageRepository (interfaces; firman con entidades de domain/)
    services/
      send_message.py
      build_prompt.py
      ingest_document.py
  infrastructure/            # Adaptadores y persistencia
    persistence/
      models.py              # Modelos SQLAlchemy (tablas)
      mappers.py             # Conversión entidad de dominio ↔ modelo de persistencia
      sql_conversation_repository.py
      sql_message_repository.py
    vector/
      chroma_vector_store.py
    llm/
      ollama_client.py
  api/
    routes/
      conversations.py
      models.py
      ollama.py
  config.py
  main.py
  schemas.py                 # DTOs de API
  db.py                      # Session, init_db (usado por infrastructure/persistence)
```

---

## Fases de implementación (orden sugerido)

### Fase 1: Cobertura en `make test`

- [x] **1.1** Añadir a la invocación de pytest en el Makefile las opciones de cobertura: `--cov=app --cov-report=term-missing` (y opcionalmente `--cov-fail-under=80` cuando la cobertura sea aceptable). *(Hecho: `make test` ya ejecuta pytest con `--cov=app --cov-report=term-missing`.)*
- [ ] **1.2** Comprobar que `pytest-cov` está en `requirements.txt` (ya está). Ejecutar `make test` y verificar que se muestra el informe de cobertura en la salida.

### Fase 2: Tests existentes y líneas no cubiertas

- [ ] **2.1** Ejecutar tests con cobertura y anotar módulos/archivos con menor cobertura (p. ej. `app/rag.py`, `app/routers/api_conversations.py`, `app/ollama_client.py`).
- [ ] **2.2** Añadir tests unitarios para funciones puras o lógica aislada (parser futuro, normalización de importancia, etc.) en cuanto existan.
- [ ] **2.3** Añadir tests que cubran ramas de error (Chroma no disponible, Ollama error, conversación no encontrada) y flujos alternativos en los routers (stream vs no-stream, save_to_chromadb variantes).

### Fase 3: Introducir puertos (interfaces)

- [ ] **3.1** Definir en `app/application/ports/` (o equivalente) la interfaz `IVectorStore`: métodos `add_document`, `search_by_similarity`, `delete_by_conversation_id` (y los que hagan falta para historial vs ingesta). Firmas pensadas para el dominio (conversation_id, query, n_results, etc.).
- [ ] **3.2** Definir `ILLMClient`: métodos `chat(model, messages) -> str` y `chat_stream(model, messages)` (iterator o async generator según conveniencia). La aplicación solo dependerá de esta interfaz.
- [ ] **3.3** Definir interfaces de repositorios: `ConversationRepository` (get, list, create, update, delete), `MessageRepository` (get, list_by_conversation, add, delete_last). Las firmas trabajan con **entidades de dominio** (Conversation, Message de `domain/`), no con modelos SQLAlchemy.

### Fase 4: Adaptadores que implementan los puertos

- [ ] **4.1** Crear `ChromaVectorStore` en infraestructura que implemente `IVectorStore`: internamente usa el código actual de `rag.py` (cliente, colección, embeddings). Extraer la lógica de `rag.py` a esta clase de forma que `add_message`, `get_relevant_context`, `delete_conversation_documents`, `add_ingested_document` pasen a ser delegaciones al adaptador.
- [ ] **4.2** Crear `OllamaLLMClient` que implemente `ILLMClient` y que envuelva la lógica actual de `ollama_client.py`. Mantener la misma API pública (chat, chat_stream) hacia el resto de la app.
- [ ] **4.3** Implementar `SqlConversationRepository` y `SqlMessageRepository` en infraestructura: usan los modelos SQLAlchemy (tablas) y **mappers** que convierten entidad de dominio ↔ modelo de persistencia en cada carga y guardado. No se wrappea `crud`; la lógica de persistencia vive en estos adaptadores y en los mappers.

### Fase 5: Servicios de aplicación

- [ ] **5.1** `BuildPromptService` (o `PromptBuilder`): recibe conversación, mensaje actual, instrucciones globales, override, rag_context (o estructura con instrucciones + contexto ingesta + historial), umbral; devuelve la lista de mensajes para Ollama (system + user). Extraer la lógica de `_build_ollama_messages` del router a este servicio. Depende solo de reglas de negocio (no de HTTP ni de Chroma directamente).
- [ ] **5.2** `SendMessageService`: recibe conversation_id, contenido, opciones (save_to_chromadb, etc.); usa ConversationRepository, MessageRepository, IVectorStore, ILLMClient, BuildPromptService. Orquesta: cargar conversación, recuperar contexto RAG (llamando al vector store), construir prompt, llamar al LLM, persistir mensajes y opcionalmente vector store. No contiene lógica HTTP (stream vs no-stream puede delegarse en el router que llama al servicio una o dos veces).
- [ ] **5.3** `IngestDocumentService`: recibe conversation_id, texto plano (o ruta); usa parser (dominio o aplicación), VectorStore para contexto ingesta, ConversationRepository para guardar instrucciones. El script `ingest_to_conversations.py` llamará a este servicio.

### Fase 6: Routers solo orquestan

- [ ] **6.1** Los routers de conversaciones dejan de importar `crud` y `rag` directamente. Obtienen por `Depends()` los servicios (SendMessageService, etc.) y los repositorios o puertos que necesiten.
- [ ] **6.2** Cada endpoint: validar entrada (schemas), llamar a un solo servicio (o a un repositorio para casos triviales como list/get), mapear resultado a DTO y devolver. La construcción del prompt y la decisión de qué guardar en Chroma viven en los servicios.
- [ ] **6.3** Mantener el streaming en el router (generador async que escribe en la respuesta) pero que el generador llame al servicio o a un método del LLM client que ya devuelva un stream; la lógica de “guardar mensaje usuario”, “guardar respuesta asistente en Chroma según save_to_chromadb” debe estar en el servicio o en un método que el router invoque.

### Fase 7: Dominio puro (entidades, value objects y mapeo)

Conviene tener esta capa lista antes o al inicio de la Fase 4, para que los adaptadores SQL (4.3) implementen los repositorios usando entidades de dominio y mappers.

- [ ] **7.1** Crear la capa de dominio: en `domain/entities/` (o `domain/`) definir **Conversation** y **Message** como clases puras (sin heredar de Base ni importar SQLAlchemy), con atributos equivalentes a los actuales (id, title, model_id, system_instruction_global, inject_instruction_every, created_at, updated_at para Conversation; id, conversation_id, role, content, instruction_override, created_at para Message). Los repositorios y servicios trabajarán con estas entidades.
- [ ] **7.2** Añadir **value objects** en `domain/` cuando encajen: p. ej. `IngestedInstruction(text)`, `ContextChunk(content, importance)` para no usar dicts en la aplicación.
- [ ] **7.3** En **infraestructura/persistence/**: mantener o mover los **modelos SQLAlchemy** (tablas) en `models.py`; crear **mappers** (funciones o clase) que conviertan `Conversation` (dominio) ↔ modelo SQLAlchemy de conversación, y `Message` (dominio) ↔ modelo SQLAlchemy de mensaje, en ambos sentidos (to_domain / to_persistence).
- [ ] **7.4** Los **SqlConversationRepository** y **SqlMessageRepository** usan Session, modelos SQLAlchemy y mappers: al cargar, leen filas y las convierten a entidades de dominio; al guardar, reciben entidades de dominio y las mapean a modelos antes de add/commit. La capa de aplicación y los servicios **nunca** reciben modelos SQLAlchemy, solo entidades de dominio.

### Fase 8: Aumentar cobertura de tests

- [ ] **8.1** Tests unitarios de `BuildPromptService` / `PromptBuilder`: distintos casos (con/sin RAG, con/sin instrucciones, umbral, etc.) con mocks de dependencias.
- [ ] **8.2** Tests unitarios de `SendMessageService` (o del flujo principal): mock de repositorios, vector store y LLM; verificar que se llama a add_message, a vector store cuando corresponde, y que el prompt construido tiene la forma esperada.
- [ ] **8.3** Tests del adaptador `ChromaVectorStore` con mock de Chroma (o tests de integración con Chroma real en CI opcional).
- [ ] **8.4** Tests del adaptador Ollama con mock de cliente Ollama.
- [ ] **8.5** Mantener y ampliar tests de API (test_api_conversations, etc.) para que sigan pasando tras el refactor; añadir casos que cubran ramas nuevas (save_to_chromadb, save_message_to_chromadb).
- [ ] **8.6** Fijar un umbral mínimo de cobertura en el Makefile (p. ej. `--cov-fail-under=85`) cuando la cobertura sea estable, para que `make test` falle si baja.

### Fase 9: Calidad y convenciones

- [ ] **9.1** Revisar tipos (type hints) en puertos y servicios para que estén completos y coherentes.
- [ ] **9.2** Documentar en README o en `docs/` la arquitectura (puertos, adaptadores, flujo de un mensaje) para que el refactor y las nuevas funcionalidades RAG sean fáciles de seguir.
- [ ] **9.3** Añadir linter (ruff o pylint) y formatter (black) en el proyecto, integrados en CI o pre-commit, y asegurar que el código cumple antes de dar por cerrado el refactor.

---

## Resumen de dependencias (después del refactor)

- **Routers (API)** → Servicios de aplicación (SendMessage, BuildPrompt, Ingest) y DTOs.
- **Servicios** → Puertos (IVectorStore, ILLMClient, ConversationRepository, MessageRepository); no conocen Chroma ni Ollama.
- **Infraestructura** → Implementa los puertos; conoce Chroma, Ollama, SQLAlchemy.
- **Dominio** (si se introduce) → Entidades y value objects; sin dependencias de frameworks.

Con esto el código quedará preparado para añadir las tres separaciones en Chroma (instrucciones, contexto ingesta, historial), el parser de archivo, el umbral y la nueva construcción del prompt siguiendo el checklist `RAG_IMPORTANCE_AND_CONTEXT_CHECKLIST.md`.
