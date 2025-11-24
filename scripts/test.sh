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
echo "2️⃣  Running backend unit tests with coverage..."
cd src-tauri
if cargo llvm-cov --version &> /dev/null 2>&1; then
  cargo llvm-cov --lib --lcov --output-path ../coverage/rust-lcov.info
  cargo llvm-cov --lib --cobertura --output-path ../coverage/cobertura-rust.xml
else
  echo "  (cargo-llvm-cov not installed, run: cargo install cargo-llvm-cov)"
  cargo test
fi
cd - > /dev/null

echo ""
echo "3️⃣  Merging unit test coverage..."
node scripts/merge-coverage.mjs

echo ""
echo "4️⃣  Running E2E tests with coverage..."
yarn wdio run ./wdio.conf.ts

echo ""
echo "5️⃣  Aggregating E2E coverage..."
node scripts/aggregate-e2e-coverage.mjs

echo ""
echo "6️⃣  Converting E2E coverage to Cobertura format..."
node scripts/convert-e2e-to-cobertura.mjs

echo ""
echo "7️⃣  Merging unit + E2E coverage into final report..."
node scripts/merge-coverage.mjs

echo ""
echo "8️⃣  Merging all Cobertura coverage sources (frontend + Rust + E2E)..."
node scripts/merge-cobertura.mjs

echo ""
echo "9️⃣  Checking coverage thresholds..."
node scripts/check-coverage.js

echo ""
echo "=========================================="
echo "✅ All tests passed with coverage!"
echo "📊 Open coverage/index.html to view coverage report"
echo "=========================================="
