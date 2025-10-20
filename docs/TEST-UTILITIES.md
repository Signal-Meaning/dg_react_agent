# Test Utilities Documentation

This document describes the test utilities and infrastructure used for testing the `DeepgramVoiceInteraction` component.

## Overview

The test suite uses a combination of Playwright for end-to-end testing and custom utilities for audio simulation, VAD event detection, and component state verification.

## Audio Testing Infrastructure

### Pre-Generated Audio Samples

The test suite uses pre-generated audio samples created using the [Deepgram TTS REST API](https://developers.deepgram.com/docs/tts-rest) to ensure consistent, realistic audio for VAD testing.

#### Generating Audio Samples

```bash
# Set your Deepgram API key
export DEEPGRAM_API_KEY=your-api-key-here

# Generate all test audio samples
npm run generate-test-audio
```

This creates audio samples in `tests/fixtures/audio-samples/` with the following structure:

```
tests/fixtures/audio-samples/
├── index.json                    # Index of all samples
├── sample_hello.json            # Individual sample files
├── sample_hello_there.json
└── ...
```

#### Audio Sample Format

Each sample file contains:

```json
{
  "phrase": "Hello, how are you today?",
  "audioData": "base64-encoded-audio-data",
  "metadata": {
    "phrase": "Hello, how are you today?",
    "sampleRate": 16000,
    "channels": 1,
    "encoding": "linear16",
    "voice": "aura-2-apollo-en",
    "model": "aura-2",
    "totalDuration": 3.8,
    "onsetSilence": 300,
    "offsetSilence": 1000,
    "totalSamples": 60800,
    "onsetSamples": 4800,
    "speechSamples": 40000,
    "offsetSamples": 16000
  }
}
```

#### Audio Configuration

- **Voice**: `aura-2-apollo-en` (Deepgram's Aura-2 Apollo voice)
- **Model**: `aura-2` (Deepgram's latest TTS model)
- **Encoding**: `linear16` (16-bit PCM)
- **Sample Rate**: 16000 Hz
- **Channels**: 1 (mono)
- **Onset Silence**: 300ms (before speech)
- **Offset Silence**: 1000ms (after speech)

### Audio Simulator (`tests/utils/audio-simulator.js`)

The `AudioSimulator` class manages audio sample loading and caching for tests.

#### Key Methods

- `generateAndCacheSample(phrase, silenceMs)` - Loads pre-generated audio sample
- `loadPreGeneratedSample(phrase)` - Fetches sample from fixtures
- `createSimpleAudioPattern(phrase, silenceMs)` - Creates basic audio pattern (fallback)

#### Usage

```javascript
// Load a pre-generated sample
const audioData = await AudioSimulator.generateAndCacheSample('Hello', 1000);

// Simulate speech with audio
await AudioSimulator.simulateSpeech(page, 'Hello, how are you today?', {
  silenceDuration: 1000,
  onsetSilence: 300
});
```

## VAD Event Testing

### VAD Event Detection (`tests/utils/audio-helpers.js`)

The `AudioTestHelpers` class provides utilities for detecting and monitoring VAD events during tests.

#### Supported Event Types

- `UserStartedSpeaking` - From Deepgram Agent API
- `UserStoppedSpeaking` - From Deepgram Agent API  
- `SpeechStarted` - From Deepgram Transcription API ✅ **REAL EVENT**
- `UtteranceEnd` - From Deepgram Transcription API ✅ **REAL EVENT**
- `VADEvent` - Legacy VAD events
- ~~`SpeechStopped`~~ - ❌ **DOES NOT EXIST** (fictional event)

#### Key Methods

- `waitForVADEvents(page, expectedEvents, timeout)` - Waits for specific VAD events
- `simulateVADSpeech(page, phrase, options)` - Simulates speech and waits for VAD events
- `simulateConversation(page, phrases, options)` - Simulates multi-turn conversations

#### Usage

```javascript
// Wait for VAD events
const vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
  'UserStartedSpeaking',
  'UserStoppedSpeaking',
  'SpeechStarted', 
  'UtteranceEnd'  // Use UtteranceEnd instead of fictional SpeechStopped
], 5000);

// Simulate speech and detect events
await AudioTestHelpers.simulateVADSpeech(page, 'Hello there', {
  silenceDuration: 1000,
  onsetSilence: 300
});
```

## Component State Testing

### Debug Methods

The component exposes debug methods via `useImperativeHandle` for test inspection:

- `getConnectionStates()` - Returns connection states for all services
- `getState()` - Returns current component state

#### Usage

```javascript
// Get connection states
const connectionStates = await page.evaluate(() => {
  return window.deepgramRef.current?.getConnectionStates();
});

// Get component state  
const componentState = await page.evaluate(() => {
  return window.deepgramRef.current?.getState();
});
```

## Test Configuration

### Playwright Configuration

Tests are configured in `playwright.config.js`:

- **Base URL**: `http://localhost:5173` (Vite dev server)
- **Test Directory**: `tests/e2e/`
- **Fixtures**: Served from `tests/fixtures/` via Vite public directory
- **Retries**: 2 on CI, 0 locally
- **Workers**: 1 on CI, parallel locally

### Environment Variables

Required for audio generation:

- `DEEPGRAM_API_KEY` - Deepgram API key for TTS generation

Required for component testing:

- `VITE_DEEPGRAM_API_KEY` - Deepgram API key for component
- `VITE_DEEPGRAM_PROJECT_ID` - Deepgram project ID

## Test Patterns

### VAD Event Testing Pattern

```javascript
test('should trigger VAD events', async ({ page }) => {
  // Enable microphone
  await page.click('[data-testid="microphone-button"]');
  
  // Wait for connection
  await expect(page.locator('[data-testid="connection-status"]'))
    .toContainText('connected', { timeout: 10000 });
  
  // Simulate speech
  await AudioTestHelpers.simulateVADSpeech(page, 'Hello there', {
    silenceDuration: 1000,
    onsetSilence: 300
  });
  
  // Wait for VAD events
  const vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
    'UserStartedSpeaking',
    'UserStoppedSpeaking',
    'SpeechStarted',
    'UtteranceEnd'  // Use UtteranceEnd instead of fictional SpeechStopped
  ], 5000);
  
  // Verify events
  expect(vadEvents.length).toBeGreaterThan(0);
  const eventTypes = vadEvents.map(event => event.type);
  const hasStartedEvent = eventTypes.some(type => 
    type === 'UserStartedSpeaking' || type === 'SpeechStarted'
  );
  const hasStoppedEvent = eventTypes.some(type => 
    type === 'UserStoppedSpeaking' || type === 'UtteranceEnd'
  );
  
  expect(hasStartedEvent).toBe(true);
  expect(hasStoppedEvent).toBe(true);
});
```

### Component State Verification Pattern

```javascript
test('should maintain correct component state', async ({ page }) => {
  // Get initial state
  const initialState = await page.evaluate(() => {
    return window.deepgramRef.current?.getState();
  });
  
  // Perform actions
  await page.click('[data-testid="microphone-button"]');
  
  // Verify state changes
  const updatedState = await page.evaluate(() => {
    return window.deepgramRef.current?.getState();
  });
  
  expect(updatedState.isRecording).toBe(true);
});
```

## Troubleshooting

### Audio Sample Issues

**Problem**: Tests fail with "Pre-generated audio sample not found"

**Solution**: Run `npm run generate-test-audio` to generate samples

**Problem**: TTS generation fails

**Solution**: Ensure `DEEPGRAM_API_KEY` is set and valid

### VAD Event Issues

**Problem**: VAD events not detected

**Solution**: 
1. Check that `vad_events: true` is set in transcription options
2. Verify microphone is enabled
3. Check console logs for VAD event messages

**Problem**: Function re-registration errors

**Solution**: The test utilities handle this automatically with try-catch blocks

### Connection Issues

**Problem**: Component fails to connect

**Solution**:
1. Verify API key and project ID are set
2. Check network connectivity
3. Review component initialization logs

## Best Practices

1. **Use Pre-Generated Samples**: Always use pre-generated audio samples for consistent testing
2. **Fail Fast**: No fallbacks - tests should fail if audio samples are missing
3. **Monitor VAD Events**: Use both agent and transcription VAD events for comprehensive testing
4. **Verify State Changes**: Always verify component state changes after actions
5. **Use Realistic Audio**: Pre-generated samples provide more realistic VAD testing than synthetic patterns
6. **Document Test Patterns**: Follow established patterns for consistency across tests
7. **Use Shared Utilities**: Always use `VADTestUtilities` class for VAD testing
8. **Lift Constants**: Use `VAD_TEST_CONSTANTS` for timing and configuration values
9. **DRY Principles**: Avoid code duplication by using shared validation functions
10. **Return Results**: Validation functions should return results, not call `expect` directly

## VAD Test Utilities (Issue #96 Resolution)

### Overview
The VAD test utilities provide a comprehensive, DRY implementation for testing Voice Activity Detection functionality. These utilities consolidate common patterns and eliminate code duplication across VAD tests.

### VADTestUtilities Class
Located in `tests/utils/vad-test-utilities.js`, this class provides:

#### Core Methods
- `loadAndSendAudioSample(sampleName)` - Load and send pre-recorded audio samples
- `analyzeVADEvents()` - Analyze captured VAD events (SpeechStarted, UtteranceEnd, UserStoppedSpeaking)
- `analyzeTiming()` - Analyze timing information from VAD events
- `analyzeAgentStateChanges()` - Analyze agent state transitions and timeout behavior

#### Validation Functions
- `validateVADSignalRedundancy(vadAnalysis)` - Validate multiple VAD signals for same event
- `validateAgentStateTimeoutBehavior(agentAnalysis)` - Validate agent state timeout behavior
- `validateIdleTimeoutStateMachine(agentAnalysis)` - Validate idle timeout state machine consistency

### Constants Configuration
```javascript
const VAD_TEST_CONSTANTS = {
  DEFAULT_AUDIO_SAMPLE: 'hello__how_are_you_today_',
  VAD_EVENT_WAIT_MS: 3000,
  AGENT_PROCESSING_WAIT_MS: 2000,
  NATURAL_TIMEOUT_WAIT_MS: 11000,
  CONNECTION_TIMEOUT_MS: 10000,
  SIGNAL_CONFLICT_THRESHOLD_MS: 1000,
  TOTAL_SILENCE_DURATION_SECONDS: 2.0
};
```

### Usage Example
```javascript
const { VADTestUtilities, VAD_TEST_CONSTANTS } = require('../utils/vad-test-utilities');

test('VAD test example', async ({ page }) => {
  const vadUtils = new VADTestUtilities(page);
  
  // Load and send audio sample
  await vadUtils.loadAndSendAudioSample(VAD_TEST_CONSTANTS.DEFAULT_AUDIO_SAMPLE);
  
  // Wait for VAD events
  await waitForVADEvents(page, VAD_TEST_CONSTANTS.VAD_EVENT_WAIT_MS);
  
  // Analyze events
  const vadAnalysis = vadUtils.analyzeVADEvents();
  vadUtils.analyzeTiming();
  
  // Validate results
  const validationResults = validateVADSignalRedundancy(vadAnalysis);
  expect(validationResults.hasMultipleSignals).toBe(true);
});
```

### Key Benefits
- **DRY Implementation**: No code duplication across VAD tests
- **Consistent Patterns**: All VAD tests follow same approach
- **Maintainable**: Easy to update constants and patterns in one place
- **Real VAD Testing**: Uses actual Deepgram API integration with pre-recorded audio
- **Comprehensive Coverage**: Tests VAD signal redundancy, agent state transitions, and timeout behavior

## Related Documentation

- [VAD Events Reference](VAD-EVENTS-REFERENCE.md) - Complete reference for Deepgram VAD events
- [VAD Events and Timeout Behavior](VAD-EVENTS-AND-TIMEOUT-BEHAVIOR.md) - VAD event handling patterns
- [Playwright Testing Plan](PLAYWRIGHT_TESTING_PLAN.md) - Overall testing strategy
- [VAD Test Status Report](VAD-TEST-STATUS-REPORT.md) - Current status of VAD testing implementation
