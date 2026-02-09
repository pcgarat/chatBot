# Chat IA con Ollama - Makefile
SHELL := /bin/bash
VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn
PYTEST := $(VENV)/bin/pytest
PORT ?= 8000
PIDFILE := .server.pid

.PHONY: help up down start start-verbose stop reload test status

help:
	@echo "Chat IA con Ollama - Comandos disponibles:"
	@echo ""
	@echo "  make up      Crear entorno virtual, instalar dependencias e iniciar la aplicación"
	@echo "  make down    Detener la aplicación y eliminar el entorno virtual"
	@echo "  make start   Iniciar el servidor (puerto $(PORT))"
	@echo "  make stop    Detener el servidor"
	@echo "  make reload  make down + make up (reinicio completo)"
	@echo "  make test    Ejecutar los tests"
	@echo "  make status  Mostrar estado del entorno y del servidor"
	@echo "  make start-verbose  Iniciar con -v (volcar en stderr lo enviado a Ollama)"
	@echo "  make help    Mostrar esta ayuda"
	@echo ""

up:
	@if [ ! -d $(VENV) ]; then echo "Creando entorno virtual..."; python3 -m venv $(VENV); fi
	@echo "Instalando dependencias..."
	@$(PIP) install -r requirements.txt
	@$(MAKE) start

reload: down
	$(MAKE) up

down:
	@-[ -f $(PIDFILE) ] && ($(MAKE) stop || true)
	@echo "Eliminando entorno virtual..."
	rm -rf $(VENV)
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
	@$(UVICORN) app.main:app --host 0.0.0.0 --port $(PORT) & echo $$! > $(PIDFILE)
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
	@VERBOSE=1 $(PYTHON) run.py -v --host 0.0.0.0 --port $(PORT) & echo $$! > $(PIDFILE)
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

test: $(VENV)/bin/pytest
	$(PYTEST)

status:
	@echo "=== Estado ==="
	@if [ -d $(VENV) ]; then \
		echo "Entorno virtual: existe ($(VENV))"; \
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
