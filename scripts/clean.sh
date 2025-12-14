#!/bin/bash

# Clean build artifacts, coverage reports, and test outputs
# Usage: yarn clean

set -ex

echo "🧹 Cleaning build artifacts..."

# Frontend builds
rm -rf dist dist-ssr

# Rust builds
rm -rf target src-tauri/target

# Coverage & test outputs
rm -rf coverage .nyc_output .wdio test-results

# Cache files
rm -rf .eslintcache .prettierrc.cache scripts/build/.compiled

# Docs cache
rm -rf documentation/.astro documentation/dist

echo "✓ Clean complete"
