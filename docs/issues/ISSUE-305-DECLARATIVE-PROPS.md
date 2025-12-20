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

**Status**: ✅ Completed

**Location**: `tests/declarative-props.test.tsx`

**Description**: Comprehensive unit tests have been created covering:

- **Edge Case Coverage**:
  - ✅ Rapid prop changes (e.g., `userMessage` changing multiple times quickly)
  - ✅ Prop changes when component is unmounting
  - ✅ Invalid prop combinations (e.g., `connectionState="connected"` with `autoStartAgent={false}`)
  - ✅ Prop changes when services are not ready (e.g., `startAudioCapture={true}` before agent connection)
  - ✅ First render skip behavior
  - ✅ Null/undefined prop handling
  
- **Error Handling**:
  - ✅ Behavior when `injectUserMessage` fails
  - ✅ Behavior when `start()` fails
  - ✅ Behavior when `stop()` fails
  - ✅ Behavior when `interruptAgent()` fails
  - ✅ Behavior when `startAudioCapture()` fails
  - ✅ Behavior when `stopRecording()` fails
  - ✅ Error propagation and callback invocation on failures

- **State Synchronization**:
  - ✅ Verification that prop changes trigger correct imperative method calls
  - ✅ Verification that callbacks (`onUserMessageSent`, `onAgentInterrupted`) are called at correct times
  - ✅ Verification that props don't trigger actions when already in desired state

**Testing Framework**: Jest + React Testing Library

**Test Coverage**: 20+ test cases covering all declarative props and edge cases

### 2. Refactoring Consideration

**Status**: ✅ Completed

**Location**: `docs/issues/ISSUE-305-REFACTORING-ANALYSIS.md`

**Description**: Comprehensive refactoring analysis has been completed, identifying:

- **Code Organization Opportunities**:
  - ✅ Analysis of `useEffect` hooks for declarative props
  - ✅ Proposed custom hooks: `useDeclarativeProp`, `useBooleanDeclarativeProp`, `useConnectionState`
  - ✅ Error handling helper function extraction
  - ✅ Code organization improvements

- **Performance Optimizations**:
  - ✅ Debouncing rapid prop changes (analysis complete, implementation optional)
  - ✅ Memoization improvements (identified, partially implemented)
  - ✅ Dependency array optimization (identified)

- **Maintainability Improvements**:
  - ✅ Documentation recommendations
  - ✅ Testing strategy
  - ✅ Migration path for future refactoring
  - ✅ Priority recommendations (High/Medium/Low)

**Key Findings**:
- Current implementation is functional and well-tested
- Highest-value refactoring: Extract `useBooleanDeclarativeProp` and `useConnectionState` hooks
- Refactoring is optional and can be done incrementally
- All recommendations maintain backward compatibility

**Next Steps** (Optional):
- Implement high-priority refactoring (extract custom hooks) if desired
- Add JSDoc documentation for better developer experience
- Consider debouncing for rapid prop changes if it becomes an issue

## References

- GitHub Issue: https://github.com/Signal-Meaning/dg_react_agent/issues/305
- API Reference: `docs/API-REFERENCE.md` (Declarative Props section)
- Test File: `test-app/tests/e2e/declarative-props-api.spec.js`
