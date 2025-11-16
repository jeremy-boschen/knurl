#!/bin/bash

# Run E2E test with resource monitoring
# Usage: ./scripts/run-test-with-monitoring.sh <spec_file> [timeout_seconds]

SPEC_FILE="${1:-}"
TIMEOUT_SEC="${2:-300}"

if [ -z "$SPEC_FILE" ]; then
  echo "Usage: $0 <spec_file> [timeout_seconds]"
  exit 1
fi

# Create output directory
OUTPUT_DIR="test-results/monitoring-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTPUT_DIR"

RESOURCE_LOG="$OUTPUT_DIR/resources.log"
TEST_LOG="$OUTPUT_DIR/test.log"

echo "Running test: $SPEC_FILE"
echo "Timeout: ${TIMEOUT_SEC}s"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Start resource monitoring in background
TEST_TIMEOUT=$TIMEOUT_SEC /home/newty/worktrees/knurl/wsl-main/scripts/monitor-test-resources.sh "$RESOURCE_LOG" &
MONITOR_PID=$!

# Run the test
timeout $TIMEOUT_SEC yarn test:e2e --spec "$SPEC_FILE" 2>&1 | tee "$TEST_LOG"
TEST_EXIT=$?

# Kill the monitor
kill $MONITOR_PID 2>/dev/null || true
wait $MONITOR_PID 2>/dev/null || true

echo ""
echo "=== Test Execution Summary ==="
echo "Exit code: $TEST_EXIT"
echo "Test log: $TEST_LOG"
echo "Resource log: $RESOURCE_LOG"
echo ""

# Extract timing info
if [ -f "$TEST_LOG" ]; then
  echo "=== Test Timings (from logs) ==="
  grep "\[TEST-TIME\]" "$TEST_LOG" | head -20
  echo ""
fi

# Summary of resource usage
if [ -f "$RESOURCE_LOG" ]; then
  echo "=== Peak Resource Usage ==="
  echo "Peak memory samples:"
  grep "^Mem:" "$RESOURCE_LOG" | tail -5
  echo ""
fi

exit $TEST_EXIT
