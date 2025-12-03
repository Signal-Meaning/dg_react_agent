#!/bin/bash
# Run a Jest test and capture output to /tmp
# Usage: ./scripts/run-test-with-log.sh <test-file-path> [additional-jest-args]

TEST_FILE="$1"
shift
ADDITIONAL_ARGS="$@"

if [ -z "$TEST_FILE" ]; then
  echo "Usage: $0 <test-file-path> [additional-jest-args]"
  echo "Example: $0 tests/agent-options-useeffect-dependency.test.tsx --no-coverage"
  exit 1
fi

# Generate log filename with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TEST_NAME=$(basename "$TEST_FILE" .tsx | sed 's/\.test$//' | tr '/' '_')
LOG_FILE="/tmp/test-${TEST_NAME}-${TIMESTAMP}.log"

echo "Running test: $TEST_FILE"
echo "Output will be saved to: $LOG_FILE"
echo ""

# Run test in background and capture output
echo "Starting test in background..."
npm test -- "$TEST_FILE" $ADDITIONAL_ARGS > "$LOG_FILE" 2>&1 &
TEST_PID=$!

echo "Test PID: $TEST_PID"
echo "Monitoring output (press Ctrl+C to stop monitoring, test will continue)..."
echo ""

# Monitor the log file
tail -f "$LOG_FILE" &
TAIL_PID=$!

# Wait for test to complete or timeout
TIMEOUT=60  # 60 second timeout
ELAPSED=0
while kill -0 $TEST_PID 2>/dev/null && [ $ELAPSED -lt $TIMEOUT ]; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

# Stop tail
kill $TAIL_PID 2>/dev/null

# Check if test is still running
if kill -0 $TEST_PID 2>/dev/null; then
  echo ""
  echo "⚠️  Test is still running after ${TIMEOUT}s timeout"
  echo "   Log file: $LOG_FILE"
  echo "   Test PID: $TEST_PID"
  echo "   To kill: kill $TEST_PID"
  echo "   To view output: tail -f $LOG_FILE"
  exit 124  # Timeout exit code
else
  # Wait for process to finish and get exit code
  wait $TEST_PID
  EXIT_CODE=$?
  
  echo ""
  echo "Test completed with exit code: $EXIT_CODE"
  echo "Full output saved to: $LOG_FILE"
  echo ""
  echo "Last 50 lines:"
  echo "----------------------------------------"
  tail -50 "$LOG_FILE"
  echo "----------------------------------------"
  
  exit $EXIT_CODE
fi

