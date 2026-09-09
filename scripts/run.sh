#!/bin/bash
set -euo pipefail

echo "Running CLI demo..."
node dist/cli.js --demo > scripts/result.txt
cat scripts/result.txt
