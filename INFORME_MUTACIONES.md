# Informe de tests de mutación

**Herramienta:** [mutmut](https://mutmut.readthedocs.io/) (mutation testing para Python).  
**Configuración:** `setup.cfg` (sección `[mutmut]`) y `make mutation-test`.

---

## 1. Qué son los tests de mutación

Los **tests de mutación** no sustituyen a los tests normales: los usan para medir su **calidad**.

- **Idea:** se introduce un pequeño cambio en el código (mutación), por ejemplo `x < 5` → `x <= 5`, o `return True` → `return False`.
- Si los tests **siguen pasando**, esa mutación **sobrevive** → o bien el cambio es equivalente, o bien los tests no cubren bien esa parte del código.
- Si los tests **fallan**, la mutación es **eliminada (killed)** → los tests detectan el fallo introducido.

Así se valora si la suite de tests es capaz de detectar fallos reales, no solo si el código está “ejecutado” (cobertura).

**Métricas típicas:**

| Métrica | Significado |
|--------|-------------|
| **Killed** | Mutación detectada por los tests (bueno). |
| **Survived** | Mutación no detectada; conviene revisar tests o código. |
| **Suspicious** | Timeout o comportamiento dudoso. |
| **Skipped** | Mutación no aplicada (ej. sintaxis inválida). |

Un **mutation score** alto (muchos killed, pocos survived) indica que los tests son sensibles a cambios en el código.

---

## 2. Configuración en este proyecto

### 2.1 Archivos

- **`setup.cfg`** – Configuración de mutmut:
  - **`paths_to_mutate=app/`** – Solo se muta código dentro de `app/`.
  - **`do_not_mutate`** – Se excluyen los mismos módulos que en `.coveragerc` (legacy, entrada FastAPI, migraciones, Protocol, api_ollama).
  - **`pytest_add_cli_args_test_selection=tests/`** – Pytest ejecuta los tests en `tests/`.

- **`.gitignore`** – Se ignoran `.mutmut-cache/` y `mutants/` (generados por mutmut).

- **`requirements-dev.txt`** – Incluye `mutmut>=3.0.0` para entornos de desarrollo.

### 2.2 Cómo ejecutar

```bash
# Instalar mutmut (si no está en el venv)
pip install mutmut
# o
pip install -r requirements-dev.txt

# Ejecutar todos los tests de mutación (muta todo app/ salvo exclusiones)
make mutation-test
# o
python -m mutmut run
```

**Mutar solo un módulo** (útil para pruebas o módulos críticos):

```bash
python -m mutmut run app/slash_commands.py
python -m mutmut run app/crud.py
```

### 2.3 Opciones desactivadas (y por qué)

- **`mutate_only_covered_lines`** – En algunos entornos (p. ej. Python 3.14 + coverage 7) la integración con coverage falla con `AssertionError` en el collector. Dejar comentado en `setup.cfg` hasta que mutmut/coverage lo soporten. Cuando esté activo, solo se mutan líneas cubiertas por tests (más rápido y enfocado).

- **`pytest_add_cli_args`** – Evitar argumentos extra de pytest en `setup.cfg` para no romper la fase de “stats” de mutmut (formato de argumentos).

---

## 3. Cómo interpretar los resultados

Cuando una pasada de `mutmut run` termina bien:

```bash
# Resumen por estado (killed, survived, etc.)
python -m mutmut results

# Ver solo mutaciones supervivientes (las más importantes)
python -m mutmut show survived

# Interfaz para explorar mutaciones
python -m mutmut browse
```

En `mutmut results` verás líneas como:

- `app.crud.xxx: killed` – Los tests detectaron la mutación.
- `app.crud.xxx: survived` – Ningún test falló; revisar si hace falta un test o si la mutación es equivalente.
- `app.crud.xxx: suspicious` – Revisar a mano (timeout, etc.).

Prioridad: **survived** > **suspicious** > killed/skipped.

---

## 4. Problemas conocidos en este entorno

Al ejecutar `make mutation-test` o `mutmut run` pueden aparecer:

1. **Fase de “Running stats”**  
   Mutmut ejecuta la suite de tests para recoger estadísticas; en algunos entornos (p. ej. Python 3.14 + pytest desde el directorio `mutants/`) se produce:
   - `RuntimeError: context has already been set` (multiprocessing).
   - O bien `BadTestExecutionCommandsException` por el formato de argumentos de pytest.  
   **Workaround:** ejecutar mutmut por módulos concretos (`mutmut run app/slash_commands.py`) o usar un entorno con Python 3.12 y las mismas dependencias para la fase de mutación.

2. **`mutate_only_covered_lines=true`**  
   Con coverage reciente puede aparecer `AssertionError` en `coverage.collector`. Por eso esta opción está comentada en `setup.cfg`. Cuando la compatibilidad esté resuelta, se puede descomentar para mutar solo líneas cubiertas.

3. **Directorios generados**  
   `mutants/` y `.mutmut-cache/` se crean durante la ejecución. Están en `.gitignore`; no es necesario versionarlos.

---

## 5. Resultados de la última ejecución

**Estado:** No se ha completado una pasada global de mutación en este entorno por los fallos descritos en §4 (fase de stats / multiprocessing).

Cuando la ejecución termine correctamente, en esta sección se puede pegar:

- Número total de mutantes generados.
- Killed / Survived / Suspicious / Skipped.
- Mutation score (p. ej. killed / (killed + survived)).
- Lista breve de mutaciones **survived** por módulo (las que más conviene reforzar con tests).

**Ejemplo de cómo quedaría:**

```text
Total: 1234 mutantes
Killed: 980
Survived: 180
Suspicious: 12
Skipped: 62
Mutation score: 84.5%

Survived destacados:
- app/crud.py: delete_message (límite conversación inexistente)
- app/provider_params.py: build_extra_body (rama options vacío)
...
```

---

## 6. Recomendaciones

1. **Ejecutar mutación de forma periódica** (p. ej. en CI con Python 3.12) cuando se estabilice la compatibilidad con mutmut/coverage.
2. **Priorizar survived** en módulos críticos: crud, api_conversations, provider_params, slash_commands.
3. **Combinar con cobertura:** el informe `INFORME_COBERTURA_TESTS.md` indica qué código está cubierto; los tests de mutación indican si esa cobertura “detecta fallos”.
4. **Marcar líneas que no quieras mutar** con `# pragma: no mutate` si son equivalentes o no aportan (p. ej. constantes, versiones).

---

*Documento generado para el proyecto chatBot. Revisar según la versión de mutmut y del entorno Python/pytest.*
