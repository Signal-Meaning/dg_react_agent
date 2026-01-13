# Issue #362: Test Comparison - Context Retention Tests

**Date**: January 12, 2026  
**Purpose**: Compare the two context retention tests to understand their differences

---

## Tests Compared

1. **`context-retention-agent-usage.spec.js`** - Original test (no function calling)
2. **`context-retention-with-function-calling.spec.js`** - New test (with function calling)

---

## Key Differences

### 1. **Function Calling Setup**

**Original Test** (`context-retention-agent-usage.spec.js`):
- ❌ **No function calling** - Tests context retention in isolation
- ❌ No function definitions
- ❌ No function handlers
- ❌ No function call waiting logic

**New Test** (`context-retention-with-function-calling.spec.js`):
- ✅ **Function calling enabled** - Tests context retention WITH function calling
- ✅ Defines `search_products` function (similar to customer's app)
- ✅ Sets up function handler (`window.handleFunctionCall`)
- ✅ Waits for function call to execute (`waitForFunctionCall`)
- ✅ Verifies function call was triggered

**Code Difference**:
```javascript
// New test adds:
await page.addInitScript(() => {
  window.testFunctions = [{ name: 'search_products', ... }];
  window.handleFunctionCall = (request, sendResponse) => { ... };
});
```

---

### 2. **Connection Setup**

**Original Test**:
```javascript
await setupTestPage(page);
await establishConnectionViaText(page);
```

**New Test**:
```javascript
await setupTestPage(page, {
  'enable-function-calling': 'true'  // ← Adds function calling URL param
});
await establishConnectionViaText(page);
```

---

### 3. **Message Processing Flow**

**Original Test**:
1. Send message: "I am looking for running shoes"
2. Wait for agent response (direct response, no function call)
3. Continue with disconnect/reconnect

**New Test**:
1. Send message: "I am looking for running shoes"
2. **Wait for function call to be triggered** ← NEW
3. **Wait for function call to execute** ← NEW
4. Wait for agent response (response after function call)
5. Continue with disconnect/reconnect

**Code Difference**:
```javascript
// New test adds:
let functionCallDetected = false;
try {
  const functionCallResult = await waitForFunctionCall(page, { timeout: 30000 });
  if (functionCallResult && functionCallResult.count > 0) {
    functionCallDetected = true;
  }
} catch (e) {
  console.log('⚠️  No function call detected...');
}
```

---

### 4. **Settings Verification**

**Original Test**:
- ✅ Verifies context is sent
- ✅ Verifies greeting is NOT included
- ❌ Does NOT verify functions are included

**New Test**:
- ✅ Verifies context is sent
- ✅ Verifies greeting is NOT included
- ✅ **Verifies functions are still included** ← NEW
- ✅ **Verifies function count** ← NEW

**Code Difference**:
```javascript
// New test adds:
expect(settings.agent.think.functions).toBeDefined();
expect(settings.agent.think.functions.length).toBeGreaterThan(0);
console.log('✅ Functions verified in Settings message');
```

---

### 5. **Error Messages**

**Original Test**:
- Error messages mention "context not being used"
- Generic error about context retention

**New Test**:
- Error messages mention **"with function calling"**
- Specifically notes: **"This suggests function calling may interfere with context processing"**

**Code Difference**:
```javascript
// New test error messages:
throw new Error(
  `Agent response does not reference previous conversation (with function calling). ` +
  `...` +
  `This suggests function calling may interfere with context processing.`
);
```

---

### 6. **Test Purpose**

**Original Test**:
- Tests context retention in **baseline scenario** (no function calling)
- Purpose: Verify agent uses context after reconnection
- Status: **Flaky** (sometimes passes, sometimes fails)

**New Test**:
- Tests context retention in **function calling scenario** (matches customer's app)
- Purpose: Verify if function calling interferes with context processing
- Expected: Should help identify if function calling causes consistent failure

---

## Summary Table

| Feature | Original Test | New Test |
|---------|--------------|----------|
| **Function Calling** | ❌ No | ✅ Yes (`search_products`) |
| **Function Setup** | ❌ None | ✅ `addInitScript` with functions |
| **Function Handler** | ❌ None | ✅ `window.handleFunctionCall` |
| **Wait for Function Call** | ❌ No | ✅ Yes (`waitForFunctionCall`) |
| **Verify Functions in Settings** | ❌ No | ✅ Yes |
| **Error Messages** | Generic | Mentions "with function calling" |
| **Matches Customer's App** | ❌ No (no function calling) | ✅ Yes (has function calling) |
| **Test Purpose** | Baseline context retention | Test function calling interference |

---

## Why This Matters

### Customer's Scenario
- ✅ Has function calling (`search_products`)
- ✅ Test fails **consistently** (not flaky)
- ✅ Agent says "I'm unable to recall previous conversations"

### Original Test
- ❌ No function calling
- ⚠️ Test is **flaky** (sometimes passes, sometimes fails)
- ⚠️ Different failure mode

### New Test
- ✅ Has function calling (matches customer)
- ✅ Should help identify if function calling causes consistent failure
- ✅ Tests the hypothesis: "Function calling interferes with context processing"

---

## Expected Results

**If function calling interferes with context**:
- ✅ New test should **FAIL consistently** (like customer's test)
- ✅ Original test remains flaky (no function calling)

**If function calling doesn't interfere**:
- ✅ New test should **PASS** (context works with function calling)
- ✅ Original test remains flaky (different issue)

---

## Conclusion

The new test is **essentially the same as the original**, but **adds function calling** to match the customer's scenario. This should help us determine if function calling is the factor causing the consistent failure.

**Key Addition**: Function calling setup and verification, which is the main difference between the two tests.

---

**End of Test Comparison**
