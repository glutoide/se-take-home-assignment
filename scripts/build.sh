#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

rm -rf dist
mkdir -p dist

node --check src/order-controller.js
node --check src/cli.js
cp src/order-controller.js src/cli.js dist/
chmod +x dist/cli.js

echo "Build complete: dist/cli.js"
