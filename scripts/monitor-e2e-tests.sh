#!/bin/bash
# Monitor E2E test progress
# Usage: ./scripts/monitor-e2e-tests.sh [log-file]

# Get the project root directory (where this script is located)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
E2E_RUNS_DIR="$PROJECT_ROOT/test-results/e2e-runs"

LOG_FILE="${1:-$(find "$E2E_RUNS_DIR" -name "*.log" -type f -mmin -60 2>/dev/null | head -1)}"

if [ -z "$LOG_FILE" ] || [ ! -f "$LOG_FILE" ]; then
  echo "❌ No log file found. Tests may not be running."
  echo "Looking for: $E2E_RUNS_DIR/*.log"
  if [ ! -d "$E2E_RUNS_DIR" ]; then
    echo "Directory does not exist: $E2E_RUNS_DIR"
    echo "Run tests first to create log files."
  fi
  exit 1
fi

echo "📊 Monitoring E2E tests: $LOG_FILE"
echo "Press Ctrl+C to stop monitoring"
echo ""

while true; do
  clear
  echo "═══════════════════════════════════════════════════════════"
  echo "📊 E2E Test Progress Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════════════════════"
  echo "Log file: $LOG_FILE"
  echo ""
  
  # Count tests
  TOTAL=$(grep -c "Running.*tests" "$LOG_FILE" 2>/dev/null | head -1 || echo "0")
  PASSED=$(grep -c "✓\|PASS" "$LOG_FILE" 2>/dev/null | wc -l || echo "0")
  FAILED=$(grep -c "×\|FAIL" "$LOG_FILE" 2>/dev/null | wc -l || echo "0")
  
  # Get last few lines
  echo "📈 Progress:"
  tail -30 "$LOG_FILE" 2>/dev/null | grep -E "(Running|PASS|FAIL|✓|×|passed|failed|Tests:)" | tail -10
  
  echo ""
  echo "📋 Recent Activity:"
  tail -15 "$LOG_FILE" 2>/dev/null
  
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "Press Ctrl+C to stop monitoring"
  sleep 5
done
