# VAD Audio Simulation System

This document describes the VAD Audio Simulation System implemented for Issue #93, which provides realistic TTS-based audio simulation for VAD testing.

## Overview

The VAD Audio Simulation System replaces the previous `ArrayBuffer(8192)` simulation with realistic speech patterns that properly trigger VAD events. This system uses the Web Speech API to generate TTS audio with proper silence padding to ensure reliable VAD event triggering.

## Architecture

### Core Components

1. **TTS Generator** (`tests/utils/tts-generator.js`)
   - Web Speech API integration
   - PCM audio format conversion (16kHz, 16-bit, mono)
   - Silence padding for VAD event triggering
   - Configurable audio parameters

2. **VAD Audio Simulator** (`tests/utils/vad-audio-simulator.js`)
   - Speech + silence simulation
   - Audio sample library management
   - Dynamic sample generation and caching
   - Integration with existing test infrastructure

3. **Enhanced Audio Helpers** (`tests/utils/audio-helpers.js`)
   - VAD-specific helper methods
   - Event monitoring utilities
   - Cache management functions

4. **Audio Sample Library** (`tests/fixtures/audio-samples/`)
   - Pre-generated TTS samples
   - Sample configuration file
   - Reusable test patterns

## Key Features

### Multiple Audio Sources
- **TTS Generation**: Web Speech API for dynamic speech generation
- **Pre-recorded Audio**: WAV file support for consistent, high-quality samples
- **Hybrid Approach**: Automatic fallback from WAV to TTS when needed
- **Format Validation**: Automatic audio format validation and conversion

### Advanced Simulation Methods
- **Basic Simulation**: Simple speech + silence patterns
- **Streaming Audio**: Chunk-based streaming for realistic real-time simulation
- **Natural Speech**: Word-by-word generation with natural pauses and variations
- **Conversation Patterns**: Multi-phrase conversation simulation

### VAD Event Triggering
- Initial silence (200-500ms) for proper Deepgram processing
- Speech content with realistic timing
- Ending silence (configurable, default 1000ms) for VAD events
- Pattern: `silence → speech → silence`

### Sample Management
- Pre-generated sample library with 10+ common phrases
- Dynamic sample generation on-demand
- Intelligent caching system for performance
- Configuration-driven samples with metadata
- Audio file validation and format conversion

### Developer Experience
- Easy-to-use helper functions
- Comprehensive test utilities
- Clear documentation and examples
- Setup scripts for quick start
- Universal testing patterns

## Usage Examples

### Basic VAD Test

```javascript
const AudioTestHelpers = require('./utils/audio-helpers');

test('should trigger VAD events with realistic audio', async ({ page }) => {
  // Enable microphone
  await page.click('[data-testid="microphone-button"]');
  
  // Simulate realistic speech
  await AudioTestHelpers.simulateVADSpeech(page, 'Hello, how are you?', {
    silenceDuration: 1000,
    onsetSilence: 300
  });
  
  // Wait for VAD events
  const vadEvents = await AudioTestHelpers.waitForVADEvents(page, [
    'UserStartedSpeaking',
    'UserStoppedSpeaking'
  ]);
  
  expect(vadEvents.length).toBeGreaterThan(0);
});
```

### Using Pre-generated Samples

```javascript
test('should work with audio samples', async ({ page }) => {
  // Use pre-generated sample from library
  await AudioTestHelpers.useAudioSample(page, 'hello');
  
  // Wait for VAD events
  const vadEvents = await AudioTestHelpers.waitForVADEvents(page);
  expect(vadEvents.length).toBeGreaterThan(0);
});
```

### Conversation Patterns

```javascript
test('should handle conversation patterns', async ({ page }) => {
  const phrases = [
    'Hello there',
    'How can you help me?',
    'That sounds good'
  ];
  
  await AudioTestHelpers.simulateVADConversation(page, phrases, {
    pauseBetween: 2000,
    silenceDuration: 1000
  });
});
```

### Dynamic Sample Generation

```javascript
test('should generate custom samples', async ({ page }) => {
  const customPhrase = 'This is a custom test phrase';
  
  await AudioTestHelpers.simulateVADSpeech(page, customPhrase, {
    generateNew: true,
    silenceDuration: 1500
  });
  
  // Sample is now cached for future use
});
```

### Streaming Audio Simulation

```javascript
test('should simulate streaming audio', async ({ page }) => {
  await VADAudioSimulator.simulateStreamingAudio(page, 'Streaming test phrase', {
    chunkSize: 4096,
    chunkInterval: 100,
    silenceDuration: 1000,
    usePreRecorded: true // Try WAV file first, fallback to TTS
  });
});
```

### Natural Speech Simulation

```javascript
test('should simulate natural speech patterns', async ({ page }) => {
  await VADAudioSimulator.simulateNaturalSpeech(page, 'Natural speech with pauses', {
    pauseProbability: 0.3,
    maxPauseDuration: 500,
    silenceDuration: 1000
  });
});
```

### Pre-recorded Audio Usage

```javascript
test('should use pre-recorded audio samples', async ({ page }) => {
  // Place hello.wav in tests/fixtures/audio-samples/
  await VADAudioSimulator.simulateSpeechWithSilence(page, 'hello', {
    sampleName: 'hello',
    usePreRecorded: true // Force WAV file usage
  });
});
```

## Setup and Configuration

### Initial Setup

```bash
# Set up audio sample library
node tests/utils/setup-audio-samples.js

# List available samples
node tests/utils/setup-audio-samples.js --list

# Clean cache
node tests/utils/setup-audio-samples.js --clean
```

### Sample Configuration

Edit `tests/fixtures/audio-samples/samples.json` to add new samples:

```json
{
  "my-sample": {
    "text": "My custom phrase",
    "speechDuration": 2000,
    "onsetSilenceDuration": 300,
    "offsetSilenceDuration": 1000,
    "description": "Custom test sample"
  }
}
```

## Technical Specifications

### Audio Format
- **Sample Rate**: 16kHz (matching AudioManager)
- **Format**: Linear16 PCM (matching Deepgram requirements)
- **Channels**: Mono (1 channel)
- **Bit Depth**: 16-bit
- **Chunk Size**: 4096 samples (matching AudioWorkletProcessor)

### VAD Timing
- **Speech Duration**: 1-3 seconds (configurable)
- **Silence Duration**: 1 second (matching `utterance_end_ms: 1000`)
- **Buffer Size**: 4096 samples per chunk
- **Sample Rate**: 16kHz

### Critical Requirements
- **Initial Silence**: 200-500ms silence at onset is required for proper Deepgram processing
- **Speech Pattern**: Initial silence → Speech content → Ending silence
- **Silence Padding**: Both onset and offset silence are essential for VAD event triggering

## File Structure

```
tests/
├── utils/
│   ├── tts-generator.js          # TTS generation utilities
│   ├── vad-audio-simulator.js    # VAD simulation utilities
│   ├── audio-helpers.js          # Enhanced audio helpers
│   └── setup-audio-samples.js    # Setup script
├── fixtures/
│   └── audio-samples/
│       ├── samples.json          # Sample configuration
│       └── *.wav                 # Generated samples (future)
└── e2e/
    ├── vad-realistic-audio.spec.js  # New VAD tests
    └── vad-*.spec.js                # Updated VAD tests
```

## Migration from ArrayBuffer(8192)

### Before (Legacy)
```javascript
// Old way - empty buffer simulation
await page.evaluate(() => {
  const audioData = new ArrayBuffer(8192);
  deepgramComponent.sendAudioData(audioData);
});
```

### After (Realistic Audio)
```javascript
// New way - realistic TTS audio
await AudioTestHelpers.simulateVADSpeech(page, 'Hello', {
  silenceDuration: 1000,
  onsetSilence: 300
});
```

## Benefits

1. **Realistic Testing**: Uses actual speech content instead of empty buffers
2. **VAD Event Triggering**: Proper speech → silence patterns trigger VAD events
3. **Reusable Library**: Pre-generated samples for consistent testing
4. **Developer Friendly**: Easy to add new samples with tunable parameters
5. **Maintainable**: Centralized audio generation and management
6. **Configurable**: Tunable silence duration for different test scenarios

## Troubleshooting

### Common Issues

1. **Web Speech API not available**
   - Ensure tests run in a browser environment
   - Check browser compatibility

2. **VAD events not triggering**
   - Verify silence padding is sufficient (300ms onset, 1000ms offset)
   - Check audio format matches Deepgram requirements

3. **Sample generation fails**
   - Check TTS voice availability
   - Verify audio context permissions

### Debug Information

```javascript
// Get cache statistics
const stats = AudioTestHelpers.getAudioCacheStats();
console.log('Cache stats:', stats);

// Clear cache if needed
AudioTestHelpers.clearAudioCache();
```

## Future Enhancements

1. **Multiple Voice Options**: Support different TTS voices
2. **Audio Quality Settings**: Configurable sample rates and bit depths
3. **Background Noise**: Add optional background noise simulation
4. **Accent Variations**: Support different speech patterns
5. **Performance Metrics**: Track audio generation and simulation performance

## Related Documentation

- [VAD Events and Timeout Behavior](../docs/VAD-EVENTS-AND-TIMEOUT-BEHAVIOR.md)
- [Issue #44 VAD Events Proposal](../docs/ISSUE-44-VAD-Events-Proposal.md)
- [Issue #38 VAD Events Proposal](../docs/ISSUE-38-VAD-Events-Proposal.md)
- [Playwright Testing Plan](../docs/PLAYWRIGHT_TESTING_PLAN.md)
