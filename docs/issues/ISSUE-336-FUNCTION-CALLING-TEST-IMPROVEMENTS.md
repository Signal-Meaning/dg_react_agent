# Issue #336: Function Calling Test Improvements - Making Tests More Deterministic

## Problem

Two E2E tests are flaky because the agent doesn't consistently decide to call functions:
- `should increment function call count when FunctionCallRequest is received`
- `should verify function call handler receives correct request structure`

The main comprehensive test passes, proving the system works, but these tests fail intermittently due to non-deterministic agent behavior.

## Root Cause

LLM-based agents (like GPT-4o-mini) make decisions about when to call functions. This is inherently non-deterministic because:
1. The agent interprets user messages and decides if a function call is needed
2. Function descriptions must match user intent for the agent to trigger calls
3. Agent behavior can vary between runs even with identical inputs

## Best Practices for Deterministic Function Calling Tests

### 1. Use Explicit, Directive Prompts

**❌ Bad (Ambiguous)**:
```
"What time is it?"
```

**✅ Good (Explicit)**:
```
"Please use the get_current_time function to tell me the current time"
```

**✅ Better (Matches Function Description Exactly)**:
```
"What time is it?" // When function description says "Use this when users ask about the time"
```

### 2. Enhance Function Descriptions

Function descriptions should be:
- **Specific**: Clearly state when to use the function
- **Action-oriented**: Use imperative language ("Use this when...", "Call this to...")
- **Match user language**: Include common phrases users might say

**Example**:
```javascript
{
  name: 'get_current_time',
  description: 'Get the current time in a specific timezone. Use this function when users ask about the time, what time it is, or current time. Always use this function when the user asks about time.',
  // ... parameters
}
```

### 3. Use System Instructions to Guide Function Usage

Add explicit instructions in the agent's `instructions` field:

```javascript
instructions: 'You are a helpful assistant. When users ask about time, you MUST use the get_current_time function. Always use available functions when they are relevant to the user\'s request.'
```

### 4. Implement Retry Logic with Different Prompts

If a function call doesn't happen, try different prompts:

```javascript
const prompts = [
  'What time is it?',
  'Please tell me the current time',
  'Use the get_current_time function to show me the time',
  'Can you call get_current_time for me?'
];

for (const prompt of prompts) {
  await page.fill('[data-testid="text-input"]', prompt);
  await page.click('[data-testid="send-button"]');
  
  const functionCallInfo = await waitForFunctionCall(page, { timeout: 10000 });
  if (functionCallInfo.count > 0) {
    break; // Success!
  }
}
```

### 5. Use More Deterministic Test Patterns

Instead of relying on agent decision-making, test the infrastructure:

**Test What We Control**:
- ✅ Function definitions are correct
- ✅ Handler is invoked when FunctionCallRequest is received
- ✅ Response is sent correctly
- ✅ Tracker increments correctly

**Accept Non-Deterministic Behavior**:
- ⚠️ Agent deciding to call functions (this is LLM behavior)

### 6. Use Test-Specific Agent Instructions

For function calling tests, use more directive instructions:

```javascript
const testAgentOptions = {
  ...baseOptions,
  instructions: 'You are a test assistant. When testing function calling, you MUST use available functions when users ask relevant questions. For time-related questions, always use the get_current_time function.',
  functions: testFunctions
};
```

## Recommended Solutions

### Solution 1: Improve Function Descriptions (Recommended)

Update function descriptions to be more explicit and match common user phrases:

```javascript
{
  name: 'get_current_time',
  description: 'Get the current time in a specific timezone. ALWAYS use this function when users ask: "What time is it?", "What time is it now?", "Tell me the time", "Current time", or any question about time. This function is required for all time-related queries.',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London"). Defaults to UTC if not specified.',
        default: 'UTC'
      }
    }
  }
}
```

### Solution 2: Add Retry Logic with Multiple Prompts

Update failing tests to try multiple prompts:

```javascript
test('should increment function call count when FunctionCallRequest is received', async ({ page }) => {
  // ... setup ...
  
  // Try multiple prompts to increase likelihood of function call
  const prompts = [
    'What time is it?',
    'Tell me the current time',
    'What time is it now?',
    'Please use get_current_time to tell me the time'
  ];
  
  let functionCallInfo = { count: 0 };
  
  for (const prompt of prompts) {
    await page.fill('[data-testid="text-input"]', prompt);
    await page.click('[data-testid="send-button"]');
    await waitForConnection(page, 30000);
    
    functionCallInfo = await waitForFunctionCall(page, { timeout: 15000 });
    if (functionCallInfo.count > 0) {
      break;
    }
    
    // Clear and try next prompt
    await page.fill('[data-testid="text-input"]', '');
  }
  
  expect(functionCallInfo.count).toBeGreaterThan(0);
});
```

### Solution 3: Use Test-Specific Agent Instructions (Best for Determinism)

Modify the test app to use more directive instructions when function calling is enabled:

```javascript
// In App.tsx memoizedAgentOptions
const instructions = enableFunctionCalling 
  ? 'You are a helpful assistant. When users ask questions that match available functions, you MUST use those functions. For example, when users ask about time, always use the get_current_time function.'
  : loadedInstructions || 'You are a helpful voice assistant. Keep your responses concise and informative.';
```

### Solution 4: Make Tests More Tolerant (Accept Flakiness)

If function calling is working (proven by the comprehensive test), make the specific tests more tolerant:

```javascript
test('should increment function call count when FunctionCallRequest is received', async ({ page }) => {
  // ... setup and attempt function call ...
  
  // If function call doesn't happen, that's okay - we test the infrastructure separately
  if (functionCallInfo.count === 0) {
    console.log('⚠️ Function call not triggered by agent - this is expected non-deterministic behavior');
    console.log('✅ Infrastructure is working (verified by comprehensive test)');
    // Test passes - we've verified the infrastructure exists
    return;
  }
  
  // If function call happens, verify it works correctly
  expect(functionCallInfo.count).toBeGreaterThan(0);
});
```

## Deepgram Recommendations

Based on Deepgram Voice Agent API patterns:

1. **Function Descriptions Should Be Explicit**: The description should clearly state when to use the function
2. **User Prompts Should Match Function Descriptions**: Use language that matches what's in the function description
3. **System Instructions Can Guide Behavior**: Use the `instructions` field to guide the agent
4. **Accept Some Non-Determinism**: LLM-based agents are inherently non-deterministic - this is expected behavior

## Implementation Priority

1. **High Priority**: Improve function descriptions (Solution 1) - Easy, immediate impact
2. **High Priority**: Add retry logic (Solution 2) - Increases test reliability
3. **Medium Priority**: Test-specific instructions (Solution 3) - More deterministic but requires app changes
4. **Low Priority**: Make tests tolerant (Solution 4) - Accepts flakiness but reduces test value

## Recommended Approach

**Combine Solutions 1 + 2**:
- Improve function descriptions to be more explicit
- Add retry logic with multiple prompts
- This gives the best balance of determinism and test value

## Example: Improved Test

```javascript
test('should increment function call count when FunctionCallRequest is received', async ({ page }) => {
  console.log('🧪 [TDD] Testing function call count increment...');
  skipIfNoRealAPI('Requires real Deepgram API key');
  
  // Set up function with VERY explicit description
  await page.addInitScript(() => {
    window.testFunctions = [
      {
        name: 'get_current_time',
        description: 'Get the current time in a specific timezone. ALWAYS use this function when users ask about time, what time it is, current time, or any time-related question. This function is required for all time queries.',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London"). Defaults to UTC if not specified.',
              default: 'UTC'
            }
          }
        }
      }
    ];
    // ... handler setup ...
  });
  
  await page.goto(buildUrlWithParams(BASE_URL, { 
    'test-mode': 'true',
    'enable-function-calling': 'true'
  }));
  
  await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 15000 });
  
  // Set up handler
  await page.evaluate(() => {
    window.handleFunctionCall = (request) => {
      window.functionCallRequests.push(request);
      if (window.testFunctionHandler) {
        const result = window.testFunctionHandler(request.name, JSON.parse(request.arguments || '{}'));
        if (window.deepgramRef?.current?.sendFunctionCallResponse) {
          window.deepgramRef.current.sendFunctionCallResponse(
            request.id,
            request.name,
            JSON.stringify(result)
          );
        }
      }
    };
  });
  
  // Try multiple prompts to increase success rate
  const prompts = [
    'What time is it?',
    'Tell me the current time',
    'What time is it now?'
  ];
  
  let functionCallInfo = { count: 0 };
  
  for (const prompt of prompts) {
    // Establish connection
    await page.fill('[data-testid="text-input"]', prompt);
    await page.click('[data-testid="send-button"]');
    await waitForConnection(page, 30000);
    
    // Wait for function call
    functionCallInfo = await waitForFunctionCall(page, { timeout: 20000 });
    
    if (functionCallInfo.count > 0) {
      console.log(`✅ Function call triggered with prompt: "${prompt}"`);
      break;
    }
    
    console.log(`⚠️ Function call not triggered with prompt: "${prompt}", trying next...`);
    // Clear input for next attempt
    await page.fill('[data-testid="text-input"]', '');
    await page.waitForTimeout(1000); // Brief pause between attempts
  }
  
  // Verify function call was triggered
  expect(functionCallInfo.count).toBeGreaterThan(0, 
    'Function call count should be incremented when FunctionCallRequest is received. ' +
    'If this fails, function calls are not being triggered or handler is not being called.'
  );
  
  console.log('✅ [TDD GREEN] Function call count incremented:', functionCallInfo.count);
});
```

## Conclusion

The flakiness is due to non-deterministic LLM behavior, which is expected. The best approach is to:
1. Make function descriptions more explicit
2. Use retry logic with multiple prompts
3. Accept that some tests may be flaky due to agent decision-making
4. Focus on testing infrastructure (handler invocation, response sending) rather than agent decision-making

The comprehensive test passing proves the system works correctly - the flaky tests are testing agent behavior, which is inherently non-deterministic.

