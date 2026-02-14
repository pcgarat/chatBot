# Informe de cobertura de tests

**Fecha de análisis:** generado a partir de `pytest --cov=app --cov-report=term-missing`.  
**Cobertura total actual:** 58% (661 líneas sin cubrir de 1579).

---

## 1. Resumen por módulo

| Módulo | Cobertura | Comentario |
|--------|-----------|------------|
| app/schemas.py | 100% | Solo modelos Pydantic; bien cubierto por uso en tests. |
| app/providers/capabilities.py | 100% | Recién añadido y testeado. |
| app/model_info.py | 98% | Muy bien cubierto; solo ramas de error de JSON/OS. |
| app/main.py | 95% | Falta rama `index` cuando no existe index.html. |
| app/config.py | 90% | Falta validador de `ollama_history_turns` (excepciones). |
| app/providers/base.py | 86% | Protocol: métodos abstractos, no ejecutables. |
| app/providers/factory.py | 86% | Falta rama Mancer (import diferido) y algún edge. |
| app/db.py | 81% | Inicialización y migraciones. |
| app/crud.py | 74% | Varias funciones CRUD sin tests directos. |
| app/routers/api_models.py | 70% | validate, list_models con provider, list_all_models. |
| app/slash_commands.py | 69% | parse_slash: ramas vacías, comando desconocido. |
| app/ollama_client.py | 41% | Código legacy; la lógica vive en providers/ollama. |
| app/provider_params.py | 45% | build_extra_body, get_presets (archivo inexistente/error). |
| app/rag.py | 48% | Muchas ramas según config (Chroma, embeddings). |
| app/providers/ollama.py | 51% | chat, chat_stream, show_model (parcial), unload. |
| app/routers/api_conversations.py | 39% | Streaming, envío de mensajes, RAG, DELETE mensajes. |
| app/routers/api_ollama.py | 33% | clear_ollama_memory (depende de Ollama real). |
| app/providers/mancer.py | 19% | Casi todo sin cubrir (list_models, chat, stream). |

---

## 2. Código a reforzar (baja cobertura y prioritario)

### 2.1 app/crud.py (74% → objetivo >90%)

**Líneas no cubiertas:** 57, 88, 130-135, 140-146, 151-156.

- **update_conversation** (57): rama `inject_instruction_every`; no hay test que actualice ese campo.
- **delete_conversation** (68-73): existe test_delete_conversation pero no cubre el `if not conv` (get devuelve None).
- **get_message** (85-95): no hay test que pida un mensaje por id; los endpoints que borran mensaje/last no están cubiertos vía API.
- **delete_message** (127-135 y 148-156): función duplicada; solo una rama se ejecuta. Añadir test que elimine por message_id y que intente eliminar mensaje inexistente (404).
- **delete_last_message** (137-145): test que llame al endpoint DELETE last y verifique 204; y 404 cuando no hay mensajes.
- **clear_conversation_messages** (158-163): test que limpie mensajes y compruebe count.

**Recomendación:** Añadir en `tests/test_crud.py` (o test_api_conversations): tests para `get_message`, `delete_message` (éxito y mensaje no encontrado), `delete_last_message` (éxito y vacío), `clear_conversation_messages`, y en `test_api_conversations` tests para DELETE last message, DELETE message by id, clear messages.

### 2.2 app/routers/api_conversations.py (39%)

**Bloques sin cubrir:** 134-137 (delete last), 154-158 (clear messages), 164-168 (delete message), 221-223, 243-383 (streaming y envío), 394-447, 476-510 (flujo completo de mensaje).

- Los tests actuales mockean mucho y no ejercitan los endpoints de **eliminación** (delete last, delete message, clear).
- El **flujo de envío de mensaje** (POST message + streaming) está mockeado a alto nivel; no se comprueban ramas como `instruction_override`, `rag_context` vacío/no vacío, ni errores del provider en mitad del stream.
- **RAG:** no hay tests que verifiquen que se llama a `rag.add_message` o `rag.delete_message_document` cuando corresponde.

**Recomendación:**  
- Tests de integración ligeros: DELETE last (204 y 404), DELETE message by id (204 y 404), clear messages (204 y 404).  
- Tests de _build_llm_messages con distintos combinaciones (sin system, con RAG, con instruction_override).  
- Mantener mocks del provider para el streaming pero añadir un test que simule un chunk de error y compruebe que se persiste el mensaje de error.

### 2.3 app/routers/api_models.py (70%)

**Líneas no cubiertas:** 61-71 (validate_provider), 95-101 (list_models con provider), 117 (list_all_models exception), 124 (list_models exception), 130-131, 140-158 (list_provider_models ConnectionError/Exception), 203-204, 230-231 (construcción de ModelInfoResponse).

- **validate_provider:** no hay test que llame a GET validate y compruebe 200 (ok) ni 503 (provider caído).
- **list_models(provider=...):** test con `?provider=mancer` (o provider inválido) para cubrir rama provider y excepciones.
- **list_provider_models:** test que mockee ConnectionError y otro que mockee Exception genérico para cubrir ambos except.
- **list_all_models:** test que un proveedor falle y se siga con el siguiente (continue).

**Recomendación:** Añadir en `tests/test_api_models.py`: test_validate_provider_ok, test_validate_provider_unavailable, test_list_models_with_provider_param, test_list_provider_models_connection_error, test_list_provider_models_generic_exception, test_list_all_models_one_provider_fails.

### 2.4 app/provider_params.py (45%)

**Líneas no cubiertas:** 27-28 (_load_config error), 52-53 (list_providers_with_params), 62-65 (set_nested), 85 (preset_path no existe), 95-97 (JSON/OS error o data no dict), 99-100, 122-154 (build_extra_body: string_list, int/float, options vacío).

- **get_presets:** tests con archivo inexistente, archivo con JSON inválido, y archivo con data no-dict.
- **build_extra_body:** tests con model_params string_list (con valores y vacío), int/float inválidos (continue), y caso que deje `options` vacío y se haga pop.

**Recomendación:** Nuevo `tests/test_provider_params.py` con tests para get_presets (archivo no existe, JSON mal formado, data no dict), set_nested, build_extra_body (string_list, int, float, options vacío).

### 2.5 app/rag.py (48%)

Ramas según `chroma_host`, `embeddings_provider`, y flujos de add_message / get_relevant_context / delete. Los tests actuales cubren “sin config” y algún camino con mocks.

- Reforzar tests que cubran: embeddings_provider=openai (con mock), add_message cuando hay Chroma, get_relevant_context con resultados, delete_conversation_documents y delete_message_document cuando RAG está activo.

### 2.6 app/providers/ollama.py (51%)

- **show_model:** ya hay tests; falta comprobar que se llama a POST con `{"model": model_name}` (opcional).
- **chat** (134-142): test con extra_body y sin extra_body; test con excepción.
- **chat_stream** (170-224): test que reciba varios chunks y un done; test con error de Ollama en JSON.
- **unload_model_from_memory / list_running_models:** tests con mock de urllib o httpx para no depender de Ollama real.

### 2.7 app/slash_commands.py (69%)

**Líneas 49, 56-66:** contenido vacío, sin slash, comando desconocido, comando conocido con y sin texto.

- Tests para: `parse_slash("")`, `parse_slash("hola")`, `parse_slash("/unknown x")`, `parse_slash("/git")`, `parse_slash("/git algo")` y comprobar `used_slash` y `mcp_contexts`.

---

## 3. Tests demasiado laxos

### 3.1 test_api_conversations

- Los tests de envío de mensaje no comprueban el **contenido** del system message (instrucciones globales + RAG + override).
- No se verifica que al enviar un mensaje se llame a `crud.add_message` con los argumentos correctos (role, content, instruction_override, etc.).
- El streaming se mockea de forma que siempre devuelve contenido; no hay caso “solo metadata” o “error a mitad de stream”.

**Sugerencia:** Al menos un test que verifique que el payload construido para el LLM incluye system con instrucción global cuando la conversación la tiene, y que el historial está acotado por `ollama_history_turns`.

### 3.2 test_crud

- **delete_conversation:** no hay test donde get_conversation devuelva None (conversation_id inexistente); por tanto no se cubre el return False.
- **delete_message / delete_last_message:** no hay tests que devuelvan False (mensaje o conversación inexistente).

**Sugerencia:** Tests que pasen ids inexistentes y comprueben return False o que no se modifique la BD.

### 3.3 test_model_info

- **test_atomic_write:** no simula un fallo entre escribir en .tmp y replace; solo comprueba que el archivo final es válido. Para probar “no corromper” haría falta inyectar un fallo o usar un mock de os.replace.
- **Límites:** se comprueba que se truncan listas, pero no que la API rechace o normalice cuando el cliente envía más del límite (eso ya se hace en el backend; podría añadirse test de integración PUT con 101 tags y comprobar que solo se guardan 100).

### 3.4 test_providers (Ollama)

- **show_model:** no se comprueba que la petición HTTP sea POST a `/api/show` con body `{"model": model_name}` (solo que el resultado tiene ciertas claves).

---

## 4. Código que conviene excluir de la cobertura

Razón: código de arranque, migraciones, adaptadores a servicios externos sin valor unitario, o duplicados que no aportan cubrir.

### 4.1 Excluir por tipo (recomendación para .coveragerc o pyproject.toml)

| Qué excluir | Motivo |
|-------------|--------|
| **app/main.py** (todo o solo `startup` y rama `index` sin archivo) | Punto de entrada FastAPI; montaje de rutas y static. Probar con test de integración E2E en lugar de cobertura. |
| **app/db.py** `init_db()` (migraciones ALTER TABLE) | Migraciones one-off; probar con BD de integración, no con unit tests. |
| **app/config.py** `Settings.Config` y carga de .env | Configuración de Pydantic; validadores sí tienen sentido testear, el resto no. |
| **app/ollama_client.py** (todo el módulo) | Legacy; la lógica real está en app/providers/ollama.py. Se puede marcar como excluido hasta deprecar/eliminar. |
| **app/providers/base.py** cuerpos de métodos del `Protocol` | Son `...` (abstractos); no se ejecutan. Excluir la clase Protocol o esas líneas. |
| **app/routers/api_ollama.py** (todo) | Depende de Ollama real para list_running_models / unload. Probar manualmente o con E2E; excluir de cobertura unitaria. |

### 4.2 Excluir líneas concretas (pragma)

- **app/model_info.py** 49-50: rama `except (json.JSONDecodeError, OSError)` en _load_all. Se puede dejar sin cubrir o añadir un test que corrompa el archivo; si no, marcar con `# pragma: no cover` y comentar que es defensivo.
- **app/db.py** 21-25 (get_db yield/close): cubierto por uso en tests con override; si se quiere cobertura “real” sería con integración. Opcional excluir.
- **app/main.py** línea 32 (startup): evento de arranque; excluir o cubrir con test que llame a startup (puede ser frágil).

### 4.3 Ejemplo de configuración para excluir

Crear en la raíz del proyecto **`.coveragerc`**:

```ini
[run]
source = app
omit =
    app/ollama_client.py
    app/main.py
    app/db.py
    app/providers/base.py
    app/routers/api_ollama.py

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    raise NotImplementedError
    if TYPE_CHECKING:
    if __name__ == .__main__.:
```

O en **pyproject.toml** (si se usa):

```toml
[tool.coverage.run]
source = ["app"]
omit = [
    "app/ollama_client.py",
    "app/main.py",
    "app/db.py",
    "app/providers/base.py",
    "app/routers/api_ollama.py",
]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
]
```

Con estas exclusiones, la cobertura reportada se centra en lógica de negocio y APIs; el total subirá en porcentaje y reflejará mejor lo que interesa testear.

---

## 5. Prioridades sugeridas

1. **Alta:** Reforzar crud (delete_message, delete_last_message, clear, get_message) y api_conversations (DELETE endpoints y _build_llm_messages). Añadir tests api_models (validate, list_models con provider, excepciones en list_provider_models y list_all_models).
2. **Media:** provider_params (get_presets, build_extra_body), slash_commands (parse_slash), ollama (chat, chat_stream con mocks).
3. **Baja:** mancer (si se usa en producción; si no, mantener excluido o solo smoke), rag (más ramas con mocks de Chroma/embeddings).
4. **Configuración:** Añadir .coveragerc (o equivalente) con las exclusiones anteriores y volver a generar este informe para comparar.

---

## 6. Mejoras aplicadas (prioridad alta y media)

**Fecha:** 2025-02-13.

### Alta – completado

- **crud:** En `tests/test_crud.py`: get_message (ok y None para conv/mensaje inexistente), delete_message (éxito y False), delete_last_message (sin mensajes / eliminando último / vacío), clear_conversation_messages (count y vaciado), update_conversation (inject_instruction_every).
- **api_conversations:** En `tests/test_api_conversations.py`: DELETE last (204 y 404), DELETE message by id (204 y 404), clear messages ya existía (204 y 404); test de _build_llm_messages con rag_context.
- **api_models:** En `tests/test_api_models.py`: validate_provider (200 ok, 503 no disponible, 503 por excepción), list_models con `?provider=...` y ValueError, list_provider_models (ConnectionError y Exception genérica), list_all_models (un proveedor falla y se continúa con el siguiente).

### Media – completado

- **provider_params:** Creado `tests/test_provider_params.py`: get_presets (archivo inexistente, JSON inválido, data no dict), set_nested (crea niveles, no pisa existentes, clave única), build_extra_body (string_list, int, float, options vacío no enviado, None/vacío, proveedor sin specs).
- **slash_commands:** Creado `tests/test_slash_commands.py`: parse_slash vacío, sin slash, comando desconocido, /git solo, /git con texto, /github, comando en mayúsculas; comprobación de used_slash y mcp_contexts.
- **ollama:** En `tests/test_providers.py`: chat con extra_body (httpx y payload fusionado), chat ConnectionError; chat_stream (varios chunks + done, chunk de error por JSON, error HTTP 503).

**Resultado:** 153 tests pasando; cobertura total ~66% (app). Cobertura por módulo mejorada en crud, api_models, provider_params, slash_commands, ollama y api_conversations.

---

*Documento generado para el proyecto chatBot. Revisar y ajustar exclusiones según criterio del equipo.*
