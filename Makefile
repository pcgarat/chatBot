# Chat IA con Ollama - Makefile
SHELL := /bin/bash
VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn
PYTEST := $(VENV)/bin/pytest
# Cobertura: siempre sobre app; exclusiones en .coveragerc
COVERAGE_OPTS := --cov=app --cov-report=term-missing
PORT ?= 8000
PIDFILE := .server.pid

# Versión de Python para crear el entorno virtual. Lee .env (PYTHON_VERSION=3.12); si no existe, 3.12 por defecto.
PYTHON_VERSION := $(strip $(shell grep '^PYTHON_VERSION=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r'))
ifeq ($(PYTHON_VERSION),)
PYTHON_VERSION := 3.12
endif
PYTHON_CMD := python$(PYTHON_VERSION)

.PHONY: help up down start start-verbose stop reload reload-dev restart-dev test coverage-html mutation-test status clean setup
.PHONY: chroma-up chroma-down chroma-logs chroma-status chroma-clean chroma-ping ingest venv312

help:
	@echo "Chat IA con Ollama - Comandos disponibles:"
	@echo ""
	@echo "  App (no tocan el contenedor Docker de Chroma):"
	@echo "  make up      Crear entorno virtual (Python desde .env PYTHON_VERSION, por defecto 3.12), instalar deps e iniciar"
	@echo "  make down    Detener la aplicación y eliminar el entorno virtual"
	@echo "  make start   Iniciar el servidor (puerto $(PORT))"
	@echo "  make stop    Detener el servidor"
	@echo "  make reload  make down + make up (reinicio completo)"
	@echo "  make reload-dev  make down + setup + tests + start-verbose (dev con tests antes de levantar)"
	@echo "  make restart-dev  make stop + tests + start-verbose (rápido: sin recrear venv)"
	@echo "  make test    Ejecutar los tests sin e2e (con cobertura sobre app); e2e solo con make test-e2e"
	@echo "  make test-e2e  Ejecutar solo tests e2e (requieren Ollama levantado)"
	@echo "  make test-no-e2e  Alias de make test (tests sin e2e)"
	@echo "  make coverage-html  Tests + informe HTML de cobertura (htmlcov/index.html)"
	@echo "  make mutation-test  Tests de mutación con mutmut (config en setup.cfg); genera .mutmut-cache"
	@echo "  make status  Mostrar estado del entorno y del servidor"
	@echo "  make clean   Parar la app y borrar .server.pid (no toca Docker ni Chroma)"
	@echo "  make start-verbose  Iniciar con -v (volcar en stderr lo enviado a Ollama)"
	@echo ""
	@echo "  ChromaDB (solo gestión del contenedor Docker):"
	@echo "  make chroma-up     Levantar contenedor (puerto 8001); datos en ./data/chroma"
	@echo "  make chroma-down   Solo bajar el contenedor; los datos en ./data/chroma se conservan"
	@echo "  make chroma-clean  Bajar el contenedor y borrar el volumen (./data/chroma) — deja Chroma a cero"
	@echo "  make chroma-ping   Probar conectividad con ChromaDB (usa CHROMA_HOST de .env)"
	@echo "  make chroma-logs   Ver logs del contenedor ChromaDB"
	@echo "  make chroma-status Estado del contenedor (docker compose ps)"
	@echo ""
	@echo "  RAG / ingestar o limpiar Chroma:"
	@echo "  make ingest [FILE=archivo.txt] Ingesta archivo en Chroma para conversaciones elegidas (por defecto archivo.txt)"
	@echo "  make clean-chroma   Limpia datos de Chroma: elige conversaciones y qué borrar (historial, ingesta o todo)"
	@echo "  make venv312   Crear .venv312 con Python 3.12 para ingest/clean-chroma (hazlo si falla por Python 3.14)"
	@echo ""
	@echo "  make help    Mostrar esta ayuda"
	@echo ""

# Valor por defecto de Chroma (mismo que en docker-compose: puerto 8001 en el host)
CHROMA_DEFAULT := http://localhost:8001
# Usar Python 3.12 (.venv312) para start si existe, para que RAG/Chroma funcione (Chroma falla en 3.14)
PYTHON_RUN := $(if $(wildcard .venv312/bin/python),.venv312/bin/python,$(PYTHON))

setup:
	@echo "Actualizando .env desde variables de entorno (OPENAI_API_KEY, CHROMA_HOST, MANCERAI_API_KEY)..."
	@touch .env
	@# Leer valores existentes del .env
	@existing_openai=$$(grep '^OPENAI_API_KEY=' .env 2>/dev/null | head -1 | cut -d= -f2-); \
	existing_chroma=$$(grep '^CHROMA_HOST=' .env 2>/dev/null | head -1 | cut -d= -f2-); \
	existing_mancer=$$(grep '^MANCER_API_KEY=' .env 2>/dev/null | head -1 | cut -d= -f2-); \
	existing_python=$$(grep '^PYTHON_VERSION=' .env 2>/dev/null | head -1 | cut -d= -f2-); \
	grep -v '^OPENAI_API_KEY=' .env 2>/dev/null | grep -v '^CHROMA_HOST=' | grep -v '^MANCER_API_KEY=' | grep -v '^PYTHON_VERSION=' > .env.tmp || true; \
	mv .env.tmp .env 2>/dev/null || true; \
	if [ -n "$$OPENAI_API_KEY" ]; then \
		echo "OPENAI_API_KEY=$$OPENAI_API_KEY" >> .env; \
		echo "  OPENAI_API_KEY actualizada desde entorno"; \
	elif [ -n "$$existing_openai" ]; then \
		echo "OPENAI_API_KEY=$$existing_openai" >> .env; \
		echo "  OPENAI_API_KEY preservada"; \
	else \
		echo "  OPENAI_API_KEY no definida (opcional para RAG con OpenAI embeddings)"; \
	fi; \
	if [ -n "$$CHROMA_HOST" ]; then \
		echo "CHROMA_HOST=$$CHROMA_HOST" >> .env; \
		echo "  CHROMA_HOST actualizado desde entorno"; \
	elif [ -n "$$existing_chroma" ]; then \
		echo "CHROMA_HOST=$$existing_chroma" >> .env; \
		echo "  CHROMA_HOST preservado"; \
	else \
		echo "CHROMA_HOST=$(CHROMA_DEFAULT)" >> .env; \
		echo "  CHROMA_HOST=$(CHROMA_DEFAULT) (default)"; \
	fi; \
	if [ -n "$$MANCERAI_API_KEY" ]; then \
		echo "MANCER_API_KEY=$$MANCERAI_API_KEY" >> .env; \
		echo "  MANCER_API_KEY actualizada desde MANCERAI_API_KEY"; \
	elif [ -n "$$existing_mancer" ]; then \
		echo "MANCER_API_KEY=$$existing_mancer" >> .env; \
		echo "  MANCER_API_KEY preservada"; \
	else \
		echo "  MANCER_API_KEY no definida (opcional para Mancer LLM)"; \
	fi; \
	if [ -n "$$PYTHON_VERSION" ]; then \
		echo "PYTHON_VERSION=$$PYTHON_VERSION" >> .env; \
		echo "  PYTHON_VERSION actualizada desde entorno"; \
	elif [ -n "$$existing_python" ]; then \
		echo "PYTHON_VERSION=$$existing_python" >> .env; \
		echo "  PYTHON_VERSION preservada ($$existing_python)"; \
	else \
		echo "PYTHON_VERSION=3.12" >> .env; \
		echo "  PYTHON_VERSION=3.12 (default para crear .venv)"; \
	fi
	@if [ ! -d $(VENV) ]; then \
		command -v $(PYTHON_CMD) >/dev/null || { echo "Error: $(PYTHON_CMD) no encontrado. Instálalo o define PYTHON_VERSION en .env (ej. 3.12)."; exit 1; }; \
		echo "Creando entorno virtual con $(PYTHON_CMD)..."; \
		$(PYTHON_CMD) -m venv $(VENV); \
	fi
	@echo "Instalando dependencias..."
	@$(PIP) install -r requirements.txt

up: setup
	@$(MAKE) start

reload: down
	$(MAKE) up

reload-dev: down
	@$(MAKE) setup
	@$(MAKE) test
	@$(MAKE) start-verbose

restart-dev:
	@$(MAKE) stop
	@$(MAKE) setup
	@$(MAKE) test
	@$(MAKE) start-verbose

down:
	@if [ -f $(PIDFILE) ]; then $(MAKE) stop; fi
	@echo "Eliminando entorno virtual..."
	@rm -rf $(VENV)
	@echo "Entorno eliminado."

start: $(VENV)/bin/uvicorn
	@if [ -f $(PIDFILE) ]; then \
		pid=$$(cat $(PIDFILE)); \
		if kill -0 $$pid 2>/dev/null; then \
			echo "El servidor ya está en marcha (PID $$pid). Usa 'make stop' para detenerlo."; \
			exit 0; \
		fi; \
		rm -f $(PIDFILE); \
	fi
	@echo "Iniciando servidor en http://0.0.0.0:$(PORT) ..."
	@$(PYTHON_RUN) -m uvicorn app.main:app --host 0.0.0.0 --port $(PORT) & echo $$! > $(PIDFILE)
	@sleep 1
	@echo "Servidor iniciado (PID $$(cat $(PIDFILE))). Usa 'make stop' para detenerlo."

start-verbose: $(VENV)/bin/uvicorn
	@if [ -f $(PIDFILE) ]; then \
		pid=$$(cat $(PIDFILE)); \
		if kill -0 $$pid 2>/dev/null; then \
			$(MAKE) stop; \
		fi; \
		rm -f $(PIDFILE); \
	fi
	@echo "Iniciando servidor con -v en http://0.0.0.0:$(PORT) ..."
	@VERBOSE=1 $(PYTHON_RUN) run.py -v --host 0.0.0.0 --port $(PORT) & echo $$! > $(PIDFILE)
	@sleep 1
	@echo "Servidor iniciado con modo verbose (PID $$(cat $(PIDFILE))). Usa 'make stop' para detenerlo."

stop:
	@if [ -f $(PIDFILE) ]; then \
		pid=$$(cat $(PIDFILE)); \
		if kill -0 $$pid 2>/dev/null; then \
			kill $$pid && echo "Servidor detenido (PID $$pid)."; \
		else \
			echo "El proceso $$pid no está en ejecución."; \
		fi; \
		rm -f $(PIDFILE); \
	else \
		echo "No hay PID guardado. Buscando proceso uvicorn en puerto $(PORT)..."; \
		pid=$$(lsof -ti:$(PORT) 2>/dev/null || true); \
		if [ -n "$$pid" ]; then \
			kill $$pid 2>/dev/null && echo "Servidor detenido (PID $$pid)." || true; \
		else \
			echo "No se encontró servidor en ejecución."; \
		fi; \
	fi

# Por defecto no se incluyen e2e (ralentizan); usar make test-e2e para ejecutarlos
test: $(VENV)/bin/pytest
	$(PYTEST) -m "not e2e" $(COVERAGE_OPTS)

# Tests e2e: requieren Ollama accesible; solo se ejecutan con make test-e2e
test-e2e: $(VENV)/bin/pytest
	$(PYTEST) -m e2e -v

# Alias explícito: tests sin e2e (mismo que make test)
test-no-e2e: $(VENV)/bin/pytest
	$(PYTEST) -m "not e2e" $(COVERAGE_OPTS)

# Tests de mutación (mutmut). Config en setup.cfg; ver INFORME_MUTACIONES.md.
# En algunos entornos la fase "stats" puede fallar (multiprocessing); entonces ejecutar
# por módulo: python -m mutmut run app/slash_commands.py
mutation-test: $(VENV)/bin/pytest
	$(PIP) install -q mutmut
	$(VENV)/bin/python -m mutmut run
	$(PYTHON) scripts/generate_mutation_report.py || true

# Solo generar el informe de mutaciones (requiere haber ejecutado antes make mutation-test)
mutation-report:
	$(PYTHON) scripts/generate_mutation_report.py

# Informe HTML de cobertura (sin e2e; mismo criterio que make test)
coverage-html: $(VENV)/bin/pytest
	$(PYTEST) -m "not e2e" --cov=app --cov-report=term-missing --cov-report=html

# Ingestar archivo de texto en Chroma (ChromaDB no va con Python 3.14; se usa .venv312 con 3.12 si existe)
FILE ?= archivo.txt
VENV312 := .venv312
PYTHON_INGEST := $(if $(wildcard $(VENV312)/bin/python),$(VENV312)/bin/python,$(PYTHON))
ingest: $(VENV)/bin/uvicorn
	@$(PYTHON_INGEST) scripts/ingest_to_conversations.py "$(FILE)"

clean-chroma: $(VENV)/bin/uvicorn
	@$(PYTHON_INGEST) scripts/clean_chroma_conversations.py

# Crear venv con Python 3.12 para ingest/clean-chroma (necesario si el venv principal es Python 3.14)
venv312:
	@command -v python3.12 >/dev/null || { echo "Necesitas Python 3.12 instalado (ChromaDB falla en 3.14)."; exit 1; }
	@python3.12 -m venv $(VENV312)
	@$(VENV312)/bin/pip install -q -r requirements.txt
	@echo "Creado $(VENV312) con Python 3.12. Ya puedes usar: make ingest"

status:
	@echo "=== Estado ==="
	@echo "Python para crear .venv: $(PYTHON_CMD) (desde .env PYTHON_VERSION, default 3.12)"
	@if [ -d $(VENV) ]; then \
		echo "Entorno virtual: existe ($(VENV))"; \
		$(VENV)/bin/python --version 2>/dev/null || true; \
	else \
		echo "Entorno virtual: no existe. Ejecuta 'make up'."; \
	fi
	@if [ -f $(PIDFILE) ]; then \
		pid=$$(cat $(PIDFILE)); \
		if kill -0 $$pid 2>/dev/null; then \
			echo "Servidor: en ejecución (PID $$pid, http://localhost:$(PORT))"; \
		else \
			echo "Servidor: no en ejecución (PID obsoleto en $(PIDFILE))"; \
		fi; \
	else \
		pid=$$(lsof -ti:$(PORT) 2>/dev/null || true); \
		if [ -n "$$pid" ]; then \
			echo "Servidor: en ejecución en puerto $(PORT) (PID $$pid)"; \
		else \
			echo "Servidor: no en ejecución"; \
		fi; \
	fi

$(VENV)/bin/uvicorn:
	@echo "Entorno virtual no encontrado o dependencias sin instalar. Ejecuta 'make up'."
	@exit 1

$(VENV)/bin/pytest:
	@echo "Entorno virtual no encontrado o dependencias sin instalar. Ejecuta 'make up'."
	@exit 1

# -----------------------------------------------------------------------------
# ChromaDB: solo estos objetivos gestionan el contenedor Docker. El resto no lo tocan.
# -----------------------------------------------------------------------------
chroma-up:
	@mkdir -p data/chroma
	docker compose up -d
	@echo "ChromaDB levantado (datos en ./data/chroma). App: CHROMA_HOST=http://localhost:8001"

chroma-down:
	docker compose down
	@echo "ChromaDB: contenedor bajado. Los datos en ./data/chroma se conservan (volumen intacto)."

chroma-clean:
	docker compose down
	@rm -rf data/chroma
	@echo "ChromaDB: contenedor bajado y volumen (./data/chroma) borrado — datos de Chroma eliminados."

chroma-ping:
	@echo "Comprobando conectividad con ChromaDB (CHROMA_HOST desde .env)..."
	@url=$$(grep '^CHROMA_HOST=' .env 2>/dev/null | cut -d= -f2- | tr -d '\r' | xargs); \
	url=$${url:-http://localhost:8001}; \
	url=$${url%/}; \
	if curl -sf --connect-timeout 5 "$$url/api/v1" -o /dev/null; then \
		echo "ChromaDB OK: $$url (puerto expuesto y respondiendo)"; \
	else \
		echo "ChromaDB no alcanzable en $$url (¿contenedor levantado? make chroma-up)"; exit 1; \
	fi

chroma-logs:
	docker compose logs -f

chroma-status:
	@docker compose ps

# -----------------------------------------------------------------------------
# App: clean solo para la app (no toca el contenedor de Chroma).
# -----------------------------------------------------------------------------
clean:
	@$(MAKE) stop 2>/dev/null || true
	@rm -f $(PIDFILE)
	@echo "Limpiado: app detenida y PID eliminado. (Chroma/Docker no se ha tocado.)"
