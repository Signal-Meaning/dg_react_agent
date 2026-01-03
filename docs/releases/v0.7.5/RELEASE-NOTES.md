# Release Notes - v0.7.5

**Release Date**: January 2, 2026  
**Release Type**: Patch Release

## Overview

v0.7.5 is a critical patch release that implements the fix for Issue #340 (Int16Array error with odd-length TTS audio buffers). This fix was documented in v0.7.3 release notes but was not actually implemented in the source code at that time. The fix is now properly implemented, tested, and ready for production use.

## 🎯 Release Highlights

### Critical Bug Fix

- **Issue #340**: Fixed Int16Array error when processing TTS audio buffers with odd byte lengths ✅
  - **Status**: Now actually implemented (was documented but not implemented in v0.7.3)
  - **Impact**: High - Prevents connection closures when Deepgram sends odd-length audio buffers
  - **Test Coverage**: Comprehensive unit tests (12 tests) and E2E test added

## 🐛 Fixed

### Issue #340: Int16Array Error with Odd-Length TTS Audio Buffers (Actual Implementation)

**Problem**: The component threw `RangeError: byte length of Int16Array should be a multiple of 2` when processing TTS audio buffers with odd byte lengths from Deepgram WebSocket.

**Important Note**: This fix was documented in v0.7.3 release notes but was **not actually implemented** in the source code at that time. The fix is now properly implemented in v0.7.5.

**Solution**: Added validation and truncation for odd-length audio buffers in `createAudioBuffer()`:
- Validates buffer length before creating `Int16Array`
- Truncates odd-length buffers to even length (removes last byte)
- Logs warning when truncation occurs for debugging
- Prevents connection closure due to unhandled errors

**Impact**: High - This error was causing connections to close immediately after TTS audio processing failed.

**Location**: `src/utils/audio/AudioUtils.ts:17-26` in `createAudioBuffer()` function

**Test Coverage**:
- ✅ 12 comprehensive unit tests (all passing)
- ✅ E2E test added for odd-length buffer handling
- ✅ Tests verify no RangeError occurs and warnings are logged correctly

## 📦 What's Included

### Code Changes
- `src/utils/audio/AudioUtils.ts` - Added odd-length buffer validation and truncation

### Tests
- `tests/unit/audio-utils-createAudioBuffer.test.ts` - 12 comprehensive unit tests
- `test-app/tests/e2e/audio-odd-length-buffer.spec.js` - E2E test for odd-length buffer handling

### Documentation
- `docs/issues/ISSUE-341/VOICE-COMMERCE-RECOMMENDATIONS.md` - Recommendations for voice-commerce team
- `docs/issues/ISSUE-341/ISSUE-340-COMPLETENESS-REVIEW.md` - Completeness review and test coverage analysis
- Updated `docs/issues/ISSUE-341/DEFECT-RESOLUTION-EVIDENCE.md` to clarify fix status

## 🔄 Migration Guide

**No migration required!** v0.7.5 is fully backward compatible. All existing code continues to work without changes.

### For Users Experiencing Int16Array Errors

If you were experiencing `RangeError: byte length of Int16Array should be a multiple of 2` errors:

1. **Update to v0.7.5**:
   ```bash
   npm install @signal-meaning/deepgram-voice-interaction-react@0.7.5
   ```

2. **Monitor Console Warnings**: 
   - If you see `console.warn` messages about odd-length buffers, this indicates:
     - The fix is working (preventing errors)
     - Deepgram is occasionally sending odd-length buffers in your environment
     - This is expected behavior - the component now handles it gracefully

3. **No Code Changes Required**: The fix is transparent to your application code

## 📊 Test Results

- **Jest Tests**: 68 test suites passed, 725 tests passed, 10 skipped ✅
- **Unit Tests**: 12 new tests for `createAudioBuffer()` odd-length buffer handling ✅
- **E2E Tests**: New test added for odd-length buffer handling ✅

## 🔗 Related Issues

- **Issue #340**: Int16Array Error: TTS Audio Processing Fails with Odd-Length Buffers (fixed - actual implementation)
- **Issue #341**: Connection State Reporting: Connections Close Immediately After Being Reported as Connected (fixed in v0.7.3)
- **Issue #350**: Quick Release v0.7.5: Issue #340 Fix - Odd-Length Buffer Handling

## 🙏 Acknowledgments

Thank you to the voice-commerce team for:
- Thoroughly testing the component
- Identifying that the fix was documented but not implemented
- Providing detailed error reports
- Helping improve component reliability

## 📚 Documentation

For more information, see:
- [CHANGELOG.md](./CHANGELOG.md) - Complete list of changes
- [Issue #340 Documentation](../../issues/ISSUE-341/VOICE-COMMERCE-RECOMMENDATIONS.md) - Detailed recommendations
- [Completeness Review](../../issues/ISSUE-341/ISSUE-340-COMPLETENESS-REVIEW.md) - Test coverage analysis

---

**Previous Release**: [v0.7.4](../v0.7.4/RELEASE-NOTES.md)

