# Issue #769: Component Remount Investigation

## Summary

Customer reports that the `DeepgramVoiceInteraction` component remounts 7 times during reconnection scenarios, even when props are stable. This causes page crashes and prevents context retention across disconnects.

## Investigation Results

### Test Results

**Our Test Environment**: ✅ Component does NOT remount during reconnection
- Test: `tests/component-remount-customer-issue769.test.tsx`
- Result: PASSES - 0 remounts detected during multiple reconnection cycles
- Conclusion: Component is stable in our test environment

**Customer's Environment**: ❌ Component remounts 7 times
- Customer test: `context-retention-text-and-audio.e2e.test.js`
- Result: FAILS - 7 remounts detected
- Conclusion: Issue is specific to customer's parent component setup

### Root Cause Analysis

Since our component does NOT remount in our test environment, but the customer sees remounts, the issue is likely in the **customer's parent component**, not our component.

**Possible causes in customer's parent component**:

1. **Key prop changing**: If the parent uses a `key` prop on our component that changes, React will remount it
   ```tsx
   // ❌ BAD - key changes cause remounts
   <DeepgramVoiceInteraction key={someChangingValue} ... />
   ```

2. **Conditional rendering**: If the parent conditionally renders our component, it will remount
   ```tsx
   // ❌ BAD - conditional rendering causes remounts
   {condition && <DeepgramVoiceInteraction ... />}
   ```

3. **Parent component remounting**: If the parent component itself remounts, our component will also remount

4. **Unstable callback props**: If callbacks are not memoized and change on every render, they could trigger parent re-renders that cause remounts (though this shouldn't cause remounts, just re-renders)

### What We've Done

1. ✅ **Fixed initialization logic** (Issue #357)
   - Removed `isReady` state check from initialization condition
   - Component only re-initializes when dependencies actually change
   - Prevents unnecessary re-initialization during cleanup/reconnection

2. ✅ **Added remount detection logging**
   - Component now logs when it detects a remount
   - Helps identify when/why remounts occur
   - Enable with `debug={true}` or `window.__DEEPGRAM_DEBUG_REMOUNTS__ = true`

3. ✅ **Added comprehensive tests**
   - Test for remount detection during reconnection
   - Test verifies component remains stable in our environment

### Recommendations for Customer

#### Available NOW (v0.7.8):

1. **Enable basic debug logging**:
   ```tsx
   <DeepgramVoiceInteraction
     debug={true}
     // ... other props
   />
   ```
   
   This will show "Component initialized" logs with `mountId` each time the component initializes. If you see multiple initialization logs during reconnection, that indicates remounts.

2. **Check for key prop changes**:
   ```tsx
   // Check if you're using a key prop that changes
   <DeepgramVoiceInteraction key={someValue} ... />
   ```

3. **Check for conditional rendering**:
   ```tsx
   // Check if component is conditionally rendered
   {condition && <DeepgramVoiceInteraction ... />}
   ```

4. **Check if parent component is remounting**:
   - Look for parent component mount logs
   - Check if parent has a `key` prop that changes
   - Check if parent is conditionally rendered

5. **Verify callback memoization**:
   ```tsx
   // ✅ GOOD - memoized callbacks
   const handleConnectionStateChange = useCallback((service, state) => {
     // ...
   }, []);
   
   // ❌ BAD - new function on every render
   const handleConnectionStateChange = (service, state) => {
     // ...
   };
   ```

#### Requires NEW RELEASE:

The enhanced remount detection logging (with `component MOUNTED` and `COMPONENT REMOUNT DETECTED` warnings) requires a new release. This will provide:
- Explicit remount detection warnings
- Instance ID tracking across remounts
- `window.__DEEPGRAM_DEBUG_REMOUNTS__` support

**Workaround for now**: Use `debug={true}` and look for multiple "Component initialized" logs - each log with a different `mountId` indicates a remount.

### Diagnostic Logging

#### Available NOW (v0.7.8):
With `debug={true}`, you'll see:
```
🔧 [Component] DeepgramVoiceInteraction initialized {
  services: "agent",
  mountId: "1768089629118-0.7774552840507682",
  isStrictModeReInvoke: false,
  isFirstMount: true,
  reason: "first mount"
}
```

If you see multiple initialization logs with different `mountId` values, that indicates remounts.

#### Requires NEW RELEASE:
Enhanced remount detection will log:
```
⚠️ [Component] COMPONENT REMOUNT DETECTED! {
  previousInstanceId: "instance-...",
  newInstanceId: "instance-...",
  reason: "Component was unmounted and remounted by React (likely parent component remount or key prop change)"
}
```

This will make remounts more obvious and easier to diagnose.

### Next Steps

1. Customer should enable remount debugging and share logs
2. Customer should check their parent component for:
   - Key prop changes
   - Conditional rendering
   - Parent component remounting
3. If remounts are necessary, we can investigate making the component more resilient to remounts

## Related Issues

- Issue #357: Fixed initialization logic to prevent unnecessary re-initialization
- Issue #276: Component remounting bug (similar symptoms)
- Issue #769: Customer report of remounts during reconnection
