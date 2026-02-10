"""
Funciones compartidas entre scripts de línea de comandos (ingesta, limpieza Chroma, etc.).
"""
from __future__ import annotations

import os
from pathlib import Path

# Raíz del proyecto
_ROOT = Path(__file__).resolve().parent.parent


def load_env_from_root() -> None:
    """Carga variables de .env en os.environ desde la raíz del proyecto."""
    _env_file = _ROOT / ".env"
    if _env_file.exists():
        with open(_env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    key, value = key.strip(), value.strip()
                    if key:
                        os.environ[key] = value


def ensure_app_in_path() -> None:
    """Asegura que la raíz del proyecto está en sys.path."""
    import sys
    if str(_ROOT) not in sys.path:
        sys.path.insert(0, str(_ROOT))


def list_conversations():
    """Devuelve la lista de conversaciones (requiere app en path y DB inicializada)."""
    from app import crud
    from app.db import SessionLocal
    db = SessionLocal()
    try:
        return crud.list_conversations(db)
    finally:
        db.close()


def parse_selection(choice: str, n: int) -> list[int]:
    """Convierte '1,3,5' o '1-4' o 'all' en lista de índices 0-based."""
    choice = choice.strip().lower()
    if choice == "all":
        return list(range(n))
    indices = []
    for part in choice.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            try:
                lo, hi = int(a.strip()), int(b.strip())
                for i in range(lo, hi + 1):
                    if 1 <= i <= n:
                        indices.append(i - 1)
            except ValueError:
                continue
        else:
            try:
                i = int(part)
                if 1 <= i <= n:
                    indices.append(i - 1)
            except ValueError:
                continue
    return sorted(set(indices))


def prompt_select_conversations(conversations: list, prompt_suffix: str = "") -> list:
    """
    Muestra la lista numerada de conversaciones, pide al usuario que elija
    (ej: 1,3,5 o 1-4 o all) y devuelve la sublista seleccionada.
    Si prompt_suffix no está vacío se añade después del prompt por defecto.
    """
    if not conversations:
        return []
    print("\nConversaciones disponibles:\n")
    for i, c in enumerate(conversations, 1):
        title = (c.title or "Sin título")[:60]
        print(f"  {i}. {title!r}  (id: {c.id})")
    print("\nEscribe los números a usar (ej: 1,3,5  o  1-4  o  all) y pulsa Enter:", end="")
    if prompt_suffix:
        print(" ", prompt_suffix, end="")
    print(" ", end="")
    try:
        choice = input().strip()
    except EOFError:
        choice = ""
    if not choice:
        return []
    indices = parse_selection(choice, len(conversations))
    return [conversations[i] for i in indices]
