#!/bin/bash
set -e

echo "Running frontend unit tests with coverage..."
VITEST_COVERAGE=true node scripts/run-vitest-groups.mjs --run

echo "Running backend unit tests..."
cd src-tauri && cargo test

echo "Consolidating coverage reports..."
cd - > /dev/null
node scripts/consolidate-coverage.mjs
