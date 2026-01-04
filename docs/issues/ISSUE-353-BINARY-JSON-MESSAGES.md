# Issue #353: Component Should Handle Binary JSON Messages

**GitHub Issue**: https://github.com/Signal-Meaning/dg_react_agent/issues/353  
**Status**: 🔴 **IN PROGRESS** - TDD Phase  
**Reported By**: Voice-commerce team  
**Priority**: **High**  
**Branch**: `davidrmcgee/issue353`  
**Related Issue**: #351

## Problem Statement

Deepgram sends `FunctionCallRequest` messages as **binary WebSocket messages** (not text), but the `DeepgramVoiceInteraction` component expects JSON messages to be **text WebSocket messages**. When the component receives a binary message containing JSON, it treats it as audio data instead of parsing it as a FunctionCallRequest.

## Root Cause

**Evidence**:
1. Backend proxy receives FunctionCallRequest from Deepgram as binary
2. Backend can parse it as JSON (proving it contains valid JSON)
3. Component receives it as `Blob` binary data
4. Component routes it to `handleAgentAudio` instead of `handleAgentMessage`
5. FunctionCallRequest handler never receives the message
6. `onFunctionCallRequest` callback is never invoked

**Browser Console Logs**:
```
📝 Browser console log: [WebSocketManager:agent] Received message data type: object, is ArrayBuffer: false, is Blob: true
📝 Browser console log: 🎵 [AUDIO EVENT] handleAgentAudio received buffer bytes= 182
```

**Backend Logs** (showing it's valid JSON):
```
📨 Deepgram → Client: FunctionCallRequest {
  type: 'FunctionCallRequest',
  functions: [...]
}
```

## Code Location

**WebSocketManager.ts** (lines 335-354):
- When a `Blob` is received, it's converted to `ArrayBuffer` and emitted as `'binary'` event
- No check is made to see if the binary data contains JSON

**DeepgramVoiceInteraction/index.tsx** (line 835-836):
- All `'binary'` events are routed to `handleAgentAudio`
- No check is made to see if binary data contains JSON before routing

## Expected Behavior

The component should:
1. Detect when a binary message contains valid JSON
2. Parse the JSON and route it to `handleAgentMessage` instead of `handleAgentMessage`
3. Process FunctionCallRequest messages correctly regardless of whether they arrive as text or binary

## Current Behavior

The component:
1. Receives binary message as `Blob`
2. Routes all binary messages to `handleAgentAudio` (see `src/components/DeepgramVoiceInteraction/index.tsx:835-836`)
3. Never parses binary messages as JSON
4. FunctionCallRequest handler never receives the message

## Workaround (Not Recommended)

We initially implemented a workaround in our proxy to convert binary JSON messages to text before relaying:

```javascript
// Workaround: Convert binary JSON to text
if (parsed.type) {
  messageToSend = messageStr; // Convert to string
}
```

**Why this is not ideal**:
- Every proxy implementation would need this workaround
- The component should handle Deepgram's message format correctly
- This creates inconsistency between direct and proxy modes

## Implementation Plan

### Phase 1: TDD - Write Failing Test ✅ COMPLETED
- [x] Create E2E test that simulates binary JSON FunctionCallRequest
- [x] Test should verify that binary JSON messages are parsed and routed correctly
- [x] Test should fail initially (RED)
- [x] Test file: `test-app/tests/e2e/issue-353-binary-json-messages.spec.js`
- [x] Comprehensive unit tests created: `tests/websocket-binary-json.test.ts`
  - FunctionCallRequest binary JSON handling (Blob and ArrayBuffer)
  - Other agent message types (SettingsApplied, ConversationText, Error)
  - Non-JSON binary data handling
  - Non-agent JSON in binary data
  - Backward compatibility (text JSON messages)
  - Edge cases (empty binary, large messages, invalid UTF-8)

### Phase 2: Implementation ✅ COMPLETED
- [x] Update `WebSocketManager.ts` to detect JSON in binary messages
- [x] Added `handleBinaryData()` helper method to check for JSON in binary data
- [x] Parse binary JSON and route to `handleAgentMessage` if it's an agent message
- [x] Only route to `handleAgentAudio` if binary data is not valid JSON or not an agent message
- [x] Implementation supports both ArrayBuffer and Blob binary data
- [x] Handles all agent message types (FunctionCallRequest, SettingsApplied, ConversationText, Error, etc.)
- [x] Maintains backward compatibility with text JSON messages

### Phase 3: Refactor
- [ ] Clean up code while keeping tests passing
- [ ] Add unit tests for binary JSON detection logic
- [ ] Ensure backward compatibility with text JSON messages

### Phase 4: Verification
- [ ] Test with real Deepgram API (if available)
- [ ] Verify with voice-commerce team
- [ ] Add regression test

## Test Case

**Setup**:
- Component: `DeepgramVoiceInteraction` with `onFunctionCallRequest` callback
- Connection: Proxy mode via `proxyEndpoint`
- Debug: `debug={true}` enabled

**Steps**:
1. Connect to Deepgram via proxy
2. Send user message that triggers function call
3. Deepgram responds with FunctionCallRequest as binary message

**Expected**:
- Component detects binary message contains JSON
- Component parses FunctionCallRequest
- Component invokes `onFunctionCallRequest` callback

**Actual** (Before Fix):
- Component treats binary message as audio
- FunctionCallRequest handler never receives message
- Callback never invoked

## Implementation Details

### Suggested Approach

In `WebSocketManager.ts`, when receiving a `Blob` or `ArrayBuffer`:
1. Try to decode it as UTF-8 text
2. Try to parse it as JSON
3. If it's valid JSON with a `type` field indicating an agent message (e.g., `FunctionCallRequest`), emit as `'message'` event instead of `'binary'` event
4. Only emit as `'binary'` if it's not valid JSON or not an agent message

### Code Changes Needed

1. **WebSocketManager.ts**:
   - Add helper function to detect and parse JSON in binary data
   - Modify `onmessage` handler to check binary messages for JSON before routing

2. **Tests**:
   - E2E test for binary JSON FunctionCallRequest handling
   - Unit tests for binary JSON detection logic

## Related Files

- `src/utils/websocket/WebSocketManager.ts` - WebSocket message handling (lines 284-359)
- `src/components/DeepgramVoiceInteraction/index.tsx` - Component binary event routing (lines 835-836)
- `src/components/DeepgramVoiceInteraction/index.tsx` - `handleAgentMessage` function (lines 1923-2297)
- `src/components/DeepgramVoiceInteraction/index.tsx` - `handleAgentAudio` function (lines 2414-2474)

## References

- Related Issue: #351 - FunctionCallRequest callback not being invoked (root cause identified as this issue)
- [v0.7.6 Release Notes](../releases/v0.7.6/RELEASE-NOTES.md)
- [Diagnostic Logs Document](./ISSUE-351-FUNCTION-CALL-REQUEST-CALLBACK.md)

## Related Documents

- [Test Strategy](./ISSUE-353/TEST-STRATEGY.md) - Decision document on test approach (polyfill vs Playwright)
- [Test Implementation Plan](./ISSUE-353/TEST-IMPLEMENTATION-PLAN.md) - Step-by-step implementation plan for test refactoring

## Test Coverage

### Unit Tests (`tests/websocket-binary-json.test.ts`)

**Comprehensive test suite covering:**

1. **FunctionCallRequest binary JSON handling**
   - Binary Blob containing FunctionCallRequest → routes as 'message' event
   - Binary ArrayBuffer containing FunctionCallRequest → routes as 'message' event

2. **Other agent message types in binary JSON**
   - SettingsApplied (binary Blob)
   - ConversationText (binary ArrayBuffer)
   - Error messages (binary Blob)

3. **Non-JSON binary data handling**
   - Binary audio data → routes as 'binary' event
   - Invalid UTF-8 data → routes as 'binary' event

4. **Non-agent JSON in binary data**
   - JSON without 'type' field → routes as 'binary' event
   - Malformed JSON → routes as 'binary' event

5. **Backward compatibility**
   - Text JSON messages continue to work correctly

6. **Edge cases**
   - Empty binary data
   - Very large binary JSON messages (100+ functions)

**Test Status**: 
- Implementation complete ✅
- All 11 ArrayBuffer tests passing in Jest ✅
- Blob tests moved to Playwright E2E (real browser APIs) ✅
- Core functionality verified ✅

### E2E Tests (`test-app/tests/e2e/issue-353-binary-json-messages.spec.js`)

- E2E test that simulates binary JSON FunctionCallRequest in proxy mode
- Requires proxy server and real API keys
- Tests full integration flow
- **Status**: ✅ **PASSING** - Test verified with real API
- **Test Results**: 
  - Binary JSON FunctionCallRequest correctly detected and parsed
  - Callback invoked successfully
  - Test passed in 2.5s
- **To run**: 
  1. Set `VITE_DEEPGRAM_API_KEY` in `test-app/.env`
  2. Run from `test-app` directory: `USE_PROXY_MODE=true npm run test:e2e -- issue-353-binary-json-messages`
  3. Proxy server starts automatically via Playwright webServer config

## Next Steps

1. ✅ GitHub issue created (#353)
2. ✅ Branch created (`davidrmcgee/issue353`)
3. ✅ Tracking document created
4. ✅ **COMPLETED**: Create failing E2E test (TDD)
5. ✅ **COMPLETED**: Implement fix to make test pass (GREEN phase)
6. ✅ **COMPLETED**: Add comprehensive unit tests for binary JSON detection logic
7. ✅ **COMPLETED**: Refactor tests - hybrid approach (ArrayBuffer in Jest, Blob in Playwright)
8. ✅ **COMPLETED**: All Jest ArrayBuffer tests passing (11/11)
9. ✅ **COMPLETED**: E2E test ready (requires real API keys and proxy server to run)
10. ✅ **COMPLETED**: E2E test PASSED - Binary JSON FunctionCallRequest handled correctly!
11. ⏳ Refactor code while keeping tests passing
12. ⏳ Verify with voice-commerce team
13. ⏳ Add regression test

