# CRITICAL BUG: useEffect Not Running When agentOptions Changes

## Customer Report

**Issue**: The `useEffect` that watches `agentOptions` (line 993) is **NOT running** when `agentOptions` changes, even though:
- Component detects prop change (memoization warning appears)
- Diagnostic logging is enabled (`window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true`)
- New object references are being created correctly (`useMemo` with `hasFunctions`)

**Evidence**:
- ✅ Connection is established: "Agent state: connected" and "SettingsApplied received"
- ✅ Component detects prop change: memoization warning appears when `agentOptions` changes
- ❌ **Missing diagnostic logs**: No entry point logs from the `useEffect` that watches `agentOptions`

## Root Cause Analysis

### The useEffect Dependency Array

```typescript:993:1189:src/components/DeepgramVoiceInteraction/index.tsx
useEffect(() => {
  // Entry point logging
  const shouldLogDiagnostics = props.debug || windowWithGlobals.__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
  if (shouldLogDiagnostics) {
    console.log('[DeepgramVoiceInteraction] 🔍 [agentOptions useEffect] Entry point - useEffect triggered', {
      // ...
    });
  }
  // ... rest of effect
}, [agentOptions, props.debug]); // Dependency array
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

### Possible Causes

#### 1. Component Remounting Instead of Re-rendering

**Hypothesis**: If the component is **remounting** (not just re-rendering), the `prevAgentOptionsForResendRef` would be reset to `undefined`, causing the effect to skip on "first render" even though it's actually a remount.

**Check**: Look for component initialization logs. If you see multiple "Component initialized" logs when `agentOptions` changes, the component is remounting.

**Related Issue**: Issue #276 - Component remounting in Strict Mode

#### 2. React Strict Mode Double Invocation

**Hypothesis**: React Strict Mode in development runs effects twice. If the cleanup runs and resets state, the second invocation might not see the change.

**Check**: Verify if running in development mode with Strict Mode enabled.

#### 3. Dependency Array Not Detecting Change

**Hypothesis**: Even though `agentOptions` reference changes, React's dependency comparison might not be triggering the effect.

**Possible reasons**:
- React's shallow comparison is somehow not working
- The destructured `agentOptions` variable is somehow not updating
- There's a closure issue capturing stale `agentOptions`

#### 4. Effect Running But Logging Not Appearing

**Hypothesis**: The effect IS running, but the diagnostic logging condition is failing.

**Check**: The logging condition is:
```typescript
const shouldLogDiagnostics = props.debug || windowWithGlobals.__DEEPGRAM_DEBUG_AGENT_OPTIONS__;
```

**Verify**:
- Is `props.debug` set to `true`?
- Is `window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__` set to `true`?
- Is `windowWithGlobals` correctly typed and accessible?

## Diagnostic Steps

### Step 1: Verify Diagnostic Logging is Enabled

```typescript
// Before rendering component:
window.__DEEPGRAM_DEBUG_AGENT_OPTIONS__ = true;

// Or use debug prop:
<DeepgramVoiceInteraction
  debug={true}
  agentOptions={agentOptions}
  // ...
/>
```

### Step 2: Check for Component Remounting

Look for these logs in console:
- `🔧 [Component] DeepgramVoiceInteraction component initialized`
- Multiple initialization logs when `agentOptions` changes = remounting

### Step 3: Add Manual Logging to Verify Effect Runs

Temporarily add logging at the very top of the component function to verify when it re-renders:

```typescript
function DeepgramVoiceInteraction(props, ref) {
  console.log('[COMPONENT RENDER] agentOptions reference:', props.agentOptions);
  console.log('[COMPONENT RENDER] agentOptions changed?', /* compare with previous */);
  
  // ... rest of component
}
```

### Step 4: Verify agentOptions Reference Actually Changes

```typescript
// In customer code, before updating:
const prevAgentOptionsRef = useRef(agentOptions);

// When updating:
console.log('agentOptions reference changed?', prevAgentOptionsRef.current !== agentOptions);
prevAgentOptionsRef.current = agentOptions;
```

### Step 5: Check React Version and Strict Mode

```typescript
// Check if Strict Mode is enabled
console.log('React version:', React.version);
console.log('Strict Mode enabled?', /* check your app setup */);
```

## Potential Fixes

### Fix 1: Use props.agentOptions Directly in Dependency Array

**Current**:
```typescript
const { agentOptions } = props;
useEffect(() => {
  // ...
}, [agentOptions, props.debug]);
```

**Potential Fix**:
```typescript
useEffect(() => {
  // Use props.agentOptions directly
  const agentOptions = props.agentOptions;
  // ...
}, [props.agentOptions, props.debug]);
```

**Rationale**: Using the destructured variable might cause closure issues. Using `props.agentOptions` directly ensures React tracks the prop correctly.

### Fix 2: Add Explicit Reference Tracking

```typescript
const agentOptionsRef = useRef(props.agentOptions);

useEffect(() => {
  const prevRef = agentOptionsRef.current;
  agentOptionsRef.current = props.agentOptions;
  
  if (prevRef !== props.agentOptions) {
    console.log('[FORCE CHECK] agentOptions reference changed!');
    // Force effect logic here
  }
}, [props.agentOptions, props.debug]);
```

### Fix 3: Use useMemo to Stabilize Reference

If the issue is that `useMemo` is returning the same reference when it shouldn't:

```typescript
// In customer code - ensure useMemo dependencies are correct
const agentOptions = useMemo(() => {
  // ... create options
}, [hasFunctions, /* all other dependencies */]);
```

## Immediate Action Items

1. **Verify diagnostic logging is actually enabled** - Check console for any logs at all
2. **Check for component remounting** - Look for multiple initialization logs
3. **Add manual logging** - Log when component renders and when `agentOptions` prop changes
4. **Verify React version** - Check if there's a known issue with dependency arrays
5. **Test with direct props access** - Try using `props.agentOptions` directly in dependency array

## Related Issues

- Issue #311 - Component not re-sending Settings when agentOptions changes
- Issue #276 - Component remounting in Strict Mode
- Issue #307 - Closure issue with agentOptions

## Test Cases to Verify Fix

1. **Test**: `useEffect` runs when `agentOptions` reference changes
   - File: `tests/agent-options-useeffect-dependency.test.tsx`
   - Test: "should verify useEffect runs when agentOptions reference changes"

2. **Test**: `useMemo` pattern works correctly
   - File: `tests/agent-options-resend-edge-cases.test.tsx`
   - Test: "should verify useMemo pattern works correctly"

## Next Steps

1. **Reproduce the issue** in a minimal test case
2. **Verify diagnostic logging** is working
3. **Check for component remounting**
4. **Try Fix 1** (use `props.agentOptions` directly)
5. **Create GitHub issue** if fix doesn't work

