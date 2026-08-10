#!/usr/bin/env bash
set -euo pipefail

DROPIN_DIR=/etc/systemd/system/ollama.service.d
DROPIN_FILE="$DROPIN_DIR/override.conf"

echo "Creando drop-in systemd: $DROPIN_FILE"
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN_FILE" <<'CONF'
[Service]
# Permite Harpa AI y otras extensiones Chrome + orígenes locales.
Environment="OLLAMA_ORIGINS=chrome-extension://*,http://localhost,http://127.0.0.1,https://localhost,https://127.0.0.1"
CONF

systemctl daemon-reload
systemctl restart ollama
sleep 1

echo "--- Environment efectivo ---"
systemctl show ollama -p Environment --no-pager

echo "--- Estado ---"
systemctl is-active ollama

echo "--- Prueba CORS chrome-extension ---"
code=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST http://127.0.0.1:11434/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Origin: chrome-extension://abcdefghijklmnopqrstuvwxyz123456' \
  -d '{"model":"qwen3:8b","messages":[{"role":"user","content":"ok"}],"max_tokens":4,"stream":false}' || true)
echo "POST con Origin chrome-extension => HTTP $code"
if [[ "$code" == "200" ]]; then
  echo "OK: Harpa debería poder conectar."
else
  echo "FALLÓ: revisa journalctl -u ollama -n 50"
  exit 1
fi
