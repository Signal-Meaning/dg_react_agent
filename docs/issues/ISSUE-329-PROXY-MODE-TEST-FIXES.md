# Issue #329: E2E Test Failures in Proxy Mode

**GitHub Issue**: [#329](https://github.com/Signal-Meaning/dg_react_agent/issues/329)  
**Status**: In Progress  
**Priority**: High  
**Labels**: bug, high-priority, testing, proxy-mode

## 🚨 Problem Summary

22 E2E tests are failing when run in proxy mode (`USE_PROXY_MODE=true`). The proxy server was only handling agent service connections and not transcription service connections, causing transcription-related tests to fail.

## 📊 Test Failure Tracking

### Test Status Overview

| Status | Count | Tests |
|--------|-------|-------|
| ✅ Fixed | 18 | `callback-test.spec.js:48` - onTranscriptUpdate callback<br>`agent-options-resend-issue311.spec.js:50` - Settings re-send<br>`backend-proxy-mode.spec.js:61` - Agent responses through proxy<br>`callback-test.spec.js:87` - onUserStartedSpeaking callback<br>`declarative-props-api.spec.js:278` - Function call response via callback<br>`callback-test.spec.js:128` - onUserStoppedSpeaking callback<br>`extended-silence-idle-timeout.spec.js:11` - Connection closure with silence<br>`interim-transcript-validation.spec.js:32` - Interim and final transcripts<br>`strict-mode-behavior.spec.js:93` - StrictMode cleanup detection<br>`user-stopped-speaking-demonstration.spec.js:20` - onUserStoppedSpeaking demonstration<br>`user-stopped-speaking-demonstration.spec.js:174` - Multiple audio samples<br>`vad-audio-patterns.spec.js:26` - VAD events with pre-generated audio<br>`vad-audio-patterns.spec.js:55` - VAD events with realistic patterns<br>`vad-audio-patterns.spec.js:120` - Multiple audio samples in sequence<br>`vad-configuration-optimization.spec.js:23` - utterance_end_ms values<br>`vad-configuration-optimization.spec.js:134` - VAD event combinations<br>`vad-configuration-optimization.spec.js:225` - VAD event timing<br>`vad-events-core.spec.js:27` - Basic VAD events |
| 🔄 In Progress | 1 | `idle-timeout-behavior.spec.js:887` - Idle timeout restart |
| ❌ Pending | 3 | See list below |

### Fixed Tests ✅

1. ✅ **`callback-test.spec.js:48:3`** - "should test onTranscriptUpdate callback with existing audio sample"
   - **Fix Date**: 2025-01-29
   - **Root Cause**: Proxy server didn't support transcription service connections
   - **Solution**: Added service type detection and routing for both agent and transcription services
   - **Verification**: Test passes, transcripts received through proxy

2. ✅ **`agent-options-resend-issue311.spec.js:50:3`** - "should re-send Settings when agentOptions changes after connection (Issue #311)"
   - **Fix Date**: 2025-01-29
   - **Root Cause**: Settings messages were being sent before WebSocket was fully OPEN, causing sendJSON to return false
   - **Solution**: Added WebSocket state checking - wait for WebSocket to be OPEN (readyState === 1) before sending Settings
   - **Additional Fix**: Handle case where WebSocket capture data might not be available in proxy mode
   - **Verification**: Test passes, SettingsApplied received through proxy

3. ✅ **`backend-proxy-mode.spec.js:61:3`** - "should work with agent responses through proxy"
   - **Fix Date**: 2025-01-29
   - **Root Cause**: Same as test #2 - Settings timing issue prevented proper connection establishment
   - **Solution**: Fixed by Fix #4 (WebSocket timing issue for Settings messages)
   - **Verification**: Test passes, agent responses work correctly through proxy

### Pending Tests ❌

#### Category 1: Agent Options & Settings (0 tests)
~~1. ❌ `agent-options-resend-issue311.spec.js:50:3`~~ - ✅ **FIXED** - See Fixed Tests section above

#### Category 2: Backend Proxy Mode (0 tests)
~~2. ❌ `backend-proxy-mode.spec.js:61:3`~~ - ✅ **FIXED** - See Fixed Tests section above

#### Category 3: Callback Tests (2 tests)
3. ✅ `callback-test.spec.js:87:3` - "should test onUserStartedSpeaking callback with existing audio sample"
   - **Status**: ✅ **FIXED** - Passing (verified earlier)
4. ✅ `callback-test.spec.js:128:3` - "should test onUserStoppedSpeaking callback with existing audio sample"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: UtteranceEnd callback wasn't being called when `speech_final=true` was received first (component was ignoring UtteranceEnd per Deepgram guidelines)
   - **Solution**: Always call `onUtteranceEnd` callback even if `speech_final=true` was already received, since the callback provides useful data (channel, lastWordEnd). The "ignore" behavior now only applies to internal state management, not to callbacks.
   - **Verification**: Test passes, UtteranceEnd callback called and DOM element updated

#### Category 4: Declarative Props API (0 tests)
~~5. ❌ `declarative-props-api.spec.js:278:5`~~ - ✅ **FIXED** - Passing (verified)

#### Category 5: Extended Silence Idle Timeout (1 test)
6. ✅ `extended-silence-idle-timeout.spec.js:11:3` - "should demonstrate connection closure with >10 seconds of silence"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Fixed by Fix #5 (UtteranceEnd callback fix) - test was failing because UtteranceEnd callback wasn't being called
   - **Verification**: Test passes, connection closes after idle timeout as expected

#### Category 6: Function Calling (2 tests)
7. ❌ `function-calling-e2e.spec.js:65:3` - "should trigger client-side function call and execute it"
   - **Status**: In Progress - FunctionCallRequest not being received
   - **Root Cause**: SettingsApplied is received, but FunctionCallRequest from Deepgram is not arriving
   - **Observations**: 
     - Settings message is sent (verified in logs)
     - SettingsApplied is received (verified in logs)
     - Functions may not be in Settings message (WebSocket capture shows functions missing, but capture may be unreliable in proxy mode)
     - FunctionCallRequest never arrives (test times out waiting)
   - **Next Steps**: 
     - Verify functions are actually included in Settings message sent to Deepgram (check proxy logs)
     - Investigate if proxy is correctly forwarding FunctionCallRequest messages from Deepgram
     - Check if Deepgram is sending FunctionCallRequest (may need to verify function definitions are valid)
8. ❌ `function-calling-e2e.spec.js:501:3` - "should test minimal function definition for SettingsApplied issue"
   - **Status**: In Progress - Page closure issue
   - **Root Cause**: Test page/browser context closing unexpectedly during execution (error: "Target page, context or browser has been closed")
   - **Observations**: Error occurs at `page.waitForTimeout(1000)` after updating agentOptions
   - **Next Steps**: 
     - Investigate why page is closing - may be connection closure or error causing browser to close
     - Check if there's an error in the component that's causing the page to close
     - May need to add error handling or check connection state before waiting

#### Category 7: Idle Timeout Behavior (1 test)
9. ❌ `idle-timeout-behavior.spec.js:887:3` - "should restart timeout after USER_STOPPED_SPEAKING when agent is idle - reproduces Issue #262/#430"
   - **Status**: In Progress - Timeout not starting
   - **Root Cause**: IdleTimeoutService disables resets when `AGENT_STATE_CHANGED` arrives with 'idle' while `isPlaying` is still true. When `PLAYBACK_STATE_CHANGED` arrives with `isPlaying: false`, `updateTimeoutBehavior()` should enable resets and start timeout, but it's not happening.
   - **Fix Attempted**: 
     - Modified `MEANINGFUL_USER_ACTIVITY` handler to check if agent is idle and enable resets/start timeout
     - Modified `PLAYBACK_STATE_CHANGED` handler to check if playback stopped and agent is idle, then enable resets/start timeout
     - Added detailed logging to track state transitions
   - **Current Issue**: Logs show events only up to `MEANINGFUL_USER_ACTIVITY` while agent is still speaking. Test waits for agent to be idle and audio to stop, but timeout isn't starting when those conditions are met.
   - **Next Steps**: 
     - Investigate why timeout isn't starting when `AGENT_STATE_CHANGED` with 'idle' and `PLAYBACK_STATE_CHANGED` with `isPlaying=false` both occur
     - May need to add a delayed check or ensure timeout starts in all code paths when conditions are met
     - Check if there's a race condition or timing issue preventing timeout from starting

#### Category 8: Interim Transcript Validation (1 test)
10. ✅ `interim-transcript-validation.spec.js:32:3` - "should receive both interim and final transcripts with fake audio"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Fixed by previous fixes (Settings timing, UtteranceEnd callback)
   - **Verification**: Test passes, transcripts received correctly

#### Category 9: StrictMode Behavior (1 test)
11. ✅ `strict-mode-behavior.spec.js:93:3` - "should detect StrictMode cleanup in console logs"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Test was looking for log messages that don't exist ("component initialized" or "DeepgramVoiceInteraction component initialized")
   - **Solution**: Updated test to look for actual component log message ("🔧 [Component] Initialization check")
   - **Verification**: Test passes, mount logs found

#### Category 10: User Stopped Speaking (2 tests)
12. ✅ `user-stopped-speaking-demonstration.spec.js:20:3` - "should demonstrate onUserStoppedSpeaking with real microphone and pre-recorded audio"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: `onUserStoppedSpeaking` wasn't being called when UtteranceEnd was received after `speech_final=true` was already received
   - **Solution**: Always call `onUserStoppedSpeaking` when UtteranceEnd is received, even if `speech_final=true` was already received, because `onUserStoppedSpeaking` might not have been called when `speech_final=true` was received (if `isUserSpeaking` was false at that time)
   - **Verification**: Test passes, both UtteranceEnd and UserStoppedSpeaking detected
13. ✅ `user-stopped-speaking-demonstration.spec.js:174:3` - "should demonstrate onUserStoppedSpeaking with multiple audio samples"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Same as test #12 - `onUserStoppedSpeaking` wasn't being called when UtteranceEnd was received
   - **Solution**: Fixed by same fix as test #12
   - **Verification**: Test passes

#### Category 11: VAD Audio Patterns (3 tests)
14. ✅ `vad-audio-patterns.spec.js:26:3` - "should detect VAD events with pre-generated audio samples"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Fixed by UtteranceEnd callback fix (Fix #5)
   - **Verification**: Test passes
15. ✅ `vad-audio-patterns.spec.js:55:3` - "should detect VAD events with realistic audio patterns"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Fixed by UtteranceEnd callback fix (Fix #5)
   - **Verification**: Test passes
16. ✅ `vad-audio-patterns.spec.js:120:3` - "should handle multiple audio samples in sequence"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Fixed by UtteranceEnd callback fix (Fix #5)
   - **Verification**: Test passes

#### Category 12: VAD Configuration Optimization (3 tests)
17. ✅ `vad-configuration-optimization.spec.js:23:3` - "should test different utterance_end_ms values for offset detection"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Fixed by UtteranceEnd callback fix (Fix #5)
   - **Verification**: Test passes
18. ✅ `vad-configuration-optimization.spec.js:134:3` - "should test different VAD event combinations"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Fixed by UtteranceEnd callback fix (Fix #5)
   - **Verification**: Test passes
19. ✅ `vad-configuration-optimization.spec.js:225:3` - "should test VAD event timing and sequencing"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Fixed by UtteranceEnd callback fix (Fix #5)
   - **Verification**: Test passes

#### Category 13: VAD Events Core (1 test)
20. ✅ `vad-events-core.spec.js:27:3` - "should detect basic VAD events (UserStartedSpeaking, UtteranceEnd)"
   - **Status**: ✅ **FIXED** - 2025-01-29
   - **Root Cause**: Fixed by UtteranceEnd callback fix (Fix #5)
   - **Verification**: Test passes

#### Category 14: VAD Redundancy (1 test)
21. ❌ `vad-redundancy-and-agent-timeout.spec.js:380:3` - "should maintain consistent idle timeout state machine"
   - **Status**: In Progress - Validation failure
   - **Root Cause**: Test expects enable/disable actions to be logged (`hasEnableActions || hasDisableActions`), but neither is found in validation results
   - **Related**: Same idle timeout issue as test #9 - timeout not starting prevents action logging
   - **Next Steps**: 
     - Fix idle timeout issue (test #9) first, then verify this test
     - May need to check if actions are being logged but not captured by the validation utility
     - Verify that idle timeout state machine is actually transitioning states

## 🔧 Fixes Applied

### Fix #1: Proxy Server Transcription Support (2025-01-29)

**Problem**: Proxy server only handled agent connections, causing transcription connections to fail.

**Root Cause**:
1. Proxy server hardcoded to agent endpoint
2. No service type detection
3. Query parameters not forwarded to Deepgram

**Solution**:
1. Added service type detection from `service` query parameter
2. Route agent → `wss://agent.deepgram.com/v1/agent/converse`
3. Route transcription → `wss://api.deepgram.com/v1/listen`
4. Forward all query parameters (except `service` and `token`)
5. Added component changes to pass `service` parameter
6. Added Playwright config to auto-start proxy server

**Files Changed**:
- `test-app/scripts/mock-proxy-server.js` - Service routing and query forwarding
- `src/components/DeepgramVoiceInteraction/index.tsx` - Add service parameter
- `test-app/tests/playwright.config.mjs` - Auto-start proxy server
- `test-app/tests/mock-proxy-server.test.js` - 14 unit tests

**Verification**:
- ✅ Unit tests: 14/14 passing
- ✅ E2E test: `callback-test.spec.js:48` passing
- ✅ Transcripts received through proxy

### Fix #2: KeepAlive Message Ordering (2025-01-29)

**Problem**: KeepAlive messages sent before Settings, causing protocol errors.

**Solution**: Defer keepalive start for agent service until Settings is sent.

**Files Changed**:
- `src/utils/websocket/WebSocketManager.ts` - Keepalive ordering fix

### Fix #3: Message Queuing for Deepgram Messages (2025-01-29)

**Problem**: Messages from Deepgram (like SettingsApplied) might be dropped if client WebSocket isn't ready.

**Root Cause**: Proxy server was dropping messages from Deepgram if client WebSocket wasn't in OPEN state, causing critical messages like SettingsApplied to be lost.

**Solution**: 
1. Added `deepgramMessageQueue` to buffer messages from Deepgram until client is ready
2. Added `forwardQueuedDeepgramMessages()` helper function to forward queued messages
3. Added error handling for send failures with automatic requeuing
4. Added retry mechanism to periodically attempt forwarding queued messages

**Files Changed**:
- `test-app/scripts/mock-proxy-server.js` - Message queuing and forwarding logic

**Status**: ✅ Fixed - Combined with Fix #4 below

### Fix #4: WebSocket Timing Issue for Settings Messages (2025-01-29)

**Problem**: Settings messages were being sent before WebSocket was fully OPEN, causing `sendJSON` to return false and messages to never reach the proxy.

**Root Cause**: 
1. Connection state became 'connected' before WebSocket readyState was OPEN
2. React StrictMode remounts caused timing issues
3. Settings was sent immediately when connection state changed, but WebSocket might still be CONNECTING

**Solution**: 
1. Added WebSocket state checking before sending Settings
2. Wait for WebSocket readyState to be OPEN (1) before attempting to send
3. Added retry logic with timeout to handle CONNECTING state
4. Added validation in `sendAgentSettings` to check WebSocket state right before sending
5. Handle case where WebSocket capture data might not be available in proxy mode

**Files Changed**:
- `src/components/DeepgramVoiceInteraction/index.tsx` - WebSocket state checking and timing fix
- `test-app/tests/e2e/agent-options-resend-issue311.spec.js` - Handle missing WebSocket capture data

**Verification**: 
- ✅ Test passes
- ✅ Settings messages received by proxy
- ✅ SettingsApplied received from Deepgram
- ✅ SettingsApplied forwarded to client

## 📝 Test Execution Notes

### ⚠️ CRITICAL Testing Guidelines

**🚨 ONE TEST AT A TIME - MANDATORY**: 
- **NEVER run all E2E tests at once** (`npm run test:e2e` without filters)
- **ALWAYS run tests individually** using `--grep` to target a specific test
- Each test must be resolved (made to pass) individually before moving to the next one
- This ensures proper isolation and prevents regression
- Running all tests at once can cause timeouts, resource conflicts, and makes debugging impossible

**Command Execution**: Until tests pass, avoid using `head` and `tail` options in shell commands. These can truncate important output needed for debugging.

**Playwright HTML Output**: Do not serve the Playwright HTML output. Use the console output and test results directly for debugging.

### Running Tests in Proxy Mode

```bash
# ❌ DO NOT DO THIS - Running all tests at once
# USE_PROXY_MODE=true npm run test:e2e

# ✅ CORRECT - Run ONE test at a time
cd test-app
USE_PROXY_MODE=true npm run test:e2e -- tests/e2e/callback-test.spec.js --grep "exact test name"

# Example for next pending test:
USE_PROXY_MODE=true npm run test:e2e -- tests/e2e/extended-silence-idle-timeout.spec.js --grep "should demonstrate connection closure"
```

### Environment Variables

- `USE_PROXY_MODE=true` - Enables proxy mode for all tests
- `VITE_PROXY_ENDPOINT=ws://localhost:8080/deepgram-proxy` - Proxy endpoint URL
- `DEEPGRAM_API_KEY` - Required for proxy server (from .env)

## 🎯 Next Steps

**⚠️ Critical**: Each test must be resolved one at a time. Do not attempt to fix multiple tests simultaneously.

1. **Fix remaining transcription-related tests** (Categories 3, 8, 11, 12, 13)
   - Likely same root cause as fixed test
   - Verify transcription connections work correctly
   - **Fix one test at a time**, verify it passes, then move to the next

2. **Investigate agent-specific failures** (Categories 1, 2, 4, 5, 6, 7, 9, 10, 14)
   - May have different root causes
   - Check SettingsApplied timing, connection state, etc.
   - **Fix one test at a time**, verify it passes, then move to the next

3. **Systematic testing approach**
   - Fix one test at a time
   - Verify fix with test execution (avoid `head`/`tail` in commands)
   - Document findings
   - Do not serve Playwright HTML output

4. **TODO: Clean up proxy server logging** (after all tests pass)
   - Once all 22 tests are passing, revert proxy server stdout/stderr to `'ignore'` in `test-app/tests/playwright.config.mjs`
   - Currently set to `'pipe'` for debugging Issue #329 (see lines 107-108)
   - This will reduce test output noise once debugging is complete

5. **TODO: Remove debug instrumentation** (after all tests pass)
   - Remove all debug instrumentation logs added during Issue #329 debugging
   - Files with instrumentation:
     - `src/components/DeepgramVoiceInteraction/index.tsx` - Settings/UtteranceEnd tracking
     - `src/utils/websocket/WebSocketManager.ts` - Settings message tracking
     - `test-app/src/App.tsx` - UtteranceEnd callback tracking
   - Look for `// #region debug log` and `// #endregion` markers
   - Remove fetch calls to `http://127.0.0.1:7244/ingest/...` debug endpoint

## 📚 Related Issues

- Issue #311: Agent options re-send
- Issue #242: Backend proxy mode
- Issue #305: Declarative props API
- Issue #262/#430: Idle timeout behavior

## 🔍 Debugging Resources

- **Unit Tests**: `test-app/tests/mock-proxy-server.test.js` (14 tests)
- **Proxy Server**: `test-app/scripts/mock-proxy-server.js`
- **Debug Logs**: `.cursor/debug.log` (when instrumentation active)

## 📅 Timeline

- **2025-01-29**: Issue identified - 22 tests failing in proxy mode
- **2025-01-29**: Root cause identified - proxy server doesn't support transcription
- **2025-01-29**: Fix #1 applied - proxy server transcription support
- **2025-01-29**: Fix #2 applied - KeepAlive message ordering
- **2025-01-29**: Fix #3 applied - Message queuing for Deepgram messages
- **2025-01-29**: Fix #4 applied - WebSocket timing issue for Settings messages
- **2025-01-29**: Proxy server logging enabled (stdout/stderr set to 'pipe') for debugging
- **2025-01-29**: 5 tests fixed, 3 in progress (transcription timeout affects multiple tests), 19 remaining
- **TODO**: Revert proxy server logging to 'ignore' once all tests pass

## ✅ Success Criteria

All 22 tests must pass when run with `USE_PROXY_MODE=true`:
- [x] callback-test.spec.js:48 - onTranscriptUpdate callback
- [x] agent-options-resend-issue311.spec.js:50 - Settings re-send
- [x] backend-proxy-mode.spec.js:61 - Agent responses through proxy
- [x] callback-test.spec.js:87 - onUserStartedSpeaking
- [x] callback-test.spec.js:128 - onUserStoppedSpeaking
- [ ] declarative-props-api.spec.js:278
- [ ] extended-silence-idle-timeout.spec.js:11
- [ ] function-calling-e2e.spec.js:65
- [ ] function-calling-e2e.spec.js:501
- [ ] idle-timeout-behavior.spec.js:887
- [ ] interim-transcript-validation.spec.js:32
- [ ] strict-mode-behavior.spec.js:93
- [ ] user-stopped-speaking-demonstration.spec.js:20
- [ ] user-stopped-speaking-demonstration.spec.js:174
- [ ] vad-audio-patterns.spec.js:26
- [ ] vad-audio-patterns.spec.js:55
- [ ] vad-audio-patterns.spec.js:120
- [ ] vad-configuration-optimization.spec.js:23
- [ ] vad-configuration-optimization.spec.js:134
- [ ] vad-configuration-optimization.spec.js:225
- [ ] vad-events-core.spec.js:27
- [ ] vad-redundancy-and-agent-timeout.spec.js:380

