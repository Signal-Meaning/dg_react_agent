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

## Unit Tests for Declarative Prop Logic

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

## Refactoring Analysis

**Status**: ✅ Completed

This section analyzes the declarative props implementation for refactoring opportunities to improve code organization, performance, and maintainability.

### Current Implementation Analysis

#### Code Structure

The declarative props are currently implemented as separate `useEffect` hooks in the main component:

1. **userMessage prop** (lines 3012-3040)
2. **connectionState / autoStart props** (lines 3042-3105)
3. **interruptAgent prop** (lines 3107-3125)
4. **startAudioCapture prop** (lines 3127-3168)

Each hook follows a similar pattern:
- Uses a `prev*Ref` to track previous values
- Skips on first render
- Only acts when prop changes to a specific value
- Calls imperative methods and handles errors
- Updates the ref at the end

#### Identified Patterns

1. **First-render skip pattern**: All hooks check if `prev*Ref.current === undefined`
2. **Change detection pattern**: Compare current prop with previous value
3. **Error handling pattern**: All async operations have `.catch()` with `handleError()`
4. **Callback invocation pattern**: Success callbacks are called after operations complete

### Refactoring Opportunities

#### 1. Extract Custom Hooks

##### 1.1 `useDeclarativeProp` Generic Hook

**Purpose**: Extract the common pattern of tracking previous prop values and detecting changes.

**Benefits**:
- Reduces code duplication
- Makes it easier to add new declarative props
- Centralizes the "skip first render" logic

**Proposed Implementation**:
```typescript
/**
 * Generic hook for declarative props that trigger actions on change
 * @param currentValue - Current prop value
 * @param onChange - Callback when value changes (not called on first render)
 * @param shouldTrigger - Optional predicate to determine if change should trigger action
 */
function useDeclarativeProp<T>(
  currentValue: T,
  onChange: (newValue: T, prevValue: T | undefined) => void,
  shouldTrigger?: (newValue: T, prevValue: T | undefined) => boolean
): void {
  const prevValueRef = useRef<T | undefined>(undefined);
  
  useEffect(() => {
    // Skip on first render
    if (prevValueRef.current === undefined) {
      prevValueRef.current = currentValue;
      return;
    }
    
    // Check if value actually changed
    if (currentValue !== prevValueRef.current) {
      // Use custom predicate if provided, otherwise trigger on any change
      if (!shouldTrigger || shouldTrigger(currentValue, prevValueRef.current)) {
        onChange(currentValue, prevValueRef.current);
      }
      prevValueRef.current = currentValue;
    }
  }, [currentValue, onChange, shouldTrigger]);
}
```

##### 1.2 `useBooleanDeclarativeProp` Hook

**Purpose**: Specialized hook for boolean props that trigger actions when changing to `true` or `false`.

**Benefits**:
- Simplifies boolean prop handling
- Handles the common "only trigger on true" or "only trigger on false" patterns

**Proposed Implementation**:
```typescript
/**
 * Hook for boolean declarative props
 * @param currentValue - Current boolean prop value
 * @param onTrue - Callback when prop changes to true
 * @param onFalse - Optional callback when prop changes to false
 * @param onCallback - Optional callback to call after action completes
 */
function useBooleanDeclarativeProp(
  currentValue: boolean | undefined,
  onTrue: () => void,
  onFalse?: () => void,
  onCallback?: () => void
): void {
  const prevValueRef = useRef<boolean | undefined>(undefined);
  
  useEffect(() => {
    // Skip on first render
    if (prevValueRef.current === undefined) {
      prevValueRef.current = currentValue;
      return;
    }
    
    // Only act when value changes
    if (currentValue === true && prevValueRef.current !== true) {
      onTrue();
      onCallback?.();
    } else if (currentValue === false && prevValueRef.current !== false && onFalse) {
      onFalse();
      onCallback?.();
    }
    
    prevValueRef.current = currentValue;
  }, [currentValue, onTrue, onFalse, onCallback]);
}
```

##### 1.3 `useConnectionState` Hook

**Purpose**: Extract the complex connection state logic into a dedicated hook.

**Benefits**:
- Isolates complex connection state determination logic
- Makes the main component cleaner
- Easier to test connection state logic independently

**Note**: Full implementation details available in the component code (lines 3042-3105).

#### 2. Performance Optimizations

##### 2.1 Debouncing Rapid Prop Changes

**Issue**: Rapid prop changes (e.g., userMessage changing multiple times quickly) could trigger multiple operations.

**Solution**: Add optional debouncing to `useDeclarativeProp` (implementation optional, only if needed).

**Consideration**: Only apply debouncing where it makes sense (e.g., userMessage might benefit, but interruptAgent should be immediate).

##### 2.2 Memoization of Callbacks

**Issue**: Callbacks passed to `useEffect` dependencies might cause unnecessary re-renders.

**Solution**: Use `useCallback` for all callbacks passed to declarative prop hooks.

**Status**: Already partially implemented, but could be more consistent.

##### 2.3 Reduce Dependency Array Re-computations

**Issue**: Some `useEffect` dependency arrays include functions that are recreated on every render.

**Solution**: Ensure all functions in dependency arrays are memoized with `useCallback`.

#### 3. Code Organization Improvements

##### 3.1 Extract Error Handling Logic

**Issue**: Error handling is duplicated across all declarative props.

**Solution**: Create a helper function for consistent error handling:

```typescript
function createDeclarativeErrorHandler(
  service: 'agent' | 'transcription',
  code: string,
  operation: string
): (error: unknown) => void {
  return (error: unknown) => {
    handleError({
      service,
      code,
      message: `Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  };
}
```

##### 3.2 Type Safety Improvements

**Solution**: Create specific types for declarative prop callbacks:

```typescript
type DeclarativePropChangeHandler<T> = (newValue: T, prevValue: T | undefined) => void;
type BooleanPropChangeHandler = () => void;
```

### Recommended Refactoring Priority

#### High Priority (Immediate Benefits)

1. **Extract `useBooleanDeclarativeProp` hook** - Simplifies `interruptAgent` and `startAudioCapture` props
2. **Extract error handling helper** - Reduces duplication
3. **Add unit tests** - ✅ Already completed

#### Medium Priority (Code Quality)

1. **Extract `useConnectionState` hook** - Isolates complex logic
2. **Improve memoization** - Ensure all callbacks are properly memoized
3. **Add JSDoc documentation** - Improve developer experience

#### Low Priority (Nice to Have)

1. **Extract generic `useDeclarativeProp` hook** - May be over-engineering for current use case
2. **Add debouncing** - Only needed if rapid prop changes become an issue
3. **Create separate file for declarative props** - Current organization is acceptable

### Key Findings

- Current implementation is functional and well-tested
- Highest-value refactoring: Extract `useBooleanDeclarativeProp` and `useConnectionState` hooks
- Refactoring is optional and can be done incrementally
- All recommendations maintain backward compatibility

### Implementation Notes

#### Backward Compatibility

All refactoring must maintain:
- ✅ Same prop API
- ✅ Same behavior
- ✅ Same error handling
- ✅ Same callback timing

#### Testing Strategy

1. ✅ Unit tests for declarative props (completed)
2. Run existing E2E tests to verify no regressions
3. Add tests for custom hooks if extracted
4. Performance testing for rapid prop changes

#### Migration Path

If custom hooks are extracted:

1. Create hooks in `src/hooks/declarative-props.ts`
2. Update component to use hooks
3. Run all tests to verify
4. Update documentation

### Conclusion

The current implementation is functional and well-tested. The main refactoring opportunities are:

1. **Extract custom hooks** to reduce duplication and make adding new props easier
2. **Improve error handling consistency** with helper functions
3. **Enhance documentation** for better maintainability

The highest-value refactoring would be extracting `useBooleanDeclarativeProp` and `useConnectionState` hooks, as these would immediately simplify the code and make it easier to add new declarative props in the future.

## References

- GitHub Issue: https://github.com/Signal-Meaning/dg_react_agent/issues/305
- API Reference: `docs/API-REFERENCE.md` (Declarative Props section)
- Test File: `test-app/tests/e2e/declarative-props-api.spec.js`
