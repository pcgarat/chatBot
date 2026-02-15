#!/usr/bin/env python3
"""Launcher de la aplicación. Acepta -v para volcar en stderr lo que se envía a Ollama."""
import argparse
import os
import sys
from pathlib import Path


def _load_env_into_os(root: Path) -> None:
    """
    Carga .env y .env.local en os.environ (solo claves que aún no estén definidas).
    Así el proceso tiene todas las variables antes de importar la app y el sync puede
    llevarlas al .env si faltan allí (p. ej. MANCER_API_KEY en .env.local).
    """
    for name in (".env", ".env.local"):
        path = root / name
        if not path.exists():
            continue
        try:
            with open(path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, value = line.partition("=")
                    key = key.strip()
                    if key and key not in os.environ:
                        value = value.strip().strip('"').strip("'")
                        os.environ[key] = value
        except OSError:
            pass


def main():
    root = Path(__file__).resolve().parent
    _load_env_into_os(root)

    parser = argparse.ArgumentParser(description="Chat IA con Ollama")
    parser.add_argument(
        "-v",
        action="store_true",
        dest="verbose",
        help="Volcar en stderr el payload enviado a Ollama (modelo + mensajes) en cada petición",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Puerto (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Recargar servidor al cambiar código (hot reload)")
    args = parser.parse_args()

    if args.verbose:
        os.environ["VERBOSE"] = "1"

    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
