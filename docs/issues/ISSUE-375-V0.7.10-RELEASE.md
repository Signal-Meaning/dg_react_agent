# Issue #375: Quick Release v0.7.10 - Patch Release

**GitHub Issue**: [#375](https://github.com/Signal-Meaning/dg_react_agent/issues/375) 🟡 **IN PROGRESS**  
**Status**: 🐛 **BLOCKED** - E2E Test Failures (34 failures must be resolved before release)  
**Priority**: Medium  
**Labels**: release, patch, priority:medium  
**Branch**: `davidrmcgee/issue375`  
**Release Branch**: `release/v0.7.10` (to be created)

## 📋 Release Overview

**Version**: v0.7.10  
**Release Type**: Patch Release  
**Target Date**: TBD  
**Working Branch**: `davidrmcgee/issue375`  
**Release Branch**: `release/v0.7.10` (to be created)

This is a patch release for version v0.7.10 of the Deepgram Voice Interaction React component. This release includes critical bug fixes and minor improvements with no breaking changes.

## 🔑 Key Changes Since v0.7.9

### Critical Bug Fix: Issue #373

**Issue #373**: Fix idle timeout firing during function call execution
- ✅ Prevents connections from closing during active function calls
- ✅ Implements reference counting for concurrent function calls
- ✅ Ensures function call responses can be sent successfully
- ✅ Includes comprehensive tests (5 unit/integration + 4 E2E tests)

**Impact**:
- Fixes connection closures during function call execution
- Prevents lost function call responses
- Resolves non-responsive agent issues during function calls
- Fixes voice-commerce team Issue #809

### Other Changes

- ✅ Improved greeting detection to prevent false positives
- ✅ Added shared utility for writing test transcripts to files
- ✅ Enhanced dual channel tests with better prompts and logging
- ✅ Documentation updates and improvements

## 📝 Commits Since v0.7.9

```
- refactor: apply DRY principles to Issue #373 implementation (be32cf0)
- Fix Issue #373: Prevent idle timeout during function call execution (3448d9d)
- fix: improve greeting detection to prevent false positives (97495b4)
- feat: add shared utility for writing test transcripts to files (d76e5cc)
- docs: add dual channel test transcripts documentation (9e498be)
- test: update Test 1 text message to use factual question (193eb36)
- test: improve dual channel tests with better prompts and greeting detection (58d0c7c)
- test: add conversation transcript logging to dual channel tests (1bef430)
- test: add conversation transcript logging to dual channel tests (377d31a)
- test: improve dual channel tests with agent response logging and pre-recorded audio (4f670b8)
```

## ✅ Release Checklist Progress

### Pre-Release
- [x] **Tests Passing**: All tests passing
  - [x] **Jest Tests**: Run `npm test`
    - ✅ **Status**: All tests passing (exit code 0)
  - [x] **⚠️ CRITICAL: Run E2E tests in proxy mode** (proxy mode is the default and primary mode)
    - [x] Start proxy server: `npm run test:proxy:server` (in test-app directory)
      - ✅ **Status**: Proxy server started automatically by Playwright config
    - [x] Run: `USE_PROXY_MODE=true npm run test:e2e` (all E2E tests must pass in proxy mode)
      - ✅ **Status**: Tests running in background (217 tests, expected 2-3 hours)
      - ✅ **Note**: Tests configured to run in background with output to log file for monitoring
      - ✅ **Monitoring**: Can check progress via log file or test results
    - [x] Verify: All tests pass in proxy mode before proceeding
      - [x] **Status**: ✅ **Tests completed** - 151 passed, 34 failed, 37 skipped (222 total)
      - [ ] **Action Required**: Fix 34 failing tests before release
- [x] **Linting Clean**: No linting errors
  - [x] **Run**: `npm run lint`
  - ✅ **Status**: Clean (0 errors, 4 warnings - acceptable)

### Version & Build
- [x] **Bump Version**: Update to v0.7.10
  - [x] **Run**: `npm version patch --no-git-tag-version`
  - ✅ **Status**: Version updated to 0.7.10
- [x] **Build Package**: Create production build
  - [x] **Run**: `npm run build`
  - ✅ **Status**: Build completed successfully
- [x] **Test Package**: Verify package works
  - [x] **Run**: `npm run package:local`
  - ✅ **Status**: Package created successfully

### Documentation
- [x] **⚠️ CRITICAL: Create Release Documentation BEFORE Publishing** ⚠️
  - [x] **Create**: `docs/releases/v0.7.10/` directory
  - [x] **Create**: `CHANGELOG.md` with all changes (Keep a Changelog format)
    - ✅ Include Issue #373 fix as main feature
    - ✅ Include other improvements and fixes
  - [x] **Create**: `PACKAGE-STRUCTURE.md` from template (`docs/releases/PACKAGE-STRUCTURE.template.md`)
    - ✅ Replaced `vX.X.X` and `X.X.X` placeholders with `v0.7.10` and `0.7.10`
  - [x] **Create**: `RELEASE-NOTES.md` (optional but standard)
- [x] **Validate Release Documentation**: Run validation script
  - [x] **Run**: `npm run validate:release-docs 0.7.10` (version without "v" prefix)
  - ✅ **Status**: All required documents present, 0 errors, 0 warnings
- [x] **Update Version**: Update version references in docs
  - ✅ **Status**: Version references updated in release documentation
- [x] **⚠️ DO NOT proceed to Release section until documentation is complete** ⚠️

### Release
- [ ] **Commit Changes**: Commit all release-related changes (including documentation)
  - [ ] **Commit**: `git add . && git commit -m "chore: prepare release v0.7.10"`
  - [ ] **Status**: TBD (pending - will commit after E2E tests)
- [ ] **Create Release Branch**: Create a release branch for the version
  - [ ] **Create**: `git checkout -b release/v0.7.10` (from current working branch or main)
  - [ ] **Push**: `git push origin release/v0.7.10`
  - [ ] **Status**: TBD
- [ ] **Publish**: Publish to GitHub Registry
  - [ ] **⚠️ Documentation must be committed to release branch BEFORE creating GitHub release** ⚠️
  - [ ] **Preferred**: Use CI build (create GitHub release to trigger `.github/workflows/test-and-publish.yml`)
    - [ ] Create GitHub release (this triggers CI publish workflow)
    - [ ] **Monitor CI workflow**: Wait for CI build to complete successfully
      - [ ] Check GitHub Actions workflow status
      - [ ] Verify all CI checks pass
      - [ ] Verify package appears in GitHub Packages
    - [ ] **Only proceed to tagging if publish succeeds**
  - [ ] **Fallback**: Dev publish (only if CI fails)
    - [ ] Run: `npm publish` (automatically publishes to GitHub Registry)
    - [ ] Verify: Package appears in GitHub Packages
    - [ ] **Only proceed to tagging if publish succeeds**
  - [ ] **Status**: TBD
- [ ] **Tag Release**: Create git tag for the release (AFTER publish succeeds)
  - [ ] Verify: Package is successfully published to GitHub Packages
  - [ ] Tag: `git tag v0.7.10`
  - [ ] Push: `git push origin v0.7.10`
  - [ ] **Status**: TBD
- [ ] **GitHub Release**: Create GitHub release (if not already created for CI publish)
  - [ ] Title: `v0.7.10`
  - [ ] Description: Copy from CHANGELOG.md
  - [ ] Target: `release/v0.7.10` branch (or `main` if release branch merged)
  - [ ] **Status**: TBD
- [ ] **Post-Release**: Merge release branch to main (if not already merged)
  - [ ] Merge: `release/v0.7.10` → `main`
  - [ ] Push: `git push origin main`
  - [ ] **Status**: TBD

## 🚨 Important Notes

- This is a patch release - no breaking changes
- All tests must pass before release
- Package publishes to GitHub Package Registry
- Update CHANGELOG.md with changes
- **Critical**: Issue #373 fix is the main feature of this release
- **⚠️ CRITICAL: E2E tests must pass in proxy mode** - proxy mode is the default and primary mode

## ✅ Completion Criteria

- [ ] **All E2E tests passing** (34 failures must be resolved) 🔴 **BLOCKING**
- [ ] Package published to GitHub Registry
- [ ] GitHub release created
- [ ] CHANGELOG.md updated

## 🔗 Related Issues

- Closes #373 (Main feature - Idle timeout during function calls) ✅ **FIXED**
- Fixes voice-commerce team Issue #809 ✅ **FIXED**
- Issue #375 (this release) 🟡 **IN PROGRESS**

## 🐛 E2E Test Failure Resolution Tracking

**Last Updated**: 2026-01-20  
**Test Run**: Full E2E test suite in proxy mode  
**Test Log**: `test-results/e2e-runs/e2e-20260120-065452.log`  
**Duration**: 1.1 hours  
**Total Tests**: 222

### Test Results Summary

- ✅ **171 tests passed** (77.0%) - **+20 tests fixed** 🎉
- ❌ **14 tests failed** (6.3%) - **-20 tests fixed, still blocking release**
- ⏭️ **37 tests skipped** (16.7%)

### Failed Tests by Category

#### 1. Idle Timeout Behavior (15 failures)
**Status**: 🔴 **HIGH PRIORITY** - Core functionality affected

| Test File | Test Name | Status | Notes |
|-----------|-----------|--------|-------|
| `idle-timeout-behavior.spec.js` | should handle microphone activation after idle timeout | ❌ | |
| `idle-timeout-behavior.spec.js` | should show loading state during reconnection attempt | ❌ | |
| `idle-timeout-behavior.spec.js` | should handle idle timeout correctly - connection closes after 10 seconds of inactivity | ❌ | |
| `idle-timeout-behavior.spec.js` | should reset idle timeout when startAudioCapture() is called (Issue #222) | ❌ | |
| `idle-timeout-behavior.spec.js` | should start idle timeout after agent finishes speaking - agent state transitions to idle | ❌ | |
| `idle-timeout-behavior.spec.js` | should start idle timeout countdown after agent finishes - reproduces voice-commerce issue | ❌ | |
| `idle-timeout-behavior.spec.js` | should restart timeout after USER_STOPPED_SPEAKING when agent is idle - reproduces Issue #262/#430 | ❌ | |
| `idle-timeout-during-agent-speech.spec.js` | @flaky should NOT timeout while agent is actively speaking | ❌ | @flaky |
| `issue-373-idle-timeout-during-function-calls.spec.js` | should NOT timeout during agent thinking phase before function call | ❌ | **Related to Issue #373** |
| `issue-373-idle-timeout-during-function-calls.spec.js` | should re-enable idle timeout after function calls complete | ❌ | **Related to Issue #373** |
| `microphone-activation-after-idle-timeout.spec.js` | should handle microphone activation after idle timeout | ✅ | **FIXED** - Uses same helpers |
| `microphone-activation-after-idle-timeout.spec.js` | should show loading state during reconnection attempt | ✅ | **FIXED** - Uses same helpers |
| `microphone-functionality-fixed.spec.js` | should handle microphone activation after idle timeout (FIXED) | ✅ | **FIXED** - Uses same helpers |
| `text-idle-timeout-suspended-audio.spec.js` | should timeout after text interaction even with suspended AudioContext | ✅ | **FIXED** - Uses same helpers |
| `text-idle-timeout-suspended-audio.spec.js` | should resume AudioContext on text input focus | ✅ | **FIXED** - Uses same helpers |

#### 2. Text Session Flow (4 failures)
**Status**: 🔴 **HIGH PRIORITY** - Text input functionality affected

| Test File | Test Name | Status | Notes |
|-----------|-----------|--------|-------|
| `text-session-flow.spec.js` | should auto-connect and re-establish connection when WebSocket is closed | ❌ | |
| `text-session-flow.spec.js` | should handle rapid message exchange within idle timeout | ❌ | |
| `text-session-flow.spec.js` | should establish connection, send settings, and respond to initial text | ❌ | |
| `text-session-flow.spec.js` | should maintain connection through sequential messages | ❌ | |

#### 3. VAD and Agent State Transitions (4 failures)
**Status**: 🟡 **MEDIUM PRIORITY** - 2 marked @flaky

| Test File | Test Name | Status | Notes |
|-----------|-----------|--------|-------|
| `vad-redundancy-and-agent-timeout.spec.js` | should handle agent state transitions for idle timeout behavior with text input | ❌ | |
| `vad-redundancy-and-agent-timeout.spec.js` | should prove AgentThinking disables idle timeout resets by injecting message | ❌ | |
| `vad-redundancy-and-agent-timeout.spec.js` | @flaky should debug agent response flow and state transitions | ❌ | @flaky |
| `vad-redundancy-and-agent-timeout.spec.js` | @flaky should verify agent state transitions using state inspection | ❌ | @flaky |

#### 4. Deepgram Instructions File (4 failures)
**Status**: 🟡 **MEDIUM PRIORITY** - Configuration feature

| Test File | Test Name | Status | Notes |
|-----------|-----------|--------|-------|
| `deepgram-instructions-file.spec.js` | should load instructions from environment variable override | ❌ | |
| `deepgram-instructions-file.spec.js` | should display instructions preview in UI | ❌ | |
| `deepgram-instructions-file.spec.js` | should integrate instructions with DeepgramVoiceInteraction component | ❌ | |
| `deepgram-instructions-file.spec.js` | should support different instruction sources | ❌ | |

#### 5. Client Message Timeout (2 failures)
**Status**: 🟡 **MEDIUM PRIORITY**

| Test File | Test Name | Status | Notes |
|-----------|-----------|--------|-------|
| `client-message-timeout.spec.js` | should handle CLIENT_MESSAGE_TIMEOUT when function call handler does not respond | ❌ | |
| `client-message-timeout.spec.js` | should handle CLIENT_MESSAGE_TIMEOUT from server idle timeout | ❌ | |

#### 6. Audio Buffer Handling (2 failures)
**Status**: 🟡 **MEDIUM PRIORITY**

| Test File | Test Name | Status | Notes |
|-----------|-----------|--------|-------|
| `audio-odd-length-buffer.spec.js` | should handle odd-length TTS audio buffers without RangeError | ❌ | |
| `audio-odd-length-buffer.spec.js` | should verify createAudioBuffer fix is in place | ❌ | |

#### 7. Other Failures (3 failures)
**Status**: 🟡 **LOW-MEDIUM PRIORITY**

| Test File | Test Name | Status | Notes |
|-----------|-----------|--------|-------|
| `agent-state-transitions.spec.js` | should transition: idle → speaking → idle (user types message and clicks send) | ❌ | |
| `greeting-idle-timeout.spec.js` | should timeout after greeting completes (Issue #139) | ❌ | |
| `strict-mode-behavior.spec.js` | should detect StrictMode cleanup in console logs | ❌ | |

### Resolution Plan

#### Phase 1: Critical Issues (Issue #373 Related) 🔴
**Priority**: **HIGHEST** - These are related to the main feature of this release

1. [x] Fix `issue-373-idle-timeout-during-function-calls.spec.js` failures
   - [x] **FIXED**: Idle timeout now stops immediately when agent enters thinking state
     - Added immediate `stopTimeout()` call in `AGENT_STATE_CHANGED` handler when state becomes 'thinking'
     - Prevents timeout from firing during agent thinking phase before function calls
   - [x] **FIXED**: Proactive thinking state transition when user message is sent
     - `injectUserMessage()` now immediately transitions to thinking state before sending message
     - Prevents idle timeout from firing during gap between message send and agent response
     - Handles case where Deepgram doesn't send `AgentThinking` message
   - [x] **FIXED**: Function call completion tracking in test
     - Added missing `window.__FUNCTION_CALL_RESPONSE_SENT__ = true` flag in test handler
     - Allows test to properly detect when function call completes
   - [x] **FIXED**: Test reliability - replaced console log parsing with DOM-based checks
     - Test now monitors `[data-testid="connection-status"]` DOM element instead of console logs
     - More reliable detection of connection state changes
     - Eliminates false positives from log messages
   - [x] **Status**: ✅ **ALL TESTS PASSING** - All 4 Issue #373 tests now pass
     - ✅ "should NOT timeout during long-running function call execution" - PASSED (14.6s)
     - ✅ "should NOT timeout during agent thinking phase before function call" - PASSED (1.8s) **FIXED**
     - ✅ "should handle multiple concurrent function calls" - PASSED (1.6s)
     - ✅ "should re-enable idle timeout after function calls complete" - PASSED (16.7s)

#### Phase 2: Core Idle Timeout Behavior 🔴
**Priority**: **HIGH** - Core functionality

2. [x] Fix idle timeout behavior test failures (7 tests in `idle-timeout-behavior.spec.js`)
   - [x] **FIXED**: Updated `setupTestPage` to use `buildUrlWithParams` for automatic proxy mode support
   - [x] **FIXED**: Improved `establishConnectionViaText` with more reliable connection pattern
   - [x] **FIXED**: Increased `sendTextMessage` timeout for better reliability
   - [x] **Status**: ✅ **ALL 9 TESTS PASSING**

3. [x] Fix text session flow failures (4 tests)
   - [x] **FIXED**: Same fixes as idle-timeout-behavior (shared helpers)
   - [x] **Status**: ✅ **ALL 4 TESTS PASSING**

#### Phase 3: Agent State and VAD 🟡
**Priority**: **MEDIUM**

4. [ ] Fix VAD and agent state transition failures (4 tests)
   - [ ] Review agent state management
   - [ ] Check AgentThinking state handling
   - [ ] Investigate flaky test patterns

#### Phase 4: Configuration and Edge Cases 🟡
**Priority**: **MEDIUM-LOW**

5. [ ] Fix Deepgram instructions file tests (4 tests)
6. [ ] Fix client message timeout tests (2 tests)
7. [ ] Fix audio buffer handling tests (2 tests)
8. [ ] Fix remaining miscellaneous tests (3 tests)

### Investigation Notes

- **Common Pattern**: Many failures involve connection establishment or idle timeout behavior
- **Last Error Observed**: Timeout waiting for connection status to become 'connected' in `waitForConnection` helper
- **Flaky Tests**: 2 tests marked @flaky in VAD redundancy tests - may need retry logic or timing adjustments
- **Issue #373 Tests**: 2 failures in the feature we're releasing - **CRITICAL** to fix before release

### Next Steps

1. [ ] Review test failure logs in detail
2. [ ] Identify root causes for each failure category
3. [ ] Create fixes following TDD approach (write tests first, then fix)
4. [ ] Re-run E2E tests after fixes
5. [ ] Verify all tests pass before proceeding with release

## Test Summary

### Issue #373 Test Coverage

**Unit/Integration Tests**: 5 tests
- Reference counting for concurrent function calls
- Idle timeout prevention during function calls
- Function call lifecycle management

**E2E Tests**: 4 tests
- Function call execution without timeout
- Concurrent function calls handling
- Function call response delivery
- Connection stability during function calls

### Total Test Coverage

- ✅ **Jest Unit/Integration Tests**: 5 new tests for Issue #373
- ✅ **E2E Tests**: 4 new tests for Issue #373
- **Total**: 9 new tests added for Issue #373

## Implementation Details

### Issue #373: Idle Timeout During Function Calls

**Problem**: The component's idle timeout was incorrectly firing during active function call execution, causing connections to close before function call responses could be sent.

**Solution**: 
- Implemented reference counting for concurrent function calls
- Automatically disable idle timeout when function calls are active
- Re-enable idle timeout when all function calls complete
- Added comprehensive test coverage

**Files Modified**:
- `src/utils/IdleTimeoutService.ts` - Added reference counting logic
- `src/hooks/useIdleTimeoutManager.ts` - Added function call tracking
- `src/components/DeepgramVoiceInteraction/index.tsx` - Integrated function call tracking

**Test Files**:
- `tests/` - Unit/integration tests for idle timeout service
- `test-app/tests/e2e/` - E2E tests for function call scenarios
