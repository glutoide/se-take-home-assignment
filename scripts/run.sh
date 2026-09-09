#!/bin/bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

cat <<'COMMANDS' | ORDER_PROCESS_MS=10000 node src/cli.js > scripts/result.txt
normal
vip
normal
+bot
+bot
wait 1000
-bot
status
wait 9500
status
exit
COMMANDS

cat scripts/result.txt
