# Issue #318: Build Issue Analysis - Destructured Props in Dependency Arrays

## Customer Diagnostic Results Summary

**Verified**:
- ✅ React hooks work (test effects execute)
- ✅ React version compatible (18.3.1)
- ✅ Reference changes verified (`useMemo` creates new references)
- ✅ React detects prop changes
- ✅ Component sees prop changes (memoization warning)

**Cannot Test**:
- ⏳ Direct prop access (requires source modification)
- ⏳ Source code testing (only dist published)

**Key Finding**: Minified code shows `[S, t.debug]` where `S = props.agentOptions` (destructured), and the effect code exists but **isn't executing**.

## Root Cause Hypothesis

**Build/Bundler Issue with Destructured Variables in Dependency Arrays**

When Rollup minifies the code, it:
1. Destructures `agentOptions` from `props` at the top level: `const S = props.agentOptions`
2. Uses `S` in the dependency array: `[S, t.debug]`
3. React's dependency tracking may not correctly track `S` because it's a local variable, not a direct prop reference

**Why This Might Fail**:
- React's dependency tracking relies on reference equality
- When minified, `S` is a local variable that gets reassigned on each render
- React might not correctly track changes to `S` because it's not a stable reference
- The dependency array `[S, t.debug]` might not trigger when `props.agentOptions` changes

## Solution: Use Direct Prop Access

Instead of destructuring and using the local variable, we should use `props.agentOptions` directly in the dependency array:

**Current Code** (problematic):
```typescript
const { agentOptions } = props;
useEffect(() => {
  // ...
}, [agentOptions, props.debug]); // Uses destructured variable
```

**Fixed Code**:
```typescript
const { agentOptions } = props; // Still destructure for use in effect body
useEffect(() => {
  // Can still use agentOptions here
  // ...
}, [props.agentOptions, props.debug]); // Use direct prop access in dependency array
```

**Why This Works**:
- `props.agentOptions` is a stable reference that React can track
- Even when minified, `props.agentOptions` remains a property access, not a local variable
- React's dependency tracking works correctly with property access

## Implementation Plan

### Step 1: Modify Source Code

Change the dependency array from `[agentOptions, props.debug]` to `[props.agentOptions, props.debug]`:

```typescript:1189:1189:src/components/DeepgramVoiceInteraction/index.tsx
}, [props.agentOptions, props.debug]); // Changed from [agentOptions, props.debug]
```

### Step 2: Verify Build

After building, verify the minified code uses property access:
- Should see `[t.agentOptions, t.debug]` instead of `[S, t.debug]`
- This ensures React can track the dependency correctly

### Step 3: Test

- Run existing tests to ensure nothing breaks
- Verify the effect runs when `agentOptions` changes
- Confirm Settings re-send works

## Alternative: Keep Destructuring but Add Explicit Tracking

If we want to keep destructuring for code clarity, we could add explicit tracking:

```typescript
const { agentOptions } = props;
const agentOptionsDep = props.agentOptions; // Explicit dependency

useEffect(() => {
  // Use agentOptions in body
  // ...
}, [agentOptionsDep, props.debug]); // Use explicit dependency
```

But this is more verbose and the direct prop access is cleaner.

## Testing Strategy

1. **Unit Tests**: Existing tests should pass (they use source code, not minified)
2. **Build Verification**: Check minified output to ensure property access is used
3. **Customer Testing**: Customer can test with new build to verify fix

## Related Code

**Current Implementation**:
- Line 151: `agentOptions` destructured from `props`
- Line 1189: Dependency array uses `[agentOptions, props.debug]`

**Proposed Fix**:
- Line 151: Keep destructuring (for use in effect body)
- Line 1189: Change to `[props.agentOptions, props.debug]`

## Risk Assessment

**Low Risk**:
- Only changes dependency array, not effect logic
- `agentOptions` still available in effect body (destructured)
- Tests should pass (they use source code)
- Direct prop access is a common React pattern

**Potential Issues**:
- Need to verify all uses of `agentOptions` in effect body still work
- Need to ensure build output is correct

## Next Steps

1. **Implement fix**: Change dependency array to use `props.agentOptions`
2. **Build and verify**: Check minified output
3. **Run tests**: Ensure all tests pass
4. **Create patch release**: v0.6.16 with fix
5. **Customer testing**: Customer can verify fix works

