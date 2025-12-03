# WebSocket Connection Behavior During Component Remounts

## Summary

The component has **different behavior** for WebSocket connections depending on the **type of remount**:

1. **React StrictMode remounts** (within 100ms): ✅ **Connections are preserved**
2. **True component unmounts**: ❌ **Connections are closed**
3. **Normal remounts** (not StrictMode, >100ms delay): ❌ **Connections are closed**

## Detailed Behavior

### React StrictMode Remounts (Preserved)

**When**: Component remounts within 100ms of cleanup (React StrictMode behavior in development)

**Behavior**: Connections are **preserved** across the remount

**Code Reference**:
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

**Detection**: Uses 100ms delay (`STRICT_MODE_REMOUNT_DETECTION_DELAY_MS`) to detect if component re-mounts quickly

**Related Issue**: Issue #206 - Fixed StrictMode connection closure

### True Component Unmounts (Closed)

**When**: Component is truly unmounting (not remounting)

**Behavior**: Connections are **closed** after 100ms delay

**Code Reference**:
```typescript:944:967:src/components/DeepgramVoiceInteraction/index.tsx
// Component is truly unmounting - close connections
if (transcriptionManagerRef.current) {
  transcriptionManagerRef.current.close();
  transcriptionManagerRef.current = null;
}

if (agentManagerRef.current) {
  agentManagerRef.current.close();
  agentManagerRef.current = null;
}
```

### Normal Remounts (Closed)

**When**: Component remounts for reasons other than StrictMode (e.g., parent component remounts, key prop changes, conditional rendering)

**Behavior**: If remount happens **after** the 100ms delay, connections are **closed** before remount completes

**Problem**: This can cause connection severance even though the component is remounting

**Example Scenario**:
1. Component unmounts (cleanup starts)
2. 100ms delay timer starts
3. Component remounts after 150ms (too late - timer already fired)
4. Connections were closed, new connections must be established

## Impact on Issue #318

If the customer's component is remounting (not just re-rendering), this explains why:

1. **WebSocket connections are severed** - Component remounts, connections close
2. **`prevAgentOptionsForResendRef` resets** - New component instance, ref is `undefined`
3. **Settings re-send doesn't work** - Effect skips on "first render" even though it's a remount

## Documentation Status

### Existing Documentation

1. **Issue #206 Status** (`docs/issues/ISSUE-206-STATUS.md`):
   - Documents StrictMode connection preservation
   - Explains 100ms delay mechanism
   - ✅ Well documented

2. **Issue #276** (`docs/issues/ISSUE-276-COMPONENT-REMOUNTING.md`):
   - Documents component remounting bug
   - Mentions connection closure but doesn't detail the behavior
   - ⚠️ Could be more explicit about connection behavior

3. **E2E Tests** (`test-app/tests/e2e/strict-mode-behavior.spec.js`):
   - Tests verify StrictMode connection preservation
   - ✅ Well tested

### Missing Documentation

1. **Normal remount behavior** - Not clearly documented
2. **Connection severance on remount** - Not explicitly stated
3. **100ms delay implications** - Not explained for non-StrictMode remounts

## Recommendations

### For Customer

1. **Check if component is remounting**:
   - Look for multiple "Component initialized" logs
   - Check if parent component is conditionally rendering
   - Verify React key prop isn't changing

2. **If remounting is necessary**:
   - Connections will be severed
   - Component will need to re-establish connections
   - `prevAgentOptionsForResendRef` will reset (causing Issue #318 behavior)

3. **Prevent remounting**:
   - Use stable React keys
   - Memoize callbacks and options
   - Avoid conditional rendering that unmounts component

### For Component Team

1. **Consider preserving connections for all remounts** (not just StrictMode)
   - Would require detecting remounts more reliably
   - May need to track remounts differently than StrictMode

2. **Document connection behavior clearly**:
   - Add to README or API documentation
   - Explain StrictMode vs normal remount behavior
   - Provide guidance on preventing remounts

## Related Issues

- Issue #206 - StrictMode connection closure (✅ Fixed)
- Issue #276 - Component remounting bug (🔍 Investigating)
- Issue #318 - useEffect not running (may be caused by remounting)

## Test Coverage

- ✅ E2E tests verify StrictMode connection preservation
- ✅ Unit tests verify remount behavior for `prevAgentOptionsForResendRef`
- ⚠️ Missing: Tests for connection behavior during normal remounts (non-StrictMode)

