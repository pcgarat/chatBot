from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.db import init_db
from app.routers import api_conversations, api_models

app = FastAPI(title="Chat IA con Ollama", version="1.0.0")

app.include_router(api_models.router)
app.include_router(api_conversations.router)

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def index():
    """Sirve la SPA del frontend."""
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Chat IA con Ollama. Añade archivos en app/static/ para el frontend."}
