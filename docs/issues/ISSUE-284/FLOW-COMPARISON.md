# Flow Comparison: Manual Test vs E2E Test

**Date**: January 2025  
**Purpose**: Understand the exact difference between manual test (successful) and E2E test (failing)

## Manual Test Flow (SUCCESSFUL)

### Step-by-Step Event Sequence

1. **User focuses text input**
   - `onFocus` handler fires (line 1056 in App.tsx)
   - AudioContext is resumed
   - **Explicitly starts agent connection**: `await deepgramRef.current?.start?.({ agent: true, transcription: false });`
   - Log: "Starting agent connection on text focus gesture"
   - Log: "✅ AudioContext resumed on text input focus"

2. **Connection established**
   - Component's connection state handler fires (line 654-656 in index.tsx)
   - `sendAgentSettings()` is called
   - Settings message sent with functions included

3. **SettingsApplied received**
   - Deepgram responds with SettingsApplied
   - `onSettingsApplied` callback fires
   - DOM updated: `has-sent-settings` = 'true'
   - Log: "Greeting marked sent (SettingsApplied received via callback)"

4. **User types and sends message**
   - User types "Hello" in text input
   - User clicks send button
   - `handleTextSubmit()` calls `injectUserMessage()`
   - Message sent to Deepgram

## E2E Test Flow (FAILING)

### Step-by-Step Event Sequence

1. **Test navigates to page**
   - `page.goto()` with URL parameters
   - `setupTestPage()` waits for `[data-testid="voice-agent"]` element

2. **Test fills text input directly**
   - `page.fill('[data-testid="text-input"]', 'Hello')`
   - **NO focus event** - `onFocus` handler does NOT fire
   - AudioContext is NOT resumed
   - Connection is NOT explicitly started via `start()`

3. **Test clicks send button**
   - `page.click('[data-testid="send-button"]')`
   - `handleTextSubmit()` calls `injectUserMessage()`

4. **Connection started inside injectUserMessage**
   - `injectUserMessage()` checks connection state (line 2258)
   - If not connected, calls `await managerBeforeConnect.connect()` (line 2260)
   - Waits `SETTINGS_SEND_DELAY_MS` (line 2269)
   - Then sends the message

5. **Connection established**
   - Component's connection state handler fires
   - `sendAgentSettings()` is called
   - Settings message sent

6. **SettingsApplied NOT received**
   - Test waits 10 seconds
   - `has-sent-settings` remains 'false'
   - Test reports "SettingsApplied NOT received"

## Key Differences

### 1. Focus Event

**Manual Test**: ✅ Focus event fires → `onFocus` handler executes → Connection started explicitly  
**E2E Test**: ❌ No focus event → `onFocus` handler does NOT execute → Connection started inside `injectUserMessage`

### 2. Connection Start Method

**Manual Test**: 
- Connection started via `deepgramRef.current?.start?.({ agent: true, transcription: false })`
- This is called BEFORE sending any message
- Settings sent, then SettingsApplied received, THEN message sent

**E2E Test**:
- Connection started inside `injectUserMessage()` via `managerBeforeConnect.connect()`
- This is called WHEN sending the message
- Settings sent, message sent immediately, SettingsApplied might not arrive in time

### 3. AudioContext Resume

**Manual Test**: ✅ AudioContext resumed in `onFocus` handler  
**E2E Test**: ❌ AudioContext NOT resumed (no focus event)

### 4. Timing

**Manual Test**:
- Connection → Settings → SettingsApplied → (user types) → Message
- Natural delays between user actions

**E2E Test**:
- Connection → Settings → Message (immediately) → SettingsApplied (may arrive too late)
- Rapid automated actions

## Hypothesis

The E2E test might be sending the user message **before** SettingsApplied is received. This could cause:
1. Deepgram to process the user message before Settings are fully applied
2. SettingsApplied to be delayed or not sent
3. A race condition where Settings and Message are sent too close together

## Solution

Update E2E test to match manual test flow:

1. **Focus the text input first** to trigger `onFocus` handler
2. **Wait for AudioContext resume** (if needed)
3. **Wait for connection** to be established
4. **Wait for SettingsApplied** to be received
5. **THEN** fill and send the message

This ensures the same event order as the manual test.

