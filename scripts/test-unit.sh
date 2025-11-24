#!/bin/bash
set -e

echo "Running frontend unit tests with coverage..."
VITEST_COVERAGE=true node scripts/run-vitest-groups.mjs --run

echo "Running backend unit tests with coverage..."
cd src-tauri && cargo tarpaulin -o Lcov --output-dir ../coverage --lib --timeout 300 && mv ../coverage/lcov.info ../coverage/rust-lcov.info || true
cd - > /dev/null

echo "Merging unit test coverage reports..."
node scripts/merge-coverage.mjs

echo "Checking coverage thresholds..."
node scripts/check-coverage.js
