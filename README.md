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
make up      # crea el entorno virtual, instala dependencias e inicia la aplicación
make help    # ver todos los comandos
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
| `make up`    | Crear entorno virtual, instalar dependencias e iniciar la aplicación |
| `make down`  | Detener la aplicación y eliminar el entorno virtual                 |
| `make start` | Iniciar el servidor (puerto 8000)                                    |
| `make stop`  | Detener el servidor                                                 |
| `make reload`| make down + make up (reinicio completo)                             |
| `make test`  | Ejecutar los tests                                                  |
| `make status`| Ver estado del entorno y del servidor                               |
| `make chroma-up`  | Levantar ChromaDB con Docker (puerto 8001); datos en `./data/chroma` |
| `make chroma-down`| Bajar el contenedor de ChromaDB (los datos se conservan)            |
| `make clean`      | Parar app y Chroma y borrar datos de Chroma y PID                   |
| `make frontend-build` | Compilar el SPA React a `app/static/` |
| `make frontend-dev`   | Vite en :5173 con proxy `/api` → :8000 |
| `make frontend-test`  | Tests de Vitest del frontend |
| `make help`  | Mostrar ayuda                                                      |

## Configuración (opcional)

Copia `.env.example` a `.env` y ajusta si lo necesitas:

- `OLLAMA_HOST`: URL de Ollama (por defecto `http://localhost:11434`).
- `DATABASE_URL`: ruta de la base de datos SQLite (por defecto `sqlite:///./chatbot.db`).
- **RAG:** `OPENAI_API_KEY` (clave API de OpenAI para embeddings) y `CHROMA_HOST` (por defecto `http://localhost:8001`). Para usar el RAG:
  1. Levanta Chroma: `make chroma-up` (crea `./data/chroma` y deja los datos ahí para no perderlos).
  2. Luego inicia la app: `make start`. La app conecta a Chroma por HTTP y guarda/consulta el historial por conversación.
  Para apagar Chroma sin borrar datos: `make chroma-down`. Para parar todo y borrar también los datos de Chroma: `make clean`.

## Ejecución

`make up` ya inicia la aplicación. Si el entorno existe y solo quieres arrancar el servidor:

```bash
make start
```

Abre en el navegador: http://localhost:8000. Para detener: `make stop`. Para reinicio completo (borrar venv y volver a subir): `make reload`.

El UI es un SPA React (`frontend/`). Tras cambiar JSX, CSS o `frontend/src/app.js`, regenera el estático:

```bash
make frontend-build
```

En desarrollo del front, `make frontend-dev` (Vite) y `make start` (API) a la vez: el dev server hace proxy de `/api` al backend.

**Modo verbose (-v):** para ver en la terminal todo lo que se envía a Ollama (modelo + mensajes, tal cual):

```bash
python run.py -v
# o
make start-verbose
# o
VERBOSE=1 make start
```

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
