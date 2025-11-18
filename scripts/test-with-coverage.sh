#!/bin/bash

# Combined unit + E2E coverage script
# Runs both unit tests with coverage and E2E tests, then consolidates with nyc
# Usage: yarn test:coverage

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
node scripts/aggregate-e2e-coverage.mjs

echo ""
echo "5️⃣  Consolidating all coverage reports with nyc..."
nyc report --reporter=text --reporter=html --reporter=lcov --reporter=json

echo ""
echo "✅ Coverage report complete!"
echo "📊 Open coverage/index.html to view detailed coverage report"
