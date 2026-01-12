# Issue #362: E2E Test Results

**Date**: January 12, 2026  
**Test File**: `test-app/tests/e2e/context-retention-agent-usage.spec.js`  
**Status**: ✅ **Test working correctly - confirms regression**

---

## Test Results

### Test: "should retain context when disconnecting and reconnecting - agent uses context"

**Result**: ❌ **FAILED** (as expected - confirms regression)

**Test Output**:
```
✅ Initial connection established
📝 Step 2: Sending first message: "I am looking for running shoes"
✅ First message sent and agent responded
📝 First agent response: What type of running shoes are you looking for?...
⏸️ Step 3: Disconnecting agent
✅ Agent disconnected
🔄 Step 4: Reconnecting agent (context should be sent in Settings)
✅ Connection re-established via auto-connect
✅ SettingsApplied received - context should have been sent
📋 Settings message sent on reconnection: {
  hasContext: true,
  contextMessageCount: 4,
  sampleContext: [
    {
      type: 'History',
      role: 'user',
      content: 'I am looking for running shoes'
    },
    {
      type: 'History',
      role: 'assistant',
      content: 'What type of running shoes are you looking for?'
    }
  ]
}
✅ Context verified in Settings message
📝 Step 5: Asking agent: "What were we just talking about?"
✅ Agent responded to recall question
📝 Agent recall response: Hello!
🔍 Step 6: Verifying agent response references previous conversation
⚠️ Agent response does not explicitly mention "running shoes"
   Agent response: "Hello!"
   This may indicate context is not being used, but checking for other context references...
❌ Error: Agent response does not reference previous conversation.
   Expected agent to mention "running shoes" or reference previous conversation.
   Agent responded: "Hello!"
```

---

## Key Findings

### ✅ Context Is Being Sent Correctly

**Verified in test output**:
- Context is included in Settings message: `hasContext: true`
- Context contains 4 messages (user message + agent responses)
- Context format is correct: `{ type: 'History', role: 'user'|'assistant', content: '...' }`
- User message about "running shoes" is in context

### ❌ Agent Is Not Using Context

**Verified in test output**:
- Agent responds with "Hello!" when asked "What were we just talking about?"
- Agent does NOT reference "running shoes" from context
- Agent does NOT reference previous conversation at all
- This confirms the regression

---

## Test Validation

**Test Status**: ✅ **Working correctly**

The test:
1. ✅ Establishes connection
2. ✅ Sends first message: "I am looking for running shoes"
3. ✅ Waits for agent response
4. ✅ Disconnects agent
5. ✅ Reconnects agent (context sent in Settings)
6. ✅ Verifies context is sent correctly
7. ✅ Asks recall question: "What were we just talking about?"
8. ❌ **Correctly fails** because agent doesn't reference context

**This confirms the regression**: Context is being sent correctly, but the agent is not using it.

---

## Next Steps

1. ✅ Test created and working
2. ✅ Regression confirmed via E2E test
3. ⏳ Investigate root cause (Deepgram API-side issue?)
4. ⏳ Implement fix
5. ⏳ Re-run test - should PASS when fix is implemented

---

**End of Test Results**
