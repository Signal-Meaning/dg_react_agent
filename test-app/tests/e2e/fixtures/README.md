# E2E Test Fixtures - DRY Helpers

This directory contains the **canonical, DRY (Don't Repeat Yourself) implementations** for E2E testing utilities. All tests should use these fixtures instead of duplicate implementations.

## Available Fixtures

### Audio Helpers (`audio-helpers.js`)

**Purpose:** Utilities for loading and sending audio samples, and detecting VAD events.

**Exports:**
- `loadAndSendAudioSample(page, sampleName)` - Load and send an audio sample to the Deepgram component
- `waitForVADEvents(page, eventTypes, timeout)` - Wait for VAD events to be detected by checking data-testid elements

**Usage:**
```javascript
import { loadAndSendAudioSample, waitForVADEvents } from './fixtures/audio-helpers.js';

// Load and send audio sample
await loadAndSendAudioSample(page, 'hello');

// Wait for VAD events (returns count of detected events)
const eventsDetected = await waitForVADEvents(page, [
  'UserStartedSpeaking',
  'UtteranceEnd'
], 15000);
```

### VAD Helpers (`vad-helpers.js`)

**Purpose:** Utilities for VAD state checking and assertions.

**Exports:**
- `setupVADTest(page, options)` - Standard test setup for VAD/audio tests
- `getVADState(page, eventTypes)` - Get current VAD state from DOM elements
- `assertVADEventsDetected(page, expect, eventTypes, options)` - Assert that VAD events were detected

**Usage:**
```javascript
import { getVADState, assertVADEventsDetected } from './fixtures/vad-helpers.js';

// Get current VAD state (returns object with event states)
const vadState = await getVADState(page, ['UserStartedSpeaking', 'UtteranceEnd', 'UserStoppedSpeaking']);

// Assert events were detected
const state = await assertVADEventsDetected(page, expect, ['UtteranceEnd'], { requireAll: true });
```

## Supported VAD Events

The fixtures support the following VAD event types:

- `UserStartedSpeaking` - Detected via `[data-testid="user-started-speaking"]`
- `UtteranceEnd` - Detected via `[data-testid="utterance-end"]`
- `UserStoppedSpeaking` - Detected via `[data-testid="user-stopped-speaking"]`

## Why These Fixtures?

1. **DRY Principle**: Single source of truth for VAD testing utilities
2. **Reliability**: Used by all passing tests, proven to work correctly
3. **Consistency**: Ensures all tests use the same detection logic
4. **Maintainability**: Changes to VAD detection logic only need to be made in one place

## Migration Guide

### Migration Examples

**Using waitForVADEvents and getVADState:**
```javascript
import { waitForVADEvents } from './fixtures/audio-helpers.js';
import { getVADState } from './fixtures/vad-helpers.js';

// Wait for events (returns count)
const eventsDetected = await waitForVADEvents(page, [
  'UserStartedSpeaking',
  'UtteranceEnd'
], 15000);

// Verify final state (more reliable)
const vadState = await getVADState(page, ['UtteranceEnd']);
expect(vadState.UtteranceEnd).toBeTruthy();
```

**Using loadAndSendAudioSample:**
```javascript
import { loadAndSendAudioSample } from './fixtures/audio-helpers.js';

await loadAndSendAudioSample(page, 'hello');
```

## Best Practices

1. **Always use fixtures** for VAD event detection and audio sample loading
2. **Use `getVADState`** for final verification (more reliable than checking arrays)
3. **Use `waitForVADEvents`** for initial detection (returns count)
4. **Combine both** for comprehensive testing:
   ```javascript
   // Wait for events
   const eventsDetected = await waitForVADEvents(page, ['UtteranceEnd'], 15000);
   
   // Verify final state
   const vadState = await getVADState(page, ['UtteranceEnd', 'UserStoppedSpeaking']);
   expect(vadState.UtteranceEnd).toBeTruthy();
   expect(vadState.UserStoppedSpeaking).toBeTruthy();
   ```

## Related Files

- **Audio Helpers:** `test-app/tests/e2e/fixtures/audio-helpers.js`
- **VAD Helpers:** `test-app/tests/e2e/fixtures/vad-helpers.js`
- **Analysis Utilities:** `test-app/tests/utils/vad-test-utilities.js` (for VAD event analysis, not basic detection)

