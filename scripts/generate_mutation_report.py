#!/usr/bin/env python3
"""
Genera INFORME_MUTACIONES_RESULTADOS.md a partir de la caché de mutmut.

Se ejecuta después de `mutmut run`. Lee los resultados con `mutmut results`,
parsea los estados (killed, survived, suspicious, timeout, skipped, not checked)
y escribe un informe markdown con resumen y lista de mutantes survived/suspicious
para priorizar mejoras de tests o código.

Uso:
  python scripts/generate_mutation_report.py
  make mutation-report   # o como paso final de make mutation-test
"""

from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Raíz del proyecto (parent de scripts/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = PROJECT_ROOT / "INFORME_MUTACIONES_RESULTADOS.md"

# Patrón: "    app.module.func_mutmut_N: status" o similar
RESULT_LINE_RE = re.compile(r"^\s*([\w.\d_]+):\s*(\S.*)$")


def run_mutmut_results() -> str:
    """Ejecuta mutmut results y devuelve la salida."""
    try:
        out = subprocess.run(
            [sys.executable, "-m", "mutmut", "results"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return out.stdout + out.stderr
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        return f"(Error al ejecutar mutmut results: {e})"


def parse_results(output: str) -> tuple[dict[str, list[str]], dict[str, int]]:
    """
    Parsea la salida de mutmut results.
    Devuelve (por_estado, contadores) donde por_estado[status] = [id1, id2, ...].
    """
    por_estado: dict[str, list[str]] = defaultdict(list)
    for line in output.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        m = RESULT_LINE_RE.match(line)
        if not m:
            if ":" in stripped:
                part = stripped.split(":", 1)
                if len(part) == 2:
                    mutant_id = part[0].strip()
                    status = part[1].strip().lower()
                    por_estado[status].append(mutant_id)
            continue
        mutant_id, status = m.groups()
        status = status.strip().lower()
        por_estado[status].append(mutant_id)

    contadores = {k: len(v) for k, v in por_estado.items()}
    return dict(por_estado), contadores


def mutation_score(killed: int, survived: int) -> str:
    """Calcula el mutation score como porcentaje."""
    total = killed + survived
    if total == 0:
        return "—"
    return f"{(100 * killed / total):.1f}%"


def agrupar_por_modulo(ids: list[str]) -> dict[str, list[str]]:
    """Agrupa IDs de mutantes por módulo (app.xxx.yyy -> app/xxx.py)."""
    por_modulo: dict[str, list[str]] = defaultdict(list)
    for mid in ids:
        # app.crud.x_delete_message_mutmut_1 -> app/crud.py
        parts = mid.split(".")
        if len(parts) >= 2 and parts[0] == "app":
            mod = parts[1]
            path = f"app/{mod}.py"
            por_modulo[path].append(mid)
    return dict(por_modulo)


def escribir_informe(por_estado: dict[str, list[str]], contadores: dict[str, int]) -> None:
    """Escribe INFORME_MUTACIONES_RESULTADOS.md."""
    killed = contadores.get("killed", 0)
    survived = contadores.get("survived", 0)
    suspicious = contadores.get("suspicious", 0)
    timeout = contadores.get("timeout", 0)
    skipped = contadores.get("skipped", 0)
    not_checked = contadores.get("not checked", 0)
    total = sum(contadores.values())
    score = mutation_score(killed, survived)

    survived_ids = por_estado.get("survived", []) + por_estado.get("survived ", [])
    suspicious_ids = por_estado.get("suspicious", []) + por_estado.get("suspicious ", [])

    # Normalizar claves por si hay espacio
    for k in list(por_estado):
        if k.strip() != k:
            por_estado[k.strip()] = por_estado.pop(k)
    if not survived_ids:
        survived_ids = por_estado.get("survived", [])
    if not suspicious_ids:
        suspicious_ids = por_estado.get("suspicious", [])

    lines = [
        "# Informe de resultados de tests de mutación",
        "",
        f"**Generado:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "Este archivo se genera al ejecutar `make mutation-test` (o `mutmut run` seguido de este script).",
        "Úsalo para priorizar qué tests o código mejorar: los **survived** indican mutaciones no detectadas por los tests.",
        "",
        "---",
        "",
        "## 1. Resumen",
        "",
        "| Métrica | Valor |",
        "|---------|-------|",
        f"| Total mutantes | {total} |",
        f"| Killed | {killed} |",
        f"| Survived | {survived} |",
        f"| Suspicious | {suspicious} |",
        f"| Timeout | {timeout} |",
        f"| Skipped | {skipped} |",
        f"| Not checked | {not_checked} |",
        f"| **Mutation score** | {score} |",
        "",
        "El mutation score es killed / (killed + survived). Un score bajo indica muchos mutantes survived (tests o código a reforzar).",
        "",
        "---",
        "",
        "## 2. Mutantes survived (prioridad alta)",
        "",
        "Estos mutantes no fueron detectados por los tests. Conviene añadir o ajustar tests, o marcar líneas con `# pragma: no mutate` si la mutación es equivalente.",
        "",
    ]

    if survived_ids:
        por_mod = agrupar_por_modulo(survived_ids)
        for mod in sorted(por_mod.keys()):
            ids = por_mod[mod]
            lines.append(f"### {mod} ({len(ids)} survived)")
            lines.append("")
            for mid in sorted(ids)[:50]:  # Limitar a 50 por módulo para no hacer el informe enorme
                lines.append(f"- `{mid}`")
            if len(ids) > 50:
                lines.append(f"- ... y {len(ids) - 50} más.")
            lines.append("")
        lines.append("Para ver el diff de un mutante: `mutmut show <id>` (ej. `mutmut show app.crud.x_delete_message_mutmut_1`).")
        lines.append("")
    else:
        lines.append("No hay mutantes survived en esta ejecución.")
        lines.append("")

    if suspicious_ids:
        lines.extend([
            "---",
            "",
            "## 3. Mutantes suspicious",
            "",
            "Timeout o comportamiento dudoso; revisar manualmente.",
            "",
        ])
        for mid in sorted(suspicious_ids)[:30]:
            lines.append(f"- `{mid}`")
        if len(suspicious_ids) > 30:
            lines.append(f"- ... y {len(suspicious_ids) - 30} más.")
        lines.append("")

    lines.extend([
        "---",
        "",
        "## 4. Cómo usar este informe",
        "",
        "1. **Priorizar por módulo**: revisa la sección 2 y elige un módulo (ej. `app/crud.py`) con muchos survived.",
        "2. **Ver el cambio que no se detectó**: `mutmut show <mutant_id>`.",
        "3. **Añadir o mejorar tests** que fallen con esa mutación, o marcar la línea con `# pragma: no mutate` si es equivalente.",
        "4. **Re-ejecutar**: `make mutation-test` para regenerar el informe y comprobar que el mutation score mejora.",
        "",
    ])

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Informe escrito en {REPORT_PATH}")


def main() -> int:
    if not (PROJECT_ROOT / ".mutmut-cache").exists():
        print("No se encontró .mutmut-cache. Ejecuta antes 'mutmut run' (o make mutation-test).", file=sys.stderr)
        return 1
    output = run_mutmut_results()
    por_estado, contadores = parse_results(output)
    escribir_informe(por_estado, contadores)
    return 0


if __name__ == "__main__":
    sys.exit(main())
