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

## Differences We've Identified

To understand why your test fails while ours pass, we need to investigate these potential differences:

### 1. **Instructions/Prompts**
- **Question**: What instructions/prompts are you using in production?
- **Why**: Different instructions might affect how the agent handles context
- **Our Test**: Uses default test-app instructions

### 2. **Context Construction**
- **Question**: How do you construct `agentOptions.context`? Can you share the code?
- **Why**: Context format or message ordering might differ
- **Our Test**: Converts conversation history to `{ type: 'History', role: 'user'|'assistant', content: string }`

### 3. **Function Calling Setup**
- **Question**: How is your `search_products` function configured?
- **Why**: Function calling might interact differently with context in your setup
- **Our Test**: Uses client-side `get_current_datetime` function

### 4. **Environment/Configuration**
- **Question**: Are there any other configuration differences (API endpoints, SDK versions, etc.)?
- **Why**: Different environments might behave differently

---

## What We Need From You

To proceed with the investigation, please provide:

1. **Your production instructions/prompts** (the `agent.instructions` you're using)
2. **Your context construction code** (how you build `agentOptions.context`)
3. **Your function calling setup** (function definitions and handlers)
4. **Any other relevant configuration** that might differ from our test-app

---

## Next Steps

Once we have this information, we will:
1. Replicate your exact setup in our test-app
2. Identify the root cause of the difference
3. Implement a fix or provide guidance

---

## Technical Details

### Context Format We're Using

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

This matches the Deepgram API specification. We've verified this format is being sent correctly in the Settings message.

### Test Files

- `test-app/tests/e2e/context-retention-agent-usage.spec.js`
- `test-app/tests/e2e/context-retention-with-function-calling.spec.js`

Both tests are available in the `dg_react_agent` repository for your review.

---

**Status**: ⚠️ **INVESTIGATING** - Awaiting additional information to reproduce your exact scenario
