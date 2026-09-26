#!/usr/bin/env bash
# Arranque/parada del stack de desarrollo: API (reload) + Vite.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-8000}"
VITE_PORT="${VITE_PORT:-5173}"
VITE_HOST="${VITE_HOST:-0.0.0.0}"
PIDFILE="${PIDFILE:-.server.pid}"
VITE_PIDFILE="${VITE_PIDFILE:-.vite.pid}"
VERBOSE="${VERBOSE:-1}"
PYTHON_RUN="${PYTHON_RUN:-}"

if [[ -z "$PYTHON_RUN" ]]; then
  if [[ -x .venv312/bin/python ]]; then
    PYTHON_RUN=".venv312/bin/python"
  elif [[ -x .venv/bin/python ]]; then
    PYTHON_RUN=".venv/bin/python"
  else
    echo "No hay entorno virtual. Ejecuta 'make setup' o 'make up-dev'." >&2
    exit 1
  fi
fi

kill_tree() {
  local pid="${1:-}"
  [[ -n "$pid" ]] || return 0
  kill -0 "$pid" 2>/dev/null || return 0
  local children
  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  local child
  for child in $children; do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

kill_pidfile() {
  local file="$1"
  local label="$2"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  local pid
  pid="$(tr -d '[:space:]' < "$file" 2>/dev/null || true)"
  if [[ -n "$pid" ]]; then
    kill_tree "$pid"
    wait "$pid" 2>/dev/null || true
    echo "Detenido $label (PID $pid)."
  fi
  rm -f "$file"
}

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Liberando puerto $port (PID $pids)..."
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.3
  fi
}

print_lan_url() {
  [[ "$VITE_HOST" == "0.0.0.0" ]] || return 0
  local ip
  ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}')"
  [[ -n "$ip" ]] || return 0
  echo "  En red:   http://${ip}:${VITE_PORT}"
}

cmd_stop() {
  local stopped=0
  if [[ -f "$PIDFILE" ]]; then
    kill_pidfile "$PIDFILE" "backend"
    stopped=1
  fi
  if [[ -f "$VITE_PIDFILE" ]]; then
    kill_pidfile "$VITE_PIDFILE" "vite"
    stopped=1
  fi
  if [[ "$stopped" -eq 0 ]]; then
    echo "No hay PID guardado. Buscando proceso uvicorn en puerto $PORT..."
    local pids
    pids="$(lsof -ti:"$PORT" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null && echo "Servidor detenido (PID $pids)." || true
    else
      echo "No se encontró servidor en ejecución."
    fi
  fi
}

cmd_start() {
  if ! command -v npm >/dev/null; then
    echo "up-dev necesita npm (Node 20+)." >&2
    exit 1
  fi
  if [[ ! -d frontend/node_modules ]]; then
    echo "Instalando dependencias del frontend..."
    (cd frontend && npm install)
  fi

  cmd_stop
  free_port "$PORT"
  free_port "$VITE_PORT"

  local backend_pid vite_pid
  backend_pid=""
  vite_pid=""

  cleanup() {
    trap - EXIT INT TERM
    echo ""
    echo "Parando backend y frontend..."
    [[ -n "$backend_pid" ]] && kill_tree "$backend_pid"
    [[ -n "$vite_pid" ]] && kill_tree "$vite_pid"
    rm -f "$PIDFILE" "$VITE_PIDFILE"
    wait 2>/dev/null || true
  }
  trap cleanup EXIT INT TERM

  local verbose_args=()
  if [[ "$VERBOSE" == "1" ]]; then
    verbose_args=(-v)
    export VERBOSE=1
  fi

  echo ""
  echo "  Frontend: http://localhost:${VITE_PORT}"
  echo "  Backend:  http://localhost:${PORT}"
  print_lan_url
  echo ""
  echo "Abre el Frontend. Ctrl+C para parar ambos."
  echo ""

  "$PYTHON_RUN" run.py "${verbose_args[@]}" --reload --host 0.0.0.0 --port "$PORT" &
  backend_pid=$!
  echo "$backend_pid" > "$PIDFILE"

  (cd frontend && npm run dev -- --port "$VITE_PORT" --host "$VITE_HOST") &
  vite_pid=$!
  echo "$vite_pid" > "$VITE_PIDFILE"

  sleep 1
  echo ""
  echo "  Frontend: http://localhost:${VITE_PORT}"
  echo "  Backend:  http://localhost:${PORT}"
  print_lan_url
  echo ""

  wait -n "$backend_pid" "$vite_pid" || true
}

case "${1:-start}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  *)
    echo "Uso: $0 {start|stop}" >&2
    exit 1
    ;;
esac
