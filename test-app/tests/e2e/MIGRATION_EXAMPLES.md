# Migration Examples - VAD Fixtures

This document shows concrete before/after examples of test migrations to use the new VAD fixtures.

## Example 1: VAD State Checking

### Before (Manual Pattern)
```javascript
// 15+ lines of manual state checking
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

// Be lenient - at least one event should be detected
const hasAnyVADEvent = !!userStartedSpeaking || !!utteranceEnd;
expect(hasAnyVADEvent).toBe(true);
```

### After (Using Fixture)
```javascript
import { assertVADEventsDetected } from './fixtures/vad-helpers.js';

// 1 line - same behavior, cleaner code
await assertVADEventsDetected(page, expect, ['UserStartedSpeaking', 'UtteranceEnd']);
```

**Benefits:**
- ✅ 15 lines → 1 line (93% reduction)
- ✅ Consistent behavior across all tests
- ✅ Single source of truth for selectors
- ✅ Easier to update if DOM changes

---

## Example 2: Getting VAD State for Analysis

### Before (Manual Pattern)
```javascript
// 10+ lines of manual state retrieval
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

const detectedVADEvents = [];
if (userStartedSpeaking) detectedVADEvents.push({ type: 'UserStartedSpeaking' });
if (utteranceEnd) detectedVADEvents.push({ type: 'UtteranceEnd' });
```

### After (Using Fixture)
```javascript
import { getVADState } from './fixtures/vad-helpers.js';

// 3 lines - cleaner and more maintainable
const vadState = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd']);

const detectedVADEvents = [];
if (vadState.UserStartedSpeaking) detectedVADEvents.push({ type: 'UserStartedSpeaking' });
if (vadState.UtteranceEnd) detectedVADEvents.push({ type: 'UtteranceEnd' });
```

**Benefits:**
- ✅ 10 lines → 3 lines (70% reduction)
- ✅ Consistent state retrieval pattern
- ✅ Type-safe property access (vadState.UserStartedSpeaking)

---

## Example 3: Test Setup Consolidation

### Before (Manual Pattern)
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

### After (Using Fixture)
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

## Example 4: Agent Response Validation

### Before (Manual Pattern)
```javascript
const agentResponse = await page.locator('[data-testid="agent-response"]').textContent();
expect(agentResponse).toBeTruthy();
expect(agentResponse).not.toBe('(Waiting for agent response...)');
```

### After (Using Fixture)
```javascript
import { verifyAgentResponse } from './helpers/test-helpers.js';

const response = await verifyAgentResponse(page, expect);
```

**Benefits:**
- ✅ Standardized response checking
- ✅ Clearer test intent
- ✅ Single source of truth

---

## Example 5: Connection State Assertion

### Before (Manual Pattern)
```javascript
await page.waitForFunction(() => 
  document.querySelector('[data-testid="connection-status"]')?.textContent === 'connected'
, { timeout: 5000 });

const connectionStatus = await page.locator('[data-testid="connection-status"]').textContent();
expect(connectionStatus).toBe('connected');
```

### After (Using Fixture)
```javascript
import { assertConnectionState } from './helpers/test-helpers.js';

await assertConnectionState(page, expect, 'connected');
```

**Benefits:**
- ✅ Automatic waiting for state
- ✅ Consistent assertion pattern
- ✅ Single line instead of 4

---

## Migration Checklist

When migrating a test file:

- [ ] Import new fixtures at top of file
- [ ] Replace manual VAD state checking with `getVADState()` or `assertVADEventsDetected()`
- [ ] Replace manual agent response checks with `verifyAgentResponse()`
- [ ] Replace connection state checks with `assertConnectionState()`
- [ ] Update test setup to use `setupVADTest()` if applicable
- [ ] Run tests to verify they still pass
- [ ] Remove unused imports

---

## Files Ready for Migration

### High Priority (Most Impact)
1. `vad-audio-patterns.spec.js` - Likely has VAD state checking
2. `vad-configuration-optimization.spec.js` - May have VAD state checking
3. `vad-redundancy-and-agent-timeout.spec.js` - Has agent response checks

### Medium Priority
4. `callback-test.spec.js` - May have VAD state checks
5. `manual-vad-workflow.spec.js` - Likely has VAD state checking
6. Other VAD-related test files

---

## Tips for Migration

1. **Start Small**: Migrate one pattern at a time per file
2. **Test After Each Change**: Run tests after migrating each pattern
3. **Keep It Simple**: Don't over-optimize - the fixtures handle complexity
4. **Document Changes**: Note which patterns were migrated in commit messages

---

## Questions or Issues?

If you encounter issues during migration:
1. Check the fixture documentation in `fixtures/vad-helpers.js`
2. Review existing migrated tests as examples
3. All fixtures are backward compatible - existing code still works

