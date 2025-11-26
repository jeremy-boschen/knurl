#!/bin/bash

# Combined unit + E2E coverage script (Legacy - see test.sh)
# Runs both unit tests with coverage and E2E tests, then consolidates with nyc
# Note: This script is now called by test.sh and kept for reference

set -e

echo "=========================================="
echo "Running comprehensive test coverage"
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
echo "3️⃣  Merging frontend and backend unit test coverage..."
node scripts/merge-coverage.mjs

echo ""
echo "4️⃣  Running E2E tests with coverage..."
yarn wdio run ./wdio.conf.ts

echo ""
echo "5️⃣  Consolidating all coverage reports..."
node scripts/consolidate-coverage.mjs

echo ""
echo "✅ Coverage report complete!"
echo "📊 Open coverage/index.html to view detailed coverage report"
