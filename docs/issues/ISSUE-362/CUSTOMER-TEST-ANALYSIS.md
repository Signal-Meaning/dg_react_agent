# Issue #362: Customer Test Analysis

**Date**: January 12, 2026  
**Customer Test**: `/Users/davidmcgee/Development/voice-commerce/frontend/tests/e2e/context-retention-across-disconnect.e2e.test.js`  
**Status**: Test updated to match ours, but **NOT PASSING** (consistent failure)

---

## Key Finding

The customer updated their test to match ours (using "Provide a summary of our conversation to this point."), but it's **still failing consistently** with the agent saying "I'm unable to recall previous conversations" or similar denial messages.

---

## Differences Between Customer's Test and Ours

### 1. **Function Calling**

**Customer's App**: Has function calling (`search_products`) - agent makes function calls before responding  
**Our Test-App**: No function calling (simpler scenario)

**Impact**: Function calling might interfere with context processing:
- Agent processes: greeting → function call → function call response → agent response
- Context might be processed differently when function calls are involved
- The function call flow might reset or interfere with context state

### 2. **Complex Greeting Filtering**

**Customer's Test**: Very complex logic to filter out greetings (lines 219-258):
- Waits for non-greeting responses after user message
- Filters out greetings by test ID and content
- Has 60-second timeout for actual response

**Our Test**: Simpler greeting handling using `waitForAgentResponseEnhanced`

**Impact**: 
- Customer is seeing greetings that interfere with responses
- This suggests greetings are being sent/received even when context is present
- The greeting might be resetting the agent's context state

### 3. **Specific Error Message Detection**

**Customer's Test**: Checks for specific "can't recall" messages (lines 302-312):
```javascript
const hasNoRecallMessage = recallResponseText.toLowerCase().includes("don't have the ability") ||
                           recallResponseText.toLowerCase().includes("can't recall") ||
                           recallResponseText.toLowerCase().includes("cannot recall") ||
                           recallResponseText.toLowerCase().includes("don't have memory") ||
                           recallResponseText.toLowerCase().includes("unable to recall") ||
                           recallResponseText.toLowerCase().includes("i don't have memory") ||
                           recallResponseText.toLowerCase().includes("no memory");
```

**Our Test**: Checks for context references but doesn't specifically check for denial messages

**Impact**: 
- Customer is getting **consistent denial messages** ("I'm unable to recall")
- Our test has been improved and is now stable
- This suggests different failure modes or different agent behavior

### 4. **Test Helpers**

**Customer's Test**: Uses custom helpers:
- `sendTextMessage` - triggers auto-connect
- `waitForConnection` - waits for connection
- `waitForSettingsApplied` - waits for Settings message
- `waitForFunctionCall` - waits for function calls

**Our Test**: Uses different helpers:
- `sendMessageAndWaitForResponse` - different implementation
- `waitForAgentResponseEnhanced` - different implementation

**Impact**: Different timing or behavior in how connections/reconnections are handled

---

## Why Customer's Test Fails Consistently

### Hypothesis 1: Function Calling Interference

**Theory**: Function calling in the customer's app interferes with context processing:
1. Agent receives context in Settings
2. Agent processes function call request
3. Function call execution might reset context state
4. Agent responds without using context

**Evidence**:
- Customer's app has function calling, ours doesn't
- Function calls happen before agent response
- Context might be lost during function call processing

### Hypothesis 2: Greeting Interference

**Theory**: Greetings are interfering with context (Issue #238):
1. Context is sent correctly in Settings
2. Greeting is received in ConversationText (Issue #238)
3. Greeting resets agent's context state
4. Agent responds without context

**Evidence**:
- Customer has complex greeting filtering logic
- Customer is seeing greetings even when context is present
- Our test also shows greeting interference warnings

### Hypothesis 3: Instructions/Prompt Differences

**Theory**: Customer's instructions might be causing different behavior:
1. Customer's instructions might explicitly tell agent about memory limitations
2. Agent follows instructions and says "I don't have memory"
3. Our test-app has different instructions

**Evidence**:
- Customer uses production instructions
- Our test-app uses default instructions
- Instructions might affect how agent handles context

### Hypothesis 4: Context Construction Differences

**Theory**: Customer might be constructing context differently:
1. Different conversation history format
2. Different message ordering
3. Different content format

**Evidence**:
- Need to check customer's context construction code
- Format should match, but implementation might differ

---

## What We Need to Check

1. **Customer's context construction**: How do they build `agentOptions.context`?
2. **Customer's instructions**: What are their production instructions?
3. **Function calling impact**: Does function calling interfere with context?
4. **Greeting behavior**: Are greetings being sent when context is present?

---

## Next Steps

1. ⏳ **Review customer's context construction code** - How do they build context?
2. ⏳ **Review customer's instructions** - What prompts are they using?
3. ⏳ **Test with function calling** - Add function calling to our test-app to see if it reproduces the issue
4. ⏳ **Test greeting interference** - Verify if greetings are interfering with context

---

## Conclusion

The customer's test is **consistently failing** with denial messages ("I'm unable to recall"), while our test (without function calling) is stable. This suggests:

1. **Different failure modes** - Customer's app has additional factors (function calling, different instructions)
2. **Consistent issue** - The regression exists, but manifests differently in different environments
3. **Need to investigate** - We need to understand why customer's test fails consistently while ours (without function calling) is stable

---

**End of Customer Test Analysis**
