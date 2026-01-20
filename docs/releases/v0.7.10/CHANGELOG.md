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

## Files Modified

### Core Implementation
- `src/utils/IdleTimeoutService.ts` - Added reference counting logic for function calls
- `src/hooks/useIdleTimeoutManager.ts` - Added function call tracking
- `src/components/DeepgramVoiceInteraction/index.tsx` - Integrated function call tracking

### Test Files
- `tests/` - Unit/integration tests for idle timeout service
- `test-app/tests/e2e/` - E2E tests for function call scenarios

### Documentation
- `docs/issues/ISSUE-373-IDLE-TIMEOUT-DURING-FUNCTION-CALLS.md` - Complete issue documentation
- `docs/issues/ISSUE-375-V0.7.10-RELEASE.md` - Release tracking document

## Related Issues

- Closes #373 (Idle timeout during function calls) ✅ **FIXED**
- Fixes voice-commerce team Issue #809 ✅ **FIXED**
