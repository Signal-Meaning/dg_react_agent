# Skipped E2E Tests Documentation

**Date**: 2026-01-02  
**Last Updated**: 2026-01-02  
**Purpose**: Document all explicitly skipped E2E tests and the reasons for skipping

**Status**: ✅ **COMPLETE** - All skip reasons have been documented in code with comments

## Overview

This document catalogs all E2E tests that are explicitly skipped (using `test.skip()`) and documents the reasons why they cannot be run. This helps identify:
- Tests that can be unskipped when dependencies are resolved
- Tests that are appropriately skipped for valid reasons
- Tests that need infrastructure or feature work to enable

## Test Skip Categories

### 1. Feature Not Yet Implemented

#### `agent-state-transitions.spec.js`
- **Test**: `should transition: idle → thinking → speaking → idle (tool trigger with text input)`
- **Location**: Line 125
- **Reason**: Requires Issue #212 - tool-triggered conversation feature
- **Details**: 
  - When tools are triggered, AgentThinking message is sent by Deepgram
  - This test validates the thinking state transition in a real scenario
  - Once Issue #212 is implemented, this message should trigger a tool call which will cause Deepgram to send an AgentThinking message
- **Can Unskip**: ❌ **NO** - Requires Issue #212 implementation
- **Action Required**: Implement tool-triggered conversation feature (Issue #212)

#### `microphone-control.spec.js`
- **Test**: `should handle microphone permission denied`
- **Location**: Line 109
- **Reason**: TODO: Fix permission mocking - see Issue #178
- **Details**: 
  - Test attempts to mock microphone permission denied
  - Permission mocking needs to be fixed to properly test this scenario
- **Can Unskip**: ❌ **NO** - Requires Issue #178 fix
- **Action Required**: Fix permission mocking (Issue #178)

### 2. CI Environment Limitations

#### `backend-proxy-mode.spec.js`
- **Skip Condition**: `process.env.CI && !process.env.VITE_PROXY_ENDPOINT`
- **Location**: Line 35 (in `beforeEach`)
- **Reason**: Proxy server not available in CI
- **Details**: 
  - Proxy server is not automatically started in CI environments
  - Tests are skipped if running in CI without explicit proxy endpoint configuration
- **Can Unskip**: ⚠️ **CONDITIONAL** - Can run locally or in CI with proper proxy setup
- **Action Required**: Configure CI to start proxy server or set `VITE_PROXY_ENDPOINT` in CI

#### `backend-proxy-authentication.spec.js`
- **Skip Condition**: `process.env.CI && !process.env.VITE_PROXY_ENDPOINT`
- **Location**: Line 20 (in `beforeEach`)
- **Reason**: Proxy server not available in CI
- **Details**: Same as above - CI environment limitation
- **Can Unskip**: ⚠️ **CONDITIONAL** - Can run locally or in CI with proper proxy setup
- **Action Required**: Configure CI to start proxy server or set `VITE_PROXY_ENDPOINT` in CI

#### `vad-configuration-optimization.spec.js`
- **Skip Condition**: `process.env.CI`
- **Location**: Line 18 (in `beforeEach`)
- **Reason**: VAD tests require real Deepgram API connections - skipped in CI
- **Details**: 
  - VAD (Voice Activity Detection) tests require real API connections
  - CI environments may not have API keys configured or may have rate limits
- **Can Unskip**: ⚠️ **CONDITIONAL** - Can run locally with real API key
- **Action Required**: Configure CI with real API keys if VAD testing is needed

#### `fixtures/vad-helpers.js` (used by multiple VAD test files)
- **Skip Condition**: `process.env.CI && skipInCI`
- **Location**: Line 31
- **Reason**: VAD tests require real Deepgram API connections
- **Details**: 
  - Used by: `manual-vad-workflow.spec.js`, `vad-events-core.spec.js`, `vad-audio-patterns.spec.js`
  - **Why skipped differently**: These tests are skipped ONLY in CI environments (`process.env.CI`), not locally
  - **Unskipping requirement**: Only requires real Deepgram API key (same as other real API tests)
  - **Why not grouped with others**: The skip logic checks `process.env.CI` specifically, while other tests use `skipIfNoRealAPI()` which checks for API key availability
  - **Should be grouped**: Yes - these should use `skipIfNoRealAPI()` like other real API tests for consistency
- **Can Unskip**: ✅ **YES** - Run locally with real API key (they're only skipped in CI)
- **Action Required**: 
  - Locally: Just run with real API key (tests will execute)
  - CI: Configure CI with real API keys if VAD testing is needed
  - **Refactoring**: Consider changing to use `skipIfNoRealAPI()` for consistency with other real API tests

### 3. Infrastructure Dependencies

#### `backend-proxy-mode.spec.js`
- **Skip Condition**: Proxy server not running at `ws://localhost:8080/deepgram-proxy`
- **Location**: Line 68 (in `beforeEach`)
- **Reason**: Proxy server is not running
- **Details**: 
  - Tests verify proxy server is accessible before running
  - If proxy server is not running, tests are skipped with helpful message
- **Can Unskip**: ✅ **YES** - Start proxy server with `npm run test:proxy:server`
- **Action Required**: Start proxy server before running tests

#### `backend-proxy-mode.spec.js`
- **Test**: `should handle proxy server unavailable gracefully (proxy mode only)`
- **Location**: Line 291
- **Reason**: Test only applies to proxy mode
- **Details**: 
  - Test is skipped if not running in proxy mode (`USE_PROXY_MODE !== 'true'`)
  - This is appropriate - test is proxy-specific
- **Can Unskip**: ⚠️ **CONDITIONAL** - Only runs in proxy mode (by design)
- **Action Required**: Run with `USE_PROXY_MODE=true` to execute this test

### 4. Audio Playback Dependencies

#### `greeting-audio-timing.spec.js`
- **Skip Condition**: `!ENABLE_AUDIO` (where `ENABLE_AUDIO = process.env.PW_ENABLE_AUDIO === 'true'`)
- **Location**: Line 24 (entire test suite)
- **Reason**: `PW_ENABLE_AUDIO` is not enabled
- **Details**: 
  - **What PW_ENABLE_AUDIO does**: Controls whether Playwright enables audio output in the browser
  - **Why not default**: By default, Playwright mutes/disables audio (`--disable-audio-output`, `--mute-audio`) to prevent noise in automated test environments
  - **When enabled**: When `PW_ENABLE_AUDIO=true`, Playwright removes these flags, allowing audio playback tests to run
  - **Why it's needed**: Audio playback tests need actual audio output to verify TTS (text-to-speech) functionality
- **Can Unskip**: ✅ **YES** - Set `PW_ENABLE_AUDIO=true` environment variable
- **Action Required**: Set `PW_ENABLE_AUDIO=true` to run audio playback tests
- **Note**: This should probably be enabled by default for audio-related tests, but is currently opt-in to avoid noise in CI/automated environments

#### `audio-interruption-timing.spec.js`
- **Test**: `should interrupt audio within 50ms when interruptAgent() is called`
- **Location**: Line 40
- **Reason**: Test is explicitly skipped - reason unknown (Issue #348 created to investigate)
- **Details**: 
  - Test verifies audio interruption timing (should stop within 50ms)
  - May be flaky due to timing sensitivity
  - **Issue #348**: Created to investigate skip reason
  - **Comment added**: Test now has TODO comment referencing Issue #348
- **Can Unskip**: ❓ **UNKNOWN** - Under investigation (Issue #348)
- **Action Required**: See Issue #348 for investigation results

#### `audio-interruption-timing.spec.js`
- **Test**: `should handle rapid interrupt clicks without errors`
- **Location**: Line 103
- **Reason**: Test is explicitly skipped - reason unknown (Issue #348 created to investigate)
- **Details**: 
  - Test verifies rapid interrupt clicks don't cause errors
  - May be flaky or have race conditions
  - **Issue #348**: Created to investigate skip reason
  - **Comment added**: Test now has TODO comment referencing Issue #348
- **Can Unskip**: ❓ **UNKNOWN** - Under investigation (Issue #348)
- **Action Required**: See Issue #348 for investigation results

#### `audio-interruption-timing.spec.js`
- **Skip Condition**: `!ENABLE_AUDIO` (multiple tests)
- **Location**: Lines 201, 268, 395
- **Reason**: `PW_ENABLE_AUDIO` is not enabled
- **Details**: 
  - Three tests are conditionally skipped if audio is not enabled
  - Tests: `should persist mute state and prevent future audio`, `should persist audio blocking across agent response turns`, `should interrupt and allow audio repeatedly`
- **Can Unskip**: ✅ **YES** - Set `PW_ENABLE_AUDIO=true` environment variable
- **Action Required**: Set `PW_ENABLE_AUDIO=true` to run these tests

## Summary

### Tests That Can Be Unskipped (with action)

1. **Proxy Server Tests** (2 test suites)
   - **Action**: Start proxy server with `npm run test:proxy:server`
   - **Tests**: `backend-proxy-mode.spec.js` (when proxy not running), `backend-proxy-authentication.spec.js` (in CI)

2. **Audio Playback Tests** (1 test suite + 3 individual tests)
   - **Action**: Set `PW_ENABLE_AUDIO=true` environment variable
   - **Tests**: `greeting-audio-timing.spec.js` (entire suite), `audio-interruption-timing.spec.js` (3 tests)

3. **VAD Tests** (multiple test files)
   - **Action**: Configure CI with real API keys (or run locally)
   - **Tests**: All VAD-related test files

### Tests That Cannot Be Unskipped (require feature work)

1. **Issue #212**: Tool-triggered conversation feature
   - **Test**: `agent-state-transitions.spec.js` - tool trigger test
   - **Status**: Feature not implemented

2. **Issue #178**: Permission mocking fix
   - **Test**: `microphone-control.spec.js` - permission denied test
   - **Status**: Permission mocking needs to be fixed

### Tests Under Investigation

1. **Audio Interruption Tests** (2 tests) - **Issue #348**
   - **Tests**: `audio-interruption-timing.spec.js` - 2 explicitly skipped tests
   - **Status**: Issue #348 created to investigate skip reasons
   - **Comments Added**: Both tests now have TODO comments referencing Issue #348
   - **Action Required**: See Issue #348 for investigation results

## Recommendations

1. ✅ **Document Skip Reasons**: **COMPLETE** - All skipped tests now have clear comments explaining why they're skipped
2. ✅ **Investigate Unknown Skips**: **COMPLETE** - Issue #348 created to investigate audio interruption tests
3. **Feature Tracking**: Track Issues #212 and #178 to know when tests can be unskipped
4. **CI Configuration**: Consider setting up CI to run proxy and VAD tests if needed
5. **Audio Testing**: Document when and why `PW_ENABLE_AUDIO` is needed
6. **VAD Test Consistency**: Consider refactoring VAD tests to use `skipIfNoRealAPI()` for consistency with other real API tests

## Related Issues

- **Issue #212**: Tool-triggered conversation feature (blocks 1 test)
- **Issue #178**: Permission mocking fix (blocks 1 test)
- **Issue #348**: Audio interruption timing tests investigation (2 tests)
- **Issue #99**: VAD mock implementation (mentioned in VAD test skips)
- **Issue #346**: Idle timeout test failures (not related to skipped tests, but related to timeout testing)

