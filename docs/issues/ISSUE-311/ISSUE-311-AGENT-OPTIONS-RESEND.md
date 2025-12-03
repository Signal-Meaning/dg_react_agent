# Issue #311: Component Not Re-sending Settings When agentOptions Changes After Connection

**GitHub Issue**: https://github.com/Signal-Meaning/dg_react_agent/issues/311

**Date**: December 3, 2025  
**Status**: 🔍 **INVESTIGATION**  
**Component Version**: `0.6.11`  
**Severity**: Medium  
**Type**: Bug / Behavior Investigation

## Problem Statement

Customer reports that the component is **not re-sending Settings** when `agentOptions` changes after connection is established, despite the component having code to handle this scenario.

### Customer Report

The customer's test shows:
- Component doesn't re-send Settings when `agentOptions` changes after connection
- Customer mentions `onAgentOptionsChange` callback - this prop doesn't exist in the component
- Customer increased wait time to 5 seconds but still no re-send
- Customer documented this as a "separate limitation, not a bug"

### Expected Behavior

The component **SHOULD** re-send Settings when `agentOptions` changes after connection, per code at lines 976-1019 in `index.tsx`.

**Our tests confirm this works:**
- `tests/agent-options-timing.test.tsx` - Test: "should re-send Settings when agentOptions.functions is added after initial render" ✅ PASSING
- `tests/closure-issue-fix.test.tsx` - Test: "should include functions when agentOptions is updated after connection is established" ✅ PASSING

## Code Analysis

### Re-send Logic (Lines 976-1019)

The component has a `useEffect` hook that should detect `agentOptions` changes and re-send Settings:

```typescript
useEffect(() => {
  // Skip on first render
  if (prevAgentOptionsForResendRef.current === undefined) {
    prevAgentOptionsForResendRef.current = agentOptions;
    return;
  }
  
  // Check if agentOptions actually changed using deep comparison
  const agentOptionsChanged = hasDependencyChanged(
    prevAgentOptionsForResendRef.current as Record<string, unknown> | undefined,
    agentOptions as Record<string, unknown>,
    false, // not first mount
    compareAgentOptionsIgnoringContext
  );
  
  // Update ref for next comparison
  prevAgentOptionsForResendRef.current = agentOptions;
  
  // Only re-send if ALL conditions are met:
  if (agentOptionsChanged && agentOptions && agentManagerRef.current) {
    agentOptionsRef.current = agentOptions;
    
    const connectionState = agentManagerRef.current.getState();
    const isConnected = connectionState === 'connected';
    const hasSentSettingsBefore = hasSentSettingsRef.current || (window as any).globalSettingsSent;
    
    if (isConnected && hasSentSettingsBefore) {
      // Reset flags and re-send Settings
      hasSentSettingsRef.current = false;
      (window as any).globalSettingsSent = false;
      
      if (props.debug) {
        log('agentOptions changed while connected - re-sending Settings with updated options');
      }
      sendAgentSettings();
    }
  }
}, [agentOptions, props.debug]);
```

## Conditions Required for Re-send

The re-send logic requires **ALL** of these conditions to be true:

1. ✅ **`agentOptionsChanged`** - Deep comparison detects change
2. ✅ **`agentOptions` exists** - agentOptions is not undefined/null
3. ✅ **`agentManagerRef.current` exists** - Agent manager is initialized
4. ✅ **Connection state is 'connected'** - `connectionState === 'connected'`
5. ✅ **`hasSentSettingsBefore` is true** - Settings were sent before (either `hasSentSettingsRef.current` or `window.globalSettingsSent`)

## Possible Root Causes

### 1. Deep Comparison Not Detecting Change

**Issue**: If customer mutates `agentOptions` object instead of creating new reference, change won't be detected.

**Example of problem**:
```typescript
// ❌ WRONG - Mutation (won't trigger re-send)
agentOptions.functions.push(newFunction);

// ✅ CORRECT - New reference (will trigger re-send)
agentOptions = { ...agentOptions, functions: [...agentOptions.functions, newFunction] };
```

**Investigation**: Check if customer is using `useMemo` correctly and creating new object references.

### 2. Connection State Check Failing

**Issue**: Connection might not be in `'connected'` state when `agentOptions` changes.

**Possible scenarios**:
- Connection is still `'connecting'`
- Connection is `'disconnected'` or `'closed'`
- Connection state check happens before connection is fully established

**Investigation**: Add logging to verify connection state when `agentOptions` changes.

### 3. Settings Flag Check Failing

**Issue**: `hasSentSettingsBefore` might be false, preventing re-send.

**Possible scenarios**:
- Settings were never sent (connection failed before Settings)
- `hasSentSettingsRef.current` is false AND `window.globalSettingsSent` is false
- Flag was reset incorrectly

**Investigation**: Add logging to verify flag state when `agentOptions` changes.

### 4. Object Reference Issue

**Issue**: If `agentOptions` prop reference doesn't change, `useEffect` won't trigger.

**Possible scenarios**:
- Customer is mutating the same object reference
- `useMemo` dependencies aren't set up correctly
- Parent component isn't creating new reference

**Investigation**: Verify customer's `agentOptions` setup matches our test patterns.

### 5. Missing Callback Prop

**Issue**: Customer mentions `onAgentOptionsChange` callback - this prop doesn't exist.

**Investigation**: This might be a misunderstanding. The component doesn't have this callback. The re-send happens automatically via `useEffect`, not via a callback.

## Investigation Plan

### Step 1: Verify Customer's Test Setup

Compare customer's test with our working tests:
- `tests/agent-options-timing.test.tsx` - Line 70-114
- `tests/closure-issue-fix.test.tsx` - Line 107-179

**Check**:
- Are they using `rerender` correctly?
- Are they creating new `agentOptions` object references?
- Are they waiting for connection to be established?
- Are they checking for the debug log message?

### Step 2: Add Diagnostic Logging

Add comprehensive logging to diagnose why re-send isn't triggering:

```typescript
useEffect(() => {
  // ... existing code ...
  
  if (agentOptionsChanged && agentOptions && agentManagerRef.current) {
    const connectionState = agentManagerRef.current.getState();
    const isConnected = connectionState === 'connected';
    const hasSentSettingsBefore = hasSentSettingsRef.current || (window as any).globalSettingsSent;
    
    // ADD DIAGNOSTIC LOGGING
    console.log('🔍 [agentOptions Change] Conditions check:', {
      agentOptionsChanged,
      agentOptionsExists: !!agentOptions,
      agentManagerExists: !!agentManagerRef.current,
      connectionState,
      isConnected,
      hasSentSettingsBefore,
      hasSentSettingsRef: hasSentSettingsRef.current,
      globalSettingsSent: (window as any).globalSettingsSent
    });
    
    if (isConnected && hasSentSettingsBefore) {
      // ... re-send logic ...
    } else {
      console.warn('⚠️ [agentOptions Change] Re-send blocked:', {
        isConnected,
        hasSentSettingsBefore,
        reason: !isConnected ? 'not connected' : 'settings not sent before'
      });
    }
  } else {
    console.log('🔍 [agentOptions Change] Change detection:', {
      agentOptionsChanged,
      agentOptionsExists: !!agentOptions,
      agentManagerExists: !!agentManagerRef.current
    });
  }
}, [agentOptions, props.debug]);
```

### Step 3: Verify Deep Comparison Logic

Check if `compareAgentOptionsIgnoringContext` is correctly detecting changes:

```typescript
// Test the comparison function
const prev = { functions: [] };
const current = { functions: [{ name: 'test' }] };
const changed = !compareAgentOptionsIgnoringContext(prev, current);
// Should be true
```

### Step 4: Customer Test Reproduction

Create a test that reproduces the customer's scenario:
- Start connection without functions
- Add functions after connection
- Verify re-send happens
- Check all conditions are met

## Test Evidence

### Our Tests (PASSING)

**Test 1**: `tests/agent-options-timing.test.tsx:70`
- ✅ Component renders without functions
- ✅ Connection established
- ✅ Functions added via state update
- ✅ Component detects change and re-sends Settings
- ✅ Settings includes functions

**Test 2**: `tests/closure-issue-fix.test.tsx:107`
- ✅ Component renders without functions
- ✅ Connection established
- ✅ `agentOptions` updated via `rerender`
- ✅ Component detects change and re-sends Settings
- ✅ Settings includes functions

### Customer's Test (FAILING)

- ❌ Component doesn't re-send Settings
- ❌ No debug log: "agentOptions changed while connected - re-sending Settings"
- ❌ Customer increased wait time to 5 seconds

## Related Issues

- **Issue #307**: Fixed closure issue (functions included in initial Settings)
- **Issue #284**: Similar timing issue (resolved with re-send logic)

## Next Steps

1. ✅ **Create GitHub issue** (Issue #311)
2. ⏳ **Add diagnostic logging** to component
3. ⏳ **Reproduce customer's scenario** in test
4. ⏳ **Identify root cause** (which condition is failing)
5. ⏳ **Fix or document** the issue
6. ⏳ **Update customer** with findings

## Acceptance Criteria

- [ ] Root cause identified (which condition is failing)
- [ ] Diagnostic logging added to help diagnose future issues
- [ ] Customer's scenario reproduced in test
- [ ] Fix implemented OR documented as expected behavior
- [ ] Customer updated with findings

## Notes

- The functionality exists and works in our tests
- Customer's issue likely stems from a condition not being met
- Need to investigate why conditions aren't met in customer's scenario
- May need to add better error messages or documentation

