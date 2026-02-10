"""
Slash commands en el mensaje del usuario para activar contexto MCP.

Ejemplo: "/git qué cambios hay" → el backend usa las tools del servidor MCP "git"
para este turno. El texto que recibe el modelo (y se guarda) es "qué cambios hay".

Comandos reconocidos: /git, /files, etc. (configurables).
"""
from __future__ import annotations

import re
from typing import NamedTuple

# Slash commands que activan un servidor/contexto MCP. Clave = comando (sin /), valor = identificador MCP.
# Cuando integres MCP, aquí mapeas "git" → servidor MCP de GitHub/git, "files" → filesystem, etc.
MCP_SLASH_COMMANDS: dict[str, str] = {
    "git": "git",
    "files": "files",
    "github": "github",
}

# Patrón: /comando al inicio (opcional espacio tras la barra), resto = mensaje
_SLASH_RE = re.compile(r"^/(\w+)(?:\s+)?(.*)", re.DOTALL)


class SlashParseResult(NamedTuple):
    """Resultado de parsear el contenido del mensaje."""

    content: str
    """Texto a enviar al modelo y guardar (sin el slash command)."""
    mcp_contexts: list[str]
    """Lista de contextos MCP a activar para este turno (ej. ['git'])."""
    used_slash: str | None
    """Comando usado (ej. 'git') o None si no había slash."""


def parse_slash_command(raw_content: str) -> SlashParseResult:
    """
    Si el mensaje empieza por /comando (ej. /git), extrae el comando y el resto del texto.

    - content: texto limpio para el modelo (sin "/git ").
    - mcp_contexts: lista de identificadores MCP a usar (ej. ["git"]).
    - used_slash: el comando usado o None.

    Si no hay slash o el comando no está en MCP_SLASH_COMMANDS, devuelve el texto tal cual
    y mcp_contexts vacío.
    """
    if not raw_content or not raw_content.strip():
        return SlashParseResult(content=raw_content, mcp_contexts=[], used_slash=None)

    stripped = raw_content.strip()
    m = _SLASH_RE.match(stripped)
    if not m:
        return SlashParseResult(content=raw_content, mcp_contexts=[], used_slash=None)

    cmd = m.group(1).lower()
    rest = (m.group(2) or "").strip()

    if cmd not in MCP_SLASH_COMMANDS:
        # Comando desconocido: no lo tratamos como MCP, dejamos el texto igual
        return SlashParseResult(content=raw_content, mcp_contexts=[], used_slash=None)

    mcp_id = MCP_SLASH_COMMANDS[cmd]
    # Si el usuario solo escribió "/git" sin más, usamos un mensaje mínimo para no enviar vacío
    content = rest if rest else "(usa las herramientas disponibles para esta petición)"
    return SlashParseResult(
        content=content,
        mcp_contexts=[mcp_id],
        used_slash=cmd,
    )
