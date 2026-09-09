#!/bin/bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
node --check src/order-controller.js
node --check src/cli.js
echo "Node.js CLI syntax validation passed"
