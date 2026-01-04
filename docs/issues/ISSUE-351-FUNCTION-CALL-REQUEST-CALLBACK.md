# Issue #351: FunctionCallRequest Callback Not Being Invoked

**GitHub Issue**: https://github.com/Signal-Meaning/dg_react_agent/issues/351  
**Status**: 🔴 **IN PROGRESS** - Investigation Phase  
**Reported By**: Voice-commerce team  
**Priority**: **High**  
**Branch**: `davidrmcgee/issue351`

## Problem Statement

The `onFunctionCallRequest` callback is not being invoked when FunctionCallRequest messages are received from Deepgram, even though the messages are successfully received and relayed through the backend proxy.

## Symptoms

1. **FunctionCallRequest received**: Backend logs show FunctionCallRequest is received from Deepgram and relayed to client:
   ```
   [WebServer] 📨 [1767490012298-nv6lv7phv] Deepgram → Client: FunctionCallRequest {
     type: 'FunctionCallRequest',
     length: 182,
     preview: '{"type":"FunctionCallRequest","functions":[{"id":"call_g9XnYEa9T4PgiXB1Aulyw6Ub","name":"search_products","arguments":"{\\"query\\":\\"limited edition sneakers\\"}","client_side":true}]}'
   }
   ```

2. **Callback not invoked**: No logs from application handler:
   - Expected: `🔧 [App.tsx] Function call request received:`
   - Expected: `🔧 [App.tsx] Calling handleFunctionCallRequest...`
   - Expected: `[FunctionCall] ✅ handleFunctionCallRequest CALLED:`
   - **Actual**: None of these logs appear

3. **Connection closes**: Connection closes with code 1005 shortly after FunctionCallRequest (~11 seconds after connection):
   ```
   [WebServer] 🔌 [1767490012298-nv6lv7phv] Deepgram proxy: Deepgram connection closed {
     code: 1005,
     reason: '',
     timeSinceClientConnect: '11489ms',
   }
   ```

4. **Test fails**: Function call tracker shows `count: 0` (window: 0, DOM: 0)

## Root Cause Analysis

The `DeepgramVoiceInteraction` component may not be processing FunctionCallRequest messages correctly in proxy mode, or the callback may not be properly wired up.

### Possible Causes

1. **Component bug**: The component may not be processing FunctionCallRequest messages correctly in proxy mode
2. **Connection state**: The component may require the connection to be in a specific state before processing FunctionCallRequest
3. **Message format**: The FunctionCallRequest message format may not match what the component expects
4. **Timing issue**: The connection may be closing before the component can process the message
5. **Callback prop not passed**: The `onFunctionCallRequest` prop may not be properly passed to the component
6. **Agent manager not configured**: The `agentManagerRef.current` may be null when the message arrives

## Enhanced Logging Added

Enhanced logging has been added to help diagnose this issue. When `debug={true}` is enabled on the component, the following logs will appear:

### Message Detection Logs
- `🔧 [FUNCTION] FunctionCallRequest detected in handleAgentMessage` - Confirms message reaches the handler
- `🔧 [FUNCTION] FunctionCallRequest received from Deepgram` - Shows full message structure

### Function Processing Logs
- `🔧 [FUNCTION] Functions array length: X` - Shows how many functions are in the request
- `🔧 [FUNCTION] Processing function call:` - Shows details of each function call
  - `id`, `name`, `client_side`, `hasArguments`

### Callback Availability Logs
- `🔧 [FUNCTION] onFunctionCallRequest callback available: true/false` - Shows if callback prop is available

### Callback Invocation Logs
- `🔧 [FUNCTION] About to invoke onFunctionCallRequest callback:` - Shows callback is about to be called
  - `id`, `name`, `hasCallback`
- `🔧 [FUNCTION] Invoking onFunctionCallRequest callback now...` - Shows callback is being invoked
- `🔧 [FUNCTION] onFunctionCallRequest callback completed:` - Shows callback finished
  - `returnedValue`, `resultType`

### Error Logs
- `🔧 [AGENT] ⚠️ Received unexpected agent message but service is not configured` - Agent manager is null
- `🔧 [AGENT] ⚠️ Invalid agent message format` - Message format issue
- `🔧 [FUNCTION] ⚠️ onFunctionCallRequest callback is not defined` - Callback prop missing
- `🔧 [FUNCTION] ❌ Error invoking onFunctionCallRequest callback` - Callback execution error

## Code Changes Made

### File: `src/components/DeepgramVoiceInteraction/index.tsx`

1. **Enhanced logging in `handleAgentMessage`** (lines ~1930-1959):
   - Added FunctionCallRequest detection logging
   - Added enhanced error logging for early returns
   - Uses `configRef.current.debug` to respect debug prop

2. **Enhanced logging in FunctionCallRequest handler** (lines ~2118-2297):
   - Added comprehensive logging throughout the function call processing flow
   - Added callback availability check with warning
   - Added try-catch around callback invocation with error logging
   - All logging respects `configRef.current.debug` flag

## Verification Steps

1. **Enable debug mode**: Set `debug={true}` on the component
   ```tsx
   <DeepgramVoiceInteraction
     debug={true}
     onFunctionCallRequest={handleFunctionCallRequest}
     // ... other props
   />
   ```

2. **Check component logs**: Look for the enhanced logging messages listed above

3. **Verify callback prop**: Ensure `onFunctionCallRequest` is passed to the component

4. **Check WebSocket messages**: Verify the component is receiving the FunctionCallRequest message via WebSocket

5. **Check agent manager**: Verify `agentManagerRef.current` is not null when message arrives

## Diagnostic Workflow

### Step 1: Verify Message Reception
- Look for: `🔧 [FUNCTION] FunctionCallRequest detected in handleAgentMessage`
- If missing: Message is not reaching `handleAgentMessage`

### Step 2: Verify Agent Manager
- Look for: `🔧 [AGENT] ⚠️ Received unexpected agent message but service is not configured`
- If present: `agentManagerRef.current` is null

### Step 3: Verify Message Format
- Look for: `🔧 [AGENT] ⚠️ Invalid agent message format`
- If present: Message format doesn't match expected structure

### Step 4: Verify Callback Prop
- Look for: `🔧 [FUNCTION] onFunctionCallRequest callback available: false`
- If false: Callback prop is not being passed to component

### Step 5: Verify Callback Invocation
- Look for: `🔧 [FUNCTION] Invoking onFunctionCallRequest callback now...`
- If missing: Callback is not being invoked (check previous steps)

## Related Files

- `src/components/DeepgramVoiceInteraction/index.tsx` - Component implementation
  - `handleAgentMessage` function (lines ~1923-2297)
  - FunctionCallRequest handler (lines ~2118-2297)
- `src/utils/websocket/WebSocketManager.ts` - WebSocket message handling
  - FunctionCallRequest detection (lines ~295-298)
- `src/utils/function-call-logger.ts` - Function call logging utility
- `test-app/src/App.tsx` - Test app handler setup
- `test-app/tests/e2e/function-calling-e2e.spec.js` - E2E tests

## Test Evidence

From voicecommerce team test run:
- FunctionCallRequest received: ✅
- Handler invoked: ❌
- Connection closed: ✅ (code 1005, ~11s after connection)
- Function call count: 0

## Next Steps

1. ✅ Enhanced logging added to component
2. ✅ GitHub issue created (#351)
3. ✅ Tracking document created
4. ✅ Code review completed - no obvious bugs found in message handling flow
5. ✅ Customer diagnostic instructions provided (GitHub issue comment)
6. ✅ Reproduction test created (`test-app/tests/e2e/issue-351-function-call-proxy-mode.spec.js`)
7. ✅ **REPRODUCTION TEST PASSED** - Cannot reproduce the issue in our test environment
8. ✅ **CUSTOMER PROVIDED LOGS** - Received diagnostic information
9. ✅ **Release Issue Created** - Issue #352 for v0.7.6 release with diagnostic logging
10. ⏳ **WAITING FOR CUSTOMER**: Provide **browser console logs** (not just backend logs)
11. ⏳ **WAITING FOR RELEASE**: v0.7.6 release with enhanced diagnostic logging
12. ⏳ Identify root cause from customer browser console logs
13. ⏳ **Implement fix** (after root cause identified)
14. ⏳ Add regression test
15. ⏳ Verify fix with voicecommerce team

## Customer Logs Analysis

**Date**: January 2, 2026  
**Component Version**: v0.7.5 (does NOT include enhanced diagnostic logging yet)

### Key Finding from Customer

**Scenario 1 (Critical)**: 
- ✅ FunctionCallRequest **WAS received** from Deepgram (verified in backend logs)
- ❌ `onFunctionCallRequest` callback **NOT invoked** by component
- ❌ Connection closes with code 1005 shortly after (~11 seconds)

**Scenario 2**:
- ❌ No FunctionCallRequest received (connection closes due to idle timeout)
- ❌ Connection closes before Deepgram responds

### Missing Information

**Critical**: Customer provided **backend/server logs** but NOT **browser console logs**

We need the browser console logs to see our diagnostic messages:
- `🔧 [FUNCTION] FunctionCallRequest detected in handleAgentMessage`
- `🔧 [FUNCTION] onFunctionCallRequest callback available: true/false`
- `🔧 [FUNCTION] About to invoke onFunctionCallRequest callback`
- etc.

**Note**: v0.7.5 does NOT include our enhanced diagnostic logging. Customer needs to:
- Wait for v0.7.6 release (with diagnostic logging), OR
- Build from `davidrmcgee/issue351` branch

### Potential Issues Identified

1. **Connection Close Timing**: Code 1005 (No Status Received) suggests connection closes abruptly
   - Could be closing **while** processing FunctionCallRequest
   - Need to verify if message reaches `handleAgentMessage` before close

2. **Version Mismatch**: Customer is on v0.7.5, enhanced logging is in development branch
   - Need browser console logs to diagnose
   - May need to upgrade to v0.7.6 or build from branch

3. **Proxy Implementation Difference**: Customer's proxy may handle messages differently
   - Our mock proxy works correctly
   - Their proxy may have timing or message handling differences

## Release Plan

**v0.7.6** (Next release):
- ✅ Enhanced diagnostic logging
- ❌ **NOT** a fix - diagnostic tools only

**v0.7.7 or v0.8.0** (After root cause identified):
- ✅ Actual bug fix
- ✅ Regression test

## Customer Instructions

**Status**: ✅ Instructions provided in GitHub issue #351

**What we told the customer**:
1. **v0.7.6 will contain diagnostic logging only** - NOT a fix for the bug
2. Upgrade to v0.7.6 (or build from branch) to get diagnostic logging
3. Enable `debug={true}` on component
4. Reproduce the issue and capture all console logs
5. Report back with:
   - Component version
   - All console logs (especially `🔧 [FUNCTION]` and `🔧 [AGENT]` logs)
   - Which diagnostic messages appear
   - Any error messages

**Important**: We have NOT fixed the bug yet. We're providing diagnostic tools first, then we'll fix the issue once we understand the root cause from the logs.

**Diagnostic messages to look for**:
- `🔧 [FUNCTION] FunctionCallRequest detected in handleAgentMessage`
- `🔧 [FUNCTION] FunctionCallRequest received from Deepgram`
- `🔧 [FUNCTION] Functions array length: X`
- `🔧 [FUNCTION] onFunctionCallRequest callback available: true/false`
- `🔧 [FUNCTION] About to invoke onFunctionCallRequest callback`
- `🔧 [FUNCTION] Invoking onFunctionCallRequest callback now...`
- `🔧 [FUNCTION] onFunctionCallRequest callback completed`
- `🔧 [AGENT] ⚠️ Received unexpected agent message but service is not configured`
- `🔧 [AGENT] ⚠️ Invalid agent message format`
- `🔧 [FUNCTION] ⚠️ onFunctionCallRequest callback is not defined`

**What the logs will tell us**:
- If no `FunctionCallRequest detected` log → Message isn't reaching the component handler
- If `agent service is not configured` → Agent manager isn't initialized
- If `Invalid agent message format` → Message format issue
- If `callback available: false` → Callback prop not being passed
- If `About to invoke` but no `Invoking` → Callback check failed
- If `Invoking` but no `completed` → Callback threw an error

## Reproduction Test Results

**Status**: ✅ **TEST PASSED** - Cannot reproduce the issue

**Test File**: `test-app/tests/e2e/issue-351-function-call-proxy-mode.spec.js`

**Test Results** (2026-01-03):
- ✅ Connection established in proxy mode
- ✅ Settings applied successfully
- ✅ FunctionCallRequest received from Deepgram
- ✅ `onFunctionCallRequest` callback **WAS INVOKED** successfully
- ✅ Function call tracker incremented (count: 1)
- ✅ All diagnostic logs show correct flow

**Key Logs from Test**:
```
🔧 [FUNCTION] FunctionCallRequest detected in handleAgentMessage
🔧 [FUNCTION] onFunctionCallRequest callback available: true
🔧 [FUNCTION] About to invoke onFunctionCallRequest callback
🔧 [FUNCTION] Invoking onFunctionCallRequest callback now...
🔧 [FUNCTION] onFunctionCallRequest callback completed
✅ Function call callback was invoked successfully!
```

**Conclusion**: 
- The callback **works correctly** in our test environment with mock proxy server
- We **cannot reproduce** the customer's issue
- This suggests the issue may be:
  - Specific to customer's proxy implementation
  - A timing/race condition that doesn't occur in our tests
  - A configuration issue on customer's end
  - A version mismatch or environment-specific issue

**Next Steps**:
- Customer must test with `debug={true}` and provide diagnostic logs
- Compare customer's logs with our working test logs to identify differences

## Investigation Notes

### Code Review Findings

**Message Flow Analysis**:
1. WebSocketManager receives message → parses JSON → emits `{ type: 'message', data }`
2. Component event listener (line 833) receives event → calls `handleAgentMessage(event.data)`
3. `handleAgentMessage` checks:
   - `agentManagerRef.current` is not null (line 1939)
   - `isAgentMessage(data)` passes (line 1945)
4. FunctionCallRequest handler (line 2134) processes message:
   - Checks `functions.length > 0` (line 2164)
   - Loops through functions (line 2178)
   - Checks `funcCall.client_side === true` (line 2195)
   - Invokes callback if available (line 2245)

**No Obvious Bugs Found**:
- Message flow appears correct
- All early return conditions have logging
- Callback invocation logic looks correct
- Enhanced logging covers all critical points

**Potential Issues to Investigate**:
1. **Timing/Race Condition**: Connection might be closing before message is processed
   - Connection closes ~11 seconds after connection
   - FunctionCallRequest arrives shortly before close
   - Possible: Component unmounting or connection closing interrupts processing
   
2. **Message Format**: Proxy might be sending message in slightly different format
   - Backend logs show correct structure
   - But WebSocket parsing might fail silently
   - Enhanced logging will show if message reaches handler

3. **Component State**: Component might be in a state that prevents processing
   - Agent manager might be null (we log this)
   - Component might be unmounting
   - Connection state might be invalid

4. **Prop Passing**: Callback prop might not be reaching component
   - Enhanced logging shows `onFunctionCallRequest callback available: true/false`
   - If false, prop is not being passed correctly

### Testing Strategy
1. Enable `debug={true}` on component
2. Capture all console logs during FunctionCallRequest reception
3. Compare logs with expected diagnostic messages
4. Identify which step in the flow is failing:
   - If no "FunctionCallRequest detected" log → message not reaching handler
   - If "agent service is not configured" → agentManagerRef is null
   - If "Invalid agent message format" → message format issue
   - If "callback available: false" → prop not passed
   - If "About to invoke" but no "Invoking" → callback check failed
   - If "Invoking" but no "completed" → callback threw error
5. Fix the identified issue

### Known Working Cases
- E2E tests show function calling works in proxy mode (Issue #345)
- All 8 function calling tests pass in proxy mode
- This suggests the issue might be:
  - Specific to voicecommerce team's proxy implementation
  - A timing/race condition that doesn't occur in tests
  - A configuration issue
  - A version mismatch

## Related Issues

- Issue #336 - Function Calling Test Coverage (✅ Resolved in v0.7.2)
- Issue #305 - Declarative Props Support (✅ Resolved in v0.6.8)
- Issue #294 - Thinking State for Function Calls (✅ Resolved in v0.6.8)

