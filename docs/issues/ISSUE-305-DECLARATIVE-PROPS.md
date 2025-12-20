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
   - Comprehensive E2E test suite covering all 5 declarative props
   - Tests use selector-based waits (no `waitForTimeout` antipatterns)
   - Tests include backward compatibility verification
   - All 15 tests passing

2. **API Documentation Updated** (`docs/API-REFERENCE.md`)
   - Added complete "Declarative Props (Issue #305)" section
   - Documented all props with examples and benefits
   - Updated "API Evolution Since Fork" section
   - Includes migration guidance and backward compatibility notes

3. **Type Definitions** (`src/types/index.ts`)
   - Added all new prop types to `DeepgramVoiceInteractionProps` interface:
     - `userMessage?: string | null`
     - `onUserMessageSent?: () => void`
     - `autoStartAgent?: boolean`
     - `autoStartTranscription?: boolean`
     - `connectionState?: 'connected' | 'disconnected' | 'auto'`
     - `interruptAgent?: boolean`
     - `onAgentInterrupted?: () => void`
     - `startAudioCapture?: boolean`
   - Enhanced `onFunctionCallRequest` to support return values (`void`, `FunctionCallResponse`, or `Promise<FunctionCallResponse>`)

4. **Component Implementation** (`src/components/DeepgramVoiceInteraction/index.tsx`)
   - Implemented `userMessage` prop with `useEffect` to watch for changes and trigger `injectUserMessage`
   - Implemented `autoStartAgent` / `autoStartTranscription` / `connectionState` props with connection management
   - Enhanced `onFunctionCallRequest` to support declarative return value pattern
   - Implemented `interruptAgent` prop with `onAgentInterrupted` callback
   - Implemented `startAudioCapture` prop with audio capture management
   - Maintained backward compatibility with all imperative methods
   - Fixed TypeScript linting errors (proper type assertions, optional chaining)

5. **Test App Updates** (`test-app/src/App.tsx`)
   - Added declarative state management for all props
   - Exposed state setters/getters for E2E tests via `window` variables
   - Implemented polling mechanism for test-driven prop updates
   - Added proper TypeScript types for test window properties
   - Fixed all linting errors (moved `useCallback` hooks before early returns, replaced `any` types)
   - Synced `micEnabled` state with `declarativeStartAudioCapture` prop for accurate DOM status

## Impact

- **Reduced ref usage**: From 6+ imperative methods to 1-2 (only for edge cases)
- **Better testability**: No need for `window.deepgramRef` exposure
- **More React-idiomatic**: Follows React's declarative patterns
- **Type safety**: Props are more type-safe than ref methods
- **Easier to reason about**: State flows through props, not imperative calls

## Related Context

This issue was identified while working on the voice-commerce project, where we need to expose refs to `window` for testing, which is a code smell indicating the API could be improved.

## Future Work / TODOs

### 1. Unit Tests for Declarative Prop Logic

**Status**: ❌ Not Started

**Description**: Add comprehensive unit tests for the declarative prop logic in the component implementation. Current E2E tests verify end-to-end behavior, but unit tests would provide:

- **Edge Case Coverage**:
  - Rapid prop changes (e.g., `userMessage` changing multiple times quickly)
  - Prop changes during connection state transitions
  - Prop changes when component is unmounting
  - Invalid prop combinations (e.g., `connectionState="connected"` with `autoStartAgent={false}`)
  - Prop changes when services are not ready (e.g., `startAudioCapture={true}` before agent connection)
  
- **Error Handling**:
  - Behavior when `injectUserMessage` fails
  - Behavior when `start()` fails
  - Behavior when `interruptAgent()` fails
  - Behavior when `startAudioCapture()` fails
  - Error propagation and callback invocation on failures

- **State Synchronization**:
  - Verification that prop changes trigger correct imperative method calls
  - Verification that callbacks (`onUserMessageSent`, `onAgentInterrupted`) are called at correct times
  - Verification that prop state is properly reset after actions complete

**Suggested Location**: `tests/unit/DeepgramVoiceInteraction.declarative-props.test.tsx` or similar

**Testing Framework**: Jest + React Testing Library

### 2. Refactoring Consideration

**Status**: ❌ Not Started

**Description**: Review the implementation to determine if any further refactoring would improve:

- **Code Organization**:
  - Whether the `useEffect` hooks for declarative props could be consolidated
  - Whether prop change detection logic could be extracted into custom hooks
  - Whether the imperative/declarative bridge logic could be simplified

- **Performance**:
  - Whether prop change detection could be optimized (e.g., debouncing rapid changes)
  - Whether unnecessary re-renders are triggered by prop changes
  - Whether memoization could be improved

- **Maintainability**:
  - Whether the code structure makes it easy to add new declarative props in the future
  - Whether the test app's prop management could be simplified
  - Whether documentation could be clearer about when to use declarative vs. imperative APIs

**Action Items**:
- Code review session focused on refactoring opportunities
- Performance profiling of prop change handling
- Documentation review for clarity and completeness

## References

- GitHub Issue: https://github.com/Signal-Meaning/dg_react_agent/issues/305
- API Reference: `docs/API-REFERENCE.md` (Declarative Props section)
- Test File: `test-app/tests/e2e/declarative-props-api.spec.js`
