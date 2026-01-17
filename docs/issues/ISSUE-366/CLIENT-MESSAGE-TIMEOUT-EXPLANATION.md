# CLIENT_MESSAGE_TIMEOUT Error Explanation

## What is CLIENT_MESSAGE_TIMEOUT?

`CLIENT_MESSAGE_TIMEOUT` is an error sent by Deepgram's server when it's waiting for a message from the client and doesn't receive one within the timeout period.

## When Does It Occur?

### Scenario 1: Function Call Response Timeout
**Most Common Cause**

1. Agent sends a `FunctionCallRequest` to the client
2. Client's `onFunctionCallRequest` handler is called
3. Handler doesn't send a response (bug or intentional)
4. Deepgram waits for response (~60 seconds)
5. Deepgram times out and sends `CLIENT_MESSAGE_TIMEOUT` error

**Example:**
```typescript
// Buggy handler - doesn't respond
onFunctionCallRequest={(request, sendResponse) => {
  // Forgot to call sendResponse()!
  console.log('Function called but not responding');
}}
```

### Scenario 2: Server Idle Timeout
**Less Common**

1. Connection is established and idle
2. Component's idle timeout (10s) usually fires first and closes connection cleanly
3. **BUT** if component's timeout doesn't fire (bug) or Deepgram's timeout is shorter:
   - Deepgram's server timeout (~60s) fires
   - Deepgram sends `CLIENT_MESSAGE_TIMEOUT` before closing

### Scenario 3: listenModel Bug (Fixed in v0.6.9)
**Historical - No Longer Occurs**

1. Component incorrectly included `listen` provider in Settings even when `listenModel` was omitted
2. Deepgram expected audio messages
3. Client sent text messages instead
4. Deepgram timed out waiting for audio → `CLIENT_MESSAGE_TIMEOUT`

**Fixed by:** Issue #299 - Component now only includes `listen` provider when `listenModel` is explicitly provided.

## Original Error Message (Misleading)

Deepgram's original error message:
```
"We did not receive audio within our timeout. Please make sure you are sending binary messages containing user speech."
```

**Why it's misleading:**
- Says "audio" even when Deepgram is expecting text (text-only mode)
- Says "binary messages" even when text messages are valid
- Doesn't explain it can occur during idle timeouts or function call timeouts
- Makes developers think text messages aren't supported

## Our Improved Error Message

```
"No message was received within the timeout period. This may occur if the connection is idle for too long or if there is a network issue."
```

**Why it's better:**
- Doesn't specify message type (audio/text/function response)
- Explains it can occur during idle timeouts
- More accurate and less confusing

## Tests

### Current Tests

#### 1. Unit Test (Simulated)
**File:** `tests/listen-model-conditional.test.tsx`

- **Type:** Unit test with mocked WebSocket
- **What it does:** Simulates the error being received from Deepgram
- **Purpose:** Verifies component handles the error gracefully
- **Limitation:** Doesn't actually trigger the error from Deepgram

```typescript
// Simulates CLIENT_MESSAGE_TIMEOUT error
eventListener({
  type: 'message',
  data: {
    type: 'Error',
    code: 'CLIENT_MESSAGE_TIMEOUT',
    description: 'We did not receive audio within our timeout...'
  }
});
```

#### 2. E2E Test (Proposed)
**File:** `test-app/tests/e2e/client-message-timeout.spec.js`

- **Type:** E2E test with real Deepgram API
- **What it does:** Actually triggers the error from Deepgram
- **Scenarios:**
  1. Function call handler doesn't respond → triggers timeout
  2. Server idle timeout (harder to test reliably)

**How to trigger:**
```javascript
// Register function that doesn't respond
onFunctionCallRequest: async (request, sendResponse) => {
  // Intentionally NOT calling sendResponse()
  // This will cause Deepgram to timeout and send CLIENT_MESSAGE_TIMEOUT
}
```

### Test Status

- ✅ **Unit test exists** - Verifies error handling
- ⚠️ **E2E test proposed** - Would actually trigger error from Deepgram
- ❌ **No E2E test currently** - We don't have a test that actually produces the error

## How to Write a Test That Produces It

### Option 1: Function Call Timeout (Most Reliable)

```javascript
test('should receive CLIENT_MESSAGE_TIMEOUT when function handler does not respond', async ({ page }) => {
  // 1. Set up component with function that doesn't respond
  await setupTestPage(page, {
    onFunctionCallRequest: async (request, sendResponse) => {
      // Intentionally NOT calling sendResponse()
      console.log('Function called but not responding');
    }
  });
  
  // 2. Establish connection
  await establishConnectionViaText(page);
  
  // 3. Send message that triggers function call
  await sendTextMessage(page, 'Call the test function');
  
  // 4. Wait for CLIENT_MESSAGE_TIMEOUT (~60 seconds)
  // Monitor console logs for the error
  // Verify error message was transformed correctly
});
```

### Option 2: Server Idle Timeout (Less Reliable)

```javascript
test('should receive CLIENT_MESSAGE_TIMEOUT from server idle timeout', async ({ page }) => {
  // 1. Establish connection
  await establishConnectionViaText(page);
  
  // 2. Disable component's idle timeout (if possible)
  // OR wait longer than component timeout
  
  // 3. Wait for Deepgram's server timeout (~60s)
  // This is harder because component usually closes first
});
```

## Why We Don't Have an E2E Test Yet

1. **Requires real API** - Needs actual Deepgram API key
2. **Slow** - Must wait ~60 seconds for timeout
3. **Unreliable** - Timing can vary, component timeout may fire first
4. **Hard to trigger** - Need specific conditions (function call or server timeout)

## Recommendations

1. **Keep unit test** - Verifies error handling works
2. **Add E2E test** - Documents how to trigger the error (even if flaky)
3. **Document scenarios** - This document explains when it occurs
4. **Monitor in production** - Real-world usage will show if it occurs

## Related Issues

- **Issue #365**: Initial fix for misleading error message
- **Issue #366**: Improved error message and debug-level logging
- **Issue #299**: Fixed listenModel bug that caused timeouts
- **Issue #355**: Function call response guarantee (prevents timeouts)
