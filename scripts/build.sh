#!/bin/bash
set -euo pipefail

echo "Building CLI..."
rm -rf dist
mkdir -p dist
node --check src/order-controller.js
node --check src/command-handler.js
node --check src/cli.js
cp src/*.js dist/
echo "Build completed"
