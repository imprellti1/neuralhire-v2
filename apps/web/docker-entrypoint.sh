#!/bin/sh
set -eu

escape_js_string() {
  printf '%s' "${1-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

mkdir -p /usr/share/nginx/html

echo "[NeuralHire] Generating runtime-config.js"
echo "[NeuralHire] APP_ENV=${VITE_APP_ENV:-}"
echo "[NeuralHire] HAS_DEMO_ACCOUNT=$([ -n "${VITE_DEMO_ACCOUNT_ID:-}" ] && echo true || echo false)"
echo "[NeuralHire] HAS_DEMO_ROLE=$([ -n "${VITE_DEMO_ROLE:-}" ] && echo true || echo false)"

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__NEURALHIRE_CONFIG__ = {
  VITE_API_URL: "$(escape_js_string "${VITE_API_URL:-https://api-v2.neuralhire.com.br}")",
  VITE_DEMO_ACCOUNT_ID: "$(escape_js_string "${VITE_DEMO_ACCOUNT_ID:-}")",
  VITE_DEMO_ROLE: "$(escape_js_string "${VITE_DEMO_ROLE:-}")",
  VITE_DEMO_USER_ID: "$(escape_js_string "${VITE_DEMO_USER_ID:-}")",
  VITE_APP_ENV: "$(escape_js_string "${VITE_APP_ENV:-}")"
};
EOF

exec nginx -g "daemon off;"
