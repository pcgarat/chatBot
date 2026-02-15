from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.db import init_db, SessionLocal
from app.migrate_conversation_rules_to_library import migrate_all as migrate_conversation_rules_to_library
from app.migrate_fill_instruction_ids import migrate_all as migrate_fill_instruction_ids
from app.migrate_model_info_rules import migrate_all as migrate_model_info_rules
from app.routers import api_conversations, api_models, api_ollama, api_rules

app = FastAPI(title="Chat IA con Ollama", version="1.0.0")

app.include_router(api_models.router)
app.include_router(api_conversations.router)
app.include_router(api_rules.router)
app.include_router(api_ollama.router)

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.on_event("startup")
def startup():
    init_db()
    db = SessionLocal()
    try:
        migrate_model_info_rules(db)
        migrate_conversation_rules_to_library(db)
        # Rellenar instruction_ids desde system_instructions legado (solo referencias a rules)
        migrate_fill_instruction_ids(db)
    finally:
        db.close()


@app.get("/")
def index():
    """Sirve la SPA del frontend."""
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Chat IA con Ollama. Añade archivos en app/static/ para el frontend."}
