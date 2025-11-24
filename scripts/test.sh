#!/bin/bash
set -e

echo "=========================================="
echo "Running comprehensive test suite with coverage"
echo "=========================================="

# Clean coverage directories
rm -rf coverage .nyc_output
mkdir -p coverage

echo ""
echo "1️⃣  Running frontend unit tests with coverage..."
VITEST_COVERAGE=true node scripts/run-vitest-groups.mjs --run

echo ""
echo "2️⃣  Running backend unit tests..."
cd src-tauri && cargo test
cd - > /dev/null

echo ""
echo "3️⃣  Consolidating unit test coverage..."
node scripts/consolidate-coverage.mjs

echo ""
echo "4️⃣  Running E2E tests with coverage..."
yarn wdio run ./wdio.conf.ts

echo ""
echo "5️⃣  Consolidating all coverage reports..."
node scripts/consolidate-coverage.mjs

echo ""
echo "=========================================="
echo "✅ All tests passed with coverage!"
echo "📊 Open coverage/index.html to view coverage report"
echo "=========================================="
