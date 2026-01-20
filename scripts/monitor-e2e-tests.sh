#!/bin/bash
# Monitor E2E test progress
# Usage: ./scripts/monitor-e2e-tests.sh [log-file]

LOG_FILE="${1:-$(find test-results/e2e-runs -name "*.log" -type f -mmin -60 | head -1)}"

if [ -z "$LOG_FILE" ] || [ ! -f "$LOG_FILE" ]; then
  echo "❌ No log file found. Tests may not be running."
  echo "Looking for: test-results/e2e-runs/*.log"
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
