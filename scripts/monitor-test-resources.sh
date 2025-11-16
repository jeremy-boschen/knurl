#!/bin/bash

# Monitor system resources during test execution
# Captures CPU, memory, disk, and process information
# Usage: ./scripts/monitor-test-resources.sh <output_file>

OUTPUT_FILE="${1:-test-resources-$(date +%s).log}"
INTERVAL=2  # Sample every 2 seconds
DURATION=${TEST_TIMEOUT:-300}  # Default 5 minutes

echo "Starting resource monitoring for $DURATION seconds..."
echo "Output file: $OUTPUT_FILE"
echo "" > "$OUTPUT_FILE"

start_time=$(date +%s)
end_time=$((start_time + DURATION))

echo "=== System Monitoring Started ===" >> "$OUTPUT_FILE"
echo "Timestamp: $(date -u)" >> "$OUTPUT_FILE"
echo "Hostname: $(hostname)" >> "$OUTPUT_FILE"
echo "Kernel: $(uname -r)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

while [ $(date +%s) -lt $end_time ]; do
  {
    echo "--- Sample at $(date -u +%Y-%m-%dT%H:%M:%S) ---"

    # Overall system CPU and memory
    echo "=== Overall System ==="
    top -bn1 | head -3

    # Memory details
    echo ""
    echo "=== Memory Details ==="
    free -h

    # Process-specific monitoring (WebDriver, Node, Rust processes)
    echo ""
    echo "=== Process Details ==="
    ps aux | grep -E "(node|chrome|chromium|tauri|yarn|wdio)" | grep -v grep | awk '{print $1, $2, $3, $4, $6, $11}' | head -20

    # Disk I/O
    echo ""
    echo "=== Disk I/O ==="
    iostat -x 1 1 2>/dev/null || echo "iostat not available"

    # Network connections
    echo ""
    echo "=== Network Connections ==="
    netstat -an 2>/dev/null | grep -E "ESTABLISHED|LISTEN" | wc -l
    echo "Active connections shown above"

    # Port 1420 (Tauri) and 3000 (mock server) status
    echo ""
    echo "=== Key Ports Status ==="
    lsof -i :1420 2>/dev/null | tail -5 || echo "Port 1420: not in use"
    lsof -i :3000 2>/dev/null | tail -5 || echo "Port 3000: not in use"

    echo ""
  } >> "$OUTPUT_FILE"

  sleep $INTERVAL
done

echo "" >> "$OUTPUT_FILE"
echo "=== System Monitoring Ended ===" >> "$OUTPUT_FILE"
echo "Timestamp: $(date -u)" >> "$OUTPUT_FILE"

echo "Resource monitoring complete. Results saved to $OUTPUT_FILE"
