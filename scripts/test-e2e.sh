#!/bin/bash

# E2E test runner that supports --spec, --test/--grep, and --coverage parameters
# Usage:
#   yarn test:e2e                           # Run all E2E tests (no coverage)
#   yarn test:e2e --spec <filename>         # Run specific test file
#   yarn test:e2e --spec=<filename>         # Run specific test file
#   yarn test:e2e --spec <f1> --spec <f2>   # Run multiple test files
#   yarn test:e2e --test <test name>        # Run tests matching name (mocha -g)
#   yarn test:e2e --test=<test name>        # Run tests matching name (mocha -g)
#   yarn test:e2e --grep <test name>        # Alias for --test
#   yarn test:e2e --grep=<test name>        # Alias for --test
#   yarn test:e2e --coverage                # Enable coverage aggregation
#   yarn test:e2e --spec=file.e2e.ts --coverage

set -e

declare -a spec_files
test_name=""
enable_coverage=0

# Parse arguments to support multiple --spec parameters and both formats
for arg in "$@"; do
  if [[ "$arg" == "--spec="* ]]; then
    # Handle --spec=filename format
    spec_files+=("${arg#--spec=}")
  elif [[ "$arg" == "--spec" ]]; then
    # Mark that we found --spec, next arg should be the filename
    spec_next=1
  elif [[ $spec_next == 1 ]]; then
    # This is the filename following --spec
    spec_files+=("$arg")
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
  elif [[ "$arg" == "--grep="* ]]; then
    # Handle --grep=name format (alias for --test)
    test_name="${arg#--grep=}"
  elif [[ "$arg" == "--grep" ]]; then
    # Mark that we found --grep, next arg should be the test name
    grep_next=1
  elif [[ $grep_next == 1 ]]; then
    # This is the test name following --grep
    test_name="$arg"
    grep_next=0
  elif [[ "$arg" == "--coverage" ]]; then
    # Enable coverage aggregation
    enable_coverage=1
  fi
done

# Build wdio command with optional parameters
wdio_cmd="yarn wdio run ./wdio.conf.ts"

# Add all spec files (supporting multiple --spec parameters)
for spec_file in "${spec_files[@]}"; do
  wdio_cmd="$wdio_cmd --spec \"$spec_file\""
done

if [[ -n "$test_name" ]]; then
  wdio_cmd="$wdio_cmd --mochaOpts.grep \"$test_name\""
fi

if [[ ${#spec_files[@]} -gt 0 ]] || [[ -n "$test_name" ]]; then
  if [[ ${#spec_files[@]} -gt 0 && -n "$test_name" ]]; then
    echo "Running E2E tests matching \"$test_name\""
  elif [[ ${#spec_files[@]} -gt 0 ]]; then
    if [[ ${#spec_files[@]} -eq 1 ]]; then
      echo "Running E2E tests from: ${spec_files[0]}"
    else
      echo "Running E2E tests from: ${#spec_files[@]} files"
    fi
  else
    echo "Running E2E tests matching: $test_name"
  fi
  eval "$wdio_cmd"
  if [[ $enable_coverage == 1 ]]; then
    node scripts/aggregate-e2e-coverage.mjs
  fi
else
  echo "Running all E2E tests"
  yarn wdio run ./wdio.conf.ts
  if [[ $enable_coverage == 1 ]]; then
    node scripts/aggregate-e2e-coverage.mjs
  fi
fi
