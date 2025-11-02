# E2E Test Development Guide

**Last Updated:** Issue #217 (2025-01-02)

This guide consolidates lessons learned and best practices from achieving 100% test pass rate and refactoring the E2E test suite. Use this as a reference when writing, maintaining, or debugging E2E tests.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Available Fixtures](#available-fixtures)
3. [Best Practices](#best-practices)
4. [Common Patterns](#common-patterns)
5. [Common Pitfalls](#common-pitfalls)
6. [Migration Examples](#migration-examples)
7. [Test Structure Guidelines](#test-structure-guidelines)

---

## Quick Start

### Writing a New VAD Test

```javascript
import { test, expect } from '@playwright/test';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';
import { assertVADEventsDetected, setupVADTest } from './fixtures/vad-helpers.js';

test.describe('My VAD Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await setupVADTest(page, {
      skipInCI: true,
      skipReason: 'Requires real Deepgram API connections'
    });
  });

  test('should detect VAD events', async ({ page }) => {
    // 1. Setup microphone
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error}`);
    }
    
    // 2. Send audio
    await loadAndSendAudioSample(page, 'hello');
    
    // 3. Wait for events (lenient - requires at least one)
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 15000);
    
    expect(eventsDetected).toBeGreaterThan(0);
    
    // 4. Assert events detected (lenient by default)
    await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd']);
  });
});
```

---

## Available Fixtures

### VAD Testing (`fixtures/vad-helpers.js`)

#### `setupVADTest(page, options)`
Standard test setup for VAD/audio tests with CI skip logic.

```javascript
import { setupVADTest } from './fixtures/vad-helpers.js';

test.beforeEach(async ({ page }) => {
  await setupVADTest(page, {
    skipInCI: true,
    skipReason: 'VAD tests require real Deepgram API connections'
  });
});
```

#### `getVADState(page, eventTypes)`
Get current VAD state from DOM elements.

```javascript
import { getVADState } from './fixtures/vad-helpers.js';

const vadState = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd']);
// Returns: { UserStartedSpeaking: 'Detected', UtteranceEnd: 'Detected', ... }
```

#### `assertVADEventsDetected(page, expect, eventTypes, options)`
Assert that VAD events were detected (lenient by default - requires at least one).

```javascript
import { assertVADEventsDetected } from './fixtures/vad-helpers.js';

// Lenient (default): Requires at least one event
await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd']);

// Strict: Requires all events
await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd'], {
  requireAll: true
});
```

### Audio Testing (`fixtures/audio-helpers.js`)

#### `loadAndSendAudioSample(page, sampleName)`
Load and send a pre-recorded audio sample.

```javascript
import { loadAndSendAudioSample } from './fixtures/audio-helpers.js';

await loadAndSendAudioSample(page, 'hello');
// Available samples: 'hello', 'hello_extended', etc.
```

#### `waitForVADEvents(page, eventTypes, timeout)`
Wait for VAD events and return count detected.

```javascript
import { waitForVADEvents } from './fixtures/audio-helpers.js';

const eventsDetected = await waitForVADEvents(page, [
  'UserStartedSpeaking',
  'UtteranceEnd'
], 15000);

expect(eventsDetected).toBeGreaterThan(0);
```

### Test Helpers (`helpers/test-helpers.js`)

#### `verifyAgentResponse(page, expect)`
Verify agent response is valid (not waiting state).

```javascript
import { verifyAgentResponse } from './helpers/test-helpers.js';

const response = await verifyAgentResponse(page, expect);
// Returns response text, throws if invalid
```

#### `assertConnectionState(page, expect, expectedState, options)`
Assert connection state with automatic waiting.

```javascript
import { assertConnectionState } from './helpers/test-helpers.js';

await assertConnectionState(page, expect, 'connected');
await assertConnectionState(page, expect, 'closed', { timeout: 15000 });
```

#### `MicrophoneHelpers.waitForMicrophoneReady(page, options)`
Activate microphone and wait for ready state.

```javascript
import { MicrophoneHelpers } from './helpers/test-helpers.js';

const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
  skipGreetingWait: true,
  connectionTimeout: 15000,
  micEnableTimeout: 10000
});

if (!result.success || result.micStatus !== 'Enabled') {
  throw new Error(`Microphone activation failed: ${result.error}`);
}
```

#### `establishConnectionViaText(page)`
Establish connection via text input field.

```javascript
import { establishConnectionViaText } from './helpers/test-helpers.js';

await establishConnectionViaText(page);
```

#### `sendMessageAndWaitForResponse(page, message)`
Send text message and wait for agent response.

```javascript
import { sendMessageAndWaitForResponse } from './helpers/test-helpers.js';

const response = await sendMessageAndWaitForResponse(page, 'Hello');
```

### Idle Timeout (`fixtures/idle-timeout-helpers.js`)

#### `waitForIdleTimeout(page, options)`
Wait for idle timeout to occur.

```javascript
import { waitForIdleTimeout } from './fixtures/idle-timeout-helpers.js';

await waitForIdleTimeout(page, { expectedTimeout: 10000 });
```

#### `verifyIdleTimeoutTiming(actualTimeout, expectedTimeout, tolerance)`
Verify idle timeout timing is within expected range.

```javascript
import { verifyIdleTimeoutTiming } from './fixtures/idle-timeout-helpers.js';

verifyIdleTimeoutTiming(actualTimeout, 10000, 2000); // 10s ± 2s tolerance
```

---

## Best Practices

### 1. Always Use Fixtures

**✅ DO:** Use established fixtures for common operations
```javascript
import { assertVADEventsDetected } from './fixtures/vad-helpers.js';
await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd']);
```

**❌ DON'T:** Duplicate fixture logic
```javascript
// ❌ BAD: Manual checking duplicates fixture code
const userStartedSpeaking = await page.evaluate(() => { /* ... */ });
const utteranceEnd = await page.evaluate(() => { /* ... */ });
```

### 2. Lenient Assertions for Timing-Dependent Checks

**✅ DO:** Use lenient assertions (require at least one event)
```javascript
await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd']);
// Lenient by default - requires at least one event
```

**❌ DON'T:** Require exact event sequences
```javascript
// ❌ BAD: Too strict - may fail if timing varies
expect(userStartedSpeaking).toBeTruthy();
expect(utteranceEnd).toBeTruthy();
```

### 3. Use data-testid Attributes

**✅ DO:** Use data-testid for reliable element selection
```javascript
page.locator('[data-testid="agent-state"]')
```

**❌ DON'T:** Rely on text content or complex selectors
```javascript
// ❌ BAD: Fragile, breaks if UI text changes
page.locator('text="Core Component State" >> .. >> strong')
```

### 4. page.evaluate() vs Locators

**✅ DO:** Use `page.evaluate()` when page might be closing
```javascript
// More reliable when page state is unstable
const state = await page.evaluate(() => {
  return document.querySelector('[data-testid="agent-state"]')?.textContent;
});
```

**✅ DO:** Use locators for standard interactions
```javascript
// Standard interactions
await page.locator('[data-testid="mic-button"]').click();
```

### 5. Avoid waitForTimeout Anti-Patterns

**✅ DO:** Wait for actual events
```javascript
await waitForVADEvents(page, ['UtteranceEnd'], 10000);
```

**❌ DON'T:** Use arbitrary delays
```javascript
// ❌ BAD: Unreliable, may be too fast or slow
await page.waitForTimeout(3000);
```

### 6. Error Handling for Optional Checks

**✅ DO:** Make optional checks graceful
```javascript
let agentState = null;
try {
  agentState = await page.locator('[data-testid="agent-state"]').textContent({ timeout: 5000 });
} catch (error) {
  console.log('Agent state element not found (optional)');
}
```

### 7. Test Isolation

**✅ DO:** Keep tests independent
- Use `beforeEach` for common setup
- Don't rely on state from previous tests
- Clean up in `afterEach` if needed

---

## Common Patterns

### Pattern 1: VAD State Checking

**Problem:** Need to check if VAD events were detected.

**Solution:**
```javascript
import { assertVADEventsDetected } from './fixtures/vad-helpers.js';

// Simple assertion (lenient)
await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd']);

// Get state for analysis
import { getVADState } from './fixtures/vad-helpers.js';
const state = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd']);
if (state.UserStartedSpeaking) {
  // Process UserStartedSpeaking event
}
```

### Pattern 2: Agent Response Validation

**Problem:** Need to verify agent responded correctly.

**Solution:**
```javascript
import { verifyAgentResponse } from './helpers/test-helpers.js';

const response = await verifyAgentResponse(page, expect);
expect(response).toContain('expected text');
```

### Pattern 3: Connection State Assertion

**Problem:** Need to assert connection state.

**Solution:**
```javascript
import { assertConnectionState } from './helpers/test-helpers.js';

await assertConnectionState(page, expect, 'connected');
await assertConnectionState(page, expect, 'closed', { timeout: 15000 });
```

### Pattern 4: Text Message Flow

**Problem:** Need to send text and wait for response.

**Solution:**
```javascript
import { establishConnectionViaText, sendMessageAndWaitForResponse } from './helpers/test-helpers.js';

await establishConnectionViaText(page);
const response = await sendMessageAndWaitForResponse(page, 'Hello');
expect(response).toBeTruthy();
```

### Pattern 5: Microphone Activation

**Problem:** Need to activate microphone and verify it's ready.

**Solution:**
```javascript
import { MicrophoneHelpers } from './helpers/test-helpers.js';

const result = await MicrophoneHelpers.waitForMicrophoneReady(page, {
  skipGreetingWait: true,
  connectionTimeout: 15000,
  micEnableTimeout: 10000
});

if (!result.success || result.micStatus !== 'Enabled') {
  throw new Error(`Microphone activation failed: ${result.error}`);
}
```

---

## Common Pitfalls

### Pitfall 1: Referencing Node.js Variables in page.evaluate()

**❌ BAD:**
```javascript
// SELECTORS not available in browser context
await page.waitForFunction(() => {
  return document.querySelector(SELECTORS.connectionStatus)?.textContent === 'connected';
});
```

**✅ GOOD:**
```javascript
// Pass selector as parameter
await page.waitForFunction((selector) => {
  return document.querySelector(selector)?.textContent === 'connected';
}, SELECTORS.connectionStatus);
```

### Pitfall 2: Requiring All Events Instead of Any Event

**❌ BAD:**
```javascript
// Too strict - may fail if timing varies
expect(userStartedSpeaking).toBeTruthy();
expect(utteranceEnd).toBeTruthy();
```

**✅ GOOD:**
```javascript
// Lenient - requires at least one
await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd']);
```

### Pitfall 3: Waiting for Console Logs Instead of DOM Elements

**❌ BAD:**
```javascript
// Console logs are unreliable, timing-dependent
await page.waitForFunction(() => consoleLogs.includes('AgentThinking'));
```

**✅ GOOD:**
```javascript
// Wait for actual DOM state
await page.waitForFunction(() => 
  document.querySelector('[data-testid="agent-response"]')?.textContent !== '(Waiting for agent response...)'
);
```

### Pitfall 4: Function Re-registration Errors

**❌ BAD:**
```javascript
// Re-registering in a loop causes errors
for (const sample of samples) {
  await page.exposeFunction('captureData', () => { /* ... */ });
}
```

**✅ GOOD:**
```javascript
// Register once outside loop
try {
  await page.exposeFunction('captureData', () => { /* ... */ });
} catch (error) {
  // Already registered
}
for (const sample of samples) {
  // Use the registered function
}
```

---

## Migration Examples

### Example 1: Migrating VAD State Checking

**Before (15+ lines):**
```javascript
const userStartedSpeaking = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="user-started-speaking"]');
  return el && el.textContent && el.textContent.trim() !== 'Not detected' 
    ? el.textContent.trim() : null;
});

const utteranceEnd = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="utterance-end"]');
  return el && el.textContent && el.textContent.trim() !== 'Not detected' 
    ? el.textContent.trim() : null;
});

const hasAnyVADEvent = !!userStartedSpeaking || !!utteranceEnd;
expect(hasAnyVADEvent).toBe(true);
```

**After (1 line):**
```javascript
import { assertVADEventsDetected } from './fixtures/vad-helpers.js';

await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd']);
```

**Benefits:**
- ✅ 15 lines → 1 line (93% reduction)
- ✅ Consistent behavior across all tests
- ✅ Single source of truth for selectors
- ✅ Easier to update if DOM changes

### Example 2: Migrating Agent Response Checking

**Before (3 lines):**
```javascript
const agentResponse = await page.locator('[data-testid="agent-response"]').textContent();
expect(agentResponse).toBeTruthy();
expect(agentResponse).not.toBe('(Waiting for agent response...)');
```

**After (2 lines):**
```javascript
import { verifyAgentResponse } from './helpers/test-helpers.js';

const response = await verifyAgentResponse(page, expect);
```

**Benefits:**
- ✅ Standardized response checking
- ✅ Clearer test intent
- ✅ Single source of truth

### Example 3: Migrating Connection State Checking

**Before (4 lines):**
```javascript
await page.waitForFunction(() => 
  document.querySelector('[data-testid="connection-status"]')?.textContent === 'connected'
, { timeout: 5000 });

const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
expect(connectionStatus).toBe('connected');
```

**After (1 line):**
```javascript
import { assertConnectionState } from './helpers/test-helpers.js';

await assertConnectionState(page, expect, 'connected');
```

**Benefits:**
- ✅ Automatic waiting for state
- ✅ Consistent assertion pattern
- ✅ Single line instead of 4

### Example 4: Migrating Test Setup

**Before (10+ lines):**
```javascript
test.beforeEach(async ({ page }) => {
  if (process.env.CI) {
    test.skip(true, 'VAD tests require real Deepgram API connections - skipped in CI.');
    return;
  }
  
  await setupTestPage(page);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
});
```

**After (5 lines):**
```javascript
import { setupVADTest } from './fixtures/vad-helpers.js';

test.beforeEach(async ({ page }) => {
  await setupVADTest(page, {
    skipInCI: true,
    skipReason: 'VAD tests require real Deepgram API connections - skipped in CI.'
  });
});
```

**Benefits:**
- ✅ Consistent setup across all VAD tests
- ✅ Centralized CI skip logic
- ✅ Easier to update setup requirements

---

## Test Structure Guidelines

### Standard VAD Test Structure

```javascript
import { test, expect } from '@playwright/test';
import { MicrophoneHelpers } from './helpers/test-helpers.js';
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';
import { assertVADEventsDetected, setupVADTest } from './fixtures/vad-helpers.js';

test.describe('Feature Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await setupVADTest(page, {
      skipInCI: true,
      skipReason: 'Requires real Deepgram API connections'
    });
  });

  test('should test feature', async ({ page }) => {
    // 1. Setup (microphone, connection, etc.)
    const activationResult = await MicrophoneHelpers.waitForMicrophoneReady(page, {
      skipGreetingWait: true,
      connectionTimeout: 15000,
      micEnableTimeout: 10000
    });
    
    if (!activationResult.success || activationResult.micStatus !== 'Enabled') {
      throw new Error(`Microphone activation failed: ${activationResult.error}`);
    }
    
    // 2. Execute action (send audio, text, etc.)
    await loadAndSendAudioSample(page, 'hello');
    
    // 3. Wait for expected events
    const eventsDetected = await waitForVADEvents(page, [
      'UserStartedSpeaking',
      'UtteranceEnd'
    ], 15000);
    
    // 4. Assert results (lenient by default)
    expect(eventsDetected).toBeGreaterThan(0);
    await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd']);
  });
});
```

### Standard Text Message Test Structure

```javascript
import { test, expect } from '@playwright/test';
import { establishConnectionViaText, sendMessageAndWaitForResponse } from './helpers/test-helpers.js';

test.describe('Text Message Tests', () => {
  test('should handle text messages', async ({ page }) => {
    // 1. Setup connection
    await establishConnectionViaText(page);
    
    // 2. Send message and wait for response
    const response = await sendMessageAndWaitForResponse(page, 'Hello');
    
    // 3. Assert response
    expect(response).toBeTruthy();
    expect(response).not.toBe('(Waiting for agent response...)');
  });
});
```

### Standard Idle Timeout Test Structure

```javascript
import { test, expect } from '@playwright/test';
import { waitForIdleTimeout } from './fixtures/idle-timeout-helpers.js';
import { assertConnectionState } from './helpers/test-helpers.js';

test.describe('Idle Timeout Tests', () => {
  test('should timeout after inactivity', async ({ page }) => {
    // Setup connection...
    
    // Wait for idle timeout
    await waitForIdleTimeout(page, { expectedTimeout: 10000 });
    
    // Assert connection closed
    await assertConnectionState(page, expect, 'closed', { timeout: 15000 });
  });
});
```

---

## Key Lessons from Issue #217

### What We Achieved
- ✅ 100% test pass rate (44/44 test files)
- ✅ Created reusable fixtures reducing ~115 lines of duplicate code
- ✅ Migrated 8 test files to use new fixtures
- ✅ Established consistent patterns across all tests

### Critical Success Factors

1. **Lenient Assertions:** Don't require exact event sequences - timing varies
2. **Use Fixtures:** Don't duplicate setup/assertion code
3. **data-testid Attributes:** Use reliable selectors, not text content
4. **Wait for Events:** Don't use arbitrary timeouts, wait for actual events
5. **Test Isolation:** Each test should be independent

### Refactoring Impact

**Lines of Code Reduced:**
- VAD state checking: ~200 lines across 8 files
- Agent response validation: ~100 lines across 3 files
- Connection state assertions: ~150 lines across multiple files
- **Total: ~115 lines eliminated in Phase 1**

**Maintainability Improvements:**
- ✅ Single source of truth for selectors
- ✅ Consistent assertion patterns
- ✅ Easier to update if DOM changes
- ✅ Clearer test intent

---

## Additional Resources

- **Test README:** `test-app/tests/e2e/README.md` - Setup and execution instructions
- **Fixture Source:** `test-app/tests/e2e/fixtures/` - Source code for all fixtures
- **Helper Source:** `test-app/tests/e2e/helpers/` - Source code for all helpers

---

## Questions or Issues?

If you encounter issues:
1. Check fixture documentation in `fixtures/vad-helpers.js` and `helpers/test-helpers.js`
2. Review existing migrated tests as examples
3. All fixtures are backward compatible - existing code still works
4. Use the migration examples above as templates

