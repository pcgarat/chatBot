#!/usr/bin/env python3
"""
Comando para ingestar un archivo de texto en Chroma para una o varias conversaciones.

Uso:
  python scripts/ingest_to_conversations.py <archivo.txt>
  make ingest FILE=archivo.txt   # desde la raíz del proyecto

1. Muestra todas las conversaciones (título e id).
2. Permite seleccionar una o varias (p. ej. 1,3,5 o 1-4 o all).
3. Lee el archivo, genera embeddings y inserta el contenido en Chroma
   para cada conversación seleccionada.

Requisitos: CHROMA_HOST en .env; ChromaDB y Ollama (modelo mxbai-embed-large) en marcha.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Raíz en path y .env cargados antes de importar app
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from scripts import common

common.load_env_from_root()

from app import config, rag

if not (config.settings.openai_api_key or "").strip():
    config.settings.openai_api_key = os.environ.get("OPENAI_API_KEY", "")
if not (config.settings.chroma_host or "").strip():
    config.settings.chroma_host = os.environ.get("CHROMA_HOST", "") or "http://localhost:8001"
rag._chroma_available = None


def main():
    if len(sys.argv) < 2:
        print("Uso: python scripts/ingest_to_conversations.py <archivo.txt>", file=sys.stderr)
        sys.exit(1)
    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"Error: no existe el archivo {path}", file=sys.stderr)
        sys.exit(1)

    conversations = common.list_conversations()
    if not conversations:
        print("No hay conversaciones. Crea alguna desde la app antes de ingestar.", file=sys.stderr)
        sys.exit(1)

    selected = common.prompt_select_conversations(conversations)
    if not selected:
        print("Nada seleccionado. Saliendo.", file=sys.stderr)
        sys.exit(0)
    print(f"\nSeleccionadas {len(selected)} conversación(es).", file=sys.stderr)

    if not rag._rag_available():
        print("RAG no disponible (revisa CHROMA_HOST en .env y que Chroma y Ollama estén en marcha).", file=sys.stderr)
        sys.exit(1)

    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"Error leyendo {path}: {e}", file=sys.stderr)
        sys.exit(1)

    if not content.strip():
        print("El archivo está vacío.", file=sys.stderr)
        sys.exit(1)

    total_chunks = 0
    for conv in selected:
        print(f"\nIngestando en conversación {conv.title!r} ({conv.id})...", file=sys.stderr)
        n = rag.add_ingested_document(conv.id, content, verbose=True)
        total_chunks += n
        if n == 0:
            print(f"  (0 chunks; si viste error 429 arriba, es cuota de OpenAI — revisa facturación en platform.openai.com)", file=sys.stderr)

    print(f"\nListo: {total_chunks} chunk(s) con embeddings insertados en Chroma.", file=sys.stderr)


if __name__ == "__main__":
    main()
