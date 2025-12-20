# Issue #305: Refactoring Analysis - Declarative Props Implementation

## Executive Summary

The declarative props implementation is **functional and well-tested**, but there are opportunities to improve **DRY principles**, **consistency**, and **maintainability**. The highest-value improvements would be:

1. **Extract custom hooks** to reduce duplication (High Priority)
2. **Standardize first-render handling** across all props (Medium Priority)
3. **Extract error handling helpers** to reduce repetition (Medium Priority)

## Current State Analysis

### ✅ What's Working Well

1. **Comprehensive test coverage** - All edge cases are tested
2. **Clear separation of concerns** - Each prop has its own `useEffect`
3. **Proper error handling** - All operations have error handling
4. **Callback ref pattern** - `onAgentInterruptedRef` avoids stale closures

### ⚠️ Issues Identified

#### 1. Inconsistent First-Render Handling (Medium Priority)

**Problem**: Three different approaches to detecting first render:

```typescript
// Approach 1: Simple undefined check (userMessage, most of codebase)
if (prevUserMessageRef.current === undefined) {
  prevUserMessageRef.current = userMessage;
  return;
}

// Approach 2: Separate boolean ref (interruptAgent)
const isFirstRender = isFirstInterruptAgentRenderRef.current;
if (isFirstRender) {
  isFirstInterruptAgentRenderRef.current = false;
  prevInterruptAgentPropRef.current = interruptAgentProp;
  return;
}

// Approach 3: Complex conditional (startAudioCapture)
if (prevValue === undefined && startAudioCaptureProp !== true) {
  prevStartAudioCaptureRef.current = startAudioCaptureProp;
  return;
}
```

**Impact**: 
- Makes code harder to understand
- Inconsistent behavior could lead to bugs
- Harder to maintain

**Recommendation**: Standardize on Approach 1 (simple undefined check) for consistency with the rest of the codebase, unless there's a specific reason for the complexity.

#### 2. Code Duplication (High Priority)

**Problem**: Repetitive patterns across declarative props:

```typescript
// Pattern repeated 3+ times:
const prevXRef = useRef<T | undefined>(undefined);

useEffect(() => {
  if (prevXRef.current === undefined) {
    prevXRef.current = currentValue;
    return;
  }
  
  if (currentValue !== prevXRef.current) {
    // Action logic
  }
  
  prevXRef.current = currentValue;
}, [currentValue, ...deps]);
```

**Impact**:
- More code to maintain
- Harder to add new declarative props
- Bugs need to be fixed in multiple places

**Recommendation**: Extract to custom hooks (see below).

#### 3. Error Handling Duplication (Medium Priority)

**Problem**: Similar error handling patterns repeated:

```typescript
// Pattern repeated multiple times:
.catch((error) => {
  log('[Declarative] Failed to ...:', error);
  handleError({
    service: 'agent' | 'transcription',
    code: '..._failed',
    message: `Failed to ...: ${error instanceof Error ? error.message : 'Unknown error'}`,
  });
});
```

**Recommendation**: Extract to helper function.

#### 4. Complex Logic in `startAudioCapture` (Low Priority)

**Problem**: The `startAudioCapture` prop has more complex logic than others:
- Needs to check `isRecordingActive` before starting
- Handles both true and false transitions
- Has special first-render handling for `undefined -> true`

**Impact**: Makes the code harder to understand, but the complexity is justified by the requirements.

**Recommendation**: Consider extracting to a custom hook, but current implementation is acceptable.

## Recommended Refactoring

### High Priority: Extract Custom Hooks

#### 1. `useBooleanDeclarativeProp` Hook

**Purpose**: Simplify boolean prop handling (interruptAgent, startAudioCapture)

**Benefits**:
- Reduces duplication
- Standardizes first-render handling
- Makes adding new boolean props easier

**Proposed Implementation**:

```typescript
/**
 * Hook for boolean declarative props that trigger actions on change
 * @param currentValue - Current boolean prop value
 * @param onTrue - Callback when prop changes to true
 * @param onFalse - Optional callback when prop changes to false
 * @param onComplete - Optional callback to call after action completes
 * @param skipFirstRender - Whether to skip action on first render (default: true)
 */
function useBooleanDeclarativeProp(
  currentValue: boolean | undefined,
  onTrue: () => void | Promise<void>,
  onFalse?: () => void | Promise<void>,
  onComplete?: () => void,
  skipFirstRender: boolean = true
): void {
  const prevValueRef = useRef<boolean | undefined>(undefined);
  
  useEffect(() => {
    // Skip on first render
    if (skipFirstRender && prevValueRef.current === undefined) {
      prevValueRef.current = currentValue;
      return;
    }
    
    // Only act when value changes
    if (currentValue === true && prevValueRef.current !== true) {
      Promise.resolve(onTrue()).then(() => {
        onComplete?.();
      }).catch((error) => {
        // Error handling should be done in onTrue callback
        console.error('[useBooleanDeclarativeProp] Error in onTrue:', error);
      });
    } else if (currentValue === false && prevValueRef.current !== false && onFalse) {
      Promise.resolve(onFalse()).then(() => {
        onComplete?.();
      }).catch((error) => {
        console.error('[useBooleanDeclarativeProp] Error in onFalse:', error);
      });
    }
    
    prevValueRef.current = currentValue;
  }, [currentValue, onTrue, onFalse, onComplete, skipFirstRender]);
}
```

**Usage Example**:

```typescript
// Before (current implementation):
const prevInterruptAgentPropRef = useRef<boolean | undefined>(undefined);
const isFirstInterruptAgentRenderRef = useRef<boolean>(true);

useEffect(() => {
  const prevValue = prevInterruptAgentPropRef.current;
  const isFirstRender = isFirstInterruptAgentRenderRef.current;
  
  if (isFirstRender) {
    isFirstInterruptAgentRenderRef.current = false;
    prevInterruptAgentPropRef.current = interruptAgentProp;
    return;
  }

  if (interruptAgentProp === true && prevValue !== true) {
    interruptAgent();
    onAgentInterruptedRef.current?.();
  }

  prevInterruptAgentPropRef.current = interruptAgentProp;
}, [interruptAgentProp]);

// After (with hook):
useBooleanDeclarativeProp(
  interruptAgentProp,
  () => {
    interruptAgent();
  },
  undefined, // No onFalse
  () => {
    onAgentInterruptedRef.current?.();
  }
);
```

#### 2. `useCallbackRef` Hook

**Purpose**: Standardize the callback ref pattern

**Benefits**:
- Reduces boilerplate
- Consistent pattern across codebase

**Proposed Implementation**:

```typescript
/**
 * Hook to store a callback in a ref to avoid stale closures
 * @param callback - Callback function to store
 * @returns Ref containing the latest callback
 */
function useCallbackRef<T extends (...args: any[]) => any>(
  callback: T | undefined
): React.MutableRefObject<T | undefined> {
  const callbackRef = useRef<T | undefined>(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return callbackRef;
}
```

**Usage Example**:

```typescript
// Before:
const onAgentInterruptedRef = useRef(onAgentInterrupted);
useEffect(() => {
  onAgentInterruptedRef.current = onAgentInterrupted;
}, [onAgentInterrupted]);

// After:
const onAgentInterruptedRef = useCallbackRef(onAgentInterrupted);
```

### Medium Priority: Extract Error Handling Helper

**Purpose**: Reduce error handling duplication

**Proposed Implementation**:

```typescript
/**
 * Creates a standardized error handler for declarative prop operations
 */
function createDeclarativeErrorHandler(
  log: (message: string, ...args: any[]) => void,
  handleError: (error: ErrorInfo) => void,
  service: 'agent' | 'transcription',
  code: string,
  operation: string
): (error: unknown) => void {
  return (error: unknown) => {
    log(`[Declarative] Failed to ${operation}:`, error);
    handleError({
      service,
      code,
      message: `Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  };
}
```

**Usage Example**:

```typescript
// Before:
startAudioCapture().catch((error) => {
  log('[Declarative] Failed to start audio capture:', error);
  handleError({
    service: 'transcription',
    code: 'audio_capture_start_failed',
    message: `Failed to start audio capture: ${error instanceof Error ? error.message : 'Unknown error'}`,
  });
});

// After:
const handleStartAudioCaptureError = createDeclarativeErrorHandler(
  log,
  handleError,
  'transcription',
  'audio_capture_start_failed',
  'start audio capture'
);

startAudioCapture().catch(handleStartAudioCaptureError);
```

### Low Priority: Extract `useConnectionState` Hook

**Purpose**: Isolate complex connection state logic

**Benefits**:
- Makes main component cleaner
- Easier to test independently
- Better separation of concerns

**Note**: This is lower priority because the logic is complex and tightly coupled to the component's state. The current implementation is acceptable.

## Refactoring Priority

### Immediate (High Value, Low Risk)

1. ✅ **Extract `useCallbackRef` hook** - Simple, low risk, immediate benefit
2. ✅ **Extract error handling helper** - Reduces duplication, low risk
3. ✅ **Standardize first-render handling** - Use simple `undefined` check consistently

### Short Term (High Value, Medium Risk)

1. **Extract `useBooleanDeclarativeProp` hook** - Higher value, requires testing
2. **Update `interruptAgent` to use hook** - Simplifies code
3. **Update `startAudioCapture` to use hook** - Simplifies code (may need custom logic)

### Long Term (Medium Value, Low Risk)

1. **Extract `useConnectionState` hook** - Nice to have, but current implementation is acceptable
2. **Add JSDoc documentation** - Improves developer experience
3. **Create separate hooks file** - Better organization

## Implementation Strategy

### Phase 1: Low-Risk Improvements (Can do now)

1. Extract `useCallbackRef` hook
2. Extract error handling helper
3. Standardize first-render handling to use `undefined` check

### Phase 2: Higher-Value Refactoring (Requires testing)

1. Extract `useBooleanDeclarativeProp` hook
2. Update `interruptAgent` to use hook
3. Update `startAudioCapture` to use hook (may need custom logic for `isRecordingActive` check)

### Phase 3: Polish (Optional)

1. Extract `useConnectionState` hook
2. Add comprehensive JSDoc
3. Create `src/hooks/declarative-props.ts` file

## Testing Strategy

For any refactoring:

1. ✅ Run existing unit tests - Must all pass
2. ✅ Run E2E tests - Must all pass
3. ✅ Add tests for new hooks (if extracted)
4. ✅ Manual testing in test-app

## Backward Compatibility

All refactoring must maintain:
- ✅ Same prop API
- ✅ Same behavior
- ✅ Same error handling
- ✅ Same callback timing
- ✅ Same first-render behavior

## Conclusion

**Current State**: Functional, well-tested, but has opportunities for improvement.

**Recommendation**: 
- **Do now**: Extract `useCallbackRef` and error handling helper (low risk, high value)
- **Do soon**: Extract `useBooleanDeclarativeProp` hook (higher value, requires testing)
- **Consider later**: Extract `useConnectionState` hook (nice to have)

**Key Insight**: The current implementation works well. Refactoring should be incremental and well-tested. The highest-value improvement is extracting the boolean prop hook, which would immediately simplify the code and make it easier to add new declarative props.
