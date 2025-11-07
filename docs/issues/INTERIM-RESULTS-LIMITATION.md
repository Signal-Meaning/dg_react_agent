# Interim Results Testing

## Summary

Interim results (transcripts with `is_final: false`) **CAN be reliably tested via real Deepgram APIs** when using the correct approach: **real-time streaming of audio chunks** rather than sending all audio at once.

## Key Findings

1. **✅ Real-Time Streaming Works**: When audio is sent in chunks at real-time intervals (matching the audio's natural playback rate), Deepgram generates interim transcripts consistently. This simulates how real microphone input works.

2. **❌ Bulk Audio Sending Fails**: When pre-recorded audio is sent all at once, Deepgram processes it quickly and typically only sends final transcripts. This is because the service processes the complete buffer before generating results.

3. **✅ Working Test**: `test-app/tests/e2e/vad-transcript-analysis.spec.js` successfully receives interim transcripts using:
   - WAV file with human speech (`shopping-concierge-question.wav`)
   - Real-time streaming (4KB chunks at calculated intervals)
   - Proper PCM extraction from WAV format

## Successful Test Pattern

The working test (`vad-transcript-analysis.spec.js`) demonstrates:

1. **Load WAV file** and extract PCM data (skip WAV header)
2. **Calculate real-time streaming rate**: 16kHz, 16-bit, mono = 32KB/second
3. **Split into chunks**: 4KB chunks (128ms of audio)
4. **Send with intervals**: Calculate chunk interval to match real-time playback
5. **Result**: Receives 3+ interim transcripts before final transcript

### Example Results
```
📝 Total transcripts received: 4
  1. INTERIM | "Can you help"
  2. INTERIM | "Hello. Can you help me find a gift for my"
  3. INTERIM | "Hello. Can you help me find a gift for my friend's birthday?"
  4. FINAL | "Hello. Can you help me find a gift for my friend's birthday?"
```

## Test Files

- ✅ `test-app/tests/e2e/vad-transcript-analysis.spec.js` - **Working test** that successfully receives interim transcripts using real-time streaming
- `test-app/tests/e2e/interim-transcript-validation.spec.js` - Also uses streaming approach for interim transcript validation

## Component Behavior

The component correctly:
- Receives and processes interim transcripts when provided by the API
- Receives and processes final transcripts
- Displays both types in the UI
- Maintains transcript history with proper `is_final` and `speech_final` flags

## Recommendations

For E2E tests requiring interim results:

1. **✅ Use Real-Time Streaming** (Recommended):
   - Load WAV files with human speech
   - Extract PCM data (skip WAV header)
   - Send in 4KB chunks at calculated real-time intervals
   - This reliably produces interim transcripts

2. **Alternative Approaches**:
   - Use mocks for faster unit testing
   - For bulk audio tests, accept that only final transcripts may be received

3. **Best Practices**:
   - Use human speech WAV files (not TTS-generated) for better interim results
   - Stream at real-time rate (16kHz = 32KB/second for 16-bit mono)
   - Wait for transcript count to stabilize before validation

## Implementation Example

See `test-app/tests/e2e/vad-transcript-analysis.spec.js` lines 88-209 for the complete working implementation.

## Related Issues

- Issue #254: Interim transcripts not being reported (resolved - component handles them correctly)
- Issue #255: Microphone button doesn't start transcription service when agent is already connected (resolved)

