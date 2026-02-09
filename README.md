# Chat IA con Ollama

Aplicación web de chat que usa modelos Ollama en local. Incluye selector de modelo, instrucciones de sistema (globales o por mensaje, invisibles en el chat), historial por conversación y persistencia para abrir y guardar conversaciones.

## Requisitos

- Python 3.10+
- [Ollama](https://ollama.com) instalado y en ejecución (`ollama serve`). Al menos un modelo descargado (por ejemplo `ollama pull llama3.2`).

## Instalación

Con Make (recomendado):

```bash
cd chatBot
make up      # crea el entorno virtual e instala dependencias
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

| Comando   | Descripción                                      |
|----------|---------------------------------------------------|
| `make up`    | Crear entorno virtual e instalar dependencias   |
| `make down`  | Eliminar el entorno virtual                      |
| `make start` | Iniciar el servidor (puerto 8000)               |
| `make stop`  | Detener el servidor                             |
| `make test`  | Ejecutar los tests                              |
| `make status`| Ver estado del entorno y del servidor           |
| `make help`  | Mostrar ayuda                                  |

## Configuración (opcional)

Copia `.env.example` a `.env` y ajusta si lo necesitas:

- `OLLAMA_HOST`: URL de Ollama (por defecto `http://localhost:11434`).
- `DATABASE_URL`: ruta de la base de datos SQLite (por defecto `sqlite:///./chatbot.db`).

## Ejecución

```bash
make start   # o: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Abre en el navegador: http://localhost:8000. Para detener el servidor: `make stop`.

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

Con cobertura (con el venv activado):

```bash
pytest --cov=app --cov-report=term-missing
```
