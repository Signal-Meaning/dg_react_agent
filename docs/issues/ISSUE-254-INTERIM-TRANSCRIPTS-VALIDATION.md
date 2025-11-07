# Issue 254: Interim Transcripts Not Being Reported

## Problem Statement

The voice-commerce team reported that interim transcripts are not being received/reported by the component. Users expect to see interim (non-final) transcripts as speech is being processed, before the final transcript is delivered.

## Evidence

### Test Results
- **Test File**: `test-app/tests/e2e/interim-transcript-validation.spec.js`
- **Test Result**: FAILING
- **Finding**: Only final transcripts are being received; no interim transcripts detected

### Test Report Details
From Playwright test report:
```
Event log debug info: {
  "totalLines": 28,
  "transcriptLinesFound": 1,
  "sampleTranscriptLines": ["22:51:37 - [TRANSCRIPT] \"Hello?\" (final)"],
  "allTranscriptLines": ["22:51:37 - [TRANSCRIPT] \"Hello?\" (final)"]
}

📊 === TRANSCRIPT VALIDATION ===
📝 Total transcripts received: 1
📝 Final transcripts: 1
📝 Interim transcripts: 0
```

### Key Observations
1. **Server is receiving audio**: The test successfully sends fake audio and receives matching transcripts
2. **Transcription is working**: Final transcripts are correctly matched to the audio sent
3. **Interim transcripts are missing**: No interim transcripts appear in the event log, only final transcripts

## Test Implementation

### Test Approach
Created a validation test that:
1. Uses fake audio samples (pre-recorded TTS audio) via `loadAndSendAudioSample()`
2. Uses the **longest available utterance** to maximize chances of receiving interim transcripts
3. Parses the DOM event log to extract transcript entries with `is_final` property
4. Validates that both interim and final transcripts are received
5. Validates that interim transcripts arrive before final transcripts

### Test File
- **Location**: `test-app/tests/e2e/interim-transcript-validation.spec.js`
- **Pattern**: Uses `setupAudioSendingPrerequisites()` helper (same pattern as passing callback tests)
- **Audio Sample**: Uses longest available sample (`this_is_a_custom_test_phrase_for_dynamic_generation`) with fallback to medium (`hello__how_are_you_today_`) then short (`hello`)

### Test Validation Points
1. ✅ At least one transcript received
2. ❌ At least one interim transcript received (FAILING)
3. ✅ At least one final transcript received
4. ❌ Interim transcripts arrive before final transcripts (FAILING - no interim to compare)
5. ✅ All transcripts contain valid text

## Root Cause Analysis

### Hypothesis
The component may not be:
1. Receiving interim transcripts from the Deepgram transcription service
2. Processing/interpreting the `is_final` property correctly
3. Calling `onTranscriptUpdate` for interim transcripts (only calling for final)

### Investigation Areas
1. **Transcription Service Configuration**: Verify `interim_results: true` is being sent to Deepgram
2. **WebSocket Message Handling**: Check if interim transcript messages are being received but not processed
3. **Callback Invocation**: Verify `onTranscriptUpdate` is called for both interim and final transcripts
4. **Event Logging**: Check if interim transcripts are received but not logged to the event log

## Test Improvements

### Current Implementation
- ✅ Uses DOM-based validation (parsing event log)
- ✅ Uses longest available audio sample
- ✅ Follows proven test patterns from passing tests
- ✅ Validates sequence (interim before final)

### Future Enhancements
1. **Add disfluency sample**: Create audio sample with "um", "uh", pauses, and corrections to better test interim transcript behavior
2. **Multiple sample testing**: Test with various utterance lengths to find minimum length that produces interim transcripts
3. **Timing analysis**: Measure time between interim and final transcripts
4. **Callback interception**: Add direct callback interception to capture raw transcript data (if DOM parsing proves insufficient)

## Status

- **Date Started**: 2025-01-XX
- **Test Status**: ✅ Test created and working (correctly detects the bug)
- **Bug Status**: ❌ Confirmed - interim transcripts not being received
- **Next Steps**: 
  1. Investigate transcription service configuration
  2. Check WebSocket message handling for interim transcripts
  3. Verify `onTranscriptUpdate` callback is invoked for interim transcripts
  4. Consider adding disfluency audio sample for better testing

## Related Issues

- Issue #248: Interim transcripts not being reported (original bug report)
- Issue #246: Recording continues after microphone deactivation (recently fixed)

## Test Output Example

```
🧪 Testing interim and final transcript receipt with fake audio...
🎤 [AUDIO_SETUP] Starting audio sending prerequisites setup...
✅ Connection established and settings applied
🎤 Loading fake audio sample (longest utterance): this_is_a_custom_test_phrase_for_dynamic_generation...
✅ Audio sample loaded: this_is_a_custom_test_phrase_for_dynamic_generation

📊 === TRANSCRIPT VALIDATION ===
📝 Total transcripts received: 1
📝 Transcript breakdown:
  1. FINAL | "Hello?"
📝 Final transcripts: 1
📝 Interim transcripts: 0

Error: expect(interimTranscripts.length).toBeGreaterThan(0)
Expected: > 0
Received: 0
```

## Component Public Interface for Transcripts

### `onTranscriptUpdate` Callback

The component emits transcripts via the `onTranscriptUpdate` callback:

```typescript
onTranscriptUpdate?: (transcriptData: TranscriptResponse) => void
```

### `TranscriptResponse` Structure

```typescript
interface TranscriptResponse {
  type: 'transcript';
  channel: number;
  is_final: boolean;        // KEY PROPERTY: false = interim, true = final
  speech_final: boolean;
  channel_index: number[];
  start: number;
  duration: number;
  alternatives: TranscriptAlternative[];  // Contains the actual transcript text
  metadata?: any;
}

interface TranscriptAlternative {
  transcript: string;       // The actual text
  confidence: number;
  words: TranscriptWord[];
}
```

### How It's Called

The component calls `onTranscriptUpdate` for **both interim and final transcripts**:

```typescript
// In handleTranscriptionMessage (line 1047)
if (data.type === 'Results' || data.type === 'Transcript') {
  const transcript = data as unknown as TranscriptResponse;
  onTranscriptUpdate?.(transcript);  // Called for BOTH interim and final
  return;
}
```

**Key Point**: The component IS emitting both interim and final transcripts via the callback. The `is_final` property indicates the type:
- `is_final: false` = Interim transcript (partial, in-progress)
- `is_final: true` = Final transcript (complete)

## Test Regex Fix

**Issue Found**: The test regex was not matching the timestamp format in the event log.

**Log Format**: `"22:34:00 - [TRANSCRIPT] \"Hi.\" (interim)"`

**Original Regex**: `\[TRANSCRIPT\]\s+"([^"]+)"\s+\((interim|final)\)` ❌ (missing timestamp)

**Fixed Regex**: `\d{2}:\d{2}:\d{2}\s+-\s+\[TRANSCRIPT\]\s+"([^"]+)"\s+\((interim|final)\)` ✅ (includes timestamp)

## References

- Test file: `test-app/tests/e2e/interim-transcript-validation.spec.js`
- Audio samples: `test-app/public/audio-samples/`
- Event log parsing: `test-app/src/App.tsx` line 292-293
- Transcription options: `test-app/src/App.tsx` line 197 (`interim_results: true`)
- Component callback: `src/components/DeepgramVoiceInteraction/index.tsx` line 1047
- TranscriptResponse type: `src/types/transcription.ts` line 132-177

