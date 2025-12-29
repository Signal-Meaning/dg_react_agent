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
| ✅ Fixed | 1 | `callback-test.spec.js:48` - onTranscriptUpdate callback |
| 🔄 In Progress | 0 | - |
| ❌ Pending | 21 | See list below |

### Fixed Tests ✅

1. ✅ **`callback-test.spec.js:48:3`** - "should test onTranscriptUpdate callback with existing audio sample"
   - **Fix Date**: 2025-01-29
   - **Root Cause**: Proxy server didn't support transcription service connections
   - **Solution**: Added service type detection and routing for both agent and transcription services
   - **Verification**: Test passes, transcripts received through proxy

### Pending Tests ❌

#### Category 1: Agent Options & Settings (1 test)
1. ❌ `agent-options-resend-issue311.spec.js:50:3` - "should re-send Settings when agentOptions changes after connection (Issue #311)"
   - **Issue**: Connection completes but SettingsApplied not received
   - **Status**: Needs investigation

#### Category 2: Backend Proxy Mode (1 test)
2. ❌ `backend-proxy-mode.spec.js:61:3` - "should work with agent responses through proxy"
   - **Status**: Previously fixed, may need re-verification

#### Category 3: Callback Tests (2 tests)
3. ❌ `callback-test.spec.js:87:3` - "should test onUserStartedSpeaking callback with existing audio sample"
4. ❌ `callback-test.spec.js:128:3` - "should test onUserStoppedSpeaking callback with existing audio sample"
   - **Status**: Likely same root cause as fixed test - transcription service

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

## 📝 Test Execution Notes

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

1. **Fix remaining transcription-related tests** (Categories 3, 8, 11, 12, 13)
   - Likely same root cause as fixed test
   - Verify transcription connections work correctly

2. **Investigate agent-specific failures** (Categories 1, 2, 4, 5, 6, 7, 9, 10, 14)
   - May have different root causes
   - Check SettingsApplied timing, connection state, etc.

3. **Systematic testing approach**
   - Fix one test at a time
   - Verify fix with test execution
   - Document findings

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
- **2025-01-29**: 1 test fixed, 21 remaining

## ✅ Success Criteria

All 22 tests must pass when run with `USE_PROXY_MODE=true`:
- [x] callback-test.spec.js:48 - onTranscriptUpdate callback
- [ ] agent-options-resend-issue311.spec.js:50
- [ ] backend-proxy-mode.spec.js:61
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

