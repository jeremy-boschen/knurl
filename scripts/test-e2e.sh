#!/bin/bash

# E2E test runner that supports --spec and --test parameters
# Usage:
#   yarn test:e2e                           # Run all E2E tests
#   yarn test:e2e --spec <filename>         # Run specific test file
#   yarn test:e2e --spec=<filename>         # Run specific test file
#   yarn test:e2e --test <test name>        # Run tests matching name (mocha -g)
#   yarn test:e2e --test=<test name>        # Run tests matching name (mocha -g)

set -e

spec_file=""
test_name=""

# Parse arguments to support both --spec <filename> and --spec=<filename>
# and both --test <name> and --test=<name>
for arg in "$@"; do
  if [[ "$arg" == "--spec="* ]]; then
    # Handle --spec=filename format
    spec_file="${arg#--spec=}"
  elif [[ "$arg" == "--spec" ]]; then
    # Mark that we found --spec, next arg should be the filename
    spec_next=1
  elif [[ $spec_next == 1 ]]; then
    # This is the filename following --spec
    spec_file="$arg"
    spec_next=0
  elif [[ "$arg" == "--test="* ]]; then
    # Handle --test=name format
    test_name="${arg#--test=}"
  elif [[ "$arg" == "--test" ]]; then
    # Mark that we found --test, next arg should be the test name
    test_next=1
  elif [[ $test_next == 1 ]]; then
    # This is the test name following --test
    test_name="$arg"
    test_next=0
  fi
done

# Build wdio command with optional parameters
wdio_cmd="yarn wdio run ./wdio.conf.ts"

if [[ -n "$spec_file" ]]; then
  wdio_cmd="$wdio_cmd --spec \"$spec_file\""
fi

if [[ -n "$test_name" ]]; then
  wdio_cmd="$wdio_cmd --grep \"$test_name\""
fi

if [[ -n "$spec_file" ]] || [[ -n "$test_name" ]]; then
  if [[ -n "$spec_file" && -n "$test_name" ]]; then
    echo "Running E2E tests in $spec_file matching \"$test_name\""
  elif [[ -n "$spec_file" ]]; then
    echo "Running E2E tests from: $spec_file"
  else
    echo "Running E2E tests matching: $test_name"
  fi
  eval "$wdio_cmd"
  node scripts/aggregate-e2e-coverage.mjs
else
  echo "Running all E2E tests"
  yarn wdio run ./wdio.conf.ts
  node scripts/aggregate-e2e-coverage.mjs
fi
