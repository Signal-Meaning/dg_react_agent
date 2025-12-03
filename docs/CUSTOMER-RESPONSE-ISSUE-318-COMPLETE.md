# Issue #318 Investigation: useEffect Not Running - Complete Analysis

## Executive Summary

**CRITICAL UPDATE**: The `useEffect` with dependency array `[agentOptions, props.debug]` is **NOT running at all**, even on initial mount:

- ❌ No "Entry point - useEffect triggered" logs
- ❌ No "First render" logs  
- ❌ No "Comparing values" logs
- ❌ No diagnostic logs of any kind

**What IS working**:
- ✅ Component mounts once (no remounting - customer confirmed)
- ✅ `useMemo` creates new object references when `hasFunctions` changes
- ✅ React detects prop change (`isNewReference: true`)
- ✅ Component sees the change (memoization warning appears)
- ✅ Diagnostic logging is enabled (`window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true`)

**Conclusion**: React detects the prop change, but the component's `useEffect` is not executing. This points to a **dependency tracking issue** or a **build/bundler issue** preventing the effect from running.

## Why Tests Pass

We created comprehensive tests to verify the behavior:

- ✅ `useEffect` runs when `agentOptions` reference changes
- ✅ `useEffect` runs with `useMemo` pattern (your pattern)
- ✅ Dependency array correctly tracks `props.agentOptions`

**Conclusion**: The dependency array and `useEffect` logic are working correctly in our test environment. React's dependency array correctly handles destructured variables like `agentOptions` from `props`.

## Possible Root Causes

Since remounting is ruled out and the effect isn't running even on initial mount, the most likely causes are:

### 1. Build/Bundler Issue (Most Likely)

**Hypothesis**: The minified/built code might have an issue with how the dependency array is handled.

**Evidence**: Customer mentions minified code shows `[S, t.debug]` where `S = props.agentOptions` (destructured at top level).

**Possible Issues**:
- Build tool might be optimizing away the effect
- Dependency array might not be correctly preserved in minified code
- React's dependency tracking might not work correctly with minified variable names
- Source maps might not be correctly mapping to source code

**How to verify**:
```typescript
// Add this test effect to verify React hooks work at all
useEffect(() => {
  console.log('[CUSTOMER-TEST] Basic useEffect works - React hooks functional');
}, []);

// Add this to verify dependency tracking works
useEffect(() => {
  console.log('[CUSTOMER-TEST] agentOptions dependency tracking works', agentOptions);
}, [agentOptions]);
```

### 2. React Version Compatibility Issue

**Hypothesis**: The customer's React version might have a bug or incompatibility with how dependency arrays track destructured variables.

**How to verify**:
```typescript
console.log('React version:', React.version);
console.log('React DOM version:', ReactDOM.version);
```

**Check**: Compare with our tested versions. We test with React 18+.

### 3. Effect Conditionally Defined

**Hypothesis**: The effect might be conditionally defined or wrapped in a condition that prevents it from being registered (though our source code shows it's always defined).

**Code Check**: Verify the effect is always defined (not inside an `if` statement or conditional).

**Current Code** (lines 993-1189):
```typescript
useEffect(() => {
  // ... effect body
}, [agentOptions, props.debug]);
```

This should always be registered. But if there's a build issue, it might be getting optimized away.

### 4. Source vs Built Version Mismatch

**Hypothesis**: The customer might be using a built/minified version that doesn't match the source code.

**How to verify**:
- Check which version they're using (npm package vs local build)
- Verify the built code matches the source
- Check if there are any build-time transformations that might affect the effect

## Diagnostic Steps

### Step 1: Verify React Hooks Work at All

Add this test to verify basic React hooks functionality:

```typescript
// In customer's component or test
useEffect(() => {
  console.log('[CUSTOMER-TEST] Basic useEffect works - React hooks functional');
}, []);

useEffect(() => {
  console.log('[CUSTOMER-TEST] agentOptions changed:', agentOptions);
}, [agentOptions]);
```

**Expected**: Should see both logs. If not, React hooks aren't working in their environment.

**If these don't work**: This indicates a fundamental React hooks issue, not a component-specific problem.

### Step 2: Test Direct Prop Access

Try using `props.agentOptions` directly instead of destructured variable:

```typescript
// Instead of:
const { agentOptions } = props;
useEffect(() => {
  // ...
}, [agentOptions, props.debug]);

// Try:
useEffect(() => {
  const agentOptions = props.agentOptions;
  // ...
}, [props.agentOptions, props.debug]);
```

**Expected**: If this works, it's a destructuring issue. If not, it's something else.

**Note**: This would require a code change in the component, which we can provide as a patch if needed.

### Step 3: Check React Version

```typescript
console.log('React version:', React.version);
console.log('React DOM version:', ReactDOM.version);
```

**Check**: Compare with our tested versions. We test with React 18+.

**If different version**: Test with React 18.x to rule out version compatibility issues.

### Step 4: Verify Build Process

If using a built version:
- Check if source maps are available
- Verify the built code includes the effect
- Check for any build warnings or errors
- Compare built code with source code

**How to check built code**:
```typescript
// If using npm package, check node_modules
// If using local build, check dist/ folder
// Look for the useEffect call in the built code
```

### Step 5: Test with Source Code Directly

If possible, test with the source code directly (not built/minified) to rule out build issues:

```typescript
// Import from source instead of built package (if possible)
// This would require access to the source code
```

### Step 6: Verify Reference Changes

Add this to verify `agentOptions` reference is actually changing:

```typescript
const prevAgentOptionsRef = useRef(agentOptions);

useEffect(() => {
  const referenceChanged = prevAgentOptionsRef.current !== agentOptions;
  console.log('[CUSTOMER] agentOptions reference changed?', referenceChanged);
  console.log('[CUSTOMER] Previous:', prevAgentOptionsRef.current);
  console.log('[CUSTOMER] Current:', agentOptions);
  
  if (!referenceChanged) {
    console.warn('[CUSTOMER] ⚠️ Same reference detected - mutation or useMemo issue!');
  }
  
  prevAgentOptionsRef.current = agentOptions;
}, [agentOptions]);
```

**Expected**: Should see logs when `agentOptions` changes. If reference isn't changing, that's the issue.

## Common Patterns That Cause Issues

### Pattern 1: Mutating Functions Array

```typescript
// ❌ WRONG
const [functions, setFunctions] = useState([]);
functions.push(newFunction); // Mutation!
const agentOptions = useMemo(() => ({ functions }), [functions]);
// Same reference returned, useEffect doesn't run

// ✅ CORRECT
const [functions, setFunctions] = useState([]);
const agentOptions = useMemo(() => ({ 
  functions: [...functions, newFunction] 
}), [functions, newFunction]);
// New reference created, useEffect runs
```

### Pattern 2: useMemo Missing Dependencies

```typescript
// ❌ WRONG
const agentOptions = useMemo(() => {
  return {
    functions: hasFunctions ? [myFunction] : undefined,
    model: 'nova-2'
  };
}, []); // Missing dependencies!

// ✅ CORRECT
const agentOptions = useMemo(() => {
  return {
    functions: hasFunctions ? [myFunction] : undefined,
    model: 'nova-2'
  };
}, [hasFunctions, myFunction]); // All dependencies included
```

### Pattern 3: Diagnostic Logging Too Late

```typescript
// ❌ WRONG - Too late
<DeepgramVoiceInteraction agentOptions={agentOptions} />
window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true; // Already rendered!

// ✅ CORRECT - Before render
window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true;
<DeepgramVoiceInteraction agentOptions={agentOptions} />
```

## Technical Details

### The useEffect Dependency Array

The `useEffect` uses `[agentOptions, props.debug]` as dependencies:

```typescript:993:1189:src/components/DeepgramVoiceInteraction/index.tsx
useEffect(() => {
  // Entry point logging
  const shouldLogDiagnostics = props.debug || windowWithGlobals.__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
  if (shouldLogDiagnostics) {
    console.log('[DeepgramVoiceInteraction] 🔍 [agentOptions useEffect] Entry point - useEffect triggered', {
      agentOptionsRef: agentOptions !== undefined ? 'exists' : 'undefined',
      prevAgentOptionsRef: prevAgentOptionsForResendRef.current !== undefined ? 'exists' : 'undefined',
      isFirstRender: prevAgentOptionsForResendRef.current === undefined
    });
  }
  
  // Skip on first render (prevAgentOptionsForResendRef is undefined)
  if (prevAgentOptionsForResendRef.current === undefined) {
    prevAgentOptionsForResendRef.current = agentOptions;
    if (shouldLogDiagnostics) {
      console.log('[DeepgramVoiceInteraction] 🔍 [agentOptions useEffect] First render - skipping change detection');
    }
    return;
  }
  
  // Deep comparison to detect actual changes
  const agentOptionsChanged = hasDependencyChanged(
    prevAgentOptionsForResendRef.current as Record<string, unknown> | undefined,
    agentOptions as Record<string, unknown>,
    false, // not first mount
    compareAgentOptionsIgnoringContext
  );
  
  // Update ref for next comparison
  prevAgentOptionsForResendRef.current = agentOptions;
  
  // Re-send Settings if conditions are met
  if (agentOptionsChanged && agentOptions && agentManagerRef.current) {
    // ... re-send logic
  }
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

### Conditions Required for Re-send

Even if the `useEffect` runs and detects a change, Settings won't be re-sent unless **ALL** conditions are met:

1. ✅ **`agentOptionsChanged`** - Deep comparison detects change
2. ✅ **`agentOptions` exists** - Not undefined/null
3. ✅ **`agentManagerRef.current` exists** - Manager is initialized
4. ✅ **Connection state is 'connected'** - `connectionState === 'connected'`
5. ✅ **`hasSentSettingsBefore` is true** - Settings were sent before

**Code Reference**: `src/components/DeepgramVoiceInteraction/index.tsx:1042-1125`

## Immediate Action Items

1. **Verify React hooks work at all**
   - Add test effects (Step 1 above)
   - If test effects don't run, React hooks aren't working

2. **Check React version**
   - Verify customer's React version
   - Test with React 18.x if different

3. **Test with direct prop access**
   - Try `[props.agentOptions, props.debug]` instead of `[agentOptions, props.debug]`
   - This would require a component patch

4. **Verify build process**
   - Check if using built/minified code
   - Verify source maps
   - Check for build warnings

5. **Verify reference changes**
   - Use diagnostic code (Step 6 above)
   - Confirm `agentOptions` reference is actually changing

## Potential Fixes

### Fix 1: Use Direct Prop Access (If Destructuring Issue)

If testing shows destructuring is the issue, we can modify the component to use direct prop access:

```typescript
// Change from:
}, [agentOptions, props.debug]);

// To:
}, [props.agentOptions, props.debug]);
```

This would require a component code change and release.

### Fix 2: Add Explicit Dependency Tracking

If build/bundler is the issue, we might need to add explicit dependency tracking:

```typescript
const agentOptionsDep = props.agentOptions;
const debugDep = props.debug;

useEffect(() => {
  // ... effect body
}, [agentOptionsDep, debugDep]);
```

### Fix 3: Build Configuration Update

If build is optimizing away the effect, we may need to:
- Update Rollup configuration
- Ensure dependency arrays are preserved
- Check for any tree-shaking issues

## Test Results

We created comprehensive tests to verify the behavior:

1. **`tests/agent-options-useeffect-must-run.test.tsx`**:
   - Verifies `useEffect` runs when `agentOptions` changes
   - Tests `useMemo` pattern (your pattern)
   - All tests passing ✅

2. **`tests/agent-options-remount-behavior.test.tsx`**:
   - Verifies what happens when component remounts
   - Tests `prevAgentOptionsForResendRef` reset behavior
   - All tests passing ✅

**Note**: All tests pass in our environment, confirming the logic works correctly when the effect runs.

## Next Steps

1. **Customer should run diagnostic tests** (Steps 1-6 above)
2. **Share results**:
   - Do test effects run? (Yes = React hooks work, No = React issue)
   - Does reference change? (Yes = should trigger effect, No = mutation issue)
   - What React version? (Compare with our tested versions)
   - Using built or source code? (Built might have issues)

3. **Based on results**:
   - If React hooks don't work: React version/compatibility issue
   - If reference doesn't change: Mutation/useMemo issue
   - If reference changes but effect doesn't run: Build/bundler issue
   - If all checks pass: Need to investigate further

## Code References

- `src/components/DeepgramVoiceInteraction/index.tsx:993-1189` - `agentOptions` useEffect
- `src/components/DeepgramVoiceInteraction/index.tsx:1004-1006` - First render skip logic
- `src/components/DeepgramVoiceInteraction/index.tsx:1015-1040` - Change detection logic
- `src/components/DeepgramVoiceInteraction/index.tsx:1042-1125` - Re-send conditions
- `tests/agent-options-useeffect-must-run.test.tsx` - Tests verifying useEffect behavior

## Related Issues

- Issue #311 - Component not re-sending Settings when agentOptions changes (✅ Fixed in v0.6.15)
- Issue #318 - useEffect not running (🔍 Investigating - build/bundler issue suspected)
