"""Fuente del frontend React para contratos de UI (pytest)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_SRC = ROOT / "frontend" / "src"
FRONTEND_INDEX = ROOT / "frontend" / "index.html"


def iter_frontend_files():
    for path in sorted(FRONTEND_SRC.rglob("*")):
        if path.suffix not in {".js", ".jsx"}:
            continue
        if ".test." in path.name or path.name == "setup.js":
            continue
        yield path


def frontend_file(*relative_parts) -> str:
    return FRONTEND_SRC.joinpath(*relative_parts).read_text(encoding="utf-8")


def frontend_source(*relative_parts) -> str:
    if relative_parts:
        return "\n".join(frontend_file(*parts) if isinstance(parts, tuple) else frontend_file(parts) for parts in relative_parts)
    return "\n".join(path.read_text(encoding="utf-8") for path in iter_frontend_files())


def frontend_markup() -> str:
    raw = "\n".join(
        path.read_text(encoding="utf-8") for path in iter_frontend_files() if path.suffix == ".jsx"
    )
    index = FRONTEND_INDEX.read_text(encoding="utf-8") if FRONTEND_INDEX.exists() else ""
    return raw.replace("className=", "class=").replace("htmlFor=", "for=") + "\n" + index
