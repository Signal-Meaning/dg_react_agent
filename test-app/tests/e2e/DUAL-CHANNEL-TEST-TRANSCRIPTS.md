# Dual Channel Tests - Conversation Transcripts

**File**: `test-app/tests/e2e/dual-channel-text-and-microphone.spec.js`  
**Last Updated**: 2026-01-17  
**Issue**: #372

## Overview

This document contains example conversation transcripts from the dual-channel E2E tests. Each test captures the full text exchange between user and assistant, including:

- User messages (text and audio transcriptions)
- Agent responses
- Function call summaries (query, provider, result count when applicable)
- Greetings (marked separately and excluded from exchange counts)

## How to View Transcripts

### Option 1: Console Output (Default)

Transcripts are automatically logged to the console at the end of each test. To view them:

```bash
cd test-app
unset CI
USE_PROXY_MODE=true VITE_PROXY_ENDPOINT=ws://localhost:8080/deepgram-proxy npm run test:e2e -- dual-channel-text-and-microphone
```

Look for sections marked `📋 CONVERSATION TRANSCRIPT:` in the output.

### Option 2: Save to Files (Optional)

Transcripts can be automatically saved to files for easier review. Enable this feature:

```bash
cd test-app
unset CI
SAVE_TEST_TRANSCRIPTS=true USE_PROXY_MODE=true VITE_PROXY_ENDPOINT=ws://localhost:8080/deepgram-proxy npm run test:e2e -- dual-channel-text-and-microphone
```

Transcripts will be saved to: `test-results/transcripts/`

**File Naming Format**: `{test-file-name}_{test-name}_{timestamp}.txt`

**Example**: `dual-channel-text-and-microphone_should_start_with_text_channel_then_switch_to_microphone_2026-01-17T12-30-45.txt`

Each transcript file includes:
- Test file name
- Test name
- Timestamp
- Full conversation transcript

## Transcript Format

Each transcript includes:
- **Greetings**: Marked as `ASSISTANT (Greeting):` and excluded from exchange counts
- **User Messages**: Marked as `USER (Text):` or `USER (Audio):`
- **Agent Responses**: Marked as `ASSISTANT:`
- **Function Calls**: Shows function name, query, provider, and result count
- **Summary**: Total exchanges (excluding greetings) and function call count

## Example Transcripts

### Test 1: "should start with text channel, then switch to microphone"

**Test Location**: Lines 221-308

**Expected Transcript Pattern**:
```
================================================================================
CONVERSATION TRANSCRIPT
================================================================================

ASSISTANT (Greeting): Hello! How can I assist you today?

[Exchange 1]
USER (Text): What is the capital city of France?

ASSISTANT: [Agent response to text question]

[Exchange 2]
USER (Audio): Hello. How are you today?

ASSISTANT: [Agent response to audio question]

================================================================================
Greetings: 1 (excluded from exchange count)
Total Exchanges: 2
================================================================================
```

**Key Points**:
- Starts with text message (factual question)
- Switches to audio input
- Both channels work in same session

### Test 2: "should start with microphone, then switch to text"

**Test Location**: Lines 310-380

**Expected Transcript Pattern**:
```
================================================================================
CONVERSATION TRANSCRIPT
================================================================================

ASSISTANT (Greeting): Hello! How can I assist you today?

[Exchange 1]
USER (Audio): Hello?

ASSISTANT: [Agent response to audio]

[Exchange 2]
USER (Text): What is the tallest mountain in the world?

ASSISTANT: [Agent response to text question]

================================================================================
Greetings: 1-2 (excluded from exchange count)
Total Exchanges: 2
================================================================================
```

**Key Points**:
- Starts with audio input
- Switches to text message (factual question)
- Both channels remain available

### Test 3: "should alternate between text and microphone in same session"

**Test Location**: Lines 382-510

**Expected Transcript Pattern**:
```
================================================================================
CONVERSATION TRANSCRIPT
================================================================================

ASSISTANT (Greeting): Hello! How can I assist you today?

[Exchange 1]
USER (Text): What is the capital city of France?

ASSISTANT: [Agent response - factual answer]

[Exchange 2]
USER (Audio): Hello. How are you today?

ASSISTANT: [Agent response to audio]

[Exchange 3]
USER (Text): Can you tell me what the largest planet in our solar system is?

ASSISTANT: [Agent response - factual answer]

[Exchange 4]
USER (Text): What is the speed of light in a vacuum?

ASSISTANT: [Agent response - factual answer]

[Exchange 5]
USER (Audio): Hello. How are you today?

ASSISTANT: [Agent response to audio]

================================================================================
Greetings: 1-2 (excluded from exchange count)
Total Exchanges: 5
================================================================================
```

**Key Points**:
- Multiple text messages with factual questions
- Multiple audio inputs
- Alternates between channels
- All prompts designed for reliable agent responses

### Test 4: "should maintain connection when switching between channels"

**Test Location**: Lines 512-619

**Expected Transcript Pattern**:
```
================================================================================
CONVERSATION TRANSCRIPT
================================================================================

ASSISTANT (Greeting): Hello! How can I assist you today?

[Exchange 1]
USER (Audio): Hello. How are you today?

ASSISTANT: [Agent response to audio]

[Exchange 2]
USER (Text): What are the primary colors in art?

ASSISTANT: [Agent response - factual answer]

[Exchange 3]
USER (Text): How many continents are there on Earth?

ASSISTANT: [Agent response - factual answer]

================================================================================
Greetings: 1-2 (excluded from exchange count)
Total Exchanges: 3
================================================================================
```

**Key Points**:
- Tests connection stability
- Uses factual questions for reliable responses
- Verifies connection maintained throughout channel switching

### Test 5: "should work in proxy mode with both text and microphone channels"

**Test Location**: Lines 621-755

**Expected Transcript Pattern**:
```
================================================================================
CONVERSATION TRANSCRIPT
================================================================================

ASSISTANT (Greeting): Hello! How can I assist you today?

[Exchange 1]
USER (Text): What is the chemical symbol for water?

ASSISTANT: [Agent response - factual answer]

[Exchange 2]
USER (Audio): Hello. How are you today?

ASSISTANT: [Agent response to audio]

[Exchange 3]
USER (Text): Who wrote the novel '1984'?

ASSISTANT: [Agent response - factual answer]

================================================================================
Greetings: 1 (excluded from exchange count)
Total Exchanges: 3
================================================================================
```

**Key Points**:
- Tests proxy mode specifically
- Uses factual questions for reliable responses
- Verifies both channels work in proxy mode

## Function Call Transcript Format

When function calls occur, they appear in the transcript as:

```
[Exchange N]
USER (Text): [User question that triggered function call]

  [Function Call]
    Function: [function_name]
    Query: [text query used]
    Provider: Deepgram Agent
    Results: [number] result(s)

ASSISTANT: [Agent response using function results]
```

## Notes

- **Greetings**: Automatically detected and marked separately. Common greeting patterns include "Hello! How can I assist you today?", "How can I help you today?", etc.
- **Exchange Count**: Only counts actual user-assistant exchanges, excluding greetings
- **Audio Transcriptions**: Final audio transcriptions are captured from the DOM and shown as `USER (Audio):`
- **Text Messages**: User text input is captured from conversation history and shown as `USER (Text):`

## Related Documents

- **DUAL-CHANNEL-TEST-REFERENCE.md**: Line-of-code references for all tests
- **Issue #372**: Improve Dual Channel Tests: Add Agent Response Logging and Pre-recorded Audio
