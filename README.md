# Chat IA con Ollama

Aplicación web de chat que usa modelos Ollama en local. Incluye selector de modelo, instrucciones de sistema (globales o por mensaje, invisibles en el chat), historial por conversación y persistencia para abrir y guardar conversaciones.

## Requisitos

- Python 3.10+
- [Ollama](https://ollama.com) instalado y en ejecución (`ollama serve`). Al menos un modelo descargado (por ejemplo `ollama pull llama3.2`).
- **Frontend:** Node.js 20+ y npm para desarrollar o recompilar el SPA React (`frontend/`). El servidor FastAPI sirve el build ya publicado en `app/static/`; no hace falta Node solo para ejecutar la app.
- **RAG (opcional):** Docker para ChromaDB y cuenta OpenAI para embeddings. Sin ellos la app funciona igual; el RAG solo se activa si están configurados `OPENAI_API_KEY` y `CHROMA_HOST`.

## Instalación

Con Make (recomendado):

```bash
cd chatBot
make up      # venv + deps + API (SPA publicado)
make up-dev  # API con reload + Vite (http://localhost:5173)
make help
```

Manual:

```bash
cd chatBot
python -m venv .venv
source .venv/bin/activate   # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Comandos Make

| Comando    | Descripción                                                         |
|------------|---------------------------------------------------------------------|
| `make up`    | venv + deps + API (sirve el SPA publicado) |
| `make up-dev`| API `--reload` + Vite HMR. Ctrl+C para ambos |
| `make down`  | Detener procesos y borrar el venv |
| `make start` | Solo API. `VERBOSE=1` para logs de LLM/Forge |
| `make stop`  | Detener API y Vite |
| `make reload`| `down` + `up` |
| `make test`  | Tests sin e2e (pytest + vitest) |
| `make status`| Estado de venv, API y Vite |
| `make chroma-up`  | Levantar ChromaDB (puerto 8001) |
| `make chroma-down`| Bajar Chroma (los datos se conservan) |
| `make clean`      | Parar la app (no toca Docker ni Chroma) |
| `make frontend-build` | Publicar el SPA React en `app/static/` |
| `make help`  | Mostrar ayuda |

## Configuración (opcional)

Copia `.env.example` a `.env` y ajusta si lo necesitas:

- `OLLAMA_HOST`: URL de Ollama (por defecto `http://localhost:11434`).
- `DATABASE_URL`: ruta de la base de datos SQLite (por defecto `sqlite:///./chatbot.db`).
- **RAG:** `OPENAI_API_KEY` (clave API de OpenAI para embeddings) y `CHROMA_HOST` (por defecto `http://localhost:8001`). Para usar el RAG:
  1. Levanta Chroma: `make chroma-up` (crea `./data/chroma` y deja los datos ahí para no perderlos).
  2. Luego inicia la app: `make start`. La app conecta a Chroma por HTTP y guarda/consulta el historial por conversación.
  Para apagar Chroma sin borrar datos: `make chroma-down`. Para borrar también los datos: `make chroma-clean`.

## Ejecución

`make up` inicia la API y sirve el SPA ya compilado en `app/static/`. Para desarrollar el front:

```bash
make up-dev
```

Abre **http://localhost:5173** (Vite con HMR; proxy `/api` → :8000). `http://localhost:8000` sigue sirviendo el build estático, no los cambios en caliente. Ctrl+C para el backend y Vite. Chroma no se arranca: `make chroma-up` si lo necesitas.

Si el entorno existe y solo quieres la API (sin Vite):

```bash
make start
```

Para detener API (y Vite si quedó de `up-dev`): `make stop`. Reinicio completo (borrar venv): `make reload`.

Para publicar el SPA en FastAPI (`make up` / :8000): `make frontend-build`.

**Logs LLM/Forge:** `make up-dev` ya va en verbose. Sin Vite: `VERBOSE=1 make start`.

## Uso

- **Nueva conversación**: panel izquierdo, botón "Nueva conversación".
- **Abrir conversación**: clic en una conversación de la lista.
- **Modelo**: selector en la cabecera; se guarda en la conversación actual.
- **Instrucciones para todos los mensajes**: el texto en el panel bajo la cabecera se envía a Ollama en cada turno y no se muestra en el chat. Pulsa "Guardar" para persistirlo.
- **Instrucción solo para este mensaje**: campo opcional encima del área de escritura; se aplica solo al siguiente mensaje y no se muestra en el chat.
- **Guardar**: actualiza título, modelo e instrucciones globales de la conversación actual.

## Tests

Los tests usan pytest con base de datos SQLite en memoria y mocks de Ollama (no hace falta tener Ollama en marcha).

```bash
make test
```

Ese comando ejecuta pytest (sin e2e) y, si hay `frontend/node_modules`, también Vitest.

Con cobertura (con el venv activado):

```bash
pytest --cov=app --cov-report=term-missing
```
