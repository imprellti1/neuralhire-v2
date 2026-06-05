#!/bin/sh
set -eu

mkdir -p /usr/share/nginx/html

echo "[NeuralHire] Generating runtime-config.js"
echo "[NeuralHire] APP_ENV=${VITE_APP_ENV:-}"
echo "[NeuralHire] HAS_SUPABASE_URL=$([ -n "${VITE_SUPABASE_URL:-}" ] && echo true || echo false)"
echo "[NeuralHire] HAS_SUPABASE_ANON_KEY=$([ -n "${VITE_SUPABASE_ANON_KEY:-}" ] && echo true || echo false)"
echo "[NeuralHire] HAS_API_URL=$([ -n "${VITE_API_URL:-}" ] && echo true || echo false)"

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__NEURALHIRE_CONFIG__ = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL:-https://qvwbsadesksrhcslmmjg.supabase.co}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY:-}",
  VITE_API_URL: "${VITE_API_URL:-https://api.neuralhire.com.br}",
  VITE_APP_ENV: "${VITE_APP_ENV:-production}"
};
EOF

echo "[NeuralHire] runtime-config.js generated:"
cat /usr/share/nginx/html/runtime-config.js

exec nginx -g "daemon off;"
