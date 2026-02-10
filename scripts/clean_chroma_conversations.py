#!/usr/bin/env python3
"""
Comando para limpiar datos de ChromaDB de una o varias conversaciones.

Uso:
  python scripts/clean_chroma_conversations.py
  make clean-chroma   # desde la raíz del proyecto

1. Muestra todas las conversaciones (título e id) y pide seleccionar cuáles limpiar
   (ej: 1,3,5 o 1-4 o all).
2. Como en Chroma distinguimos por metadata 'role' entre historial de chat (user/assistant)
   e ingesta de archivo (ingested), se pregunta qué borrar:
   - Solo historial de chat (mensajes usuario/asistente)
   - Solo ingesta de archivo
   - Todo (todos los datos de Chroma para las conversaciones elegidas)
3. Ejecuta el borrado y muestra un resumen.

Requisitos: CHROMA_HOST en .env; ChromaDB accesible.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Raíz en path antes de importar scripts o app
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from scripts import common

common.load_env_from_root()

from app import config, rag

if not (config.settings.chroma_host or "").strip():
    config.settings.chroma_host = os.environ.get("CHROMA_HOST", "") or "http://localhost:8001"
rag._chroma_available = None


def main():
    conversations = common.list_conversations()
    if not conversations:
        print("No hay conversaciones. Nada que limpiar.", file=sys.stderr)
        sys.exit(0)

    selected = common.prompt_select_conversations(conversations)
    if not selected:
        print("Nada seleccionado. Saliendo.", file=sys.stderr)
        sys.exit(0)
    print(f"\nSeleccionadas {len(selected)} conversación(es).", file=sys.stderr)

    if not rag._rag_available():
        print("Chroma no disponible (revisa CHROMA_HOST en .env). No se puede limpiar.", file=sys.stderr)
        sys.exit(1)

    # Segundo paso: qué borrar (distinguimos por role en Chroma)
    print(
        "\n¿Qué quieres borrar de Chroma para estas conversaciones?",
        file=sys.stderr,
    )
    print("  1. Solo historial de chat (mensajes usuario/asistente)", file=sys.stderr)
    print("  2. Solo ingesta de archivo (contenido ingerido)", file=sys.stderr)
    print("  3. Todo", file=sys.stderr)
    print("Elige (1, 2 o 3): ", end="", file=sys.stderr)
    try:
        choice = input().strip()
    except EOFError:
        choice = ""
    if choice not in ("1", "2", "3"):
        print("Opción no válida. Saliendo.", file=sys.stderr)
        sys.exit(1)

    for conv in selected:
        if choice == "1":
            rag.delete_chat_history_documents(conv.id)
            print(f"  Limpiado historial de chat en {conv.title!r} ({conv.id})", file=sys.stderr)
        elif choice == "2":
            rag.delete_ingested_documents(conv.id)
            print(f"  Limpiada ingesta en {conv.title!r} ({conv.id})", file=sys.stderr)
        else:
            rag.delete_conversation_documents(conv.id)
            print(f"  Limpiado todo Chroma en {conv.title!r} ({conv.id})", file=sys.stderr)

    print("\nListo.", file=sys.stderr)


if __name__ == "__main__":
    main()
