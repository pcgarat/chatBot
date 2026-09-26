"""Contrato de make up / make up-dev: qué levanta cada target."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAKEFILE = (ROOT / "Makefile").read_text(encoding="utf-8")
SCRIPT = (ROOT / "scripts" / "dev_stack.sh").read_text(encoding="utf-8")


def test_make_up_does_not_start_vite():
    up_block = MAKEFILE.split("\nup:")[1].split("\n\n")[0]
    assert "start" in up_block
    assert "frontend-dev" not in up_block
    assert "dev_stack" not in up_block
    assert "vite" not in up_block.lower()


def test_make_up_dev_installs_and_starts_backend_and_frontend():
    assert "\nup-dev:" in MAKEFILE
    block = MAKEFILE.split("\nup-dev:")[1].split("\n\n")[0]
    assert "setup" in block
    assert "dev_stack.sh" in block
    assert "chroma-up" not in block
    assert "$(MAKE) test" not in block


def test_start_and_up_dev_print_frontend_and_backend_urls():
    start = MAKEFILE.split("\nstart:")[1].split("\nstop:")[0]
    assert "print-app-urls" in start
    assert "Frontend:" in MAKEFILE
    assert "Backend:" in MAKEFILE
    assert "http://localhost:$(PORT)" in MAKEFILE or "APP_URL" in MAKEFILE
    assert "Frontend: http://localhost:${VITE_PORT}" in SCRIPT
    assert "Backend:  http://localhost:${PORT}" in SCRIPT
    assert SCRIPT.count("Frontend: http://localhost") >= 2
    assert "trap" in SCRIPT
    assert "--reload" in SCRIPT
    assert "npm run dev" in SCRIPT
    assert "run.py" in SCRIPT
    assert ".vite.pid" in SCRIPT


def test_vite_listens_on_all_interfaces():
    assert 'VITE_HOST="${VITE_HOST:-0.0.0.0}"' in SCRIPT
    assert '--host "$VITE_HOST"' in SCRIPT
    assert "--host 127.0.0.1" not in SCRIPT


def test_obsolete_make_targets_are_gone():
    help_start = MAKEFILE.split("\nhelp:")[1].split("\n# Valor por defecto")[0]
    for dead in (
        "frontend-dev",
        "reload-dev",
        "restart-dev",
        "start-verbose",
        "test-no-e2e",
    ):
        assert f"make {dead}" not in help_start
        assert f"\n{dead}:" not in MAKEFILE
    stop = MAKEFILE.split("\nstop:")[1].split("\n\n")[0]
    status = MAKEFILE.split("\nstatus:")[1]
    assert "dev_stack.sh stop" in stop
    assert "VITE_PIDFILE" in MAKEFILE
    assert "5173" in status or "vite" in status.lower() or "VITE_PIDFILE" in status
