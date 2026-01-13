# Issue #362: Function Calling Test Status

**Date**: January 12, 2026  
**Question**: Do we have tests that validate function calling?

---

## Answer: ✅ YES, but they don't test context retention with function calling

---

## Existing Function Calling Tests

### 1. `test-app/tests/e2e/function-calling-e2e.spec.js` ✅

**What it tests**:
- ✅ Functions are included in Settings message
- ✅ FunctionCallRequest messages are received from Deepgram
- ✅ Client-side functions can be executed
- ✅ FunctionCallResponse can be sent
- ✅ Agent continues conversation after function execution

**What it does NOT test**:
- ❌ Context retention with function calling
- ❌ Context + function calling + reconnection
- ❌ Whether function calling interferes with context processing

**Test Flow**:
1. Setup function calling
2. Connect agent
3. Trigger function call
4. Execute function
5. Verify agent response

**No context retention scenario** - Tests function calling in isolation

---

### 2. `test-app/tests/e2e/agent-options-resend-issue311.spec.js` ✅

**What it tests**:
- ✅ Functions are included when agentOptions changes
- ✅ Settings are re-sent with functions

**What it does NOT test**:
- ❌ Context retention with function calling

---

### 3. `test-app/tests/e2e/issue-351-function-call-proxy-mode.spec.js` ✅

**What it tests**:
- ✅ Function calling in proxy mode

**What it does NOT test**:
- ❌ Context retention with function calling

---

## Missing Test: Context Retention + Function Calling

**What we need**:
- ❌ Test that combines context retention with function calling
- ❌ Test that verifies context works after function calls
- ❌ Test that verifies context works when reconnecting with function calling enabled

**Why this matters**:
- Customer's app uses function calling (`search_products`)
- Customer's test fails consistently (agent says "I'm unable to recall")
- Our test (without function calling) is flaky
- **Hypothesis**: Function calling might interfere with context processing

---

## Recommendation

**Create a new test**: `test-app/tests/e2e/context-retention-with-function-calling.spec.js`

**Test Flow**:
1. Setup function calling (e.g., `search_products`)
2. Send message: "I am looking for running shoes"
3. Wait for function call to execute
4. Wait for agent response about function results
5. Disconnect agent
6. Reconnect agent (context should be sent)
7. Ask: "Provide a summary of our conversation to this point."
8. Verify agent uses context (mentions "running shoes")

**This would test**:
- ✅ Context retention with function calling
- ✅ Whether function calling interferes with context
- ✅ Whether reconnection with function calling + context works

---

## Conclusion

**We have function calling tests**, but **we don't have tests that combine function calling with context retention**. This is a gap that might explain why:

1. Customer's test fails consistently (has function calling)
2. Our test is flaky (no function calling)
3. Function calling might interfere with context processing

**Next Step**: Create a test that combines context retention with function calling to verify if function calling is the cause of the consistent failure.

---

**End of Function Calling Test Status**
