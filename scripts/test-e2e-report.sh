#!/bin/bash
set -e

REPORT_FILE="e2e-test-report.txt"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
REPORT_PATH="${REPORT_FILE%.txt}_${TIMESTAMP}.txt"

# Check if we should re-run tests
RUN_TESTS=true
if [ -f "coverage/e2e-coverage.json" ] && [ -d "coverage/e2e" ]; then
  echo "Coverage outputs already exist."
  read -p "Re-run tests? (y/n) [n]: " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    RUN_TESTS=false
    echo "Using existing coverage outputs..."
  fi
fi

if [ "$RUN_TESTS" = true ]; then
  echo "Running E2E tests and generating report..."
  echo "Report will be saved to: $REPORT_PATH"
  echo ""

  # Run tests and capture all output
  wdio run ./wdio.conf.ts 2>&1 | tee "$REPORT_PATH"
else
  echo "Skipping test execution."
fi

echo ""
echo "============================================"
echo "E2E Test Report Summary"
echo "============================================"
echo ""

# Extract test results
if [ -f "$REPORT_PATH" ]; then
  echo "Full output saved to: $REPORT_PATH"
  echo ""

  # Show failing tests
  FAILURES=$(grep -E "^\s+\d+\)|FAILED|Error:|unavailable" "$REPORT_PATH" | head -50)
  if [ -n "$FAILURES" ]; then
    echo "Failed Tests/Errors:"
    echo "$FAILURES"
  fi

  # Show coverage status
  echo ""
  echo "Coverage Report:"
  if [ -d "coverage/e2e" ]; then
    echo "✓ E2E coverage report generated in coverage/e2e/index.html"
    ls -lh coverage/e2e-coverage.json 2>/dev/null && echo "  Coverage data: coverage/e2e-coverage.json"
  else
    echo "✗ No E2E coverage report found"
  fi
fi
