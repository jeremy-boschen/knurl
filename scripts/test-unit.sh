#!/bin/bash
set -e

echo "Running frontend unit tests with coverage..."
VITEST_COVERAGE=true node scripts/run-vitest-groups.mjs --run

echo "Running backend unit tests..."
cd src-tauri && cargo test

echo "Merging unit test coverage reports..."
cd - > /dev/null
node scripts/merge-coverage.mjs

echo "Checking coverage thresholds..."
node scripts/check-coverage.js
