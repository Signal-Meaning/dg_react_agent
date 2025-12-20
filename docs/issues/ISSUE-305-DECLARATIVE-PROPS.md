# Issue #305: Add Declarative Props to Reduce Imperative Ref Usage

## Problem Statement

The component currently requires extensive use of `deepgramRef` for imperative actions, which creates several issues:

1. **Testing Fragility**: Tests must access `window.deepgramRef?.current`, which is fragile and requires special setup
2. **Non-Declarative**: Many actions that could be declarative (React props) are instead imperative (ref methods)
3. **Type Safety**: Ref methods are less type-safe than props
4. **React Patterns**: Goes against React's declarative philosophy

## Current Imperative Usage

We use `deepgramRef` for:

1. `injectUserMessage(message: string)` - Sending text messages
2. `start(options?: { agent?: boolean; transcription?: boolean })` - Starting connections
3. `stop()` - Stopping connections
4. `sendFunctionCallResponse(id, name, content)` - Sending function call responses
5. `interruptAgent()` - Interrupting TTS playback
6. `startAudioCapture()` - Starting microphone capture

## Proposed Declarative Alternatives

### 1. Text Message Input → Declarative Prop

**Current (Imperative)**:
```tsx
deepgramRef.current?.injectUserMessage('Hello');
```

**Proposed (Declarative)**:
```tsx
<DeepgramVoiceInteraction
  userMessage={userMessage} // Triggers when prop changes
  onUserMessageSent={() => setUserMessage(null)} // Clear after sent
/>
```

**Benefits**:
- More React-idiomatic
- Easier to test (just change props)
- Type-safe
- No ref needed

### 2. Connection Control → Declarative Props

**Current (Imperative)**:
```tsx
deepgramRef.current?.start({ agent: true });
deepgramRef.current?.stop();
```

**Proposed (Declarative)**:
```tsx
<DeepgramVoiceInteraction
  autoStartAgent={true}
  autoStartTranscription={false}
  // OR
  connectionState="connected" // 'connected' | 'disconnected' | 'auto'
/>
```

**Benefits**:
- Controlled component pattern
- Easier to reason about
- No ref needed

### 3. Function Call Response → Callback Return Value

**Current (Imperative)**:
```tsx
onFunctionCallRequest={(request) => {
  // Execute function
  deepgramRef.current?.sendFunctionCallResponse(id, name, result);
}}
```

**Proposed (Declarative)**:
```tsx
onFunctionCallRequest={async (request) => {
  // Execute function
  return result; // Component handles sending response
  // OR
  return Promise.resolve(result);
}}
```

**Benefits**:
- More functional/declarative
- Component handles response sending
- No ref needed

### 4. TTS Interruption → Declarative Prop

**Current (Imperative)**:
```tsx
deepgramRef.current?.interruptAgent();
```

**Proposed (Declarative)**:
```tsx
<DeepgramVoiceInteraction
  interruptAgent={shouldInterrupt} // Boolean prop
  onAgentInterrupted={() => setShouldInterrupt(false)} // Clear flag
/>
```

**Benefits**:
- Controlled by parent state
- Easier to test
- No ref needed

### 5. Audio Capture → Declarative Prop

**Current (Imperative)**:
```tsx
deepgramRef.current?.startAudioCapture();
```

**Proposed (Declarative)**:
```tsx
<DeepgramVoiceInteraction
  startAudioCapture={isMicrophoneActive} // Boolean prop
/>
```

**Benefits**:
- Controlled by parent state
- Easier to test
- No ref needed

## What Must Stay Imperative

Some actions genuinely need to be imperative:

1. `getAudioContext()` - Getting a reference to AudioContext (genuinely needs ref)
2. `updateAgentInstructions()` - Updating instructions dynamically (could be prop, but imperative makes sense)

## Testing Improvements

With declarative props, tests become much simpler:

**Current (Fragile)**:
```tsx
const deepgramRef = (window as any).deepgramRef?.current;
expect(deepgramRef).toBeDefined(); // ❌ Fragile
await deepgramRef.injectUserMessage('test');
```

**Proposed (Robust)**:
```tsx
const { rerender } = render(<App />);
rerender(<App userMessage="test" />); // ✅ Declarative
await waitFor(() => {
  expect(screen.getByText('test')).toBeInTheDocument();
});
```

## Implementation Status

### ✅ Completed

1. **API Tests Created** (`test-app/tests/e2e/declarative-props-api.spec.js`)
   - Comprehensive test suite covering all 5 declarative props
   - Tests use selector-based waits (no `waitForTimeout` antipatterns)
   - Tests include backward compatibility verification
   - All tests structured to work once implementation is complete

2. **API Documentation Updated** (`docs/API-REFERENCE.md`)
   - Added complete "Declarative Props (Issue #305)" section
   - Documented all props with examples and benefits
   - Updated "API Evolution Since Fork" section
   - Includes migration guidance and backward compatibility notes

### ⏳ In Progress

3. **Type Definitions** (`src/types/index.ts`)
   - Need to add new prop types to `DeepgramVoiceInteractionProps` interface
   - Props to add:
     - `userMessage?: string | null`
     - `onUserMessageSent?: () => void`
     - `autoStartAgent?: boolean`
     - `autoStartTranscription?: boolean`
     - `connectionState?: 'connected' | 'disconnected' | 'auto'`
     - `interruptAgent?: boolean`
     - `onAgentInterrupted?: () => void`
     - `startAudioCapture?: boolean`

### ❌ Not Started

4. **Component Implementation** (`src/components/DeepgramVoiceInteraction/index.tsx`)
   - Implement `userMessage` prop with `useEffect` to watch for changes
   - Implement `autoStartAgent` / `autoStartTranscription` / `connectionState` props
   - Enhance `onFunctionCallRequest` to support return value
   - Implement `interruptAgent` prop with `onAgentInterrupted` callback
   - Implement `startAudioCapture` prop
   - Ensure backward compatibility with all imperative methods

5. **Test App Updates** (`test-app/src/App.tsx`)
   - Add UI controls for declarative props (optional, for manual testing)
   - Expose state setters for E2E tests (if needed)

## Impact

- **Reduced ref usage**: From 6+ imperative methods to 1-2 (only for edge cases)
- **Better testability**: No need for `window.deepgramRef` exposure
- **More React-idiomatic**: Follows React's declarative patterns
- **Type safety**: Props are more type-safe than ref methods
- **Easier to reason about**: State flows through props, not imperative calls

## Related Context

This issue was identified while working on the voice-commerce project, where we need to expose refs to `window` for testing, which is a code smell indicating the API could be improved.

## Next Steps

1. Update type definitions in `src/types/index.ts`
2. Implement declarative props in component
3. Update test app if needed
4. Run tests to verify implementation
5. Update any remaining documentation

## References

- GitHub Issue: https://github.com/Signal-Meaning/dg_react_agent/issues/305
- API Reference: `docs/API-REFERENCE.md` (Declarative Props section)
- Test File: `test-app/tests/e2e/declarative-props-api.spec.js`
