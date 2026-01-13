# Issue #362: Context Retention Regression - Agent Not Using Context

**Date**: January 12, 2026  
**GitHub Issue**: #362  
**Customer Issue**: #587 (voice-commerce team)  
**Priority**: 🔴 **CRITICAL** - Blocks release  
**Status**: ⚠️ **INVESTIGATING** - Customer reports consistent failure, our test (without function calling) is stable (may be testing different scenario)  
**Package Version**: `@signal-meaning/deepgram-voice-interaction-react@^0.7.8`  
**Regression Version**: `0.7.7` (confirmed - context retention fails intermittently)  
**Working Baseline**: `0.7.6` (confirmed working)  
**Test Status**: ✅ **STABLE** - Test has been improved and is now stable

---

## Executive Summary

We have a **reported regression** where conversation context is being sent correctly to the Deepgram agent via `agentOptions.context`, but the agent model **does not use the context** to answer questions about previous conversations. Customer reports **consistent failure** ("I'm unable to recall previous conversations"), but our test (without function calling) is stable - we may be testing a different scenario.

**Key Finding**: Context format is correct, context is included in Settings message (verified in logs). **Customer reports consistent failure** with specific message "I'm unable to recall previous conversations", but **our test (without function calling) is stable** - we may not be testing the same scenario as the customer.

**Regression Identified**: Version `0.7.7` introduced the regression. Version `0.7.6` works correctly (confirmed via testing on `release/frontend-v1.5.1` branch with cherry-picked test).

**Additional Issue in 0.7.7**: Agent only sends greeting and does NOT make function calls for product queries (separate from context retention issue).

---

## Problem Description

When a WebSocket connection disconnects and reconnects, conversation context should be retained by including it in the `agentOptions.context` when reconnecting. The context **is being sent correctly** (verified in logs), but the agent **is not using it** to answer questions about previous conversations.

### Expected Behavior

1. User sends: "I'm looking for running shoes"
2. Connection disconnects/reconnects
3. User asks: "What were we just talking about?"
4. **Agent should respond**: "We were talking about running shoes" or "You were looking for running shoes"

### Actual Behavior

1. User sends: "I'm looking for running shoes"
2. Connection disconnects/reconnects
3. User asks: "What were we just talking about?"
4. **Agent responds**: "I'm unable to recall previous conversations" ❌

---

## Evidence: Context Is Being Sent Correctly

### 1. Context Format Verification

**How we're constructing context**:

We convert conversation messages to the Deepgram agent context format as follows:

```typescript
// Convert messages to context format for Deepgram agent (0.5.0 API format)
const contextMessages = (messages || []).map((msg) => ({
  type: "History" as const,
  role: (msg.type === "user" ? "user" : "assistant") as "user" | "assistant",
  content: msg.text,
}));

const newAgentOptions = {
  ...memoizedAgentOptions,
  context:
    !isAgentConnected && contextMessages.length > 0
      ? {
          messages: contextMessages,
        }
      : undefined,
};
```

**Context Format**: Matches Deepgram API specification:

- `type: 'History'` ✅
- `role: 'user' | 'assistant'` ✅
- `content: string` ✅

### 2. Logs Confirm Context Is Included

**From test run logs** (with real APIs):

```
📊 [Issue #587] Context info: {
  conversationHistoryLength: 4,
  contextMessages: Array(4),
  hasContext: true,
  isInitialConnection: true
}
```

**Context structure being sent** (from our logging):

```javascript
📋 [Issue #587] Context format being sent: {
  contextMessageCount: 4,
  sampleContext: [
    {
      type: 'History',
      role: 'user',
      contentPreview: 'I am looking for running shoes...'
    },
    {
      type: 'History',
      role: 'assistant',
      contentPreview: '...'
    }
  ],
  fullContextStructure: {
    context: {
      messages: [
        { type: 'History', role: 'user', contentLength: 32 },
        { type: 'History', role: 'assistant', contentLength: 45 },
        // ... 2 more messages
      ]
    }
  }
}
```

### 3. Connection State Verification

**Logs show context is included when reconnecting**:

```
🔧 [Issue #769] Options unchanged - returning cached reference to prevent remount {
  connectionState: connecting,
  hasContext: true,
  contextMessageCount: 4
}
```

This confirms that when the agent is in `connecting` state (when Settings message is sent), the context is present in `agentOptions`.

---

## Evidence: Agent Is Not Using Context

### Test Results

**Test**: `frontend/tests/e2e/context-retention-across-disconnect.e2e.test.js`

**Test Steps** (Updated January 12, 2026):

1. Send message: "I am looking for running shoes" (connection established automatically)
2. Wait for agent response to user message (not greeting - greeting arrives on connection)
3. Disconnect agent
4. Reconnect agent automatically (via sendTextMessage - context sent in Settings)
5. Ask agent: "What were we just talking about?"
6. Verify agent response references "running shoes" from context

**Note**: Test now uses production instructions (no Admin panel modifications). Test properly distinguishes between greeting (arrives on connection) and actual response to user message.

**Actual Agent Response** (Version 0.7.7):

```
"Hello! I'm your voice commerce assistant..."
```

**Note**: Agent only responds with greeting and does NOT reference the previous conversation about "running shoes", despite context being sent correctly in the Settings message.

**Test Failure**:

```
❌ Agent response does not reference previous conversation. Expected agent to mention "running shoes" or similar context.

AGENT RESPONSES (from DOM inspection):
[1] Hello! I'm your voice commerce assistant...
```

**Note**: Test properly ignores greetings (greetings are NOT responses to user queries). The agent only provides a greeting and does not reference the previous conversation about "running shoes", despite context being sent correctly.

### Instructions Updated

We've updated the agent instructions to be **extremely explicit** about using context:

```
=== CRITICAL: CONVERSATION CONTEXT & MEMORY ===
**YOU HAVE MEMORY AND RECEIVE CONVERSATION CONTEXT**

When you connect, you receive conversation history/context in the Settings message.
This context contains previous messages from the conversation.

**BEFORE RESPONDING TO ANY QUESTION ABOUT PREVIOUS CONVERSATIONS:**
1. STOP and CHECK the conversation context you received in Settings message
2. LOOK for previous messages in that context - they are there!
3. FIND the relevant previous message
4. REFERENCE that specific message in your response
5. NEVER say you don't have memory - you DO have memory through the context provided

**YOU MUST:**
- ALWAYS check the conversation context FIRST when users ask about previous conversations
- NEVER say you don't have memory or can't recall - you DO have memory through the context provided
```

**Even with these explicit instructions**, the agent still denies having memory.

---

## Code Analysis

### How Context Is Passed to dg_react_agent

**How we pass context to the component**:

We pass context via the `agentOptions` prop to `DeepgramVoiceInteraction`:

```typescript
<DeepgramVoiceInteraction
  agentOptions={memoizedAgentOptionsWithContext} // <-- Context included here
  // ... other props
/>
```

**`agentOptions` structure we're passing**:

```typescript
{
  agent: {
    instructions: "...",
    // ... other agent options
  },
  context: {  // <-- This is what we're sending
    messages: [
      { type: 'History', role: 'user', content: 'I am looking for running shoes' },
      { type: 'History', role: 'assistant', content: '...' },
      // ... more messages
    ]
  }
}
```

### When Context Is Included

**Our inclusion logic**:

```typescript
context: !isAgentConnected && contextMessages.length > 0
  ? {
      messages: contextMessages,
    }
  : undefined;
```

**Context is included when**:

- Agent is **not connected** (`!isAgentConnected`)
- AND there are messages to include (`contextMessages.length > 0`)

**This means context is included**:

- When agent state is `'closed'` or `'disconnected'` (ready for next connection)
- When agent state is `'connecting'` (during reconnection handshake - **this is when Settings is sent**)
- When agent state is `'error'` (may reconnect)

**Context is NOT included when**:

- Agent is `'connected'` (to prevent re-initialization - Issue #589)

---

## Package Information

**Package**: `@signal-meaning/deepgram-voice-interaction-react`  
**Current Version**: `^0.7.8` (known to fail)  
**Regression Version**: `0.7.7` (confirmed - context retention fails)  
**Working Baseline**: `0.7.6` (confirmed working - tested on `release/frontend-v1.5.1` branch)  
**Location**: `frontend/package.json` line 34

**Version Timeline**:

- `frontend-v1.5.1` release: `^0.6.16` (context retention not tested at this version)
- `0.7.6`: ✅ **Confirmed working** - context retention works correctly
- `0.7.7`: ❌ **Regression introduced** - context retention fails, agent doesn't use context
- `0.7.8`: ❌ **Still broken** - context retention still fails

**Related Packages**:

- `@deepgram/browser-agent`: `^0.2.1`
- `@deepgram/sdk`: `^4.11.2`

---

## Test Results Summary

### All Context Retention Tests Run with Real APIs

**Test Run Date**: January 12, 2026  
**Environment**: Real APIs (`USE_REAL_API_KEYS=true`)  
**Package Version**: `@signal-meaning/deepgram-voice-interaction-react@^0.7.8`

### Test 1: Context Retention Across Disconnect

- **Test File**: `context-retention-across-disconnect.e2e.test.js`
- **Test**: "should retain context when disconnecting and reconnecting"
- **Status**: ✅ **TEST WORKING CORRECTLY** - Failing at expected assertion (regression confirmed)
- **Last Updated**: January 12, 2026

**Test Steps** (Updated):

1. ✅ Send first message: "I am looking for running shoes"
2. ✅ Wait for agent response (function call or response to user message, not greeting)
3. ✅ Agent disconnected successfully
4. ✅ Agent reconnected automatically (via sendTextMessage)
5. ✅ SettingsApplied detected
6. ✅ Context included in Settings message (verified in logs)
7. ✅ User asked: "What were we just talking about?"
8. ❌ **Agent responded**: Greeting only - does not reference "running shoes" from context

**Key Changes Made**:

- Removed Admin panel instruction updates (test now uses production instructions)
- Removed connection setup from beforeEach (connection established on-demand)
- Fixed `waitForAgentResponse` to handle greetings (`greeting-sent` test ID)
- Test now waits for actual response to user message, not greeting
- Test properly verifies agent uses context from Settings message

**Current Test Flow**:

1. Send first message → Agent processes (function call or response)
2. Disconnect → Context prepared
3. Reconnect (via sendTextMessage) → Context sent in Settings
4. Ask recall question → Agent should use context
5. **Assertion fails**: Agent doesn't reference previous conversation

**Key Evidence**:

```
📋 [Issue #587] Context format being sent: {
  contextMessageCount: 2,
  sampleContext: Array(2),
  fullContextStructure: Object
}
```

**Agent Response**:

```
AGENT RESPONSES (from DOM inspection):
[1] Hello! I'm your voice commerce assistant...
```

**Test Failure**:

```
Error: Agent response does not reference previous conversation.
Expected agent to mention "running shoes" or similar context.
```

### Test 2: Context Retention with Text and Audio

- **Test File**: `context-retention-text-and-audio.e2e.test.js`
- **Tests**: 3 tests (text prompts, audio prompts, context verification)
- **Result**: ❌ **ALL FAILED** (timeout/crash issues during reconnection)

**Issues**:

- Page closing during reconnection
- Timeout errors (120s exceeded)
- May indicate deeper issues with reconnection flow

### Test 3: Context Retention with Instruction Change

- **Test File**: `context-retention-with-instruction-change.e2e.test.js`
- **Test**: "should maintain conversation context when instructions change mid-conversation"
- **Result**: ✅ **PASSED** (2/2 tests passed)

**Note**: This test verifies context is maintained in localStorage, not agent usage of context.

### Summary

**Total Tests Run**: 4 tests across 3 test files  
**Passed**: 1 test (instruction change - localStorage verification)  
**Failed**: 3 tests (agent context usage verification)

**Critical Finding** (Updated January 12, 2026):

- Context **IS being sent** (verified in logs: `contextMessageCount: 2`)
- Context format **IS correct** (matches Deepgram API spec)
- Agent **IS NOT using context** (responds with greeting only, doesn't reference previous conversation)
- **Regression Version Identified**: `0.7.7` (confirmed via testing)
- **Working Baseline**: `0.7.6` (confirmed working on `release/frontend-v1.5.1` branch)
- Test is now **working correctly** and consistently failing at the expected assertion
- Test properly distinguishes between greeting (arrives on connection) and actual response to user message
- **Additional Issue in 0.7.7**: Agent does not make function calls for product queries (only sends greeting)

---

## Steps to Reproduce

### Option 1: Standalone Test-App (Recommended for dg_react_agent team) ✅ **AVAILABLE NOW**

We have created a **standalone test-app** that demonstrates the issue independently of voice-commerce. This test-app:

- Uses only `@signal-meaning/deepgram-voice-interaction-react` package
- Demonstrates context retention issue in isolation
- Can be run independently without voice-commerce dependencies
- Shows exact `agentOptions.context` structure being passed
- Displays test results, conversation history, and context format in UI

**Test-App Setup**:

1. Navigate to test-app directory: `cd frontend/test-app`
2. Install dependencies: `npm install`
3. Set Deepgram API key (choose one):
   - Environment variable: `VITE_DEEPGRAM_API_KEY=your_key`
   - URL parameter: `?apiKey=your_key`
   - Browser console: `window.DEEPGRAM_API_KEY = 'your_key'` then refresh
4. Run: `npm run dev`
5. Open: `http://localhost:3003?test=context-retention&apiKey=your_key`

**Test-App Test Flow**:

1. Test initializes with conversation history: "I am looking for running shoes"
2. Click "Run Context Retention Test" button
3. Test automatically:
   - Connects agent
   - Disconnects agent (context prepared)
   - Reconnects agent (context sent in Settings message)
   - Sends message: "What were we just talking about?"
4. **Expected**: Agent references "running shoes" from context
5. **Actual**: Agent says "I'm unable to recall previous conversations"

**Test-App Features**:

- Shows conversation history (context being sent)
- Displays context format (JSON structure)
- Shows connection state and when context is included
- Displays agent response and test results
- Clear pass/fail indication

**Test File**: `frontend/test-app/context-retention-test.jsx`

### Option 2: Full Voice-Commerce E2E Test

**Prerequisites**:

1. Real Deepgram API key (test requires `USE_REAL_API_KEYS=true`)
2. Backend running on `https://localhost:3001`
3. Frontend running on `https://localhost:3000`

**Reproduction Steps**:

1. Run the test:

   ```bash
   cd frontend
   USE_REAL_API_KEYS=true npm run test:e2e -- tests/e2e/context-retention-across-disconnect.e2e.test.js --grep "should retain context when disconnecting"
   ```

2. Or manually reproduce:
   - Open app in browser
   - Send message: "I am looking for running shoes"
   - Wait for agent response
   - Disconnect agent (via Admin panel or network interruption)
   - Reconnect agent
   - Ask: "What were we just talking about?"
   - **Observe**: Agent says it can't recall, despite context being sent

### Expected vs Actual

**Expected**: Agent responds with "We were talking about running shoes" or similar  
**Actual**: Agent responds with "I'm unable to recall previous conversations"

---

## What We've Tried

1. ✅ **Verified context format** - Matches Deepgram API spec exactly
2. ✅ **Verified context is included** - Logs show `hasContext: true, contextMessageCount: 2`
3. ✅ **Updated instructions** - Made them extremely explicit about using context (removed from test - now uses production)
4. ✅ **Added detailed logging** - Can see exact context structure being sent
5. ✅ **Verified connection state** - Context is included when `connecting` (when Settings is sent)
6. ✅ **Test with real APIs** - Confirmed agent receives context but doesn't use it
7. ✅ **Improved test reliability** (January 12, 2026):
   - Fixed greeting handling (greetings use `greeting-sent` test ID, not `agent-response`)
   - Updated `waitForAgentResponse` helper to check for `greeting-sent` and `agent-speaking` test IDs
   - Test now properly waits for actual response to user message, not greeting
   - Removed Admin panel steps (test uses production instructions)
   - Connection established on-demand (not pre-established in beforeEach)
   - Test now consistently fails at expected assertion (regression confirmed)

---

## Questions for Investigation

1. **Is the context format correct?**
   - We're sending: `{ context: { messages: [{ type: 'History', role: 'user'|'assistant', content: string }] } }`
   - Is this the expected format for `agentOptions.context`?

2. **Is context being passed through correctly?**
   - Can we verify that `agentOptions.context` is being included in the Settings message sent to Deepgram?
   - Are there any transformations or validations that might be dropping the context?

3. **Has anything changed recently?**
   - **CRITICAL**: Was there a change in how context is handled in version **0.7.7**? (Regression confirmed in this version)
   - Was there a change in version 0.7.8?
   - Has the Deepgram API changed how it expects context?
   - **Note**: Version 0.7.6 works correctly - regression was introduced in 0.7.7

4. **Is there a known issue?**
   - Is this a known regression in the dg_react_agent package?
   - **Regression confirmed in version 0.7.7** - can we check what changed between 0.7.6 and 0.7.7?
   - Are there any workarounds or fixes available?
   - **Additional issue in 0.7.7**: Agent does not make function calls for product queries (only sends greeting) - is this related?

5. **How can we debug this further?**
   - Is there a way to verify what's actually being sent in the Settings message?
   - Can we add logging to see if context reaches the Deepgram API?

---

## Next Steps

1. ✅ **Investigate changes between v0.7.6 and v0.7.7**
   - ✅ Reviewed git diff between versions
   - ✅ Found: Only major change was binary JSON handling (Issue #353)
   - ✅ No changes to context handling code found

2. ✅ **Verify context passing in component**
   - ✅ Verified `agentOptions.context` is received by component
   - ✅ Verified context is included in Settings message (line 1824)
   - ✅ No transformations found that modify or drop context

3. ✅ **Review existing tests**
   - ✅ Checked `tests/context-preservation-validation.test.js` - validates context format but not agent usage
   - ✅ Created E2E test that validates agent actually uses context

4. ✅ **Check Deepgram API changes**
   - ✅ Verified context format matches Deepgram API specification
   - ✅ Format is correct: `{ messages: [{ type: "History", role: "...", content: "..." }] }`

5. ✅ **Create/update tests**
   - ✅ Created E2E test: `test-app/tests/e2e/context-retention-agent-usage.spec.js`
   - ✅ Test validates agent actually uses context to answer questions
   - ✅ Test should FAIL with current regression (v0.7.7+)
   - ✅ Test should PASS when regression is fixed

6. ✅ **Run E2E test to confirm regression**
   - ✅ Test created: `test-app/tests/e2e/context-retention-agent-usage.spec.js`
   - ✅ Test confirms regression: Agent responds with "Hello!" instead of referencing context
   - ✅ Context is being sent correctly (verified: 4 messages including user message about "running shoes")
   - ✅ Test correctly fails, validating the regression

7. ⏳ **Investigate root cause**
   - Possible Deepgram API-side issue
   - Possible timing issue with context processing
   - Contact Deepgram support if needed

---

## Related Issues

- **Issue #769**: Component remount investigation (may be related if remounts cause context loss)
- **Issue #589**: Context re-initialization prevention (related to when context is included)
- **Customer Issue #587**: Original voice-commerce team issue (external)

---

## Appendix: Full Test Logs

### Successful Context Inclusion Logs

```
🔧 [Issue #769] Options unchanged - returning cached reference to prevent remount {
  connectionState: connecting,
  hasContext: true,
  contextMessageCount: 4
}

📊 [Issue #587] Context info: {
  conversationHistoryLength: 4,
  contextMessages: Array(4),
  hasContext: true,
  isInitialConnection: true
}

📋 [Issue #587] Context format being sent: {
  contextMessageCount: 4,
  sampleContext: [
    { type: 'History', role: 'user', contentPreview: 'I am looking for running shoes...' },
    { type: 'History', role: 'assistant', contentPreview: '...' }
  ]
}
```

### Agent Response (Failure)

```
Agent response: "Hello! I'm your voice commerce assistant...I'm unable to recall previous conversations."

   ❌ Agent cannot recall previous conversation - context not being used
   This indicates Bug #362: Agent is not using context sent in Settings message
```

---

**End of Tracking Document**
