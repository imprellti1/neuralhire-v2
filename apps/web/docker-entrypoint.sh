#!/bin/sh
set -eu

mkdir -p /usr/share/nginx/html

echo "[NeuralHire] Generating runtime-config.js"
echo "[NeuralHire] APP_ENV=${VITE_APP_ENV:-}"
echo "[NeuralHire] HAS_DEMO_ACCOUNT=$([ -n "${VITE_DEMO_ACCOUNT_ID:-}" ] && echo true || echo false)"
echo "[NeuralHire] HAS_DEMO_ROLE=$([ -n "${VITE_DEMO_ROLE:-}" ] && echo true || echo false)"

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__NEURALHIRE_CONFIG__ = {
  VITE_API_URL: "${VITE_API_URL:-https://api.neuralhire.com.br}",
  VITE_DEMO_ACCOUNT_ID: "${VITE_DEMO_ACCOUNT_ID:-}",
  VITE_DEMO_ROLE: "${VITE_DEMO_ROLE:-}",
  VITE_DEMO_USER_ID: "${VITE_DEMO_USER_ID:-}",
  VITE_APP_ENV: "${VITE_APP_ENV:-}"
};
EOF

echo "[NeuralHire] runtime-config.js generated:"
cat /usr/share/nginx/html/runtime-config.js

exec nginx -g "daemon off;"
