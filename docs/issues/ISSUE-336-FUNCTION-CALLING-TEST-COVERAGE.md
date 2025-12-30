# Issue #336: Function Calling - Test Coverage Gap and Execution Flow Issues

**GitHub Issue**: https://github.com/Signal-Meaning/dg_react_agent/issues/336  
**Status**: 🔄 **IN PROGRESS**  
**Reported By**: Voice-commerce team  
**Priority**: **High**

## ⚠️ CRITICAL: Testing Strategy

**IMPORTANT**: When working on this issue, **test with direct connection first** (using `apiKey` prop), **NOT proxy mode**.

- Proxy mode adds complexity and may mask underlying function calling issues
- Test direct connection mode until all tests pass
- Only after direct connection tests pass should proxy mode be tested
- This isolates function calling issues from proxy-specific issues

## Problem Statement

The voice-commerce team has identified a significant gap between our test coverage and actual function calling execution. Our tests verify that functions are correctly included in the Settings message, but they do not adequately test the full end-to-end execution flow.

**Key Finding**: Tests that verify Settings message structure pass, but tests that verify actual function call execution fail or timeout.

## Current Test Coverage Analysis

### ✅ What's Tested (Passing)

#### 1. Unit Tests - Settings Message Structure
**File**: `tests/function-calling-settings.test.tsx`

- ✅ Verifies functions are included in `agent.think.functions` in Settings message
- ✅ Verifies function structure matches Deepgram API spec
- ✅ Verifies `client_side` flag is filtered out from Settings message
- ✅ Tests various function configurations (client-side, server-side, multiple functions)

**Scope**: Only verifies Settings message structure - does NOT test execution

#### 2. E2E Test - Settings Message Verification
**File**: `test-app/tests/e2e/function-calling-e2e.spec.js`  
**Test**: `should verify functions are included in Settings message` (lines 414-658)

- ✅ Verifies Settings message structure via `window.__DEEPGRAM_LAST_SETTINGS__` (test mode)
- ✅ Falls back to WebSocket capture if window variables unavailable
- ✅ Verifies functions are in `agent.think.functions`
- ✅ Checks for Error messages from Deepgram

**Scope**: Only verifies Settings message structure - does NOT test execution

**Test Flow**:
1. Navigate to test app with function calling enabled
2. Establish connection
3. Capture Settings message from window or WebSocket
4. Verify functions are included
5. ❌ **Does NOT send user messages**
6. ❌ **Does NOT wait for function calls**
7. ❌ **Does NOT verify function execution**

### ❌ What's Missing (Failing/Incomplete)

#### 1. Full Execution Flow Tests
**File**: `test-app/tests/e2e/function-calling-e2e.spec.js`  
**Test**: `should trigger client-side function call and execute it` (lines 74-412)

**What It Attempts to Test**:
- Full end-to-end flow: Connection → Message → Function Call → Execution → Results
- Function call triggering via user message
- Function call handler invocation
- Function execution and response sending
- Agent continuation after function execution

**Current Status**: 
- ⚠️ Test exists but may timeout or fail
- ⚠️ Relies on agent deciding to call functions (non-deterministic)
- ⚠️ Requires stable connection throughout execution
- ⚠️ Uses `window.functionCallRequests` array tracking (fragile)

**Test Flow**:
1. ✅ Sets up functions and handlers
2. ✅ Establishes connection
3. ✅ Verifies functions in Settings message
4. ✅ Sends user message ("What time is it?")
5. ⚠️ **Waits for `window.functionCallRequests` to be populated** ← May timeout
6. ⚠️ **Verifies function call structure** ← May never reach
7. ⚠️ **Verifies function execution** ← May never reach
8. ⚠️ **Verifies agent response** ← May never reach

#### 2. Voice-Commerce Team's Failing Tests

**Location**: `frontend/tests/e2e/function-calling.e2e.test.js` (lines 58 & 225)

**What They Test**:
- Full end-to-end flow with product search functions
- Function call triggering via user messages
- Function execution and product results
- Products displayed in UI
- Agent response contains product info

**Why They Fail**:
- Function calls not being triggered (agent doesn't decide to call functions)
- Function call handler not being invoked
- Connection instability (code 1005/1006 errors)
- `functionCallCount` tracker never incremented

**Test Infrastructure**:
- Uses `data-testid="function-call-tracker"` in App.tsx
- Tracker updated in `functionCallHandler.ts` when `handleFunctionCallRequest()` is called
- Requires actual function calls to be triggered and executed

## Key Differences Summary

| Aspect | Current Tests (Passing) | Missing Tests (Failing) |
|--------|------------------------|-------------------------|
| **Scope** | Settings message structure only | Full end-to-end flow |
| **What it verifies** | Functions in Settings message | Function call execution + results |
| **Requires function calls?** | ❌ No | ✅ Yes |
| **Sends user messages?** | ❌ No | ✅ Yes |
| **Waits for execution?** | ❌ No | ✅ Yes |
| **Checks results in UI?** | ❌ No | ✅ Yes |
| **Uses test mode?** | ✅ Yes (`__DEEPGRAM_TEST_MODE__`) | ❌ No (real flow) |
| **WebSocket interception** | ✅ For verification | ❌ Not used |
| **Connection stability** | ⚠️ Not critical | ✅ Critical |
| **Why it passes** | Only checks message structure | Requires full execution flow |

## Evidence

### 1. Settings Message is Correct ✅
- Unit tests confirm functions are included in Settings message structure
- E2E test confirms functions are in `agent.think.functions`
- Component correctly forwards functions to Settings message

### 2. Function Calls Not Happening ❌
- E2E tests that wait for function call execution timeout
- `window.functionCallRequests` array never populated
- `functionCallCount` tracker never incremented
- Agent doesn't decide to call functions based on user messages

### 3. Connection Issues ⚠️
- Code 1005/1006 errors suggest connection instability
- Connection may not stay open long enough for function calls to complete
- Settings message is sent correctly (tests confirm this)

### 4. Handler Not Invoked ❌
- `onFunctionCallRequest` callback may not be called
- `handleFunctionCallRequest()` may not be invoked
- Function call handlers may not be set up correctly

## Root Cause Analysis Needed

### 1. Function Call Triggering

**Questions to Investigate**:
- Are `FunctionCallRequest` messages being received from Deepgram?
- Is the agent deciding to call functions based on user messages?
- Are function descriptions/prompts sufficient to trigger calls?
- Is the agent's LLM provider configured correctly for function calling?

**Investigation Steps**:
- Add logging to see if `FunctionCallRequest` messages are received
- Verify function descriptions are clear and trigger-worthy
- Check if agent's prompt includes function calling instructions
- Verify LLM provider supports function calling

### 2. Function Call Handler

**Questions to Investigate**:
- Is `onFunctionCallRequest` callback being invoked?
- Is `handleFunctionCallRequest()` being called?
- Are function call trackers being updated?
- Is the handler set up correctly in the test app?

**Investigation Steps**:
- Add logging to `onFunctionCallRequest` callback
- Verify handler is registered before connection
- Check if handler is called when `FunctionCallRequest` is received
- Verify handler execution flow

### 3. Connection Stability

**Questions to Investigate**:
- Why are code 1005/1006 errors occurring?
- Is connection staying open long enough for function calls to complete?
- Are Settings messages being sent correctly (tests confirm this works)?
- Is there a timing issue with connection and function call flow?

**Investigation Steps**:
- Monitor WebSocket connection state during function call flow
- Check for connection errors in WebSocket capture
- Verify connection stays open throughout execution
- Check for timing issues between connection and function calls

### 4. Response Handling

**Questions to Investigate**:
- Are `FunctionCallResponse` messages being sent correctly?
- Is agent receiving and processing function results?
- Does agent continue conversation after function execution?
- Is response format correct per Deepgram API spec?

**Investigation Steps**:
- Verify `sendFunctionCallResponse()` is called
- Check response message structure
- Verify agent receives response
- Check if agent continues conversation

## Recommendations

### 1. Add Comprehensive E2E Tests

**Priority**: High

**Test Scenarios Needed**:
- ✅ Test full execution flow: Connection → Message → Function Call → Execution → Results
- ✅ Test function call triggering with various prompts
- ✅ Test handler invocation and execution
- ✅ Test agent continuation after function execution
- ✅ Test multiple function calls in sequence
- ✅ Test function call errors and error handling
- ✅ Test connection stability during function call flow

**Test Infrastructure Improvements**:
- Add `data-testid="function-call-tracker"` element to test app for reliable tracking
- Create `waitForFunctionCall()` helper function for tests
- Add logging to track function call execution flow
- Create test utilities for function call testing

### 2. Improve Test Infrastructure

**Priority**: High

**Improvements Needed**:
- **Reliable Tracking**: Add `data-testid="function-call-tracker"` element to test app
- **Helper Functions**: Create `waitForFunctionCall()` helper for tests
- **Logging**: Add comprehensive logging to track function call execution flow
- **Test Utilities**: Create utilities for setting up function call tests
- **Mock Functions**: Create mock function handlers for testing

**Example Implementation**:
```javascript
// Helper function for waiting for function calls
async function waitForFunctionCall(page, options = {}) {
  const timeout = options.timeout || 10000;
  const expectedCount = options.count || 1;
  
  await page.waitForFunction(
    () => {
      const tracker = document.querySelector('[data-testid="function-call-tracker"]');
      const count = tracker ? parseInt(tracker.textContent) : 0;
      return count >= expectedCount;
    },
    { timeout }
  );
  
  const count = await page.evaluate(() => {
    const tracker = document.querySelector('[data-testid="function-call-tracker"]');
    return tracker ? parseInt(tracker.textContent) : 0;
  });
  
  return { count };
}
```

### 3. Investigate Execution Flow

**Priority**: High

**Investigation Tasks**:
- Add logging to see if `FunctionCallRequest` messages are received
- Verify `onFunctionCallRequest` callback is being invoked
- Check if function call handlers are being called
- Verify connection stability during function call flow
- Check response handling and agent continuation

**Logging Points**:
- WebSocket message reception (FunctionCallRequest)
- `onFunctionCallRequest` callback invocation
- Handler execution
- Function execution
- Response sending
- Agent continuation

### 4. Document Test Coverage Gap

**Priority**: Medium

**Documentation Needed**:
- Document that Settings message structure is verified but execution is not
- Create test plan for full execution flow coverage
- Identify which scenarios need test coverage
- Document known limitations of current tests

## Action Items

### Immediate (High Priority)

- [ ] **Get Tests Passing Without Proxy First** ⚠️ **CRITICAL**
  - **Test direct connection mode first** (using `apiKey` prop, not `proxyEndpoint`)
  - Proxy mode adds complexity and may mask underlying issues
  - Once tests pass with direct connection, then test proxy mode
  - This isolates function calling issues from proxy-specific issues

- [ ] **Investigate Function Call Triggering**
  - Add logging to see if `FunctionCallRequest` messages are received
  - Verify agent is deciding to call functions
  - Check function descriptions and prompts
  - **Test with direct connection first** (no proxy)

- [ ] **Investigate Handler Invocation**
  - Add logging to `onFunctionCallRequest` callback
  - Verify handler is being called
  - Check handler setup in test app
  - **Test with direct connection first** (no proxy)

- [ ] **Add Test Infrastructure**
  - Add `data-testid="function-call-tracker"` to test app ✅ **COMPLETED**
  - Create `waitForFunctionCall()` helper function ✅ **COMPLETED**
  - Add comprehensive logging

### Short Term (High Priority)

- [ ] **Add Comprehensive E2E Tests** ✅ **COMPLETED** (TDD Red phase)
  - Test full execution flow ✅
  - Test function call triggering ✅
  - Test handler invocation ✅
  - Test agent continuation ✅
  - **Note**: Tests are written but expected to fail initially (RED phase)

- [ ] **Get Tests Passing (Direct Connection First)** ⚠️ **CRITICAL**
  - Run tests with direct connection (`apiKey` prop) - NOT proxy mode
  - Fix issues to make tests pass (GREEN phase)
  - Once direct connection tests pass, then test proxy mode
  - Proxy mode testing should be separate phase

- [ ] **Investigate Connection Stability**
  - Monitor WebSocket connection during function call flow
  - Check for connection errors
  - Verify connection stays open
  - **Test with direct connection first** (no proxy)

- [ ] **Document Test Coverage Gap**
  - Document current test limitations
  - Create test plan
  - Identify missing scenarios

### Long Term (Medium Priority)

- [ ] **Improve Test Reliability**
  - Make tests more deterministic
  - Reduce reliance on agent decision-making
  - Add retry logic for flaky tests

- [ ] **Expand Test Coverage**
  - Test multiple function calls
  - Test function call errors
  - Test edge cases

## Related Files

- `tests/function-calling-settings.test.tsx` - Unit tests for Settings message structure
- `test-app/tests/e2e/function-calling-e2e.spec.js` - E2E tests (partial coverage)
- `test-app/src/App.tsx` - Test app with function call handlers
- `src/components/DeepgramVoiceInteraction.tsx` - Component implementation
- `src/utils/websocket/WebSocketManager.ts` - WebSocket message handling

## Acceptance Criteria

- [ ] Comprehensive E2E tests added for full function call execution flow
- [ ] Tests verify function call triggering, handler invocation, execution, and agent continuation
- [ ] Test infrastructure improved with reliable tracking mechanisms
- [ ] Root cause identified for why function calls aren't being triggered/executed
- [ ] Connection stability issues resolved (if applicable)
- [ ] Documentation updated to reflect test coverage scope
- [ ] All new tests passing reliably

## Next Steps

1. **⚠️ CRITICAL: Test Direct Connection First**
   - Run new TDD tests with direct connection (using `apiKey` prop)
   - Do NOT test with proxy mode until direct connection tests pass
   - Proxy mode adds complexity and may mask underlying function calling issues
   - Once direct connection tests pass, then add proxy mode tests

2. **Investigate**: Start with function call triggering investigation (direct connection only)
3. **Add Infrastructure**: ✅ **COMPLETED** - Test tracking and helper functions added
4. **Add Tests**: ✅ **COMPLETED** - Comprehensive E2E tests created (TDD Red phase)
5. **Fix Issues**: Address any bugs found during investigation (GREEN phase)
6. **Test Proxy Mode**: After direct connection tests pass, add proxy mode test coverage
7. **Document**: Update documentation with findings and improvements

## Progress Update

### ✅ Completed (TDD Red Phase)

1. **Test Infrastructure Added** ✅
   - Added `waitForFunctionCall()` helper function in `test-helpers.js`
   - Added `data-testid="function-call-tracker"` element to test app
   - Added `functionCallCount` state that increments when function calls are received

2. **Comprehensive E2E Tests Written** ✅ (TDD Red Phase)
   - `should track function calls via data-testid tracker element` - Verifies infrastructure
   - `should increment function call count when FunctionCallRequest is received` - Verifies tracking
   - `should verify full execution flow: Connection → Message → Function Call → Execution → Response` - Full E2E test
   - `should verify function call handler receives correct request structure` - Verifies request structure
   - Tests are written but expected to fail initially (RED phase)

3. **Diagnostic Logging Added** ✅
   - Enhanced logging in `DeepgramVoiceInteraction/index.tsx` for FunctionCallRequest handling
   - Added logging in `WebSocketManager.ts` to track FunctionCallRequest messages at WebSocket level
   - Logging includes:
     - Full FunctionCallRequest message structure
     - Functions array length and contents
     - Client-side function detection
     - Callback invocation
     - Response handling

### 🔄 In Progress (TDD Green Phase)

1. **Investigation Phase**
   - Tests are ready to run and will provide diagnostic information
   - Enhanced logging will help identify where the flow breaks
   - Next step: Run tests with direct connection to see what fails

### 📋 Next Steps

1. **Run Tests** - Execute the new E2E tests with direct connection (not proxy)
2. **Analyze Failures** - Use diagnostic logging to identify where function call flow breaks
3. **Fix Issues** - Address root causes to make tests pass (GREEN phase)
4. **Verify** - Ensure all tests pass with direct connection
5. **Test Proxy Mode** - After direct connection works, add proxy mode tests

---

**Status**: 🔄 **IN PROGRESS** - TDD Green Phase (Investigation & Fix)

