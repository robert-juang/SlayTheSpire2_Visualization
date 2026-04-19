#!/usr/bin/env bash

set -euo pipefail

echo "Running: npm run typecheck"
npm run typecheck

echo "Running: npm install"
npm install

echo "Running: npm run build"
npm run build

echo "Running: Chmod to assigning read and execute permissions to node_modules"
chmod -R a+x node_modules

echo "Running: npm run dev"
npm run dev
