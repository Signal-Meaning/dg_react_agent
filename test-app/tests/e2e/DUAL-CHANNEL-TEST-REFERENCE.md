# Dual Channel Tests - Line of Code Reference

**File**: `test-app/tests/e2e/dual-channel-text-and-microphone.spec.js`  
**Last Updated**: 2026-01-17  
**Issue**: #372

## Overview

This document provides line-of-code references for the dual-channel E2E tests, making it easy to locate specific test scenarios and their implementations.

## Test Structure

### Test Suite: `Dual Channel - Text and Microphone`
**Location**: Line 219

### Helper Function: `captureConversationTranscript()`
**Location**: Lines 47-217
- Captures full conversation transcripts including user messages, agent responses, and function calls
- Identifies and marks greetings separately
- Excludes greetings from exchange counts

## Test Cases

### Test 1: "should start with text channel, then switch to microphone"
**Location**: Lines 221-308

**Key Steps**:
- **Line 224**: `setupTestPage(page)` - Initialize test page
- **Line 228-230**: Focus text input to trigger auto-connect
- **Line 233-239**: Wait for connection establishment
- **Line 243**: Send text message: `"Hello, I'm testing the text channel."`
- **Line 252-257**: Wait for and capture first agent response
- **Line 260-272**: Enable microphone using `MicrophoneHelpers.waitForMicrophoneReady()`
- **Line 276**: Send pre-recorded audio: `'hello__how_are_you_today_'` (Line 276)
- **Line 285-290**: Wait for and capture second agent response (audio)
- **Line 303-305**: Capture and log full conversation transcript

**Audio Sample Used**: `hello__how_are_you_today_` (Line 276)

### Test 2: "should start with microphone, then switch to text"
**Location**: Lines 310-380

**Key Steps**:
- **Line 313**: `setupTestPage(page)` - Initialize test page
- **Line 314**: Grant microphone permissions
- **Line 318-326**: Enable microphone and establish connection
- **Line 330**: Send pre-recorded audio: `'hello'` (Line 330)
- **Line 339-344**: Wait for and capture first agent response (audio)
- **Line 352**: Send text message: `"What is the tallest mountain in the world?"` (Line 352)
- **Line 356-361**: Wait for and capture second agent response (text)
- **Line 375-377**: Capture and log full conversation transcript

**Audio Sample Used**: `hello` (Line 330)

### Test 3: "should alternate between text and microphone in same session"
**Location**: Lines 382-510

**Key Steps**:
- **Line 385**: `setupTestPage(page)` - Initialize test page
- **Line 400**: Send text message 1: `"What is the capital city of France?"` (Line 400)
- **Line 409-412**: Wait for and capture first agent response
- **Line 416-422**: Enable microphone
- **Line 426**: Send pre-recorded audio: `'hello__how_are_you_today_'` (Line 426)
- **Line 435-438**: Wait for and capture second agent response (audio)
- **Line 442**: Send text message 2: `"Can you tell me what the largest planet in our solar system is?"` (Line 442)
- **Line 448-451**: Wait for and capture third agent response (text)
- **Line 455-460**: Disable microphone
- **Line 464**: Send text message 3: `"What is the speed of light in a vacuum?"` (Line 464)
- **Line 470-473**: Wait for and capture fourth agent response (text)
- **Line 477-482**: Re-enable microphone
- **Line 486**: Send pre-recorded audio again: `'hello__how_are_you_today_'` (Line 486)
- **Line 495-498**: Wait for and capture fifth agent response (audio)
- **Line 505-507**: Capture and log full conversation transcript

**Audio Samples Used**: 
- `hello__how_are_you_today_` (Lines 426, 486)

**Text Messages**:
- Line 400: `"What is the capital city of France?"`
- Line 442: `"Can you tell me what the largest planet in our solar system is?"`
- Line 464: `"What is the speed of light in a vacuum?"`

### Test 4: "should maintain connection when switching between channels"
**Location**: Lines 512-619

**Key Steps**:
- **Line 515**: `setupTestPage(page)` - Initialize test page
- **Line 520-532**: Establish connection via text input
- **Line 536-546**: Enable microphone
- **Line 550**: Send pre-recorded audio: `'hello__how_are_you_today_'` (Line 550)
- **Line 559-562**: Wait for and capture first agent response (audio)
- **Line 567**: Send text message 1: `"What are the primary colors in art?"` (Line 567)
- **Line 571-573**: Wait for and capture second agent response (text)
- **Line 582-589**: Disable microphone
- **Line 594**: Send text message 2: `"How many continents are there on Earth?"` (Line 594)
- **Line 600-602**: Wait for and capture third agent response (text)
- **Line 614-616**: Capture and log full conversation transcript

**Audio Sample Used**: `hello__how_are_you_today_` (Line 550)

**Text Messages**:
- Line 567: `"What are the primary colors in art?"`
- Line 594: `"How many continents are there on Earth?"`

### Test 5: "should work in proxy mode with both text and microphone channels"
**Location**: Lines 621-755

**Key Steps**:
- **Line 624-630**: Check proxy mode configuration
- **Line 631**: `skipIfNoRealAPI()` - Skip if no real API key
- **Line 632-351**: Verify proxy server is running
- **Line 353-360**: Navigate to test URL with proxy configuration
- **Line 365-380**: Establish connection via text in proxy mode
- **Line 384**: Send text message 1: `"What is the chemical symbol for water?"` (Line 384)
- **Line 389-391**: Wait for and capture first agent response (text)
- **Line 394-400**: Enable microphone
- **Line 404**: Send pre-recorded audio: `'hello__how_are_you_today_'` (Line 404)
- **Line 413-415**: Wait for and capture second agent response (audio)
- **Line 420**: Send text message 2: `"Who wrote the novel '1984'?"` (Line 420)
- **Line 425-427**: Wait for and capture third agent response (text)
- **Line 432-434**: Verify connection is still active
- **Line 437-439**: Capture and log full conversation transcript

**Audio Sample Used**: `hello__how_are_you_today_` (Line 404)

**Text Messages**:
- Line 384: `"What is the chemical symbol for water?"`
- Line 420: `"Who wrote the novel '1984'?"`

## Transcript Capture Function

### `captureConversationTranscript(page)`
**Location**: Lines 47-217

**Features**:
- **Line 58-59**: Gets conversation history from `window.__testConversationHistory`
- **Line 62-74**: Extracts audio transcripts from DOM elements
- **Line 77-78**: Gets function call information from window
- **Line 84-91**: Combines conversation history entries
- **Line 94-101**: Adds audio transcriptions
- **Line 104-158**: Processes function call information
- **Line 161**: Sorts all events by timestamp
- **Line 163-193**: Formats transcript with greeting detection
- **Line 167-179**: Processes user messages (text and audio)
- **Line 180-183**: Processes agent responses with greeting detection
- **Line 184-192**: Processes function calls
- **Line 195-200**: Outputs summary statistics

**Greeting Detection**:
- **Lines 163-170**: `isGreeting()` helper function identifies greeting patterns
- **Lines 180-183**: Greetings are marked separately and excluded from exchange count
- **Line 196**: Greeting count is reported separately in summary

## Audio Samples Reference

All audio samples are located in: `test-app/public/audio-samples/`

**Samples Used in Tests**:
- `hello` - Basic greeting (used in Test 2)
- `hello__how_are_you_today_` - Extended greeting with question (used in Tests 1, 3, 4, 5)
- `hello_there` - Alternative greeting (not currently used)

## Test Helpers Used

- `setupTestPage(page)` - From `./helpers/test-helpers.js`
- `sendTextMessage(page, message)` - From `./helpers/test-helpers.js`
- `MicrophoneHelpers.waitForMicrophoneReady()` - From `./helpers/test-helpers.js`
- `waitForAgentResponse(page, expectedText, timeout)` - From `./helpers/test-helpers.js`
- `loadAndSendAudioSample(page, sampleName, options)` - From `./fixtures/audio-helpers.js`
- `skipIfNoRealAPI(reason)` - From `./helpers/test-helpers.js`

## Related Issues

- **Issue #372**: Improve Dual Channel Tests: Add Agent Response Logging and Pre-recorded Audio
- **Issue #369**: API Key Security Tests and Dual Channel Tests
