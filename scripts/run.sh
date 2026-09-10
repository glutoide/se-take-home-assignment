#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f dist/cli.js ]]; then
  echo "ERROR: dist/cli.js not found. Run scripts/build.sh first." >&2
  exit 1
fi

rm -f scripts/result.txt
node dist/cli.js --demo > scripts/result.txt
cat scripts/result.txt
