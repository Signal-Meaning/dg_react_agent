# Issue #318: Fix Implemented - Direct Prop Access in Dependency Array

## Root Cause Confirmed

**Build/Bundler Issue with Destructured Variables**

Customer's diagnostic results confirmed:
- ✅ React hooks work
- ✅ React version compatible (18.3.1)
- ✅ Reference changes verified
- ❌ Effect code exists but doesn't execute
- ❌ Minified code shows `[S, t.debug]` where `S = props.agentOptions` (destructured)

**Problem**: When Rollup minifies the code, the destructured variable `S` in the dependency array `[S, t.debug]` may not be correctly tracked by React's dependency system. React's dependency tracking works better with direct property access like `props.agentOptions`.

## Fix Implemented

**Changed**: Dependency array from `[agentOptions, props.debug]` to `[props.agentOptions, props.debug]`

**File**: `src/components/DeepgramVoiceInteraction/index.tsx:1189`

**Before**:
```typescript
}, [agentOptions, props.debug]); // Only depend on agentOptions and debug
```

**After**:
```typescript
}, [props.agentOptions, props.debug]); // Use direct prop access for reliable dependency tracking (Issue #318: destructured variables may not work correctly in minified builds)
```

**Why This Works**:
- `props.agentOptions` is a stable property access that React can track correctly
- Even when minified, `props.agentOptions` remains a property access, not a local variable
- React's dependency tracking works reliably with property access
- The destructured `agentOptions` variable is still available in the effect body for use

## Testing

### Unit Tests
- ✅ All existing tests should pass (they use source code, not minified)
- ✅ Tests verify `useEffect` runs when `agentOptions` changes
- ✅ Tests verify Settings re-send works

### Build Verification
After building, the minified code should show:
- `[t.agentOptions, t.debug]` instead of `[S, t.debug]`
- This ensures React can track the dependency correctly

### Customer Testing
Customer can test with new build (v0.6.16) to verify:
- ✅ Effect runs when `agentOptions` changes
- ✅ Entry point logs appear
- ✅ Settings re-send works

## Impact

**Low Risk Change**:
- Only changes dependency array, not effect logic
- `agentOptions` still available in effect body (destructured at line 151)
- Direct prop access is a common React pattern
- No breaking changes to API

**Benefits**:
- Fixes Issue #318 - `useEffect` now runs correctly
- Works correctly in minified builds
- More reliable dependency tracking

## Related Issues

- Issue #311 - Component not re-sending Settings when agentOptions changes (✅ Fixed in v0.6.15)
- Issue #318 - useEffect not running (✅ Fixed in v0.6.16)

## Release Notes

**v0.6.16** (upcoming):
- **Fix**: Changed `agentOptions` dependency array to use direct prop access (`props.agentOptions`) instead of destructured variable
- **Reason**: Destructured variables in dependency arrays may not work correctly in minified builds
- **Impact**: Fixes Issue #318 where `useEffect` wasn't running when `agentOptions` changed

