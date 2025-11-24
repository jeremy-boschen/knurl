#!/bin/bash
set -e

echo "=========================================="
echo "Running quick test check ([CRITICAL] tests only)"
echo "=========================================="

echo ""
echo "1️⃣  Running frontend unit tests..."
node scripts/run-vitest-groups.mjs --run

echo ""
echo "2️⃣  Running backend unit tests..."
cd src-tauri && cargo test
cd - > /dev/null

echo ""
echo "3️⃣  Running E2E [CRITICAL] tests only..."
bash scripts/test-e2e.sh --grep "\[CRITICAL\]"

echo ""
echo "=========================================="
echo "✅ Critical test suite passed!"
echo "=========================================="
