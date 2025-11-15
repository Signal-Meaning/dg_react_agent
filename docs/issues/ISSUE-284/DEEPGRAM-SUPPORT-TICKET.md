# Deepgram Support Ticket: SettingsApplied Not Received with Function Calling

## Issue Summary

**RESOLUTION**: Manual testing with Browser DevTools confirms that `SettingsApplied` **IS received** with minimal function definitions. The issue was **E2E test-specific**, not a Deepgram API issue.

**Root Cause**: E2E test was not properly simulating the manual test flow:
- Missing focus gesture that triggers AudioContext resume
- Different timing/event order than manual test
- May be checking for SettingsApplied before it arrives

**Status**: ✅ **RESOLVED** - Manual test proves implementation works correctly. E2E test needs to be updated to match manual test flow.

**Original Issue** (E2E Test): When including functions in the Settings message sent to Deepgram's Voice Agent API v1, the `SettingsApplied` confirmation event was not received in E2E tests, even though:
- Functions are correctly structured and match Deepgram's specification
- No Error messages are received from Deepgram
- Settings message structure is correct
- `SettingsApplied` is received when functions are NOT included

## Component Information

- **Component**: `@signal-meaning/deepgram-voice-interaction-react`
- **Version**: v0.6.5+
- **API Endpoint**: `wss://agent.deepgram.com/v1/agent/converse` ✅ Verified in code
- **API Version**: Voice Agent API v1
- **WebSocket Library**: Native browser WebSocket API (no proxy)
- **Test Environment**: Chrome/Chromium (Playwright), Node.js 20

## Problem Details

### Expected Behavior

When sending a Settings message with functions included in `agent.think.functions`, Deepgram should respond with a `SettingsApplied` event to confirm the settings have been accepted and are active.

### Actual Behavior

1. ✅ Settings message is sent with functions correctly included
2. ✅ No Error messages are received from Deepgram
3. ❌ `SettingsApplied` event is NOT received
4. ✅ `SettingsApplied` IS received when functions are NOT included

### Impact

Without `SettingsApplied`, the component cannot determine when settings are active and ready for audio processing. This prevents proper initialization and breaks the function calling workflow.

## Pre-Submission Validation Checklist

### ⚠️ 1. Settings Message Structure Verification

**Outgoing Settings Message Captured**: ✅ **COMPLETE**
- ✅ Verified via component logs (console.log output)
- ✅ Verified via unit tests (mocked WebSocket)
- ✅ **CAPTURED via Browser DevTools** - See `CAPTURED-SETTINGS-PAYLOAD.json` for the exact payload

**Captured Payload**: The Settings message was successfully captured and shows:
- ✅ Functions correctly placed in `agent.think.functions`
- ✅ Minimal function structure is correct
- ✅ **SettingsApplied WAS received** in this manual test
- ✅ Greeting appeared, confirming settings were applied

**Note**: This contradicts earlier E2E test results where `SettingsApplied` was not received. Further investigation needed.

**Message Type**: `"type": "Settings"` ✅ Confirmed (via component logs)

**Functions Location**: Functions are correctly placed under `agent.think.functions` ✅ Verified (via component logs and unit tests)

**No Extraneous Locations**: ✅ Confirmed - no `functions` properties in root, `agent.functions`, or other locations (verified in code)

### ✅ 2. Minimal Function Definition Test

**Minimal Function Used**:
```json
{
  "name": "test",
  "description": "test",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```

**Result**: ✅ Function appears correctly in `agent.think.functions` in Settings message (verified via unit tests)

### ✅ 3. Comparative Tests

**Case A: No Functions**:
- Settings sent without functions
- ✅ `SettingsApplied` event received from Deepgram

**Case B: With Functions (minimal)**:
- Settings sent with minimal function in `agent.think.functions`
- ❌ `SettingsApplied` event NOT received
- ✅ No Error messages from Deepgram

### ✅ 4. Extraneous Keys Check

**Removed Keys**: 
- ✅ `client_side` - Removed from Settings message (only appears in FunctionCallRequest responses, not in function definitions)
- ✅ No undocumented keys included in function definitions

**Function Definition Structure**: Matches Deepgram spec exactly (name, description, parameters, optional endpoint)

### ⚠️ 5. Documentation Captured

**Outgoing Settings JSON**: ⚠️ **PARTIALLY COMPLETE**
- ✅ Captured in component logs (console.log output - see below)
- ❌ **NOT YET CAPTURED via WebSocket.send() interception** - Need to wrap `window.WebSocket.send` to capture exact JSON being sent over the wire

**Events Received**: 
- ✅ Welcome message received
- ❌ SettingsApplied NOT received when functions included
- ✅ SettingsApplied received when functions NOT included
- ✅ No Error or Warning messages received

**Component Version**: `@signal-meaning/deepgram-voice-interaction-react@0.6.5+`

**WebSocket URL**: `wss://agent.deepgram.com/v1/agent/converse` ✅ Verified

**Timing**: Waited 10+ seconds after sending Settings message for SettingsApplied

### ✅ 6. Results Interpretation

**Conclusion**: Functions appear correctly under `agent.think.functions`, and we still do not get `SettingsApplied` - **strong evidence this is a Deepgram backend issue or account/configuration limitation**.

## Evidence

### Settings Message Structure

We are sending the following Settings message structure:

```json
{
  "type": "Settings",
  "audio": {
    "input": {
      "encoding": "linear16",
      "sample_rate": 16000
    },
    "output": {
      "encoding": "linear16",
      "sample_rate": 24000
    }
  },
  "agent": {
    "language": "en",
    "listen": {
      "provider": {
        "type": "deepgram",
        "model": "nova-3"
      }
    },
    "think": {
      "provider": {
        "type": "open_ai",
        "model": "gpt-4o-mini"
      },
      "prompt": "You are a helpful assistant that can tell the time.",
      "functions": [
        {
          "name": "get_current_time",
          "description": "Get the current time in a specific timezone. Use this when users ask about the time, what time it is, or current time.",
          "parameters": {
            "type": "object",
            "properties": {
              "timezone": {
                "type": "string",
                "description": "Timezone (e.g., \"America/New_York\", \"UTC\", \"Europe/London\"). Defaults to UTC if not specified."
              }
            }
          }
        }
      ]
    },
    "speak": {
      "provider": {
        "type": "deepgram",
        "model": "aura-asteria-en"
      }
    }
  }
}
```

### Function Structure Verification

Our function structure matches Deepgram's AsyncAPI specification:

- ✅ `name`: string (required)
- ✅ `description`: string (required)
- ✅ `parameters`: object (required, JSON Schema format)
- ✅ `endpoint`: omitted (client-side function)

### Test Results

**Unit Tests**: ✅ All passing
- Functions are correctly included in Settings message
- Function structure is correct

**E2E Tests**: ⚠️ Partial
- Functions are confirmed to be sent in Settings message
- No Error messages received
- `SettingsApplied` not received

### Comparison with Deepgram Examples

We have compared our function structure with:
- [Deepgram Function Calling Documentation](https://developers.deepgram.com/docs/voice-agents-function-calling)
- [Deepgram Function Calling Examples Repository](https://github.com/deepgram-devs/voice-agent-function-calling-examples)
- [Deepgram AsyncAPI Specification](https://github.com/deepgram/deepgram-api-specs)

Our structure matches the specification exactly.

## Questions for Deepgram Support

1. **Account Requirements**: Are there any account-level requirements or feature flags needed to enable function calling?

2. **API Version**: Are we using the correct API version? We're using `wss://agent.deepgram.com/v1/agent/converse` - is this correct for function calling?

3. **Validation**: Are there any additional validation requirements for function definitions that might cause silent rejection (no Error message, but no SettingsApplied)?

4. **Known Issues**: Is this a known issue with function calling in Voice Agent API v1?

5. **Required Fields**: Are there any required fields in the function parameter schema that we might be missing? For example:
   - Is `required: []` array required even for optional parameters?
   - Are there any other JSON Schema requirements?

6. **Provider Compatibility**: Does function calling work with all think providers (OpenAI, Anthropic, etc.)?

## Minimal Test Cases

We have created minimal function definitions to isolate the issue:

### Test Case 1: Absolute Minimal Function
```json
{
  "name": "test",
  "description": "test",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```
**Settings Message Location**: `agent.think.functions[0]` ✅ Verified
**Result**: ❌ `SettingsApplied` still not received
**Error Messages**: None received
**Timing**: Waited 10+ seconds after Settings message sent

### Test Case 2: Minimal Function with Explicit Required Array
```json
{
  "name": "test",
  "description": "test",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```
**Settings Message Location**: `agent.think.functions[0]` ✅ Verified
**Result**: ❌ `SettingsApplied` still not received
**Error Messages**: None received
**Timing**: Waited 10+ seconds after Settings message sent

**Conclusion**: Even the simplest possible function definitions (matching Deepgram spec exactly) result in `SettingsApplied` not being received, confirming this is not a function structure issue.

## WebSocket Message Flow

### Without Functions (Working)
1. Client sends Settings message (no functions)
2. Deepgram responds with `SettingsApplied` ✅

### With Functions (Not Working)
1. Client sends Settings message (with functions)
2. Deepgram does NOT respond with `SettingsApplied` ❌
3. Deepgram does NOT send Error message
4. Connection remains open but settings status unknown

## Component Logs

When functions are included, our component logs:
```
🔍 [SETTINGS DEBUG] Full Settings message with functions: {...}
🔍 [SETTINGS DEBUG] Functions array structure: [...]
📤 [Protocol] Settings message sent successfully
```

**No error logs are generated**, and **no Error messages are received from Deepgram**.

**Component Code Verification**:
- Settings message construction: `src/components/DeepgramVoiceInteraction/index.tsx:1329-1334`
- Functions placement: `agent.think.functions` ✅ Verified in code
- WebSocket endpoint: `wss://agent.deepgram.com/v1/agent/converse` ✅ Verified in `src/types/connection.ts:27`

## Requested Action

Please help us understand:
1. Why `SettingsApplied` is not received when functions are included
2. What requirements or configurations might be missing
3. Whether this is a known issue or expected behavior
4. Recommended workaround or fix

## Additional Information

- **Component Repository**: https://github.com/Signal-Meaning/dg_react_agent
- **Issue Tracking**: Issue #284
- **Test Files**: Available in repository for reproduction
- **Component Version**: v0.6.5+

---

**Submitted**: January 2025  
**Component**: @signal-meaning/deepgram-voice-interaction-react  
**API**: Voice Agent API v1

