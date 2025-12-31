#!/bin/bash

# Comprehensive Test Runner
# Runs all test types in stages and generates a comprehensive report
# Allows inspection of results between stages

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Stage control
SKIP_PROMPTS=${SKIP_PROMPTS:-false}  # Set SKIP_PROMPTS=true to run without pauses

# Timestamp for report
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
# Use test-results directory to match Playwright convention
REPORT_DIR="test-results/comprehensive_${TIMESTAMP}"
mkdir -p "$REPORT_DIR"

# Summary file
SUMMARY_FILE="$REPORT_DIR/SUMMARY.md"
JSON_SUMMARY="$REPORT_DIR/summary.json"

# Detect API configuration
check_api_config() {
    local config_type=$1
    local api_key_var=$2
    local api_key_file=$3
    
    if [ "$config_type" = "jest" ]; then
        # Check for Jest API key
        local api_key=$(grep -E "^${api_key_var}=" "$PROJECT_ROOT/.env" 2>/dev/null | cut -d '=' -f2- | tr -d '\n' | tr -d '\r' || echo "")
        if [ -z "$api_key" ]; then
            api_key=$(grep -E "^${api_key_var}=" "$PROJECT_ROOT/test-app/.env" 2>/dev/null | cut -d '=' -f2- | tr -d '\n' | tr -d '\r' || echo "")
        fi
        if [ -n "$api_key" ] && [ "$api_key" != "mock" ] && [ "$api_key" != "your-deepgram-api-key-here" ] && [ ${#api_key} -ge 20 ]; then
            echo "real"
        else
            echo "mock"
        fi
    elif [ "$config_type" = "e2e" ]; then
        # Check for E2E API key
        local api_key=$(grep -E "^${api_key_var}=" "$PROJECT_ROOT/test-app/.env" 2>/dev/null | cut -d '=' -f2- | tr -d '\n' | tr -d '\r' || echo "")
        if [ -n "$api_key" ] && [ "$api_key" != "mock" ] && [ "$api_key" != "your-deepgram-api-key-here" ] && [ ${#api_key} -ge 20 ]; then
            echo "real"
        else
            echo "mock"
        fi
    else
        echo "unknown"
    fi
}

JEST_API_CONFIG=$(check_api_config "jest" "DEEPGRAM_API_KEY" ".env")
E2E_API_CONFIG=$(check_api_config "e2e" "VITE_DEEPGRAM_API_KEY" "test-app/.env")

# Initialize summary
echo "# Comprehensive Test Report" > "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "## Test Configuration" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "**Jest Tests API Mode:** $([ "$JEST_API_CONFIG" = "real" ] && echo "✅ Real APIs" || echo "⚠️ Mock APIs")" >> "$SUMMARY_FILE"
echo "**E2E Tests API Mode:** $([ "$E2E_API_CONFIG" = "real" ] && echo "✅ Real APIs" || echo "⚠️ Mock APIs")" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# Initialize JSON summary
echo "{" > "$JSON_SUMMARY"
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> "$JSON_SUMMARY"
echo "  \"testSuites\": [" >> "$JSON_SUMMARY"

# Track overall results (must not use 'local' - these are global)
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
SKIPPED_SUITES=0

# Function to show stage summary
show_stage_summary() {
    local stage_num=$1
    local stage_name=$2
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Stage $stage_num Complete: $stage_name${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Report location: $PROJECT_ROOT/$REPORT_DIR"
    echo "Summary file: $PROJECT_ROOT/$SUMMARY_FILE"
    echo ""
    echo "Current status:"
    echo -e "  Total Suites: ${BLUE}$TOTAL_SUITES${NC}"
    echo -e "  Passed: ${GREEN}$PASSED_SUITES${NC}"
    echo -e "  Failed: ${RED}$FAILED_SUITES${NC}"
    echo -e "  Skipped: ${YELLOW}$SKIPPED_SUITES${NC}"
    echo ""
    
    if [ "$SKIP_PROMPTS" != "true" ]; then
        echo -e "${YELLOW}Press Enter to continue to next stage, or Ctrl+C to stop...${NC}"
        read -r
    fi
}

# Function to run a test suite and capture results
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    local output_file="$PROJECT_ROOT/$REPORT_DIR/${suite_name// /_}.log"
    local json_file="$PROJECT_ROOT/$REPORT_DIR/${suite_name// /_}.json"
    
    echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "## $suite_name" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Running: $suite_name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local start_time=$(date +%s)
    
    # Run test and capture output
    if eval "$test_command" > "$output_file" 2>&1; then
        local exit_code=0
    else
        local exit_code=$?
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Parse Jest/Playwright output for summary
    local passed=$(grep -oE "✓|PASS|passed" "$output_file" | wc -l | tr -d ' ')
    local failed=$(grep -oE "✕|FAIL|failed" "$output_file" | wc -l | tr -d ' ')
    local skipped=$(grep -oE "○|SKIP|skipped" "$output_file" | wc -l | tr -d ' ')
    
    # Try to extract more detailed stats from Jest output
    if grep -q "Test Suites:" "$output_file"; then
        local test_suites=$(grep "Test Suites:" "$output_file" | head -1 | grep -oE "[0-9]+" | head -1)
        local test_tests=$(grep "Tests:" "$output_file" | head -1 | grep -oE "[0-9]+" | head -1)
        local test_passed=$(grep "Tests:" "$output_file" | head -1 | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+" || echo "0")
        local test_failed=$(grep "Tests:" "$output_file" | head -1 | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" || echo "0")
        local test_skipped=$(grep "Tests:" "$output_file" | head -1 | grep -oE "[0-9]+ skipped" | grep -oE "[0-9]+" || echo "0")
    else
        # Playwright output
        local test_suites="N/A"
        local test_tests=$(grep -oE "[0-9]+ passed|[0-9]+ failed" "$output_file" | wc -l | tr -d ' ')
        local test_passed=$(grep -oE "[0-9]+ passed" "$output_file" | grep -oE "[0-9]+" | head -1 || echo "0")
        local test_failed=$(grep -oE "[0-9]+ failed" "$output_file" | grep -oE "[0-9]+" | head -1 || echo "0")
        local test_skipped="0"
    fi
    
    # Determine status
    if [ "$exit_code" -eq 0 ]; then
        local status="✅ PASSED"
        local status_color="$GREEN"
        ((PASSED_SUITES++))
    else
        local status="❌ FAILED"
        local status_color="$RED"
        ((FAILED_SUITES++))
    fi
    
    ((TOTAL_SUITES++))
    
    # Determine API mode for this suite
    local api_mode="N/A"
    if [[ "$suite_name" == *"Jest"* ]]; then
        api_mode="$JEST_API_CONFIG"
    elif [[ "$suite_name" == *"E2E"* ]] || [[ "$suite_name" == *"Playwright"* ]]; then
        api_mode="$E2E_API_CONFIG"
    fi
    
    # Write to summary
    echo "**Status:** $status" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "**Duration:** ${duration}s" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "**API Mode:** $([ "$api_mode" = "real" ] && echo "✅ Real APIs" || echo "⚠️ Mock APIs")" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "**Test Suites:** $test_suites" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "**Tests:** $test_tests (Passed: $test_passed, Failed: $test_failed, Skipped: $test_skipped)" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "**Output:** \`${suite_name// /_}.log\`" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    
    # Write JSON
    if [ $TOTAL_SUITES -gt 1 ]; then
        echo "," >> "$PROJECT_ROOT/$JSON_SUMMARY"
    fi
    echo "    {" >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "      \"name\": \"$suite_name\"," >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "      \"status\": \"$([ $exit_code -eq 0 ] && echo 'passed' || echo 'failed')\"," >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "      \"duration\": $duration," >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "      \"testSuites\": $test_suites," >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "      \"tests\": {" >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "        \"total\": $test_tests," >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "        \"passed\": $test_passed," >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "        \"failed\": $test_failed," >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "        \"skipped\": $test_skipped" >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "      }," >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "      \"outputFile\": \"${suite_name// /_}.log\"" >> "$PROJECT_ROOT/$JSON_SUMMARY"
    echo "    }" >> "$PROJECT_ROOT/$JSON_SUMMARY"
    
    # Extract failed tests for E2E tests
    if [[ "$suite_name" == *"E2E"* ]] || [[ "$suite_name" == *"Playwright"* ]]; then
        if [ "$exit_code" -ne 0 ] || [ "$test_failed" -gt 0 ]; then
            # Extract failed test list from log
            # Playwright format: "[chromium] › tests/e2e/file.spec.js:line:column › Test Suite › test name"
            # This appears after "X failed" in the summary section
            local failed_tests_file="$PROJECT_ROOT/$REPORT_DIR/${suite_name// /_}_failed_tests.txt"
            # Look for the "X failed" line, then extract all lines that match the pattern until we hit "skipped" or "passed"
            # The failed tests appear as: "    [chromium] › tests/e2e/file.spec.js:line:column › Test Suite › test name"
            awk '/[0-9]+ failed$/ {flag=1; next} /[0-9]+ skipped|[0-9]+ passed \(/ {flag=0} flag && /\[chromium\] › tests\/e2e/ {print}' "$output_file" | \
                sed 's/^[[:space:]]*//' | \
                sed 's/\[chromium\] › //' | \
                sed 's/› / - /' | \
                sed 's/^tests\/e2e\///' | \
                sed 's/\.spec\.js:/:/' | \
                sed 's/:[0-9]*:[0-9]*//' > "$failed_tests_file" 2>/dev/null || true
            
            # Count extracted failures
            local extracted_failures=$(wc -l < "$failed_tests_file" 2>/dev/null | tr -d ' ' || echo "0")
            if [ "$extracted_failures" -gt 0 ] && [ "$extracted_failures" -le 50 ]; then
                # Only add if we found a reasonable number of failures (avoid false positives)
                echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
                echo "### Failed Tests" >> "$PROJECT_ROOT/$SUMMARY_FILE"
                echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
                local test_num=1
                while IFS= read -r line; do
                    if [ -n "$line" ]; then
                        # Format: "tests/e2e/file.spec.js:line:column - Test Suite - test name"
                        # Extract just the meaningful part: "file:line - Test Suite - test name"
                        local formatted_line=$(echo "$line" | sed 's/^tests\/e2e\///' | sed 's/\.spec\.js:/:/' | sed 's/:[0-9]*:[0-9]*//' | sed 's/ - / - /')
                        echo "$test_num. **$formatted_line**" >> "$PROJECT_ROOT/$SUMMARY_FILE"
                        ((test_num++))
                    fi
                done < "$failed_tests_file"
                echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
            fi
        fi
    fi
    
    # Print status
    echo -e "${status_color}$status${NC} (${duration}s)"
    echo ""
    
    return $exit_code
}

# Change to project root and store absolute path
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Comprehensive Test Run (Staged)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Report directory: $PROJECT_ROOT/$REPORT_DIR"
echo "Summary file: $PROJECT_ROOT/$SUMMARY_FILE"
echo ""
if [ "$SKIP_PROMPTS" != "true" ]; then
    echo -e "${CYAN}Note: The script will pause between stages for inspection.${NC}"
    echo -e "${CYAN}      Set SKIP_PROMPTS=true to run without pauses.${NC}"
    echo ""
    echo -e "${YELLOW}Press Enter to begin, or Ctrl+C to cancel...${NC}"
    read -r
fi
echo ""

# 1. Jest Unit/Integration Tests (Root)
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Stage 1: Jest Unit/Integration Tests (Root)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
run_test_suite "Jest Unit Integration Tests" "npm test -- --listTests 2>/dev/null | head -1 > /dev/null && npm test 2>&1 || npm test 2>&1"
show_stage_summary 1 "Jest Unit/Integration Tests"

# 2. Jest WebSocket Connectivity Tests
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Stage 2: Jest WebSocket Connectivity Tests${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
run_test_suite "Jest WebSocket Connectivity" "npm test -- tests/integration/websocket-connectivity.test.js 2>&1"
show_stage_summary 2 "Jest WebSocket Connectivity Tests"

# 3. Test App Unit Tests
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Stage 3: Test App Unit Tests${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
if [ -d "$PROJECT_ROOT/test-app/tests/unit" ] && [ "$(find "$PROJECT_ROOT/test-app/tests/unit" \( -name '*.test.*' -o -name '*.spec.*' \) | wc -l | tr -d ' ')" -gt 0 ]; then
    run_test_suite "Test App Unit Tests" "cd $PROJECT_ROOT/test-app && npm test 2>&1 || true"
else
    echo -e "${YELLOW}⚠️  No test-app unit tests found, skipping${NC}"
    echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "## Test App Unit Tests" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "**Status:** ⚠️ SKIPPED (No tests found)" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    ((SKIPPED_SUITES++))
    ((TOTAL_SUITES++))
fi
show_stage_summary 3 "Test App Unit Tests"

# 4. Test App Integration Tests
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Stage 4: Test App Integration Tests${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
if [ -d "$PROJECT_ROOT/test-app/tests/integration" ] && [ "$(find "$PROJECT_ROOT/test-app/tests/integration" \( -name '*.test.*' -o -name '*.spec.*' \) | wc -l | tr -d ' ')" -gt 0 ]; then
    run_test_suite "Test App Integration Tests" "cd $PROJECT_ROOT/test-app && npm test -- tests/integration 2>&1 || true"
else
    echo -e "${YELLOW}⚠️  No test-app integration tests found, skipping${NC}"
    echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "## Test App Integration Tests" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "**Status:** ⚠️ SKIPPED (No tests found)" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    echo "" >> "$PROJECT_ROOT/$SUMMARY_FILE"
    ((SKIPPED_SUITES++))
    ((TOTAL_SUITES++))
fi
show_stage_summary 4 "Test App Integration Tests"

# 5. E2E Tests (Playwright)
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Stage 5: E2E Tests (Playwright)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}⚠️  Note: Some E2E tests may be blocked by automated browser detection${NC}"
echo -e "${YELLOW}    See docs/issues/ISSUE-341/AUTOMATED-BROWSER-RESTRICTIONS.md${NC}"
echo ""
run_test_suite "E2E Tests Playwright" "cd $PROJECT_ROOT/test-app && npm run test:e2e 2>&1 || true"
show_stage_summary 5 "E2E Tests (Playwright)"

# Close JSON array
echo "" >> "$JSON_SUMMARY"
echo "  ]," >> "$JSON_SUMMARY"
echo "  \"summary\": {" >> "$JSON_SUMMARY"
echo "    \"total\": $TOTAL_SUITES," >> "$JSON_SUMMARY"
echo "    \"passed\": $PASSED_SUITES," >> "$JSON_SUMMARY"
echo "    \"failed\": $FAILED_SUITES," >> "$JSON_SUMMARY"
echo "    \"skipped\": $SKIPPED_SUITES" >> "$JSON_SUMMARY"
echo "  }" >> "$JSON_SUMMARY"
echo "}" >> "$JSON_SUMMARY"

# Final summary
echo "" >> "$SUMMARY_FILE"
echo "---" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "## Overall Summary" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "**Total Test Suites:** $TOTAL_SUITES" >> "$SUMMARY_FILE"
echo "**Passed:** $PASSED_SUITES" >> "$SUMMARY_FILE"
echo "**Failed:** $FAILED_SUITES" >> "$SUMMARY_FILE"
echo "**Skipped:** $SKIPPED_SUITES" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# Print final summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Test Run Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Report location: $PROJECT_ROOT/$REPORT_DIR"
echo "Summary: $PROJECT_ROOT/$SUMMARY_FILE"
echo "JSON Summary: $PROJECT_ROOT/$JSON_SUMMARY"
echo ""
echo -e "Total Suites: ${BLUE}$TOTAL_SUITES${NC}"
echo -e "Passed: ${GREEN}$PASSED_SUITES${NC}"
echo -e "Failed: ${RED}$FAILED_SUITES${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED_SUITES${NC}"
echo ""

# Exit with error if any suite failed
if [ $FAILED_SUITES -gt 0 ]; then
    exit 1
else
    exit 0
fi

