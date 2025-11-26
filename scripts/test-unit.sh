#!/bin/bash
set -e

echo "Running frontend unit tests with coverage..."
VITEST_COVERAGE=true node scripts/run-vitest-groups.mjs --run

echo "Running backend unit tests with coverage..."
cd src-tauri
if cargo llvm-cov --version &> /dev/null 2>&1; then
  cargo llvm-cov --lib --lcov --output-path ../coverage/rust-lcov.info
  cargo llvm-cov --lib --cobertura --output-path ../coverage/cobertura-rust.xml
else
  echo "  (cargo-llvm-cov not installed, run: cargo install cargo-llvm-cov)"
  cargo test
fi
cd - > /dev/null

if [ -f coverage/rust-lcov.info ]; then
  echo "Converting Rust LCOV to Istanbul format..."
  node scripts/lcov-to-istanbul.mjs coverage/rust-lcov.info coverage/rust-coverage.json
fi

echo "Merging unit test coverage reports..."
node scripts/merge-coverage.mjs

echo "Checking coverage thresholds..."
node scripts/check-coverage.js
