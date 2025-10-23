# Testing Quick Start Guide

This guide helps new developers quickly understand how to test voice interaction features in the `dg_react_agent` library.

## 🎯 Testing Philosophy: Real First, Then Mock

**Always start with real audio + real Deepgram services, then add mocks for edge cases.**

## 🚀 Quick Start: Testing Voice Features

### 1. Basic Voice Interaction Test

```javascript
import { test, expect } from '@playwright/test';
import { setupTestPage } from './helpers/audio-mocks';
import { VADTestUtilities } from '../utils/vad-test-utilities';
import SimpleVADHelpers from '../utils/simple-vad-helpers';

test('voice interaction works with real audio', async ({ page }) => {
  // Set up test page
  await setupTestPage(page);
  
  // Initialize VAD utilities
  const vadUtils = new VADTestUtilities(page);
  
  // Enable microphone
  await page.click('[data-testid="microphone-button"]');
  
  // Send real audio sample
  await vadUtils.loadAndSendAudioSample('hello');
  
  // Wait for real VAD events
  const vadEvents = await SimpleVADHelpers.waitForVADEvents(page, [
    'SpeechStarted',
    'UtteranceEnd'
  ], 5000);
  
  // Verify events were detected
  expect(vadEvents.length).toBeGreaterThan(0);
});
```

### 2. Testing Idle Timeout Behavior

```javascript
test('idle timeout works correctly', async ({ page }) => {
  const { VADTestUtilities } = require('../utils/vad-test-utilities');
  const vadUtils = new VADTestUtilities(page);
  
  await setupTestPage(page);
  await page.click('[data-testid="microphone-button"]');
  
  // Simulate conversation with real audio
  const samples = ['hello', 'hello__how_are_you_today_', 'hello'];
  
  for (const sample of samples) {
    await vadUtils.loadAndSendAudioSample(sample);
    
    // Wait for VAD events (keeps connection alive)
    await SimpleVADHelpers.waitForVADEvents(page, [
      'SpeechStarted',
      'UtteranceEnd'
    ], 5000);
    
    // Brief pause between samples
    await page.waitForTimeout(1000);
  }
  
  // Verify connection stayed alive
  const status = await page.locator('[data-testid="connection-status"]').textContent();
  expect(status).toBe('connected');
});
```

## 📚 Available Audio Samples

| Sample Name | Duration | Use Case |
|-------------|----------|----------|
| `hello` | ~2.6s | Quick tests, basic functionality |
| `hello__how_are_you_today_` | ~3.8s | Longer conversations, timeout tests |
| `hello_there` | ~2.9s | Medium-length tests |

**Each sample includes:**
- 300ms onset silence
- Actual speech content  
- 2000ms offset silence

## ⚠️ Common Pitfalls

### ❌ Don't Do This
```javascript
// This often fails - synthetic audio doesn't trigger VAD events
await AudioSimulator.simulateSpeech(page, 'hello');
```

### ✅ Do This Instead
```javascript
// This works - real audio samples trigger actual VAD events
await vadUtils.loadAndSendAudioSample('hello');
```

## 🔧 Key Utilities

### VADTestUtilities
- `loadAndSendAudioSample(sampleName)` - Load and send real audio samples
- `analyzeVADEvents()` - Analyze detected VAD events

### SimpleVADHelpers  
- `waitForVADEvents(page, events, timeout)` - Wait for specific VAD events
- `getVADEventCount()` - Count detected events

## 📖 Further Reading

- [TEST-UTILITIES.md](./TEST-UTILITIES.md) - Complete testing infrastructure guide
- [VAD-EVENTS-REFERENCE.md](./VAD-EVENTS-REFERENCE.md) - Deepgram VAD events documentation
- [VAD-EVENTS-AND-TIMEOUT-BEHAVIOR.md](./VAD-EVENTS-AND-TIMEOUT-BEHAVIOR.md) - Timeout behavior details

## 🐛 Troubleshooting

### Test Fails with "No VAD Events Detected"
1. Check you're using `VADTestUtilities.loadAndSendAudioSample()`
2. Verify the sample name exists in `tests/fixtures/audio-samples/`
3. Ensure microphone is enabled before sending audio
4. Increase timeout to account for 2s offset silence

### Test Passes But Real Usage Fails
1. Add more real audio tests
2. Test with different sample combinations
3. Verify timeout behavior with longer conversations
4. Check for race conditions in timeout management

## 🎯 Best Practices

1. **Start with real audio** - Always test the complete integration first
2. **Use existing samples** - Don't generate new ones unless necessary
3. **Test conversation flow** - Use multiple samples with proper timing
4. **Verify VAD events** - Always check that events are actually detected
5. **Account for timing** - Samples have 2s offset silence, use appropriate timeouts
6. **Test edge cases** - Add mock tests for error scenarios after real tests pass
