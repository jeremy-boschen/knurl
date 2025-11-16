#!/bin/bash

# E2E test runner that supports --spec parameter
# Usage: yarn test:e2e [--spec path/to/test.e2e.ts]

set -e

# Check if --spec parameter is provided
if [[ "$1" == "--spec" ]]; then
  spec_file="$2"
  echo "Running specific E2E test: $spec_file"
  yarn wdio run ./wdio.conf.ts --spec "$spec_file"
  node scripts/aggregate-e2e-coverage.mjs
else
  echo "Running all E2E tests"
  yarn wdio run ./wdio.conf.ts
  node scripts/aggregate-e2e-coverage.mjs
fi
