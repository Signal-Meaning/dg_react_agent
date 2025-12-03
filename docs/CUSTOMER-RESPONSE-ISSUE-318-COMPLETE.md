# Issue #318 Investigation: useEffect Not Running - Complete Analysis

## Executive Summary

We've investigated why the `useEffect` for `agentOptions` appears not to be running. Our analysis shows:

1. **The dependency array works correctly** - React properly tracks `agentOptions` changes
2. **The `useEffect` runs in our tests** - All tests pass, confirming the effect runs when `agentOptions` changes
3. **Most likely cause: Component remounting** - If your component is remounting (not just re-rendering), this explains the behavior

## Why Tests Pass

We created comprehensive tests to verify the behavior:

- ✅ `useEffect` runs when `agentOptions` reference changes
- ✅ `useEffect` runs with `useMemo` pattern (your pattern)
- ✅ Dependency array correctly tracks `props.agentOptions`

**Conclusion**: The dependency array and `useEffect` logic are working correctly. React's dependency array correctly handles destructured variables like `agentOptions` from `props`.

## Why You Might See Different Behavior

If the component is **remounting** (not just re-rendering), two things happen:

### 1. `prevAgentOptionsForResendRef` Resets

On remount, all refs reset to their initial values. The effect sees `prevAgentOptionsForResendRef.current === undefined` and treats this as "first render", skipping change detection:

```typescript
// Skip on first render (prevAgentOptionsForResendRef is undefined)
if (prevAgentOptionsForResendRef.current === undefined) {
  prevAgentOptionsForResendRef.current = agentOptions;
  return; // Skips change detection
}
```

**Code Reference**: `src/components/DeepgramVoiceInteraction/index.tsx:1004-1006`

### 2. WebSocket Connections May Be Severed

The component has different behavior for WebSocket connections depending on remount type:

- **StrictMode remounts (<100ms)**: ✅ Connections are **preserved**
- **Normal remounts (>100ms)**: ❌ Connections are **closed**
- **True unmounts**: ❌ Connections are **closed**

**Code Reference**: `src/components/DeepgramVoiceInteraction/index.tsx:931-981`

The component uses a 100ms delay to detect StrictMode remounts. If the component remounts after 100ms, connections are closed before the remount completes, requiring new connections to be established.

## How to Diagnose

### Check for Component Remounting

Look for these signs in your console logs:

1. **Multiple "Component initialized" logs**:
   ```
   🔧 [Component] DeepgramVoiceInteraction component initialized
   ```
   If you see this log multiple times when `agentOptions` changes, the component is remounting.

2. **Enable diagnostic logging**:
   ```typescript
   window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true;
   ```

3. **Check for "First render" logs**:
   ```
   [agentOptions useEffect] First render - skipping change detection
   ```
   If you see this when `agentOptions` changes, the ref was reset (indicating remount).

### Verify Component Stability

Add this to your component or test to track mounts:

```typescript
useEffect(() => {
  console.log('🔍 Component mounted/remounted');
  return () => {
    console.log('🔍 Component unmounting');
  };
}, []);
```

## Common Causes of Remounting

### 1. Parent Component Remounts

```tsx
// ❌ Bad - remounts on every state change
{condition && <DeepgramVoiceInteraction ... />}

// ✅ Good - stable rendering
<DeepgramVoiceInteraction ... />
```

### 2. React Key Prop Changes

```tsx
// ❌ Bad - remounts when key changes
<DeepgramVoiceInteraction key={someValue} ... />

// ✅ Good - stable key
<DeepgramVoiceInteraction ... />
```

### 3. Parent Component Creates New Component Instance

```tsx
// ❌ Bad - new component on every render
function Parent() {
  return <DeepgramVoiceInteraction ... />;
}

// ✅ Good - memoized or stable
const Component = useMemo(() => <DeepgramVoiceInteraction ... />, [deps]);
```

### 4. Callback Props Creating New References

```tsx
// ❌ Bad - new function on every render
<DeepgramVoiceInteraction onTranscriptUpdate={(text) => {...}} />

// ✅ Good - stable callback
const handleTranscript = useCallback((text) => {...}, []);
<DeepgramVoiceInteraction onTranscriptUpdate={handleTranscript} />
```

## Recommended Actions

### Step 1: Verify Component Stability

Check if your component is remounting by looking for multiple initialization logs or using the mount tracking code above.

### Step 2: Prevent Remounting (If Confirmed)

If remounting is the issue, fix the root cause:

- Use stable React keys
- Memoize callbacks and options
- Avoid conditional rendering that unmounts component
- Ensure parent component doesn't remount unnecessarily
- Use `useCallback` for callback props
- Use `useMemo` for options objects

### Step 3: If Remounting is Necessary

If you must remount the component:

- Connections will be severed (expected behavior)
- Component will need to re-establish connections
- `prevAgentOptionsForResendRef` will reset (causing the "first render" skip)
- First `agentOptions` change after remount will be skipped
- Second `agentOptions` change after remount will work correctly

## Technical Details

### The useEffect Dependency Array

The `useEffect` uses `[agentOptions, props.debug]` as dependencies:

```typescript:993:1189:src/components/DeepgramVoiceInteraction/index.tsx
useEffect(() => {
  // Entry point logging
  const shouldLogDiagnostics = props.debug || window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
  if (shouldLogDiagnostics) {
    console.log('[DeepgramVoiceInteraction] 🔍 [agentOptions useEffect] Entry point - useEffect triggered', {
      agentOptions,
      prevAgentOptionsRef: prevAgentOptionsForResendRef.current !== undefined ? 'exists' : 'undefined',
      isFirstRender: prevAgentOptionsForResendRef.current === undefined
    });
  }
  
  // Skip on first render (prevAgentOptionsForResendRef is undefined)
  if (prevAgentOptionsForResendRef.current === undefined) {
    prevAgentOptionsForResendRef.current = agentOptions;
    return;
  }
  
  // ... rest of effect
}, [agentOptions, props.debug]);
```

### How agentOptions is Extracted

```typescript:147:151:src/components/DeepgramVoiceInteraction/index.tsx
const {
  apiKey,
  transcriptionOptions,
  agentOptions, // Destructured from props
  // ...
} = props;
```

**Important**: React's dependency array correctly tracks destructured variables. The dependency `[agentOptions, props.debug]` will trigger when `props.agentOptions` changes, even though `agentOptions` is destructured.

### Connection Preservation Logic

The component preserves connections during StrictMode remounts:

```typescript:931:942:src/components/DeepgramVoiceInteraction/index.tsx
cleanupTimeoutRef.current = setTimeout(() => {
  // If component re-mounted quickly (within delay), this was likely StrictMode
  // In that case, don't close connections as they'll be needed for the re-mounted component
  if (isMountedRef.current) {
    if (props.debug) {
      console.log('🔧 [Component] Cleanup detected StrictMode re-invocation - preserving connections and state');
    }
    return; // Component re-mounted, don't close connections or reset state
  }
  // ... close connections only if truly unmounting
}, STRICT_MODE_REMOUNT_DETECTION_DELAY_MS); // 100ms delay
```

**Limitation**: This only works for remounts within 100ms (StrictMode). Normal remounts after 100ms will close connections.

## Test Results

We created two comprehensive test suites:

1. **`tests/agent-options-useeffect-must-run.test.tsx`**:
   - Verifies `useEffect` runs when `agentOptions` changes
   - Tests `useMemo` pattern (your pattern)
   - All tests passing ✅

2. **`tests/agent-options-remount-behavior.test.tsx`**:
   - Verifies what happens when component remounts
   - Tests `prevAgentOptionsForResendRef` reset behavior
   - Tests Settings re-send after remount
   - All tests passing ✅

## Next Steps

1. **Verify if your component is remounting** using the diagnostic steps above
2. **If remounting is confirmed**: Fix the root cause in your code (likely parent component or key prop)
3. **If remounting is not the issue**: Please share:
   - Your component usage code
   - Console logs with diagnostic logging enabled
   - Any error messages
   - React version

## Code References

- `src/components/DeepgramVoiceInteraction/index.tsx:993-1189` - `agentOptions` useEffect
- `src/components/DeepgramVoiceInteraction/index.tsx:931-981` - Cleanup and connection handling
- `src/components/DeepgramVoiceInteraction/index.tsx:1004-1006` - First render skip logic
- `tests/agent-options-useeffect-must-run.test.tsx` - Tests verifying useEffect behavior
- `tests/agent-options-remount-behavior.test.tsx` - Tests verifying remount behavior

## Related Issues

- Issue #206 - StrictMode connection closure (✅ Fixed)
- Issue #276 - Component remounting bug (🔍 Investigating)
- Issue #311 - Component not re-sending Settings when agentOptions changes (✅ Fixed in v0.6.15)

