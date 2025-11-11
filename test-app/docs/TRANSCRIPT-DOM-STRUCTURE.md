# Transcript DOM Structure

**Version**: 0.6.5+  
**Last Updated**: January 2025

## Overview

This document explains how the test-app displays transcribed user speech in the DOM. This structure is designed to support both user-facing display and E2E testing via Playwright.

## DOM Structure

The test-app reports transcribed speech in two main DOM locations:

### 1. Live Transcript Display

**Location**: Main transcript display area  
**Element**: `<pre data-testid="transcription">`

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginTop: '20px' }}>
  <div style={{ flex: 1, border: '1px solid #ccc', padding: '10px' }}>
    <h3>Live Transcript</h3>
    <pre data-testid="transcription">{lastTranscript || '(Waiting for transcript...)'}</pre>
  </div>
</div>
```

**Purpose**: Displays the most recent transcript text in real-time.

**Content**: 
- Shows the latest transcript text as it's received
- Updates immediately when new transcripts arrive
- Displays `'(Waiting for transcript...)'` when no transcript is available

**Usage in Tests**:
```javascript
const transcriptText = await page.locator('[data-testid="transcription"]').textContent();
```

### How Live Transcripts Are Generated

The Live Transcript is generated through the following flow:

#### 1. **Transcript Reception**

Transcripts are received from the Deepgram Voice Agent API via the `onTranscriptUpdate` callback:

```tsx
<DeepgramVoiceInteraction
  onTranscriptUpdate={handleTranscriptUpdate}
  // ... other props
/>
```

#### 2. **Transcript Processing**

Each transcript received triggers `handleTranscriptUpdate`:

```tsx
const handleTranscriptUpdate = useCallback((transcript: TranscriptResponse) => {
  // Use the simplified top-level transcript field (normalized by component)
  // The component extracts transcript text from the API structure and provides
  // it at transcript.transcript for convenience
  const text = transcript.transcript;
  const speakerId = transcript.alternatives?.[0]?.words?.[0]?.speaker;
  
  if (text && text.trim().length > 0) {
    // Format with speaker ID if available
    const displayText = speakerId !== undefined 
      ? `Speaker ${speakerId}: ${text}` 
      : text;
    
    // Update Live Transcript immediately
    setLastTranscript(displayText);
  }
}, []);
```

**Note**: The component normalizes the Deepgram API response structure. The transcript text is available at the top-level `transcript` field, eliminating the need to access `channel.alternatives[0].transcript` or `alternatives[0].transcript`. The full `alternatives` array is still available for advanced use cases (word-level data, confidence scores, etc.).

#### 3. **Update Behavior**

The Live Transcript updates on **every transcript received**, regardless of type:

- **Interim Transcripts** (`is_final: false`): Updates as speech is being processed
  - Shows partial, in-progress transcription
  - Updates frequently as more words are recognized
  - Example: User says "Hello, how are you?" → Live Transcript shows:
    - `"Hello"` (interim)
    - `"Hello, how"` (interim)
    - `"Hello, how are"` (interim)
    - `"Hello, how are you"` (interim)

- **Final Transcripts** (`is_final: true`): Updates when a segment is finalized
  - Shows completed transcription segment
  - May be followed by `speech_final: true` when speech ends
  - Example: `"Hello, how are you?"` (final)

#### 4. **When a Transcript "Ends"**

A transcript doesn't technically "end" - the Live Transcript **continuously updates** with each new transcript received. What ends is the **speech itself**, which is detected by:

**Primary Signal: `speech_final: true`**
- Deepgram's endpointing feature detects silence after speech
- Indicates the user has finished speaking
- This is the **recommended** signal for detecting speech completion
- When received, the Live Transcript shows the final transcript with `speech_final: true`

**Fallback Signal: `is_final: true` without `speech_final`**
- Final transcript without endpointing detection
- Used when endpointing is not enabled or hasn't fired yet
- Still indicates a completed transcription segment

**Important**: The Live Transcript continues to display the **last received transcript** even after speech ends. It doesn't clear or reset - it simply stops updating until new speech begins.

#### 5. **Transcript Lifecycle Example**

Here's a complete example of how the Live Transcript updates during a speech session:

```
Time  | Transcript Received          | Live Transcript Display
------|------------------------------|--------------------------
0ms   | (none)                       | "(Waiting for transcript...)"
500ms | "Hello" (interim)            | "Hello"
800ms | "Hello, how" (interim)       | "Hello, how"
1200ms| "Hello, how are" (interim)   | "Hello, how are"
1500ms| "Hello, how are you" (final) | "Hello, how are you"
1800ms| "Hello, how are you" (final, speech_final: true) | "Hello, how are you"
      |                              | (Speech ends - transcript stays displayed)
```

#### 6. **State Management**

The Live Transcript is managed by React state:

```tsx
const [lastTranscript, setLastTranscript] = useState('');

// Updates on every transcript
setLastTranscript(displayText);
```

- **Initial State**: `''` (empty string)
- **Empty Display**: Shows `'(Waiting for transcript...)'` when state is empty
- **Update Frequency**: Updates on every transcript callback (both interim and final)
- **Persistence**: Remains displayed after speech ends until new speech begins

#### 7. **Key Characteristics**

- **Real-time**: Updates immediately as transcripts arrive
- **Overwrites**: Each update replaces the previous content (doesn't append)
- **No History**: Only shows the most recent transcript (history is separate)
- **Persistent**: Stays visible after speech ends until new speech starts
- **Speaker-Aware**: Includes speaker identification when available

### Advantages of Live Transcript Over Transcript History

The Live Transcript section provides several benefits beyond the Transcript History:

#### 1. **Speaker Identification**

The Live Transcript includes speaker identification when available from Deepgram's speaker diarization:

```tsx
const displayText = speakerId !== undefined 
  ? `Speaker ${speakerId}: ${text}` 
  : text;
```

**Example Output**:
- With speaker: `"Speaker 1: Hello, how are you?"`
- Without speaker: `"Hello, how are you?"`

The Transcript History stores only the raw text without speaker information, making the Live Transcript the primary source for speaker-aware transcript display.

#### 2. **Real-Time Single-Value Display**

Unlike the Transcript History which accumulates all transcripts, the Live Transcript:
- **Overwrites** previous content with each new transcript
- Provides a **clean, focused view** of the current speech
- Eliminates the need to scroll through history to see the latest
- Ideal for **user-facing UI** where only the current transcript matters

#### 3. **Immediate Updates Without Scrolling**

The Live Transcript:
- Always shows the **most recent** transcript without scrolling
- Updates **instantly** as new transcripts arrive (both interim and final)
- Provides **immediate visual feedback** to users
- Doesn't require users to look at the bottom of a scrollable list

#### 4. **Simpler Query Pattern for Tests**

For E2E tests that only need to verify the latest transcript:

```javascript
// Simple - just get the current transcript
const currentTranscript = await page.locator('[data-testid="transcription"]').textContent();

// vs. Transcript History - need to find the last entry
const lastEntry = await page.evaluate(() => {
  const entries = document.querySelectorAll('[data-testid^="transcript-entry-"]');
  const lastIndex = entries.length - 1;
  return document.querySelector(`[data-testid="transcript-text-${lastIndex}"]`)?.textContent;
});
```

#### 5. **User Experience Focus**

The Live Transcript is designed for **end-user consumption**:
- Clean, readable format without metadata clutter
- No visual indicators (colors, labels) that might distract users
- Focuses attention on the **current** conversation state
- Matches common UI patterns where "current" information is prominently displayed

#### 6. **State Verification**

The Live Transcript provides a simple way to verify the **current state** of transcription:
- If empty or shows `'(Waiting for transcript...)'`, no transcript has been received
- If it contains text, transcription is active
- Useful for quick health checks in tests without parsing history

**When to Use Each**:

| Use Case | Use Live Transcript | Use Transcript History |
|----------|-------------------|----------------------|
| Display current speech to users | ✅ | ❌ |
| Verify latest transcript in tests | ✅ | ✅ |
| Analyze all transcripts (interim + final) | ❌ | ✅ |
| Check transcript metadata (is_final, speech_final) | ❌ | ✅ |
| Speaker identification | ✅ | ❌ |
| Debug transcript flow | ❌ | ✅ |
| Verify transcript sequence | ❌ | ✅ |

### 2. Transcript History

**Location**: Transcript history section  
**Element**: `<div data-testid="transcript-history">`

This section displays all transcripts (both interim and final) in a scrollable list.

#### Container Structure

```tsx
<div data-testid="transcript-history" style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
  <h3>Transcript History (for E2E testing)</h3>
  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
    {/* Transcript entries */}
  </div>
</div>
```

#### Individual Transcript Entry

Each transcript is rendered as a list item with the following structure:

```tsx
<li 
  key={index}
  data-testid={`transcript-entry-${index}`}
  data-is-final={entry.is_final}
  data-speech-final={entry.speech_final}
  data-timestamp={entry.timestamp}
  style={{
    padding: '8px',
    marginBottom: '4px',
    backgroundColor: entry.is_final ? (entry.speech_final ? '#1a4d1a' : '#4a3a00') : '#1a3a5c',
    border: `1px solid ${entry.is_final ? (entry.speech_final ? '#48bb78' : '#f6ad55') : '#4299e1'}`,
    borderRadius: '4px',
    fontSize: '0.9em',
    color: '#ffffff'
  }}
>
  <span style={{ fontWeight: 'bold', marginRight: '8px' }}>
    [{entry.is_final ? (entry.speech_final ? 'FINAL' : 'final') : 'interim'}]
  </span>
  <span data-testid={`transcript-text-${index}`}>{entry.text}</span>
  <span style={{ color: '#cbd5e0', fontSize: '0.85em', marginLeft: '8px' }}>
    ({new Date(entry.timestamp).toLocaleTimeString()})
  </span>
</li>
```

## Data Attributes

### Container Attributes

| Attribute | Value | Description |
|-----------|-------|-------------|
| `data-testid` | `"transcript-history"` | Main container for all transcript entries |

### Entry Attributes

Each transcript entry includes the following data attributes:

| Attribute | Type | Description |
|-----------|------|-------------|
| `data-testid` | `"transcript-entry-${index}"` | Unique identifier for each transcript entry (0-based index) |
| `data-is-final` | `"true"` or `"false"` | Indicates if this is a final transcript (`is_final: true`) or interim transcript (`is_final: false`) |
| `data-speech-final` | `"true"` or `"false"` | Indicates if Deepgram's endpointing detected speech has ended (`speech_final: true`) |
| `data-timestamp` | Number (string) | Unix timestamp in milliseconds when the transcript was received |

### Text Content Attribute

| Attribute | Value | Description |
|-----------|-------|-------------|
| `data-testid` | `"transcript-text-${index}"` | Contains the actual transcript text content |

## Visual Styling

The test-app uses color coding to distinguish transcript types:

### Interim Transcripts (`is_final: false`)
- **Background**: `#1a3a5c` (dark blue)
- **Border**: `#4299e1` (blue)
- **Label**: `[interim]` in `#90cdf4` (light blue)

### Final Transcripts (`is_final: true`, `speech_final: false`)
- **Background**: `#4a3a00` (dark yellow/brown)
- **Border**: `#f6ad55` (orange)
- **Label**: `[final]` in `#fbd38d` (light yellow)

### Speech Final Transcripts (`is_final: true`, `speech_final: true`)
- **Background**: `#1a4d1a` (dark green)
- **Border**: `#48bb78` (green)
- **Label**: `[FINAL]` in `#9ae6b4` (light green)

## Data Flow

### 1. Transcript Reception

Transcripts are received via the `onTranscriptUpdate` callback:

```tsx
const handleTranscriptUpdate = useCallback((transcript: TranscriptResponse) => {
  const isFinal = transcript.is_final;
  const speechFinal = transcript.speech_final || false;
  // Use the simplified top-level transcript field (normalized by component)
  const text = transcript.transcript || '';
  
  // Update last transcript (for live display)
  setLastTranscript(text);
  
  // Add to transcript history
  setTranscriptHistory(prev => [...prev, {
    text,
    is_final: isFinal || false,
    speech_final: speechFinal,
    timestamp: Date.now()
  }]);
}, []);
```

**API Simplification**: The component normalizes the Deepgram API response, providing the transcript text at `transcript.transcript` instead of requiring access to `channel.alternatives[0].transcript`. This makes the API more ergonomic for the common case while preserving the full `alternatives` array for advanced use cases.

### 2. State Management

The test-app maintains two pieces of state:

- **`lastTranscript`**: String containing the most recent transcript text
- **`transcriptHistory`**: Array of `TranscriptHistoryEntry` objects

```tsx
type TranscriptHistoryEntry = {
  text: string;
  is_final: boolean;
  speech_final: boolean;
  timestamp: number;
};
```

### 3. DOM Rendering

The transcript history is rendered by mapping over the `transcriptHistory` array:

```tsx
{transcriptHistory.map((entry, index) => (
  <li 
    key={index}
    data-testid={`transcript-entry-${index}`}
    data-is-final={entry.is_final}
    data-speech-final={entry.speech_final}
    data-timestamp={entry.timestamp}
  >
    <span data-testid={`transcript-text-${index}`}>{entry.text}</span>
  </li>
))}
```

## E2E Testing Usage

### Querying Transcripts from DOM

E2E tests can extract transcript data from the DOM using Playwright:

```javascript
// Wait for transcripts to stabilize
await page.waitForTimeout(2000);

// Extract all transcript entries
const capturedTranscripts = await page.evaluate(() => {
  const entries = Array.from(document.querySelectorAll('[data-testid^="transcript-entry-"]'));
  return entries.map((entry, index) => {
    const textEl = entry.querySelector(`[data-testid="transcript-text-${index}"]`);
    const text = textEl?.textContent?.trim() || '';
    const isFinal = entry.getAttribute('data-is-final') === 'true';
    const speechFinal = entry.getAttribute('data-speech-final') === 'true';
    const timestamp = parseInt(entry.getAttribute('data-timestamp') || '0', 10);
    
    return {
      text,
      is_final: isFinal,
      speech_final: speechFinal,
      timestamp
    };
  });
});
```

### Filtering Transcripts

```javascript
// Get only final transcripts
const finalTranscripts = capturedTranscripts.filter(t => t.is_final === true);

// Get only speech_final transcripts
const speechFinalTranscripts = capturedTranscripts.filter(t => t.speech_final === true);

// Get only interim transcripts
const interimTranscripts = capturedTranscripts.filter(t => t.is_final === false);
```

### Waiting for Specific Transcripts

```javascript
// Wait for at least one transcript
await page.waitForSelector('[data-testid^="transcript-entry-"]', { timeout: 10000 });

// Wait for a final transcript
await page.waitForSelector('[data-is-final="true"]', { timeout: 10000 });

// Wait for a speech_final transcript
await page.waitForSelector('[data-speech-final="true"]', { timeout: 10000 });
```

## Example Test Pattern

Here's a complete example from the test suite:

```javascript
test('should receive both interim and final transcripts', async ({ page, context }) => {
  // Setup and send audio...
  
  // Wait for transcripts to stabilize
  let previousCount = 0;
  let stableCount = 0;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(500);
    const currentCount = await page.evaluate(() => {
      return document.querySelectorAll('[data-testid^="transcript-entry-"]').length;
    });
    if (currentCount === previousCount) {
      stableCount++;
      if (stableCount >= 2) {
        break; // Count stabilized
      }
    } else {
      stableCount = 0;
    }
    previousCount = currentCount;
  }
  
  // Extract transcripts
  const capturedTranscripts = await page.evaluate(() => {
    const entries = Array.from(document.querySelectorAll('[data-testid^="transcript-entry-"]'));
    return entries.map((entry, index) => {
      const textEl = entry.querySelector(`[data-testid="transcript-text-${index}"]`);
      return {
        text: textEl?.textContent?.trim() || '',
        is_final: entry.getAttribute('data-is-final') === 'true',
        speech_final: entry.getAttribute('data-speech-final') === 'true',
        timestamp: parseInt(entry.getAttribute('data-timestamp') || '0', 10)
      };
    });
  });
  
  // Validate
  const finalTranscripts = capturedTranscripts.filter(t => t.is_final === true);
  const interimTranscripts = capturedTranscripts.filter(t => t.is_final === false);
  
  expect(interimTranscripts.length).toBeGreaterThan(0);
  expect(finalTranscripts.length).toBeGreaterThan(0);
});
```

## API Testing

### Testing the Simplified Transcript API

The component normalizes the Deepgram API response to provide a simplified interface. Tests should verify:

1. **Top-level `transcript` field is available**:
```javascript
// ✅ Correct - use the simplified API
const text = transcript.transcript;

// ❌ Avoid - don't dig into nested structures
const text = transcript.channel?.alternatives?.[0]?.transcript;
```

2. **Backward compatibility**: The `alternatives` array is still available for advanced use cases:
```javascript
// Access word-level data, confidence scores, etc.
const words = transcript.alternatives?.[0]?.words;
const confidence = transcript.alternatives?.[0]?.confidence;
```

3. **Common properties are easily accessible**:
```javascript
const text = transcript.transcript;        // ✅ Simplified
const isFinal = transcript.is_final;      // ✅ Direct access
const speechFinal = transcript.speech_final; // ✅ Direct access
```

### Existing Tests

The following tests verify transcript functionality:

- **`test-app/tests/e2e/callback-test.spec.js`**: Tests `onTranscriptUpdate` callback and verifies transcripts appear in the UI
- **`test-app/tests/e2e/vad-transcript-analysis.spec.js`**: Analyzes transcript patterns with different audio samples
- **`test-app/tests/e2e/interim-transcript-validation.spec.js`**: Validates interim and final transcript handling

All existing tests continue to work with the simplified API since they verify UI output rather than the raw API structure.

## Key Points for Developers

1. **Simplified API**: Use `transcript.transcript` instead of `channel.alternatives[0].transcript` or `alternatives[0].transcript`

2. **Index-Based IDs**: Transcript entries use 0-based indices (`transcript-entry-0`, `transcript-entry-1`, etc.)

3. **String Attributes**: All data attributes are stored as strings, so boolean values are `"true"` or `"false"` (not actual booleans)

4. **Timestamp Format**: Timestamps are stored as Unix milliseconds (number as string)

5. **Text Extraction**: Always use `textContent` (not `innerText`) to get the transcript text, as it's more reliable for test automation

6. **Stabilization**: When testing, wait for the transcript count to stabilize before extracting data, as transcripts may arrive incrementally

7. **Color Coding**: Visual styling helps distinguish transcript types, but tests should rely on data attributes, not colors

## Related Documentation

- [Test App README](./README.md) - Overview of test app purpose and structure
- [Integration Examples](./releases/v0.5.0/INTEGRATION-EXAMPLES.md) - How to integrate the component
- [E2E Test Guide](../../tests/e2e/README.md) - E2E testing patterns and utilities

## Implementation Location

- **Component**: `test-app/src/App.tsx`
- **Transcript History Rendering**: Lines 972-1008
- **Live Transcript Display**: Line 963
- **State Management**: Lines 51-52, 271-300
- **Transcript Processing**: Lines 271-300 (uses simplified `transcript.transcript` API)

---

**Last Updated**: January 2025  
**Component Version**: 0.6.5+  
**Test App Version**: 0.5.0+

