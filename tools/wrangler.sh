#!/bin/sh
# Roda o wrangler do signal-worker com o Electron no papel de Node.
# Ex.: sh tools/wrangler.sh deploy   (precisa de "wrangler login" na conta Cloudflare do Felipe)
T="$(cd "$(dirname "$0")" && pwd)"; R="$(cd "$T/.." && pwd)"
cd "$R/signal-worker"
WRANGLER_SEND_METRICS=false ELECTRON_RUN_AS_NODE=1 NODE_OPTIONS="--require $(cygpath -w "$T/release/eb-wrap.js")" \
  "$R/../electron-runtime/electron.exe" node_modules/wrangler/bin/wrangler.js "$@"
