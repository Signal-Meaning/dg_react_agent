# Release Notes - v0.7.10

**Release Date**: January 20, 2026  
**Release Type**: Patch Release

## Overview

v0.7.10 is a patch release that fixes a critical bug where the idle timeout was incorrectly firing during active function call execution. This release ensures that function calls can complete successfully without connection interruptions, resolving issues reported by the voice-commerce team.

## 🎯 Release Highlights

### Critical Bug Fix: Idle Timeout During Function Calls (Issue #373)

**Problem**: The component's idle timeout was incorrectly firing during active function call execution, causing connections to close before function call responses could be sent.

**Solution**: 
- Implemented reference counting for concurrent function calls
- Automatically disables idle timeout when function calls are active
- Re-enables idle timeout when all function calls complete
- Added comprehensive test coverage (5 unit/integration + 4 E2E tests)

**Impact**:
- ✅ Fixes connection closures during function call execution
- ✅ Prevents lost function call responses
- ✅ Resolves non-responsive agent issues during function calls
- ✅ Fixes voice-commerce team Issue #809

## 🐛 Fixed

### Idle Timeout During Function Calls
- **Issue**: Idle timeout (10 seconds) was firing during active function call execution, causing connections to close mid-operation
- **Solution**: 
  - Added reference counting mechanism to track active function calls
  - Idle timeout automatically disabled when function calls are active
  - Idle timeout re-enabled when all function calls complete
  - Handles concurrent function calls correctly
- **Files Modified**:
  - `src/utils/IdleTimeoutService.ts` - Added reference counting logic
  - `src/hooks/useIdleTimeoutManager.ts` - Added function call tracking
  - `src/components/DeepgramVoiceInteraction/index.tsx` - Integrated function call tracking

### Greeting Detection Improvements
- **Issue**: False positives in greeting detection
- **Solution**: Enhanced detection logic to reduce incorrect greeting triggers
- **Impact**: More reliable greeting detection, fewer false positives

## ✨ Added

### Test Utilities
- **Shared Test Transcript Utility**: Added utility for writing test transcripts to files
  - Enables consistent transcript logging across tests
  - Improves test debugging and analysis

### Test Improvements
- **Dual Channel Tests**: Enhanced with better prompts and logging
  - Improved test prompts for more reliable test execution
  - Added conversation transcript logging
  - Better agent response logging and pre-recorded audio support
  - Updated Test 1 text message to use factual question

## 📊 Test Coverage

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

### Test Status
- ✅ **Jest Unit Tests**: All tests passing
- ✅ **E2E Tests**: All tests passing, including new Issue #373 tests

## 🔄 Backward Compatibility

✅ **Fully backward compatible** - No breaking changes
- Bug fix only - no API changes
- No behavior changes (except fixing incorrect behavior)
- Existing functionality preserved
- Function calls now work correctly (previously broken)

## ⚠️ Important Notes

### Function Call Behavior
- Function calls now correctly prevent idle timeout during execution
- Concurrent function calls are supported with reference counting
- Idle timeout automatically resumes after all function calls complete
- This fixes a critical bug that was preventing function calls from completing

### Testing
- All new tests verify the fix works correctly
- Tests cover both single and concurrent function call scenarios
- E2E tests verify real-world function call execution

## 🔗 Related Issues

- Closes #373 (Idle timeout during function calls) ✅ **FIXED**
- Fixes voice-commerce team Issue #809 ✅ **FIXED**

## 📝 Migration Guide

**No migration required** - This is a patch release with a critical bug fix.

The fix is automatic and requires no code changes. Function calls will now work correctly without connection interruptions.

### What Changed
- **Before**: Idle timeout could fire during function call execution, causing connection to close
- **After**: Idle timeout is automatically disabled during function call execution, ensuring function calls complete successfully

### No Action Required
- No API changes
- No prop changes
- No callback changes
- Function calls simply work correctly now

## 🙏 Acknowledgments

- Issue #373: Critical bug report and fix implementation
- Voice-commerce team (Issue #809): Real-world bug report
- All tests implemented and verified
