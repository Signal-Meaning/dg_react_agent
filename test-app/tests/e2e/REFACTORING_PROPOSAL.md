# E2E Test Refactoring Proposal

## Current State Analysis

**Achievement**: All 44/44 test files passing (100% pass rate) ✅

**Current Fixtures:**
- `fixtures/audio-helpers.js`: `loadAndSendAudioSample()`, `waitForVADEvents()`
- `fixtures/idle-timeout-helpers.js`: `waitForIdleTimeout()`, `verifyIdleTimeoutTiming()`, `monitorConnectionStatus()`
- `helpers/test-helpers.js`: Comprehensive helpers (microphone, connection, text, etc.)
- `helpers/microphone-helpers.js`: Microphone activation utilities

## Refactoring Opportunities

### 1. Common VAD State Checking Pattern ⭐ HIGH PRIORITY

**Current Problem:**
Repeated pattern across many test files:
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
```

**Proposed Solution:**
Create `getVADState()` fixture in `fixtures/vad-helpers.js`:
```javascript
/**
 * Get current VAD state from DOM elements
 * @param {import('@playwright/test').Page} page
 * @param {Array<string>} eventTypes - Events to check (default: ['UserStartedSpeaking', 'UtteranceEnd'])
 * @returns {Promise<Object>} Object with event states { userStartedSpeaking, utteranceEnd, userStoppedSpeaking }
 */
export async function getVADState(page, eventTypes = ['UserStartedSpeaking', 'UtteranceEnd']) {
  return await page.evaluate((events) => {
    const state = {};
    
    const selectors = {
      UserStartedSpeaking: '[data-testid="user-started-speaking"]',
      UtteranceEnd: '[data-testid="utterance-end"]',
      UserStoppedSpeaking: '[data-testid="user-stopped-speaking"]'
    };
    
    for (const eventType of events) {
      const selector = selectors[eventType];
      if (!selector) continue;
      
      const el = document.querySelector(selector);
      const value = el?.textContent?.trim();
      state[eventType] = value && value !== 'Not detected' ? value : null;
    }
    
    return state;
  }, eventTypes);
}
```

**Files Affected:** ~8 test files (vad-events-core, vad-transcript-analysis, user-stopped-speaking-demonstration, etc.)

**Benefits:**
- Reduces code duplication
- Consistent VAD state checking
- Single source of truth for selectors
- Easier to update if DOM changes

---

### 2. Agent Response Validation Pattern ⭐ HIGH PRIORITY

**Current Problem:**
Repeated pattern checking agent response:
```javascript
const agentResponse = await page.locator('[data-testid="agent-response"]').textContent();
expect(agentResponse).toBeTruthy();
expect(agentResponse).not.toBe('(Waiting for agent response...)');
```

**Proposed Solution:**
Create `waitForAgentResponse()` and `verifyAgentResponse()` fixtures:
```javascript
/**
 * Wait for agent response and return the response text
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {number} options.timeout - Timeout in ms (default: 15000)
 * @returns {Promise<string>} Agent response text
 */
export async function waitForAgentResponse(page, options = {}) {
  const { timeout = 15000 } = options;
  
  await page.waitForFunction(() => {
    const response = document.querySelector('[data-testid="agent-response"]');
    return response && response.textContent && 
           response.textContent !== '(Waiting for agent response...)';
  }, { timeout });
  
  return await page.locator('[data-testid="agent-response"]').textContent();
}

/**
 * Verify agent response is valid (non-empty, not waiting)
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @returns {Promise<string>} Agent response text
 */
export async function verifyAgentResponse(page, expect) {
  const response = await page.locator('[data-testid="agent-response"]').textContent();
  expect(response).toBeTruthy();
  expect(response).not.toBe('(Waiting for agent response...)');
  return response;
}
```

**Files Affected:** ~15 test files

**Benefits:**
- Standardized agent response checking
- Clearer test intent
- Easier to update if response format changes

---

### 3. Enhanced VAD Event Assertion Helper ⭐ MEDIUM PRIORITY

**Current Problem:**
Multiple tests check for VAD events with lenient logic:
```javascript
const hasAnyVADEvent = !!userStartedSpeaking || !!utteranceEnd;
expect(hasAnyVADEvent).toBe(true);
```

**Proposed Solution:**
Enhance `waitForVADEvents()` to return structured data and add assertion helper:
```javascript
/**
 * Assert that VAD events were detected (lenient - requires at least one)
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {Array<string>} eventTypes - Events to check
 * @param {Object} options
 * @param {boolean} options.requireAll - Require all events (default: false)
 * @returns {Promise<Object>} Detected events object
 */
export async function assertVADEventsDetected(page, expect, eventTypes = ['UserStartedSpeaking', 'UtteranceEnd'], options = {}) {
  const { requireAll = false } = options;
  const state = await getVADState(page, eventTypes);
  
  if (requireAll) {
    for (const eventType of eventTypes) {
      expect(state[eventType]).toBeTruthy();
    }
  } else {
    const hasAnyEvent = eventTypes.some(eventType => state[eventType]);
    expect(hasAnyEvent).toBe(true);
  }
  
  return state;
}
```

**Files Affected:** ~10 test files

**Benefits:**
- Consistent lenient checking pattern
- Configurable strictness
- Clearer test assertions

---

### 4. Connection State Assertion Helper ⭐ MEDIUM PRIORITY

**Current Problem:**
Repeated connection status checking:
```javascript
const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
expect(connectionStatus).toBe('connected');
```

**Proposed Solution:**
Create `assertConnectionState()` fixture:
```javascript
/**
 * Assert connection is in expected state
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Expect} expect
 * @param {string} expectedState - Expected state ('connected', 'closed', 'connecting')
 * @param {number} timeout - Timeout in ms (default: 5000)
 */
export async function assertConnectionState(page, expect, expectedState, timeout = 5000) {
  await page.waitForFunction(
    (state) => {
      const statusEl = document.querySelector('[data-testid="connection-status"]');
      return statusEl?.textContent?.toLowerCase().includes(state.toLowerCase());
    },
    expectedState,
    { timeout }
  );
  
  const actualStatus = await page.locator('[data-testid="connection-status"]').textContent();
  expect(actualStatus.toLowerCase()).toContain(expectedState.toLowerCase());
}
```

**Files Affected:** ~20 test files

**Benefits:**
- Standardized connection checking
- Automatic waiting for state
- Consistent error messages

---

### 5. Test Setup Consolidation ⭐ MEDIUM PRIORITY

**Current Problem:**
Many tests have similar beforeEach patterns:
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

**Proposed Solution:**
Create test setup helper with common patterns:
```javascript
/**
 * Standard test setup for VAD/audio tests
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {boolean} options.skipInCI - Skip in CI (default: true)
 * @param {string} options.skipReason - Reason for skipping (default: 'Requires real API')
 * @param {boolean} options.waitForNetworkIdle - Wait for network idle (default: true)
 */
export async function setupVADTest(page, options = {}) {
  const { skipInCI = true, skipReason = 'Requires real Deepgram API connections', waitForNetworkIdle = true } = options;
  
  if (process.env.CI && skipInCI) {
    test.skip(true, skipReason);
    return;
  }
  
  await setupTestPage(page);
  if (waitForNetworkIdle) {
    await page.waitForLoadState('networkidle');
  }
  await page.waitForSelector('[data-testid="voice-agent"]', { timeout: 10000 });
}
```

**Files Affected:** ~15 test files

**Benefits:**
- Consistent test setup
- Centralized CI skip logic
- Easier to update setup requirements

---

### 6. Agent State Verification Helper ⭐ LOW PRIORITY

**Current Problem:**
Complex agent state checking patterns:
```javascript
await page.waitForFunction(() => {
  const stateElement = document.querySelector('[data-testid="agent-state"]');
  return stateElement && stateElement.textContent?.includes('speaking');
}, { timeout: 10000 });
```

**Proposed Solution:**
Create `waitForAgentState()` and `assertAgentState()` helpers:
```javascript
/**
 * Wait for agent to enter specific state
 * @param {import('@playwright/test').Page} page
 * @param {string|Array<string>} expectedState - Expected state(s) ('idle', 'speaking', 'thinking', etc.)
 * @param {Object} options
 * @param {number} options.timeout - Timeout in ms (default: 10000)
 * @param {boolean} options.matchAny - Match any of the states if array (default: true)
 * @returns {Promise<string>} Actual agent state
 */
export async function waitForAgentState(page, expectedState, options = {}) {
  const { timeout = 10000, matchAny = true } = options;
  const states = Array.isArray(expectedState) ? expectedState : [expectedState];
  
  await page.waitForFunction((stateList, anyMatch) => {
    const stateEl = document.querySelector('[data-testid="agent-state"]');
    if (!stateEl) return false;
    
    const currentState = stateEl.textContent?.toLowerCase() || '';
    if (anyMatch) {
      return stateList.some(state => currentState.includes(state.toLowerCase()));
    }
    return stateList.every(state => currentState.includes(state.toLowerCase()));
  }, states, matchAny, { timeout });
  
  return await page.locator('[data-testid="agent-state"]').textContent();
}
```

**Files Affected:** ~8 test files

**Benefits:**
- Simplified state waiting
- Support for multiple states
- Consistent state checking

---

### 7. Consolidate VAD Test Utilities ⭐ MEDIUM PRIORITY

**Current Problem:**
Some tests import from multiple VAD utility sources:
- `VADTestUtilities` from `../utils/vad-test-utilities.js`
- `SimpleVADHelpers` from `../utils/simple-vad-helpers`
- `VADAudioSimulator` from `../utils/vad-audio-simulator`

**Proposed Solution:**
Create unified VAD test utilities in `fixtures/vad-helpers.js` that consolidates common patterns:
```javascript
/**
 * Unified VAD testing utilities
 * Consolidates patterns from multiple utility sources
 */

export const VADHelpers = {
  // Load and send audio (already in audio-helpers, but could be here too)
  // Wait for events (already in audio-helpers)
  // Get state (new)
  // Assert events (new)
  // Setup VAD test environment (wrapper around existing)
};
```

**Files Affected:** ~5 test files using VAD utilities

**Benefits:**
- Single import for VAD testing
- Clearer API
- Reduced utility file complexity

---

### 8. Text Message Fixtures Enhancement ⭐ LOW PRIORITY

**Current State:**
- `sendTextMessage()` exists
- `sendMessageAndWaitForResponse()` exists (good!)

**Proposed Enhancement:**
Add helper for sending multiple messages:
```javascript
/**
 * Send multiple text messages and wait for responses
 * @param {import('@playwright/test').Page} page
 * @param {Array<string>} messages - Array of messages to send
 * @param {Object} options
 * @param {number} options.delayBetween - Delay between messages in ms (default: 1000)
 * @returns {Promise<Array<string>>} Array of response texts
 */
export async function sendMultipleMessages(page, messages, options = {}) {
  const { delayBetween = 1000 } = options;
  const responses = [];
  
  for (let i = 0; i < messages.length; i++) {
    const response = await sendMessageAndWaitForResponse(page, messages[i]);
    responses.push(response);
    
    if (i < messages.length - 1) {
      await page.waitForTimeout(delayBetween);
    }
  }
  
  return responses;
}
```

**Files Affected:** ~3 test files with message loops

**Benefits:**
- Cleaner multi-message tests
- Consistent delays
- Better error handling

---

### 9. Audio Sample Management ⭐ LOW PRIORITY

**Current State:**
Audio samples are referenced by name string, but no central registry.

**Proposed Solution:**
Create audio sample constants:
```javascript
// fixtures/audio-samples.js
export const AUDIO_SAMPLES = {
  HELLO: 'hello',
  HELLO_THERE: 'hello__how_are_you_today_',
  HELLO_EXTENDED: 'hello_extended',
  // ... etc
};

export const SAMPLE_METADATA = {
  [AUDIO_SAMPLES.HELLO]: {
    phrase: 'Hello',
    duration: 2.0,
    hasSilence: true
  },
  // ... etc
};
```

**Benefits:**
- Type-safe sample references
- Centralized sample information
- Easier to update sample names

---

### 10. Test Organization Improvements ⭐ LOW PRIORITY

**Current Structure:**
All tests in flat `tests/e2e/` directory.

**Proposed Structure:**
```
tests/e2e/
├── core/              # Core functionality tests
│   ├── connection/
│   ├── microphone/
│   └── agent-state/
├── features/          # Feature-specific tests
│   ├── vad/
│   ├── idle-timeout/
│   └── callbacks/
├── integration/       # Integration tests
│   ├── text-session/
│   └── audio-session/
├── fixtures/          # Shared fixtures
├── helpers/          # Helper utilities
└── utils/            # Utility scripts
```

**Benefits:**
- Better organization
- Easier to find related tests
- Clearer test structure

---

## Implementation Priority

### Phase 1: High-Impact, Low-Risk (Implement First)
1. ✅ **Common VAD State Checking** - `getVADState()` fixture
2. ✅ **Agent Response Validation** - `waitForAgentResponse()` and `verifyAgentResponse()`
3. ✅ **Test Setup Consolidation** - `setupVADTest()` helper

### Phase 2: Medium Impact (Implement Next)
4. ✅ **Enhanced VAD Event Assertions** - `assertVADEventsDetected()`
5. ✅ **Connection State Assertions** - `assertConnectionState()`
6. ✅ **Agent State Verification** - `waitForAgentState()` improvements

### Phase 3: Nice-to-Have (Implement When Needed)
7. ✅ **VAD Utilities Consolidation** - Unified VAD helpers
8. ✅ **Text Message Enhancements** - `sendMultipleMessages()`
9. ✅ **Audio Sample Management** - Constants and metadata
10. ✅ **Test Organization** - Directory restructure (optional)

---

## Best Practices Recommendations

### 1. Consistent Error Handling
All fixtures should use try-catch where appropriate and provide clear error messages.

### 2. Timeout Strategy
- Use consistent timeout defaults (5000ms for quick checks, 15000ms for network ops)
- Make timeouts configurable via options object
- Log timeout events for debugging

### 3. Assertion Patterns
- Use lenient assertions for timing-dependent checks (at least one event detected)
- Use strict assertions for critical checks (connection state)
- Provide clear failure messages

### 4. Documentation
- All fixtures should have JSDoc comments
- Include usage examples in fixture files
- Document timeout behavior

### 5. Test Isolation
- Each test should be independent
- Use beforeEach for common setup
- Clean up any global state in afterEach if needed

---

## Migration Strategy

1. **Create new fixtures** alongside existing code
2. **Update 2-3 test files** as proof of concept
3. **Verify tests still pass** after migration
4. **Update remaining tests** gradually
5. **Remove old patterns** once migration complete

---

## Estimated Impact

- **Lines of code reduced**: ~500-800 lines across test files
- **Test maintainability**: Significantly improved
- **Consistency**: All tests follow same patterns
- **New test development**: Faster (reusable fixtures)

---

## Next Steps

1. Review this proposal
2. Prioritize which refactorings to implement
3. Create new fixture files
4. Migrate tests incrementally
5. Update documentation

