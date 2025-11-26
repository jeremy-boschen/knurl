#!/bin/bash

# Integration test runner that supports --spec, --test/--grep parameters
# Usage:
#   yarn test:integration                           # Run all integration tests
#   yarn test:integration --spec <filename>         # Run specific test file
#   yarn test:integration --spec=<filename>         # Run specific test file
#   yarn test:integration --spec <f1> --spec <f2>   # Run multiple test files
#   yarn test:integration --test <test name>        # Run tests matching name (mocha -g)
#   yarn test:integration --test=<test name>        # Run tests matching name (mocha -g)
#   yarn test:integration --grep <test name>        # Alias for --test
#   yarn test:integration --grep=<test name>        # Alias for --test

set -e

declare -a spec_files
test_name=""

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
  fi
done

# Build wdio command with integration-specific environment variable
wdio_cmd="VITE_INTEGRATION_ENABLED=true yarn wdio run ./wdio.conf.ts"

# Add all spec files (supporting multiple --spec parameters)
for spec_file in "${spec_files[@]}"; do
  wdio_cmd="$wdio_cmd --spec \"$spec_file\""
done

if [[ -n "$test_name" ]]; then
  wdio_cmd="$wdio_cmd --mochaOpts.grep \"$test_name\""
fi

if [[ ${#spec_files[@]} -gt 0 ]] || [[ -n "$test_name" ]]; then
  if [[ ${#spec_files[@]} -gt 0 && -n "$test_name" ]]; then
    echo "Running integration tests matching \"$test_name\""
  elif [[ ${#spec_files[@]} -gt 0 ]]; then
    if [[ ${#spec_files[@]} -eq 1 ]]; then
      echo "Running integration tests from: ${spec_files[0]}"
    else
      echo "Running integration tests from: ${#spec_files[@]} files"
    fi
  else
    echo "Running integration tests matching: $test_name"
  fi
  eval "$wdio_cmd"
else
  echo "Running all integration tests"
  VITE_INTEGRATION_ENABLED=true yarn wdio run ./wdio.conf.ts --spec "src-common/e2e/specs/integration/**/*.intg.ts"
fi
