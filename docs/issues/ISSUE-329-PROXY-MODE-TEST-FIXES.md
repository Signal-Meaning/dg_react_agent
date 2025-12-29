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
| ✅ Fixed | 4 | `callback-test.spec.js:48` - onTranscriptUpdate callback<br>`agent-options-resend-issue311.spec.js:50` - Settings re-send<br>`backend-proxy-mode.spec.js:61` - Agent responses through proxy<br>`callback-test.spec.js:87` - onUserStartedSpeaking callback |
| 🔄 In Progress | 1 | `callback-test.spec.js:128` - onUserStoppedSpeaking callback (transcription timeout issue) |
| ❌ Pending | 17 | See list below |

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
4. ❌ `callback-test.spec.js:128:3` - "should test onUserStoppedSpeaking callback with existing audio sample"
   - **Status**: In Progress - Transcription connection times out (error 1011) before UtteranceEnd can be processed
   - **Root Cause**: Transcription service requires audio within timeout window, but test waits for agent SettingsApplied before sending audio
   - **Fix Attempted**: Added keepalive audio sent immediately after transcription connection
   - **Next Steps**: May need to send real audio to transcription service immediately after connection, not wait for agent SettingsApplied

#### Category 4: Declarative Props API (1 test)
5. ❌ `declarative-props-api.spec.js:278:5` - "should handle function call response via callback return value"
   - **Status**: Needs investigation

#### Category 5: Extended Silence Idle Timeout (1 test)
6. ❌ `extended-silence-idle-timeout.spec.js:11:3` - "should demonstrate connection closure with >10 seconds of silence"
   - **Status**: Needs investigation

#### Category 6: Function Calling (2 tests)
7. ❌ `function-calling-e2e.spec.js:65:3` - "should trigger client-side function call and execute it"
8. ❌ `function-calling-e2e.spec.js:501:3` - "should test minimal function definition for SettingsApplied issue"
   - **Status**: Needs investigation

#### Category 7: Idle Timeout Behavior (1 test)
9. ❌ `idle-timeout-behavior.spec.js:887:3` - "should restart timeout after USER_STOPPED_SPEAKING when agent is idle - reproduces Issue #262/#430"
   - **Status**: Needs investigation

#### Category 8: Interim Transcript Validation (1 test)
10. ❌ `interim-transcript-validation.spec.js:32:3` - "should receive both interim and final transcripts with fake audio"
   - **Status**: Likely transcription service issue

#### Category 9: StrictMode Behavior (1 test)
11. ❌ `strict-mode-behavior.spec.js:93:3` - "should detect StrictMode cleanup in console logs"
   - **Status**: Needs investigation

#### Category 10: User Stopped Speaking (2 tests)
12. ❌ `user-stopped-speaking-demonstration.spec.js:20:3` - "should demonstrate onUserStoppedSpeaking with real microphone and pre-recorded audio"
13. ❌ `user-stopped-speaking-demonstration.spec.js:174:3` - "should demonstrate onUserStoppedSpeaking with multiple audio samples"
   - **Status**: Needs investigation

#### Category 11: VAD Audio Patterns (3 tests)
14. ❌ `vad-audio-patterns.spec.js:26:3` - "should detect VAD events with pre-generated audio samples"
15. ❌ `vad-audio-patterns.spec.js:55:3` - "should detect VAD events with realistic audio patterns"
16. ❌ `vad-audio-patterns.spec.js:120:3` - "should handle multiple audio samples in sequence"
   - **Status**: Likely transcription service issue

#### Category 12: VAD Configuration Optimization (3 tests)
17. ❌ `vad-configuration-optimization.spec.js:23:3` - "should test different utterance_end_ms values for offset detection"
18. ❌ `vad-configuration-optimization.spec.js:134:3` - "should test different VAD event combinations"
19. ❌ `vad-configuration-optimization.spec.js:225:3` - "should test VAD event timing and sequencing"
   - **Status**: Likely transcription service issue

#### Category 13: VAD Events Core (1 test)
20. ❌ `vad-events-core.spec.js:27:3` - "should detect basic VAD events (UserStartedSpeaking, UtteranceEnd)"
   - **Status**: Likely transcription service issue

#### Category 14: VAD Redundancy (1 test)
21. ❌ `vad-redundancy-and-agent-timeout.spec.js:380:3` - "should maintain consistent idle timeout state machine"
   - **Status**: Needs investigation

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

### ⚠️ Important Testing Guidelines

**One Test at a Time**: Each test must be resolved (made to pass) individually before moving to the next one. This ensures proper isolation and prevents regression.

**Command Execution**: Until tests pass, avoid using `head` and `tail` options in shell commands. These can truncate important output needed for debugging.

**Playwright HTML Output**: Do not serve the Playwright HTML output. Use the console output and test results directly for debugging.

### Running Tests in Proxy Mode

```bash
# Start proxy server (now automatic via Playwright config)
cd test-app
USE_PROXY_MODE=true npm run test:e2e

# Run specific test
USE_PROXY_MODE=true npm run test:e2e -- tests/e2e/callback-test.spec.js --grep "test name"
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
- **2025-01-29**: 3 tests fixed, 19 remaining
- **TODO**: Revert proxy server logging to 'ignore' once all tests pass

## ✅ Success Criteria

All 22 tests must pass when run with `USE_PROXY_MODE=true`:
- [x] callback-test.spec.js:48 - onTranscriptUpdate callback
- [x] agent-options-resend-issue311.spec.js:50 - Settings re-send
- [x] backend-proxy-mode.spec.js:61 - Agent responses through proxy
- [ ] callback-test.spec.js:87 - onUserStartedSpeaking
- [ ] callback-test.spec.js:128 - onUserStoppedSpeaking
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

