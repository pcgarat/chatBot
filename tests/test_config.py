"""Tests del módulo app.config (Settings y sync_env_to_dotenv)."""
import os
from pathlib import Path
from unittest.mock import patch

import pytest

from app.config import ENV_VARS_TO_SYNC, sync_env_to_dotenv


def test_sync_env_to_dotenv_appends_only_missing_vars(tmp_path):
    """sync_env_to_dotenv añade al .env solo las variables del sistema que no están ya en el archivo."""
    env_file = tmp_path / ".env"
    env_file.write_text("PYTHON_VERSION=3.12\nMANCER_API_KEY=mcr-secret-in-file\n", encoding="utf-8")
    with patch("app.config._PROJECT_ROOT", tmp_path), patch.dict(
        os.environ,
        {"OPENAI_PROJECT_ID": "proj_new", "MANCER_API_KEY": "mcr-from-system"},
        clear=False,
    ):
        sync_env_to_dotenv(skip_if_pytest=False)
    content = env_file.read_text(encoding="utf-8")
    assert "PYTHON_VERSION=3.12" in content
    assert "MANCER_API_KEY=mcr-secret-in-file" in content  # no se sobrescribe
    assert "OPENAI_PROJECT_ID=proj_new" in content  # sí se añade (no estaba)


def test_sync_env_to_dotenv_skipped_under_pytest(monkeypatch, tmp_path):
    """Bajo pytest (PYTEST_CURRENT_TEST definido) no se escribe .env."""
    env_file = tmp_path / ".env"
    env_file.write_text("", encoding="utf-8")
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "test_config.py::test_foo")
    monkeypatch.setenv("OPENAI_PROJECT_ID", "proj_should_not_appear")
    with patch("app.config._PROJECT_ROOT", tmp_path):
        sync_env_to_dotenv()
    assert env_file.read_text(encoding="utf-8") == ""


def test_env_vars_to_sync_contains_expected():
    """ENV_VARS_TO_SYNC incluye las variables usadas por la aplicación."""
    expected = {
        "OPENAI_API_KEY",
        "OPENAI_PROJECT_ID",
        "OLLAMA_HOST",
        "MANCER_API_KEY",
        "ABLIT_KEY",
        "PYTHON_VERSION",
    }
    assert expected.issubset(set(ENV_VARS_TO_SYNC))
