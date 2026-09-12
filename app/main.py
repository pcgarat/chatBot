from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import db as app_db
from app import models_user  # noqa: F401 — tablas users/sessions en init_db
from app.config import sync_env_to_dotenv
from app.migrate_conversation_rules_to_library import migrate_all as migrate_conversation_rules_to_library
from app.migrate_fill_instruction_ids import migrate_all as migrate_fill_instruction_ids
from app.migrate_model_info_rules import migrate_all as migrate_model_info_rules
from app.migrate_multi_user import bootstrap_multi_user
from app.services.image_illustration.worker import start_image_generation_worker
from app.services.rules.seed import seed_builtin_rules
from app.routers import (
    api_auth,
    api_conversations,
    api_images,
    api_message_tree,
    api_models,
    api_ollama,
    api_planner_rule_presets,
    api_prompt_generator,
    api_rules,
    api_workspace_profiles,
)

app = FastAPI(title="Chat IA con Ollama", version="1.0.0")

app.include_router(api_auth.router)
app.include_router(api_models.router)
app.include_router(api_conversations.router)
app.include_router(api_message_tree.router)
app.include_router(api_prompt_generator.router)
app.include_router(api_rules.router)
app.include_router(api_ollama.router)
app.include_router(api_images.router)
app.include_router(api_workspace_profiles.router)
app.include_router(api_planner_rule_presets.router)

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.on_event("startup")
def startup():
    sync_env_to_dotenv()
    app_db.init_db()
    db = app_db.SessionLocal()
    try:
        migrate_model_info_rules(db)
        migrate_conversation_rules_to_library(db)
        # Rellenar instruction_ids desde system_instructions legado (solo referencias a rules)
        migrate_fill_instruction_ids(db)
        seed_builtin_rules(db)
        bootstrap_multi_user(db)
    finally:
        db.close()
    start_image_generation_worker()


@app.get("/")
def index():
    """Sirve la SPA del frontend."""
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Chat IA con Ollama. Añade archivos en app/static/ para el frontend."}
