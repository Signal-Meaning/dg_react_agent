# API Changes: v0.6.7 to v0.6.8

## Overview

This is a **patch release** that **enhances** the function calling API while maintaining **full backward compatibility**. The `onFunctionCallRequest` callback signature has been enhanced with a new `sendResponse` parameter, and new types have been exported for better TypeScript support.

## Component Props

### Enhanced Callback Signature

#### `onFunctionCallRequest` Callback

**Previous Signature (v0.6.7)**:
```typescript
onFunctionCallRequest?: (functionCall: FunctionCallRequest) => void;
```

**New Signature (v0.6.8)**:
```typescript
onFunctionCallRequest?: (
  functionCall: FunctionCallRequest,
  sendResponse: (response: FunctionCallResponse) => void
) => void;
```

**What Changed**:
- ✅ The callback now receives a **second parameter**: `sendResponse`
- ✅ The `sendResponse` function allows direct response handling without component refs
- ✅ **Backward compatible**: Existing code that only uses the first parameter continues to work

**Benefits**:
- Eliminates the need for component refs and null checks
- More ergonomic API for handling function calls
- Better TypeScript support with explicit types

### Usage Examples

#### New Recommended Pattern (v0.6.8)

```typescript
<DeepgramVoiceInteraction
  apiKey="your-api-key"
  agentOptions={{
    language: 'en',
    voice: 'aura-asteria-en',
    instructions: 'You are a helpful assistant.',
    functions: [
      {
        name: 'get_weather',
        description: 'Get the current weather',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' }
          },
          required: ['location']
        }
      }
    ]
  }}
  onFunctionCallRequest={(request, sendResponse) => {
    // Directly use sendResponse without refs
    if (request.name === 'get_weather') {
      const args = JSON.parse(request.arguments);
      // Execute function
      const result = { temperature: 72, condition: 'sunny' };
      
      // Send response directly
      sendResponse({
        id: request.id,
        result: result
      });
    }
  }}
/>
```

#### Previous Pattern (Still Supported)

```typescript
// Old pattern still works for backward compatibility
const ref = useRef<DeepgramVoiceInteractionRef>(null);

<DeepgramVoiceInteraction
  ref={ref}
  apiKey="your-api-key"
  agentOptions={{ /* ... */ }}
  onFunctionCallRequest={(request) => {
    // Use ref-based method
    if (request.name === 'get_weather') {
      const result = { temperature: 72, condition: 'sunny' };
      ref.current?.sendFunctionCallResponse(
        request.id,
        request.name,
        JSON.stringify(result)
      );
    }
  }}
/>
```

## Type Exports

### New Types Exported

The following types are now exported from the main package:

```typescript
import type {
  FunctionCallRequest,
  FunctionCallResponse
} from '@signal-meaning/deepgram-voice-interaction-react';
```

#### `FunctionCallRequest` Interface

```typescript
export interface FunctionCallRequest {
  id: string;                    // Unique function call ID
  name: string;                   // Function name
  arguments: string;              // JSON string of function arguments
  client_side?: boolean;          // Indicates if this is a client-side function
}
```

#### `FunctionCallResponse` Interface

```typescript
export interface FunctionCallResponse {
  id: string;                     // Function call ID (must match request.id)
  result?: any;                   // Function execution result
  error?: string;                 // Error message if function failed
}
```

**Note**: Either `result` or `error` should be provided, but not both.

## Methods

### Existing Methods Remain Unchanged

#### `sendFunctionCallResponse` (Ref-Based Method)

**Status**: ✅ Still available for backward compatibility

**Signature**:
```typescript
sendFunctionCallResponse(id: string, name: string, content: string): void
```

**Usage**:
```typescript
const ref = useRef<DeepgramVoiceInteractionRef>(null);

// Send response using ref-based method
ref.current?.sendFunctionCallResponse(
  request.id,
  request.name,
  JSON.stringify({ result: 'success' })
);
```

**Recommendation**: Use the new `sendResponse` callback parameter instead for better ergonomics and type safety.

## Existing APIs

### ✅ All Other APIs Remain Unchanged

- ✅ All other component props remain unchanged
- ✅ All other callbacks maintain the same signatures
- ✅ All state properties maintain the same structure
- ✅ All other methods maintain the same signatures
- ✅ All other TypeScript types remain unchanged

## Backward Compatibility

### ✅ 100% Backward Compatible

**Migration Path**:
- **From v0.6.7**: No migration needed, direct update
- **Existing code**: Continues to work without modification
- **New code**: Can adopt the enhanced `sendResponse` parameter

### Compatibility Guarantees

1. **Callback Compatibility**: 
   - Callbacks that only use the first parameter (`functionCall`) continue to work
   - The second parameter (`sendResponse`) is optional to use

2. **Ref-Based Method**: 
   - The `sendFunctionCallResponse` method via ref remains fully functional
   - No deprecation warnings or breaking changes

3. **Type Compatibility**:
   - All existing type definitions remain unchanged
   - New types are additive only

## Migration Guide

### No Migration Required

This release requires **no migration**:
- ✅ Existing code works without changes
- ✅ New features are opt-in
- ✅ No deprecated APIs
- ✅ No breaking changes

### Adopting the New API

To use the enhanced `sendResponse` callback:

**Before (v0.6.7 pattern)**:
```typescript
const ref = useRef<DeepgramVoiceInteractionRef>(null);

<DeepgramVoiceInteraction
  ref={ref}
  onFunctionCallRequest={(request) => {
    // Need ref and null check
    if (ref.current) {
      ref.current.sendFunctionCallResponse(
        request.id,
        request.name,
        JSON.stringify({ result: 'success' })
      );
    }
  }}
/>
```

**After (v0.6.8 enhanced pattern)**:
```typescript
<DeepgramVoiceInteraction
  onFunctionCallRequest={(request, sendResponse) => {
    // Direct use, no ref needed
    sendResponse({
      id: request.id,
      result: { success: true }
    });
  }}
/>
```

### Error Handling

**Using sendResponse with errors**:
```typescript
onFunctionCallRequest={(request, sendResponse) => {
  try {
    const result = executeFunction(request);
    sendResponse({
      id: request.id,
      result: result
    });
  } catch (error) {
    sendResponse({
      id: request.id,
      error: error.message
    });
  }
}}
```

## TypeScript Support

### Importing Types

```typescript
import type {
  FunctionCallRequest,
  FunctionCallResponse,
  DeepgramVoiceInteractionProps,
  DeepgramVoiceInteractionRef
} from '@signal-meaning/deepgram-voice-interaction-react';
```

### Type Safety

The new `sendResponse` callback provides better type safety:

```typescript
onFunctionCallRequest={(request: FunctionCallRequest, sendResponse) => {
  // TypeScript knows the exact signature
  sendResponse({
    id: request.id,        // ✅ Type checked
    result: { /* ... */ }  // ✅ Type checked
  });
}}
```

## Testing

### Test Coverage

- ✅ 13 comprehensive tests for `sendResponse` callback
- ✅ Backward compatibility tests for ref-based method
- ✅ Error handling tests
- ✅ Type safety verification

## Related Documentation

- [Changelog](CHANGELOG.md) - Complete list of changes
- [Release Notes](RELEASE-NOTES.md) - Release summary
- [Issue #293](https://github.com/Signal-Meaning/dg_react_agent/issues/293) - sendResponse callback enhancement
- [PR #296](https://github.com/Signal-Meaning/dg_react_agent/pull/296) - Implementation details

## Summary

| Change Type | Description | Breaking? |
|------------|-------------|-----------|
| **Enhanced** | `onFunctionCallRequest` callback signature (added `sendResponse` parameter) | ❌ No |
| **Added** | `FunctionCallRequest` type export | ❌ No |
| **Added** | `FunctionCallResponse` type export | ❌ No |
| **Unchanged** | `sendFunctionCallResponse` ref-based method | ✅ Still available |
| **Changed** | None | - |
| **Deprecated** | None | - |
| **Removed** | None | - |

**Result**: ✅ **100% Backward Compatible** - No breaking changes

---

**Previous Version**: [v0.6.7 API Changes](../v0.6.7/)  
**Full Documentation**: [docs/releases/v0.6.8/](./)  
**GitHub Repository**: [Signal-Meaning/dg_react_agent](https://github.com/Signal-Meaning/dg_react_agent)

