# Issue #362: Customer Response - Context Retention Investigation

**Date**: January 13, 2026  
**Customer Issue**: #587 (voice-commerce team)  
**GitHub Issue**: #362  
**Package Version**: `@signal-meaning/deepgram-voice-interaction-react@^0.7.8`

---

## Summary

We have investigated the context retention regression you reported. Our tests are currently **passing**, but your test is still **failing consistently**. This suggests we may not be reproducing the exact same scenario. We need additional information to identify the differences.

---

## Our Test Results

### Tests Created

We created two E2E tests to validate context retention:

1. **`context-retention-agent-usage.spec.js`** (without function calling)
   - **Status**: ✅ **PASSING**
   - **Test Message**: "My favorite color is blue"
   - **Result**: Agent correctly references "blue" in recall response

2. **`context-retention-with-function-calling.spec.js`** (with function calling)
   - **Status**: ✅ **PASSING**
   - **Test Message**: "What is the time?" (triggers function call)
   - **Result**: Agent correctly references "time" in recall response

### Test Verification

Both tests verify:
- ✅ Context is sent correctly in Settings message (verified via WebSocket capture)
- ✅ Context format matches Deepgram API specification
- ✅ Agent uses context to answer recall questions

---

## Your Test Status

**Your Test**: `context-retention-across-disconnect.e2e.test.js`  
**Status**: ❌ **Still failing consistently** (even after updating to match our test)  
**Error**: Agent responds with "I'm unable to recall previous conversations"

---

## Next Steps - Please Use Our Test Examples

To help us identify the root cause, please try running our test examples in your environment:

### Option 1: Run Our Tests Directly

Our tests are available in the `dg_react_agent` repository:
- `test-app/tests/e2e/context-retention-agent-usage.spec.js` (without function calling)
- `test-app/tests/e2e/context-retention-with-function-calling.spec.js` (with function calling)

Please run these tests in your environment and let us know:
- Do they pass or fail?
- If they fail, what error do you see?

### Option 2: Adapt Our Test Pattern

If you cannot run our tests directly, please adapt your test to match our test pattern:

1. **Use our test messages**:
   - Without function calling: "My favorite color is blue"
   - With function calling: "What is the time?" (with a simple datetime function)

2. **Use our recall question**: "Provide a summary of our conversation to this point."

3. **Follow our test flow**:
   - Send first message
   - Wait for agent response
   - Disconnect
   - Reconnect (context should be sent automatically)
   - Ask recall question
   - Verify agent references previous conversation

This will help us determine if the issue is specific to your setup or a broader problem.

---

## What We'll Do

Once we understand whether our tests pass in your environment:
1. If they pass: We'll investigate what's different about your specific setup
2. If they fail: We'll investigate why the same tests behave differently in your environment
3. We'll implement a fix or provide guidance based on the findings

---

## Technical Details

### Context Format

The component automatically constructs context from conversation history in the correct format:

```typescript
{
  context: {
    messages: [
      {
        type: 'History',
        role: 'user' | 'assistant',
        content: string
      }
    ]
  }
}
```

This matches the Deepgram API specification. The component handles context construction automatically - you just need to provide conversation history via `agentOptions.context`.

### Test Files

- `test-app/tests/e2e/context-retention-agent-usage.spec.js`
- `test-app/tests/e2e/context-retention-with-function-calling.spec.js`

Both tests are available in the `dg_react_agent` repository for your review.

---

**Status**: ⚠️ **INVESTIGATING** - Awaiting additional information to reproduce your exact scenario
