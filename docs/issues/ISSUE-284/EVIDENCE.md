# Issue #284: Evidence Collection

This document collects all evidence related to Issue #284: onSettingsApplied Callback and Function Calling.

## Test Files Created

### Unit Tests

1. **`tests/on-settings-applied-callback.test.tsx`** (602 lines)
   - **Purpose**: Comprehensive test coverage for `onSettingsApplied` callback
   - **Test Count**: 9 tests
   - **Status**: ✅ All passing
   - **Coverage**:
     - Basic callback invocation
     - Callback optionality
     - Callback timing and order
     - Edge cases (unmount, reconnection, other events)
     - Integration with other callbacks

2. **`tests/function-calling-settings.test.tsx`** (490 lines)
   - **Purpose**: Verify functions are included in Settings message
   - **Test Count**: 6 tests
   - **Status**: ✅ All passing
   - **Coverage**:
     - Functions included when provided
     - Multiple functions
     - Server-side functions (with endpoint)
     - Functions not included when not provided
     - Empty functions array handling
     - Extra properties preservation

### E2E Tests

3. **`test-app/tests/e2e/function-calling-e2e.spec.js`** (501 lines)
   - **Purpose**: End-to-end verification of function calling
   - **Test Count**: 2 tests
   - **Status**: 1 passing, 1 failing (due to SettingsApplied not received)
   - **Coverage**:
     - Functions included in Settings message ✅
     - End-to-end function calling flow ⚠️ (fails due to SettingsApplied issue)

## Test Results

### Unit Test Results

```
PASS tests/function-calling-settings.test.tsx
  ✓ should include functions in agent.think.functions when provided in agentOptions (37 ms)
  ✓ should include multiple functions in agent.think.functions (7 ms)
  ✓ should include server-side functions with endpoint in agent.think.functions (7 ms)
  ✓ should NOT include functions in Settings when agentOptions.functions is not provided (6 ms)
  ✓ should NOT include functions in Settings when agentOptions.functions is empty array (5 ms)
  ✓ should preserve extra properties in functions (like client_side, functionInstructions) (5 ms)

PASS tests/on-settings-applied-callback.test.tsx
  ✓ should call onSettingsApplied when SettingsApplied event is received (11 ms)
  ✓ should NOT call onSettingsApplied when callback is not provided (7 ms)
  ✓ should call onSettingsApplied exactly once per SettingsApplied event (9 ms)
  ✓ should call onSettingsApplied after connection state changes to connected (9 ms)
  ✓ should call onSettingsApplied after Welcome message is received (8 ms)
  ✓ should handle SettingsApplied event even if component unmounts before callback completes (7 ms)
  ✓ should handle multiple SettingsApplied events during reconnection scenarios (12 ms)
  ✓ should NOT call onSettingsApplied for other event types (103 ms)
  ✓ should work correctly when used alongside other callbacks (11 ms)

Tests: 15 passed, 15 total
```

**Summary**: ✅ All 15 unit tests passing

## Code Changes

### Files Modified

1. **`src/components/DeepgramVoiceInteraction/index.tsx`**
   - **Lines Changed**: 91 additions, 1 deletion
   - **Key Changes**:
     - Added function inclusion in Settings message (line 1329-1334)
     - Added enhanced logging for Settings message with functions (line 1370-1386)
     - Added error detection logging (line 1409-1411)
     - Added `FunctionCallRequest` handling (line 1601-1627)
     - Added `sendFunctionCallResponse` method (line 2338-2354)
     - Exposed `sendFunctionCallResponse` via ref (line 2562)

2. **`src/types/index.ts`**
   - **Lines Changed**: 23 additions
   - **Key Changes**:
     - Added `onFunctionCallRequest` callback to props (line 147-159)
     - Added `sendFunctionCallResponse` method to handle (line 339)

3. **`test-app/src/App.tsx`**
   - Added function definition for testing (line 223-241)
   - Removed `client_side` property (not part of Settings message)
   - Added `onFunctionCallRequest` handler

### Code Snippets

#### Function Inclusion in Settings Message

**Location**: `src/components/DeepgramVoiceInteraction/index.tsx:1329-1334`

```typescript
// Include functions if provided in agentOptions
// Functions without endpoint are client-side (executed by the client)
// Functions with endpoint are server-side (executed by the server)
...(agentOptions.functions && agentOptions.functions.length > 0 ? {
  functions: agentOptions.functions
} : {})
```

#### FunctionCallRequest Handling

**Location**: `src/components/DeepgramVoiceInteraction/index.tsx:1601-1627`

```typescript
// Handle FunctionCallRequest from Deepgram
if (data.type === 'FunctionCallRequest') {
  console.log('🔧 [FUNCTION] FunctionCallRequest received from Deepgram');
  log('FunctionCallRequest received from Deepgram');
  
  // Extract function call information
  const functions = Array.isArray((data as any).functions) ? (data as any).functions : [];
  
  if (functions.length > 0) {
    // For each function call request, invoke the callback
    functions.forEach((funcCall: { id: string; name: string; arguments: string; client_side: boolean }) => {
      if (funcCall.client_side) {
        // Only invoke callback for client-side functions
        onFunctionCallRequest?.({
          id: funcCall.id,
          name: funcCall.name,
          arguments: funcCall.arguments,
          client_side: funcCall.client_side
        });
      } else {
        log('Server-side function call received (not handled by component):', funcCall.name);
      }
    });
  }
  
  return;
}
```

#### sendFunctionCallResponse Method

**Location**: `src/components/DeepgramVoiceInteraction/index.tsx:2338-2354`

```typescript
const sendFunctionCallResponse = (id: string, name: string, content: string): void => {
  if (!agentManagerRef.current) {
    log('Cannot send FunctionCallResponse: agent manager not available');
    throw new Error('Agent manager not available');
  }

  const responseMessage = {
    type: 'FunctionCallResponse',
    id: id,
    name: name,
    content: content
  };

  console.log('🔧 [FUNCTION] Sending FunctionCallResponse to Deepgram:', responseMessage);
  log('Sending FunctionCallResponse to Deepgram');
  agentManagerRef.current.sendJSON(responseMessage);
};
```

## Documentation Changes

### API Reference

**File**: `docs/API-REFERENCE.md` (moved from `docs/releases/v0.5.0/API-REFERENCE.md`)

**Changes**:
1. Added `onFunctionCallRequest` to props interface
2. Added `onFunctionCallRequest` to Agent Events table
3. Added `sendFunctionCallResponse` to Function Calling Methods section
4. Added `functions?: AgentFunction[]` to `AgentOptions` type
5. Added `AgentFunction` interface definition
6. Added complete function calling example
7. Updated version to 0.6.5+

## Git History

Relevant commits:
- `a491f1f` - Merge pull request #285 from Signal-Meaning/davidrmcgee/issue284
- `899f113` - Add comprehensive test coverage for onSettingsApplied callback (Issue #284)
- `e7351f0` - feat: Add onSettingsApplied callback (Issue #162 Phase 0)

## Test Execution Evidence

### Unit Test Execution

**Command**: `npm test -- tests/on-settings-applied-callback.test.tsx tests/function-calling-settings.test.tsx`

**Result**: 
```
Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
Time:        1.073 s
```

### E2E Test Execution

**Command**: `npx playwright test tests/e2e/function-calling-e2e.spec.js`

**Result**:
- Test 1: "should verify functions are included in Settings message" ✅ Passing
- Test 2: "should trigger client-side function call and execute it" ⚠️ Failing (SettingsApplied not received)

## Function Structure Evidence

### Our Implementation

```typescript
interface AgentFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;  // JSON Schema object
  endpoint?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
  };
}
```

### Deepgram Specification Match

✅ **Verified**: Our structure matches Deepgram's AsyncAPI specification:
- `name`: string (required) ✅
- `description`: string (required) ✅
- `parameters`: object (required, JSON Schema format) ✅
- `endpoint`: object (optional, if not provided, function is client-side) ✅

## Settings Message Evidence

### Logging Output

When functions are included, the component logs:
```
🔍 [SETTINGS DEBUG] Full Settings message with functions: {...}
🔍 [SETTINGS DEBUG] Functions array structure: [...]
```

### Settings Message Structure

Functions are correctly placed in:
```json
{
  "type": "Settings",
  "agent": {
    "think": {
      "functions": [
        {
          "name": "get_current_time",
          "description": "...",
          "parameters": {
            "type": "object",
            "properties": {...}
          }
        }
      ]
    }
  }
}
```

## Known Issues

### SettingsApplied Not Received

**Status**: ⚠️ Confirmed with Minimal Functions

**Evidence**:
- ✅ Functions are confirmed to be sent in Settings message (via component logs and unit tests)
- ✅ No Error messages received from Deepgram
- ⚠️ `SettingsApplied` not received when functions are included (even minimal functions)
- ✅ `SettingsApplied` received when functions are NOT included

**Minimal Function Test Results** (January 2025):
1. **Absolute Minimal Function** (`name: 'test'`, `description: 'test'`, empty `properties`):
   - ✅ Functions sent correctly (verified via unit tests)
   - ❌ `SettingsApplied` NOT received
   - ✅ No Error messages from Deepgram

2. **Minimal Function with Explicit `required: []`**:
   - ✅ Functions sent correctly (verified via unit tests)
   - ❌ `SettingsApplied` NOT received
   - ✅ No Error messages from Deepgram

**Conclusion**: The issue is NOT related to:
- Function complexity (even minimal functions fail)
- Missing `required` array (explicit required array still fails)
- Function structure (matches Deepgram spec exactly)

**Possible Causes**:
1. Deepgram API validation issue (silent rejection)
2. Account-level feature flag requirement for function calling
3. API version compatibility issue
4. Deepgram API bug or limitation

## File Statistics

- **Total Test Code**: 1,593 lines
  - `tests/on-settings-applied-callback.test.tsx`: 602 lines
  - `tests/function-calling-settings.test.tsx`: 490 lines
  - `test-app/tests/e2e/function-calling-e2e.spec.js`: 501 lines

- **Code Changes**: 113 lines added/modified
  - `src/components/DeepgramVoiceInteraction/index.tsx`: 91 additions, 1 deletion
  - `src/types/index.ts`: 23 additions

## Verification Checklist

- ✅ Functions are included in Settings message (unit tests)
- ✅ Functions structure matches Deepgram spec (comparison)
- ✅ `onSettingsApplied` callback works correctly (unit tests)
- ✅ `onFunctionCallRequest` callback implemented (code)
- ✅ `sendFunctionCallResponse` method implemented (code)
- ✅ Function calling API documented (API-REFERENCE.md)
- ⚠️ `SettingsApplied` received when functions included (E2E test failing)

---

**Last Updated**: January 2025  
**Evidence Collection Date**: January 2025

