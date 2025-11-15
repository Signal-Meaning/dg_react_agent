# Event Order Comparison: Manual Test vs E2E Test

**Date**: January 2025  
**Purpose**: Compare event order and timing between manual test (successful) and E2E test (failing)

## Manual Test Event Order (SUCCESSFUL)

**Test Conditions**: 
- URL: `http://localhost:5173/?test-mode=true&enable-function-calling=true&function-type=minimal&debug=true`
- Function Type: Minimal
- Method: Browser DevTools, manual interaction

**Event Timeline** (reverse chronological order):

```
01:41:03 - agent connection state: closed

01:40:53 - Audio playback: stopped - Agent playback completed
01:40:53 - Agent state changed: idle
01:40:53 - 🎯 [IDLE_TIMEOUT] Timeout active: true
01:40:52 - 🎤 [AGENT] User stopped speaking at 01:40:52
01:40:51 - Agent said: How can I help you today?
01:40:51 - Audio playback: started
01:40:51 - Agent state changed: speaking
01:40:51 - Agent state changed: speaking
01:40:51 - Agent said: Hi there!
01:40:50 - Audio playback: stopped - Agent playback completed
01:40:50 - Agent state changed: listening
01:40:50 - User message from server: Hello
01:40:50 - 🎤 [AGENT] User started speaking at 01:40:50
01:40:50 - Text message sent to Deepgram agent
01:40:50 - Sending text message: Hello
01:40:48 - Audio playback: started
01:40:48 - Agent state changed: speaking
01:40:48 - Agent state changed: speaking
01:40:48 - Agent said: Hello! How can I assist you today?
01:40:48 - Greeting marked sent (SettingsApplied received via callback) ✅
01:40:48 - agent connection state: connected
01:40:48 - agent connection state: connecting
01:40:48 - Starting agent connection on text focus gesture
01:40:48 - ✅ AudioContext resumed on text input focus
01:38:55 - Component is ready
01:38:55 - Loaded instructions via loader: You are a helpful voice assistant. Keep your respo...
01:38:55 - Loaded instructions via loader: You are a helpful voice assistant. Keep your respo...
01:38:55 - Audio playback: stopped - Agent playback completed
01:38:55 - Agent state changed: idle
01:38:55 - Component is not ready
```

### Key Observations from Manual Test

1. **SettingsApplied Received**: ✅ "Greeting marked sent (SettingsApplied received via callback)" at 01:40:48
2. **Timing**: SettingsApplied received immediately after connection established (01:40:48)
3. **Greeting Spoken**: "Hello! How can I assist you today?" spoken at 01:40:48
4. **Connection Flow**:
   - 01:40:48 - Text input focus gesture
   - 01:40:48 - AudioContext resumed
   - 01:40:48 - Connection starting
   - 01:40:48 - Connection connected
   - 01:40:48 - SettingsApplied received
   - 01:40:48 - Greeting spoken

## E2E Test Event Order (TO BE CAPTURED)

**Test Conditions**:
- Same URL parameters
- Function Type: Minimal
- Method: Playwright automated test

**Expected Event Order** (based on test code):
1. Navigate to test app
2. Setup test page
3. Fill text input with "Hello"
4. Click send button
5. Wait for connection
6. Wait for SettingsApplied (THIS IS WHERE IT FAILS)
7. Check for SettingsApplied in DOM

### E2E Test Code Flow

```javascript
// 1. Navigate with minimal function type
await page.goto(buildUrlWithParams(BASE_URL, { 
  'test-mode': 'true',
  'enable-function-calling': 'true',
  'function-type': 'minimal',
  'debug': 'true'
}));

// 2. Setup test page
await setupTestPage(page);

// 3. Establish connection
await page.fill('[data-testid="text-input"]', 'Hello');
await page.click('[data-testid="send-button"]');

// 4. Wait for connection
await waitForConnection(page, 10000);

// 5. Wait for SettingsApplied (THIS FAILS)
await waitForSettingsApplied(page, 30000);
```

## Differences to Investigate

### 1. Timing Differences

**Manual Test**:
- Human interaction timing
- Natural delays between actions
- Browser has time to process events

**E2E Test**:
- Automated, rapid actions
- May not allow enough time for events to propagate
- Playwright may be checking before events arrive

### 2. Event Propagation

**Manual Test**:
- Full browser event loop
- All events processed naturally
- No artificial waiting

**E2E Test**:
- Playwright-controlled browser
- May have different event timing
- Need explicit waits for async events

### 3. Connection Establishment

**Manual Test**:
- Text input focus gesture triggers connection
- AudioContext resumed first
- Then connection starts

**E2E Test**:
- Direct text input and send button click
- May skip focus gesture
- May not resume AudioContext properly

### 4. SettingsApplied Detection

**Manual Test**:
- Callback fires naturally
- DOM updated immediately
- Visible in logs

**E2E Test**:
- Waiting for DOM element update
- May be checking too early
- May need longer timeout

## Potential Issues

1. **Race Condition**: E2E test may be checking for SettingsApplied before it arrives
2. **Timeout Too Short**: 30 seconds may not be enough in some cases
3. **Event Order**: E2E test may not be following the same event sequence as manual test
4. **AudioContext**: E2E test may not be resuming AudioContext properly
5. **Focus Gesture**: E2E test may be missing the text input focus gesture

## Recommendations

1. **Add Delays**: Add small delays between actions to match manual test timing
2. **Increase Timeout**: Increase SettingsApplied wait timeout
3. **Check AudioContext**: Ensure AudioContext is resumed in E2E test
4. **Add Focus Gesture**: Simulate text input focus before sending message
5. **Log Event Order**: Add detailed logging to E2E test to compare with manual test
6. **Wait for Greeting**: Instead of waiting for SettingsApplied, wait for greeting to appear

## Next Steps

1. Re-run E2E test and capture full event log
2. Compare event order with manual test
3. Identify timing differences
4. Adjust E2E test to match manual test flow
5. Verify SettingsApplied is received in E2E test

