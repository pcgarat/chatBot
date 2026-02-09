#!/usr/bin/env python3
"""Launcher de la aplicación. Acepta -v para volcar en stderr lo que se envía a Ollama."""
import argparse
import os
import sys


def main():
    parser = argparse.ArgumentParser(description="Chat IA con Ollama")
    parser.add_argument(
        "-v",
        action="store_true",
        dest="verbose",
        help="Volcar en stderr el payload enviado a Ollama (modelo + mensajes) en cada petición",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Puerto (default: 8000)")
    args = parser.parse_args()

    if args.verbose:
        os.environ["VERBOSE"] = "1"

    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
