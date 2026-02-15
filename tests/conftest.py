"""Fixtures compartidos: BD en memoria y cliente de prueba con mocks de Ollama."""
# Parche para tests de mutación (mutmut): cuando pytest se ejecuta desde mutants/, el código
# mutado importa mutmut.__main__, que llama a set_start_method('fork'). Si el contexto de
# multiprocessing ya fue fijado por pytest/plugins, lanza RuntimeError. Evitamos el fallo
# haciendo que esa llamada sea un no-op cuando el contexto ya está establecido.
import multiprocessing as _mp

_orig_set_start_method = _mp.set_start_method


def _patched_set_start_method(method, *args, **kwargs):
    try:
        _orig_set_start_method(method, *args, **kwargs)
    except RuntimeError:
        pass  # context has already been set (p. ej. por pytest al correr desde mutants/)


_mp.set_start_method = _patched_set_start_method

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db import Base, get_db
from app import models  # noqa: F401 - registra tablas en Base
from app.config import settings
from app.providers import get_provider

from app.main import app


@pytest.fixture
def db_engine():
    # StaticPool: una sola conexión para que :memory: sea compartida entre fixture y requests
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    Session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# E2E: comprobación de Ollama (tests que requieren Ollama levantado)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def ollama_available():
    """
    Comprueba si Ollama está accesible antes de ejecutar tests e2e.
    Si no está disponible, hace skip de todos los tests que dependan de esta fixture
    y muestra un mensaje claro al usuario.
    """
    try:
        provider = get_provider("ollama")
        if provider.validate_connection():
            return True
    except Exception:
        pass
    host = getattr(settings, "ollama_host", "http://localhost:11434")
    pytest.skip(
        f"Ollama no está accesible en {host}. "
        "Levanta Ollama (p. ej. 'ollama serve') o ejecuta los tests sin e2e: pytest -m 'not e2e'."
    )


@pytest.fixture(scope="session")
def openai_available():
    """
    Comprueba si OpenAI está configurado (OPENAI_API_KEY) para tests e2e de OpenAI.
    Si no hay key, hace skip de los tests que dependan de esta fixture.
    """
    if not getattr(settings, "openai_api_key", ""):
        pytest.skip(
            "OPENAI_API_KEY no configurada. "
            "Configura la variable de entorno para ejecutar tests e2e de OpenAI."
        )
    return True
