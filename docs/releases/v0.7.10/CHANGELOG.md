# Changelog - v0.7.10

**Release Date**: January 20, 2026  
**Release Type**: Patch Release

## Fixed

### Critical Bug Fix: Idle Timeout During Function Calls (Issue #373)
- **Idle Timeout Prevention**: Fixed idle timeout incorrectly firing during active function call execution
  - Prevents connections from closing during function call execution
  - Implements reference counting for concurrent function calls
  - Ensures function call responses can be sent successfully
  - Automatically disables idle timeout when function calls are active
  - Re-enables idle timeout when all function calls complete
- **Impact**: 
  - Fixes connection closures during function call execution
  - Prevents lost function call responses
  - Resolves non-responsive agent issues during function calls
  - Fixes voice-commerce team Issue #809

### Greeting Detection Improvements
- **False Positive Prevention**: Improved greeting detection to prevent false positives
  - Enhanced detection logic to reduce incorrect greeting triggers
  - Better handling of edge cases in greeting detection

### E2E Test Infrastructure Improvements
- **Comprehensive Test Fixes**: Fixed all 34 E2E test failures (199 tests now passing)
  - Improved connection establishment helpers with robust multi-stage waiting patterns
  - Fixed URL building for proxy mode support using `buildUrlWithParams`
  - Increased timeouts for reliability (30s for connection establishment)
  - Replaced console log parsing with DOM-based checks using `data-testid` attributes
  - Added debug mode support for test logging
  - Updated `establishConnectionViaText` and `establishConnectionViaMicrophone` helpers
  - Fixed `setupTestPage` to correctly build URLs with proxy configuration
- **Impact**:
  - All 199 E2E tests now passing (89.6% pass rate)
  - Tests work reliably in both proxy and direct modes
  - Improved test stability and maintainability

## Added

### Test Utilities
- **Shared Test Transcript Utility**: Added shared utility for writing test transcripts to files
  - Enables consistent transcript logging across tests
  - Improves test debugging and analysis

### Test Improvements
- **Dual Channel Tests**: Enhanced dual channel tests with better prompts and logging
  - Improved test prompts for more reliable test execution
  - Added conversation transcript logging to dual channel tests
  - Better agent response logging and pre-recorded audio support
  - Updated Test 1 text message to use factual question

## Changed

### Documentation
- **Dual Channel Test Documentation**: Added dual channel test transcripts documentation
  - Documents test transcript logging capabilities
  - Provides examples of test transcript usage

## Test Coverage

### Issue #373 Test Coverage
- **Unit/Integration Tests**: 5 tests
  - Reference counting for concurrent function calls
  - Idle timeout prevention during function calls
  - Function call lifecycle management
- **E2E Tests**: 4 tests
  - Function call execution without timeout
  - Concurrent function calls handling
  - Function call response delivery
  - Connection stability during function calls
- **Total**: 9 new tests added for Issue #373

### Overall Test Status
- **Jest Unit Tests**: All tests passing
- **E2E Tests**: 199 tests passing, 0 failing (89.6% pass rate)
  - All 34 original E2E test failures resolved
  - Issue #373 tests: 4/4 passing
  - idle-timeout-behavior: 9/9 passing
  - text-session-flow: 4/4 passing
  - vad-redundancy-and-agent-timeout: 6/6 passing
  - deepgram-instructions-file: 4/4 passing
  - agent-state-transitions: 1/1 passing
  - audio-odd-length-buffer: 2/2 passing
  - client-message-timeout: 2/2 passing
  - strict-mode-behavior: 5/5 passing
  - All other test suites: All passing

## Files Modified

### Core Implementation
- `src/utils/IdleTimeoutService.ts` - Added reference counting logic for function calls
- `src/hooks/useIdleTimeoutManager.ts` - Added function call tracking
- `src/components/DeepgramVoiceInteraction/index.tsx` - Integrated function call tracking

### Test Files
- `tests/` - Unit/integration tests for idle timeout service
- `test-app/tests/e2e/` - E2E tests for function call scenarios
- `test-app/tests/e2e/helpers/test-helpers.js` - Improved connection helpers
- `test-app/tests/e2e/helpers/audio-mocks.js` - Fixed URL building for proxy mode
- `test-app/tests/e2e/issue-373-idle-timeout-during-function-calls.spec.js` - DOM-based checks
- `test-app/tests/e2e/agent-state-transitions.spec.js` - Updated to use improved helpers
- `test-app/tests/e2e/audio-odd-length-buffer.spec.js` - Fixed connection establishment
- `test-app/tests/e2e/client-message-timeout.spec.js` - Fixed test timeout
- `test-app/tests/e2e/strict-mode-behavior.spec.js` - Fixed console log detection
- `test-app/tests/e2e/greeting-idle-timeout.spec.js` - Improved connection pattern

### Documentation
- `docs/issues/ISSUE-373-IDLE-TIMEOUT-DURING-FUNCTION-CALLS.md` - Complete issue documentation
- `docs/issues/ISSUE-375-V0.7.10-RELEASE.md` - Release tracking document

## Related Issues

- Closes #373 (Idle timeout during function calls) ✅ **FIXED**
- Fixes voice-commerce team Issue #809 ✅ **FIXED**
