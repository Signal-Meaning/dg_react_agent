# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.6] - 2026-01-03

### Added

#### Issue #351: Enhanced Diagnostic Logging for FunctionCallRequest

**Purpose**: Help diagnose why `onFunctionCallRequest` callback may not be invoked in certain environments.

- **Comprehensive Debug Logging**: Added detailed diagnostic logging throughout FunctionCallRequest handling flow
  - Logs message detection when FunctionCallRequest is received
  - Logs function processing details (array length, function details)
  - Logs callback availability status
  - Logs callback invocation flow (before, during, after)
  - Logs error conditions and early return scenarios
- **Production-Friendly**: All logging respects `debug` prop - only logs when `debug={true}` is enabled
- **Diagnostic Messages**: Added specific log messages to help identify where in the flow issues occur:
  - `🔧 [FUNCTION] FunctionCallRequest detected in handleAgentMessage`
  - `🔧 [FUNCTION] FunctionCallRequest received from Deepgram`
  - `🔧 [FUNCTION] Functions array length: X`
  - `🔧 [FUNCTION] onFunctionCallRequest callback available: true/false`
  - `🔧 [FUNCTION] About to invoke onFunctionCallRequest callback`
  - `🔧 [FUNCTION] Invoking onFunctionCallRequest callback now...`
  - `🔧 [FUNCTION] onFunctionCallRequest callback completed`
  - `🔧 [AGENT] ⚠️` messages for early return conditions

**Files Modified**:
- `src/components/DeepgramVoiceInteraction/index.tsx` - Enhanced logging in FunctionCallRequest handler (lines ~1928-2298)

**Impact**: Medium - Diagnostic tooling to help identify root cause of Issue #351

**Usage**: Enable `debug={true}` on the component to see diagnostic logs:
```tsx
<DeepgramVoiceInteraction
  debug={true}
  onFunctionCallRequest={handleFunctionCallRequest}
  // ... other props
/>
```

### Documentation

- **Issue #351 Documentation**: Created comprehensive tracking document
  - `docs/issues/ISSUE-351-FUNCTION-CALL-REQUEST-CALLBACK.md` - Full issue tracking and investigation
  - `test-app/tests/e2e/issue-351-function-call-proxy-mode.spec.js` - Reproduction test (passes in our environment)

### Test Results

- **Jest Tests**: 69 test suites passed, 737 tests passed, 10 skipped ✅
- **E2E Tests**: Reproduction test created and passing ✅
- **Linting**: Clean (4 warnings, acceptable - no errors) ✅

### Complete Commit List

- `Issue #351: Add enhanced logging for FunctionCallRequest callback diagnosis`
- `Issue #351: Create reproduction test for FunctionCallRequest callback in proxy mode`
- `Issue #351: Reproduction test passes - cannot reproduce customer issue`
- `Issue #351: Update with customer logs analysis`
- `Issue #351: Add release issue reference for v0.7.6`

---

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

