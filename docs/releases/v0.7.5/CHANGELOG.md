# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.5] - 2026-01-02

### Fixed

#### Issue #340: Int16Array Error with Odd-Length TTS Audio Buffers (Actual Implementation)

**Important Note**: This fix was documented in v0.7.3 release notes but was not actually implemented in the source code at that time. The fix is now properly implemented and tested in v0.7.5.

- **Audio Buffer Validation**: Implemented validation and truncation for odd-length audio buffers in `createAudioBuffer()`
  - Prevents `RangeError: byte length of Int16Array should be a multiple of 2`
  - Gracefully handles audio buffers with odd byte lengths from Deepgram WebSocket
  - Truncates odd-length buffers to even length before creating `Int16Array`
  - Logs warning when truncation occurs for debugging purposes
- **Root Cause**: PCM16 audio format requires 2 bytes per sample, but Deepgram occasionally sends buffers with odd byte lengths
- **Impact**: High - This error was causing connections to close immediately after TTS audio processing failed
- **Location**: `src/utils/audio/AudioUtils.ts:17-26` in `createAudioBuffer()` function
- **Test Coverage**: 
  - ✅ 12 comprehensive unit tests (all passing)
  - ✅ E2E test added for odd-length buffer handling
  - ✅ All tests verify no RangeError occurs and warnings are logged

### Added

- **Comprehensive Test Coverage for Issue #340**:
  - Unit tests: `tests/unit/audio-utils-createAudioBuffer.test.ts` (12 tests)
  - E2E test: `test-app/tests/e2e/audio-odd-length-buffer.spec.js`
  - Tests cover: even-length buffers, odd-length buffers (1, 3, 999, 1001 bytes), edge cases, and data conversion

### Documentation

- **Issue #340 Documentation**: Created comprehensive documentation
  - `docs/issues/ISSUE-341/VOICE-COMMERCE-RECOMMENDATIONS.md` - Recommendations for voice-commerce team
  - `docs/issues/ISSUE-341/ISSUE-340-COMPLETENESS-REVIEW.md` - Completeness review and test coverage analysis
  - Updated `docs/issues/ISSUE-341/DEFECT-RESOLUTION-EVIDENCE.md` to clarify fix status

### Test Results

- **Jest Tests**: 68 test suites passed, 725 tests passed, 10 skipped ✅
- **Unit Tests**: 12 new tests for `createAudioBuffer()` odd-length buffer handling ✅
- **E2E Tests**: New test added for odd-length buffer handling ✅

### Complete Commit List

All commits since v0.7.4:

1. `dea2573` - Issue #340: Add E2E test and update documentation
2. `5e467c7` - Issue #340: Implement odd-length buffer validation fix

### Related Issues

- **Issue #340**: Int16Array Error: TTS Audio Processing Fails with Odd-Length Buffers (fixed - actual implementation)
- **Issue #341**: Connection State Reporting: Connections Close Immediately After Being Reported as Connected (fixed in v0.7.3)
- **Issue #350**: Quick Release v0.7.5: Issue #340 Fix - Odd-Length Buffer Handling

---

[0.7.4]: https://github.com/Signal-Meaning/dg_react_agent/releases/tag/v0.7.4

