"""Tests para parse_slash_command: vacío, sin slash, comando desconocido, /git, /git algo, used_slash y mcp_contexts."""
import pytest

from app.slash_commands import parse_slash_command


def test_parse_slash_vacio():
    """Contenido vacío o solo espacios: used_slash None, mcp_contexts vacío."""
    r = parse_slash_command("")
    assert r.content == ""
    assert r.mcp_contexts == []
    assert r.used_slash is None

    r2 = parse_slash_command("   ")
    assert r2.content == "   "
    assert r2.mcp_contexts == []
    assert r2.used_slash is None


def test_parse_slash_sin_slash():
    """Texto sin barra inicial: se devuelve tal cual, used_slash None."""
    r = parse_slash_command("hola")
    assert r.content == "hola"
    assert r.mcp_contexts == []
    assert r.used_slash is None

    r2 = parse_slash_command("dime algo sobre / cosas")
    assert r2.content == "dime algo sobre / cosas"
    assert r2.mcp_contexts == []
    assert r2.used_slash is None


def test_parse_slash_comando_desconocido():
    """Comando no reconocido: texto igual, mcp_contexts vacío, used_slash None."""
    r = parse_slash_command("/unknown x")
    assert r.content == "/unknown x"
    assert r.mcp_contexts == []
    assert r.used_slash is None

    r2 = parse_slash_command("/foo bar baz")
    assert r2.content == "/foo bar baz"
    assert r2.mcp_contexts == []
    assert r2.used_slash is None


def test_parse_slash_git_solo():
    """/git sin argumentos: content mensaje por defecto, mcp_contexts ['git'], used_slash 'git'."""
    r = parse_slash_command("/git")
    assert r.mcp_contexts == ["git"]
    assert r.used_slash == "git"
    assert "herramientas" in r.content

    r2 = parse_slash_command("  /git  ")
    assert r2.mcp_contexts == ["git"]
    assert r2.used_slash == "git"


def test_parse_slash_git_con_texto():
    """/git algo: content es el resto del texto, mcp_contexts ['git'], used_slash 'git'."""
    r = parse_slash_command("/git qué cambios hay")
    assert r.content == "qué cambios hay"
    assert r.mcp_contexts == ["git"]
    assert r.used_slash == "git"

    r2 = parse_slash_command("/git   status")
    assert r2.content == "status"
    assert r2.mcp_contexts == ["git"]
    assert r2.used_slash == "git"


def test_parse_slash_github_mcp_context():
    """Comando /github activa mcp_contexts ['github']."""
    r = parse_slash_command("/github list issues")
    assert r.content == "list issues"
    assert r.mcp_contexts == ["github"]
    assert r.used_slash == "github"


def test_parse_slash_comando_minusculas():
    """El comando se normaliza a minúsculas para la búsqueda."""
    r = parse_slash_command("/GIT algo")
    assert r.used_slash == "git"
    assert r.mcp_contexts == ["git"]
    assert r.content == "algo"
