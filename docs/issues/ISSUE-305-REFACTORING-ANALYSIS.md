# Issue #305: Declarative Props Refactoring Analysis

## Overview

This document analyzes the declarative props implementation for refactoring opportunities to improve code organization, performance, and maintainability.

## Current Implementation Analysis

### Code Structure

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

### Identified Patterns

1. **First-render skip pattern**: All hooks check if `prev*Ref.current === undefined`
2. **Change detection pattern**: Compare current prop with previous value
3. **Error handling pattern**: All async operations have `.catch()` with `handleError()`
4. **Callback invocation pattern**: Success callbacks are called after operations complete

## Refactoring Opportunities

### 1. Extract Custom Hooks

#### 1.1 `useDeclarativeProp` Generic Hook

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

**Usage Example**:
```typescript
// userMessage prop
useDeclarativeProp(
  userMessage,
  (newValue, prevValue) => {
    if (newValue !== null && newValue !== undefined) {
      log('[Declarative] userMessage prop changed, sending message:', newValue);
      injectUserMessage(newValue)
        .then(() => {
          log('[Declarative] userMessage sent successfully');
          onUserMessageSent?.();
        })
        .catch((error) => {
          log('[Declarative] Failed to send userMessage:', error);
          handleError({
            service: 'agent',
            code: 'user_message_failed',
            message: `Failed to send user message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        });
    }
  },
  (newValue) => newValue !== null && newValue !== undefined
);
```

#### 1.2 `useBooleanDeclarativeProp` Hook

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

**Usage Example**:
```typescript
// interruptAgent prop
useBooleanDeclarativeProp(
  interruptAgentProp,
  () => {
    log('[Declarative] interruptAgent prop set to true, interrupting TTS');
    interruptAgent();
  },
  undefined, // No action on false
  () => {
    onAgentInterrupted?.();
  }
);
```

#### 1.3 `useConnectionState` Hook

**Purpose**: Extract the complex connection state logic into a dedicated hook.

**Benefits**:
- Isolates complex connection state determination logic
- Makes the main component cleaner
- Easier to test connection state logic independently

**Proposed Implementation**:
```typescript
/**
 * Hook for managing connection state via declarative props
 */
function useConnectionState(
  connectionState: 'connected' | 'disconnected' | 'auto' | undefined,
  autoStartAgent: boolean | undefined,
  autoStartTranscription: boolean | undefined,
  isAgentConfigured: boolean,
  isTranscriptionConfigured: boolean,
  currentAgentState: ConnectionState | undefined,
  currentTranscriptionState: ConnectionState | undefined,
  start: (options?: { agent?: boolean; transcription?: boolean }) => Promise<void>,
  stop: () => Promise<void>,
  handleError: (error: DeepgramError) => void,
  log: (message: string, ...args: any[]) => void
): void {
  const prevConnectionStateRef = useRef<'connected' | 'disconnected' | 'auto' | undefined>(undefined);
  const prevAutoStartAgentRef = useRef<boolean | undefined>(undefined);
  const prevAutoStartTranscriptionRef = useRef<boolean | undefined>(undefined);
  
  useEffect(() => {
    // Determine desired connection state
    let desiredState: 'connected' | 'disconnected' | null = null;
    
    if (connectionState !== undefined && connectionState !== 'auto') {
      desiredState = connectionState === 'connected' ? 'connected' : 'disconnected';
    } else if (connectionState === 'auto' || connectionState === undefined) {
      const shouldConnectAgent = autoStartAgent === true && isAgentConfigured;
      const shouldConnectTranscription = autoStartTranscription === true && isTranscriptionConfigured;
      
      if (shouldConnectAgent || shouldConnectTranscription) {
        desiredState = 'connected';
      } else if (autoStartAgent === false && autoStartTranscription === false) {
        desiredState = 'disconnected';
      }
    }
    
    // Check if state actually changed
    const isCurrentlyConnected = 
      (isAgentConfigured && currentAgentState === 'connected') ||
      (isTranscriptionConfigured && currentTranscriptionState === 'connected');
    
    // Only act if desired state differs from current state
    if (desiredState === 'connected' && !isCurrentlyConnected) {
      log('[Declarative] connectionState/autoStart prop indicates connection needed');
      start({
        agent: autoStartAgent !== false && isAgentConfigured,
        transcription: autoStartTranscription !== false && isTranscriptionConfigured,
      }).catch((error) => {
        log('[Declarative] Failed to start connection:', error);
        handleError({
          service: 'agent',
          code: 'connection_start_failed',
          message: `Failed to start connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      });
    } else if (desiredState === 'disconnected' && isCurrentlyConnected) {
      log('[Declarative] connectionState prop indicates disconnection needed');
      stop().catch((error) => {
        log('[Declarative] Failed to stop connection:', error);
        handleError({
          service: 'agent',
          code: 'connection_stop_failed',
          message: `Failed to stop connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      });
    }
    
    prevConnectionStateRef.current = connectionState;
    prevAutoStartAgentRef.current = autoStartAgent;
    prevAutoStartTranscriptionRef.current = autoStartTranscription;
  }, [
    connectionState,
    autoStartAgent,
    autoStartTranscription,
    isAgentConfigured,
    isTranscriptionConfigured,
    currentAgentState,
    currentTranscriptionState,
    start,
    stop,
    handleError,
    log,
  ]);
}
```

### 2. Performance Optimizations

#### 2.1 Debouncing Rapid Prop Changes

**Issue**: Rapid prop changes (e.g., userMessage changing multiple times quickly) could trigger multiple operations.

**Solution**: Add optional debouncing to `useDeclarativeProp`:

```typescript
function useDeclarativeProp<T>(
  currentValue: T,
  onChange: (newValue: T, prevValue: T | undefined) => void,
  shouldTrigger?: (newValue: T, prevValue: T | undefined) => boolean,
  debounceMs?: number // Optional debounce delay
): void {
  // ... implementation with debouncing logic
}
```

**Consideration**: Only apply debouncing where it makes sense (e.g., userMessage might benefit, but interruptAgent should be immediate).

#### 2.2 Memoization of Callbacks

**Issue**: Callbacks passed to `useEffect` dependencies might cause unnecessary re-renders.

**Solution**: Use `useCallback` for all callbacks passed to declarative prop hooks:

```typescript
const handleUserMessageChange = useCallback((newValue: string | null) => {
  // ... implementation
}, [injectUserMessage, onUserMessageSent, handleError]);
```

**Status**: Already partially implemented, but could be more consistent.

#### 2.3 Reduce Dependency Array Re-computations

**Issue**: Some `useEffect` dependency arrays include functions that are recreated on every render.

**Solution**: Ensure all functions in dependency arrays are memoized with `useCallback`.

### 3. Code Organization Improvements

#### 3.1 Group Related Declarative Props

**Current**: All declarative props are at the end of the component, mixed with imperative handle.

**Proposed**: Create a dedicated section or file for declarative props logic:

```typescript
// Declarative Props Section (Issue #305)
// ======================================

// Import custom hooks
import { useDeclarativeProp, useBooleanDeclarativeProp, useConnectionState } from '../../hooks/declarative-props';

// Use hooks
useDeclarativeProp(userMessage, handleUserMessageChange, ...);
useConnectionState(...);
useBooleanDeclarativeProp(interruptAgentProp, handleInterruptAgent, ...);
useBooleanDeclarativeProp(startAudioCaptureProp, handleStartAudioCapture, handleStopAudioCapture, ...);
```

#### 3.2 Extract Error Handling Logic

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

#### 3.3 Type Safety Improvements

**Issue**: Some prop types could be more specific.

**Solution**: Create specific types for declarative prop callbacks:

```typescript
type DeclarativePropChangeHandler<T> = (newValue: T, prevValue: T | undefined) => void;
type BooleanPropChangeHandler = () => void;
```

### 4. Maintainability Improvements

#### 4.1 Documentation

**Current**: Each declarative prop has inline comments.

**Proposed**: Add JSDoc comments to custom hooks explaining:
- When the hook triggers
- What conditions must be met
- Error handling behavior
- Callback invocation timing

#### 4.2 Testing

**Current**: E2E tests exist, but unit tests for declarative props logic are missing.

**Proposed**: 
- ✅ Unit tests created (see `tests/declarative-props.test.tsx`)
- Add tests for custom hooks if extracted
- Add tests for edge cases (rapid changes, unmounting, etc.)

#### 4.3 Adding New Declarative Props

**Current**: Adding a new declarative prop requires:
1. Adding prop to type definition
2. Destructuring in component
3. Creating a ref for previous value
4. Creating a useEffect hook
5. Adding to dependency arrays

**Proposed**: With custom hooks, adding a new prop would be:
1. Add prop to type definition
2. Destructure in component
3. Call appropriate custom hook

**Example**:
```typescript
// New prop: pauseAgent
useBooleanDeclarativeProp(
  pauseAgent,
  () => agentManagerRef.current?.pause(),
  () => agentManagerRef.current?.resume(),
  () => onAgentPaused?.()
);
```

## Recommended Refactoring Priority

### High Priority (Immediate Benefits)

1. **Extract `useBooleanDeclarativeProp` hook** - Simplifies `interruptAgent` and `startAudioCapture` props
2. **Extract error handling helper** - Reduces duplication
3. **Add unit tests** - ✅ Already completed

### Medium Priority (Code Quality)

1. **Extract `useConnectionState` hook** - Isolates complex logic
2. **Improve memoization** - Ensure all callbacks are properly memoized
3. **Add JSDoc documentation** - Improve developer experience

### Low Priority (Nice to Have)

1. **Extract generic `useDeclarativeProp` hook** - May be over-engineering for current use case
2. **Add debouncing** - Only needed if rapid prop changes become an issue
3. **Create separate file for declarative props** - Current organization is acceptable

## Implementation Notes

### Backward Compatibility

All refactoring must maintain:
- ✅ Same prop API
- ✅ Same behavior
- ✅ Same error handling
- ✅ Same callback timing

### Testing Strategy

1. ✅ Unit tests for declarative props (completed)
2. Run existing E2E tests to verify no regressions
3. Add tests for custom hooks if extracted
4. Performance testing for rapid prop changes

### Migration Path

If custom hooks are extracted:

1. Create hooks in `src/hooks/declarative-props.ts`
2. Update component to use hooks
3. Run all tests to verify
4. Update documentation

## Conclusion

The current implementation is functional and well-tested. The main refactoring opportunities are:

1. **Extract custom hooks** to reduce duplication and make adding new props easier
2. **Improve error handling consistency** with helper functions
3. **Enhance documentation** for better maintainability

The highest-value refactoring would be extracting `useBooleanDeclarativeProp` and `useConnectionState` hooks, as these would immediately simplify the code and make it easier to add new declarative props in the future.
