# Issue #162: Remove Debug Methods and Add Missing Callback

**Status**: 🚧 IN PROGRESS  
**Created**: January 2025  
**Branch**: Published (exact branch TBD)  
**Related**: Issue #162, API cleanup since fork

## 🎯 Executive Summary

The component exposes debug methods (`getConnectionStates()` and `getState()`) that reveal internal implementation details. These methods should not be part of the public API for v0.5.0 and must be removed. 

**Revised Scope**: This issue now includes:
1. **Adding** the missing `onSettingsApplied` callback to expose `hasSentSettings` state via public API
2. **Removing** debug methods (`getConnectionStates()` and `getState()`) from public API
3. **Migrating** all test-app and E2E test usage to public API alternatives

**✅ DEBATE SETTLED**: Test remediation analysis confirms **ALL tests can be remediated** using existing callbacks plus the new `onSettingsApplied` callback. The removal is **safe and feasible** once the missing callback is added.

## Problem Statement

### Current State

**Debug Methods Exposed**: The component exposes two debug methods in the public API:

1. **`getConnectionStates()`** - Returns internal connection state:
   ```typescript
   getConnectionStates: () => {
     transcription: string;
     agent: string;
     transcriptionConnected: boolean;
     agentConnected: boolean;
   };
   ```

2. **`getState()`** - Returns internal component state:
   ```typescript
   getState: () => VoiceInteractionState;
   ```

**Missing Public API**: The component lacks a callback for `SettingsApplied` event, forcing test-app and tests to poll internal state via `getState()` to check `hasSentSettings`.

### Why This Is a Problem

1. **Post-Fork Addition**: Debug methods were added after the fork and don't exist in the original upstream API
2. **Implementation Details Exposure**: Debug methods expose internal state management that should be encapsulated
3. **Debug vs Production**: Debug information should be handled through the `debug` prop and console logging, not exposed as public API methods
4. **Missing Public API**: Lack of `onSettingsApplied` callback forces polling of internal state
5. **API Validation Failure**: Debug methods should cause failures in component API tests since they're not approved for v0.5.0 public API

### API Validation Test Status

**Expected Behavior**: The API validation test (`tests/voice-agent-api-validation.test.tsx`) should **FAIL** because:
- These methods are marked as "UNDER REVIEW - debate needed" in `approved-additions.ts`
- They should be in `METHODS_TO_REMOVE` for v0.5.0
- Currently excluded from validation (line 854-855) but should fail when properly configured

**Current State**: Test currently excludes them with comment, but they should be validated and fail

## Public API Alternatives

### For Connection State

**Replacement**: Use `onConnectionStateChange` callback prop

```typescript
onConnectionStateChange?: (service: ServiceType, state: ConnectionState) => void;
```

**Migration Pattern**:
```typescript
// Before (debug method)
const states = deepgramRef.current?.getConnectionStates();
if (!states.agentConnected) {
  // handle disconnected
}

// After (public API callback)
<DeepgramVoiceInteraction
  onConnectionStateChange={(service, state) => {
    if (service === 'agent' && state === 'closed') {
      // handle disconnected
    }
  }}
/>
```

### For Component State

**Replacements**: Use existing callbacks for state information:

1. **Agent State**: `onAgentStateChange(agentState: AgentState)`
2. **Connection States**: `onConnectionStateChange(service, state)`
3. **Ready State**: `onReady(isReady: boolean)`
4. **Playback State**: `onPlaybackStateChange(isPlaying: boolean)`

### Missing Public API Coverage (Requires Addition)

**Gap Identified**: `hasSentSettings` state
- **Internal State**: Set when `SettingsApplied` event is received
- **Current Usage**: Test-app polls `getState()` to check `hasSentSettings`
- **Problem**: No public callback for `SettingsApplied` event
- **Solution**: Add `onSettingsApplied?: () => void` callback prop

**Migration Pattern**:
```typescript
// Before (debug method)
const state = deepgramRef.current?.getState();
const isReady = state?.isReady;
const agentState = state?.agentState;

// After (public API callbacks)
const [isReady, setIsReady] = useState(false);
const [agentState, setAgentState] = useState<AgentState>('idle');

<DeepgramVoiceInteraction
  onReady={setIsReady}
  onAgentStateChange={setAgentState}
/>
```

## Test Remediation Analysis

### ✅ All Tests Can Be Remediated

**Conclusion**: Detailed analysis confirms that **all ~45 usages** across test-app and E2E tests have clear solutions using:
1. Existing public API callbacks (`onConnectionStateChange`, `onAgentStateChange`, etc.)
2. One new callback (`onSettingsApplied`)
3. Callback-based state tracking patterns in E2E tests

**No test functionality will be lost.** The removal is **safe and feasible**.

### Detailed Remediation by Category

#### Category 1: test-app/src/App.tsx (4 usages)

**Usage 1 & 2 (Lines 231, 332)**: Polling `hasSentSettings` state
- **Purpose**: Track when settings are applied (SettingsApplied event received)
- **Solution**: Add `onSettingsApplied` callback
- **Migration**: Replace polling with callback handler
- **Status**: ✅ **SOLVABLE**

**Usage 3 (Line 548)**: Check agent connection before audio capture
- **Purpose**: Ensure agent is connected before starting audio
- **Solution**: Use `onConnectionStateChange` callback + React state
- **Migration**: Track connection state in component state
- **Status**: ✅ **SOLVABLE**

**Usage 4 (Line 890)**: Check agent connection on text input focus
- **Purpose**: Ensure connection is active when user focuses text input
- **Solution**: Same as Usage 3 - use tracked connection state
- **Status**: ✅ **SOLVABLE**

#### Category 2: E2E Tests - Connection State (~35 usages)

**Usage Pattern**: Verify connection state transitions
- **Example**: `lazy-initialization-e2e.spec.js` (27 instances)
- **Current**: `const states = deepgramComponent.getConnectionStates()`
- **Solution**: Use callback-based state tracking in page context
- **Pattern**: Set up `onConnectionStateChange` callback in page.evaluate(), track state in window object
- **Status**: ✅ **SOLVABLE**

**Usage Pattern**: Verify managers not created (lazy initialization)
- **Solution**: Verify via `onConnectionStateChange` not firing before `onReady`
- **Status**: ✅ **SOLVABLE**

**Usage Pattern**: Check state before/after operations
- **Solution**: Track state changes during operation via callback history
- **Status**: ✅ **SOLVABLE**

#### Category 3: E2E Tests - Component State (~5 usages)

**Usage Pattern**: Check `hasSentSettings` in test helpers
- **Example**: `test-helpers.js:67` - `waitForSettingsApplied()`
- **Solution**: Use `onSettingsApplied` callback (requires new callback)
- **Status**: ✅ **SOLVABLE**

**Usage Pattern**: Debug/logging of component state
- **Solution**: Remove (if debug-only) or use callback-based tracking
- **Status**: ✅ **SOLVABLE**

**Usage Pattern**: Check for method existence
- **Example**: `user-stopped-speaking-callback.spec.js:76`
- **Solution**: Convert to negative test (verify methods don't exist)
- **Status**: ✅ **SOLVABLE**

#### Category 4: Direct Ref Access (1 usage)

**Usage Pattern**: Direct manager reference access
- **Example**: `vad-event-validation.spec.js:87` - `transcriptionManagerRef.current.getState()`
- **Status**: ⚠️ **NEEDS INVESTIGATION** - May need test utility (not public API)

### Required API Addition (Phase 0)

**New Callback**: `onSettingsApplied?: () => void`

**Rationale**: `hasSentSettings` is the only state information used by tests that lacks a public callback. This callback must be added before removing debug methods to ensure all test functionality can be preserved.

**Implementation**:
```typescript
// Add to DeepgramVoiceInteractionProps
onSettingsApplied?: () => void;

// Call when SettingsApplied event received:
if (data.type === 'SettingsApplied') {
  props.onSettingsApplied?.();
  // ... existing code
}
```

**Impact**: Low - Single callback addition, matches existing pattern

**Usage Count**: 
- test-app: 2 usages
- E2E tests: 1 helper function used by multiple tests

### Remediation Summary

| Category | Count | Status | Solution |
|----------|-------|--------|----------|
| Connection State Checks | ~35 | ✅ Solvable | Use `onConnectionStateChange` + state tracking |
| `hasSentSettings` Checks | 3 | ✅ Solvable | Add `onSettingsApplied` callback |
| Component State Debug | 5 | ✅ Solvable | Remove or use callbacks |
| Method Existence Tests | 1 | ✅ Solvable | Convert to negative test |
| Direct Ref Access | 1 | ⚠️ Needs Review | May need test utility |

**Total**: ~45 usages, all solvable (1 needs review for test utility)

## Implementation Plan

### Phase 0: Add Missing Callback (Prerequisite) ✅ TODO

**Objective**: Add `onSettingsApplied` callback to expose `hasSentSettings` state via public API, enabling test remediation

**Rationale**: Before removing debug methods, we must provide a public API alternative. The `onSettingsApplied` callback fills the gap for `hasSentSettings` state that tests currently access via `getState()`.

**Tasks**:
1. ✅ Add `onSettingsApplied?: () => void` to `DeepgramVoiceInteractionProps`
2. ✅ Call callback when `SettingsApplied` event received (component line ~1273)
3. ✅ Update TypeScript types
4. ✅ Document in API reference
5. ✅ Test that callback fires correctly

**Files to Modify**:
- `src/types/index.ts` - Add callback prop to `DeepgramVoiceInteractionProps`
- `src/components/DeepgramVoiceInteraction/index.tsx` - Call callback on SettingsApplied event
- `docs/` - Update API reference documentation

### Phase 1: Update API Validation ⏳ TODO

**Objective**: Make API validation tests fail for debug methods (can be done after Phase 0 or in parallel)

**Prerequisite**: Phase 0 must be complete before removing methods, as tests need the new callback

**Tasks**:
1. ✅ Move `getConnectionStates` from `approved-additions.ts` to `METHODS_TO_REMOVE`
2. ✅ Move `getState` from `approved-additions.ts` to `METHODS_TO_REMOVE`
3. ✅ Update API validation test to include these in unauthorized methods check
4. ✅ Verify tests fail (confirming they shouldn't be in public API)
5. ✅ Verify `onSettingsApplied` is in approved additions

**Files to Modify**:
- `tests/api-baseline/approved-additions.ts` - Move debug methods to `METHODS_TO_REMOVE`, add `onSettingsApplied` to approved additions
- `tests/voice-agent-api-validation.test.tsx` - Remove exclusion comment, validate removal

### Phase 2: Remove from Component API ✅ TODO

**Objective**: Remove methods from component implementation and type definitions

**Tasks**:
1. ✅ Remove `getConnectionStates()` from `DeepgramVoiceInteractionHandle` interface
2. ✅ Remove `getState()` from `DeepgramVoiceInteractionHandle` interface
3. ✅ Remove implementations from component (`useImperativeHandle`)
4. ✅ Update TypeScript types

**Files to Modify**:
- `src/types/index.ts` - Remove method definitions
- `src/components/DeepgramVoiceInteraction/index.tsx` - Remove implementations

### Phase 3: Update Test-App ✅ TODO

**Objective**: Replace debug method usage with public API callbacks (including new `onSettingsApplied`)

**Prerequisite**: Phase 0 must be complete (`onSettingsApplied` callback available)

#### 3.1: Identify All Usage

**Location**: `test-app/src/App.tsx`

**Current Usages**:
1. **Line 231**: `deepgramRef.current?.getState?.()` - Polling `hasSentSettings` for DOM mirror
2. **Line 328, 332**: `deepgramRef.current?.getState?.()` - Polling `hasSentSettings` as fallback for greeting detection
3. **Line 548**: `deepgramRef.current.getConnectionStates()` - Checking if agent connection is closed before starting audio capture
4. **Line 890**: `deepgramRef.current?.getConnectionStates?.()` - Additional connection state check

**Tasks**:
1. ✅ Replace `hasSentSettings` polling with `onSettingsApplied` callback (usages 1 & 2)
2. ✅ Replace connection state checks with `onConnectionStateChange` callback + React state (usages 3 & 4)
3. ✅ Maintain application state using callbacks instead of imperative polling/checks

#### 3.2: Update Test-App Implementation

**Implementation Pattern**:

```typescript
// Add state tracking via callbacks
const [agentConnectionState, setAgentConnectionState] = useState<ConnectionState>('closed');
const [transcriptionConnectionState, setTranscriptionConnectionState] = useState<ConnectionState>('closed');
const [isComponentReady, setIsComponentReady] = useState(false);
const [agentState, setAgentState] = useState<AgentState>('idle');

// Replace getConnectionStates() usage
const handleConnectionStateChange = useCallback((service: ServiceType, state: ConnectionState) => {
  if (service === 'agent') {
    setAgentConnectionState(state);
  } else if (service === 'transcription') {
    setTranscriptionConnectionState(state);
  }
}, []);

// Replace getState() usage
const handleReady = useCallback((ready: boolean) => {
  setIsComponentReady(ready);
}, []);

const handleAgentStateChange = useCallback((state: AgentState) => {
  setAgentState(state);
}, []);

// Usage in component
<DeepgramVoiceInteraction
  onConnectionStateChange={handleConnectionStateChange}
  onReady={handleReady}
  onAgentStateChange={handleAgentStateChange}
  // ... other props
/>

// Replace imperative checks
// Before: if (!deepgramRef.current.getConnectionStates().agentConnected)
// After: if (agentConnectionState === 'connected')
```

### Phase 4: Update E2E Tests ✅ TODO

**Objective**: Replace debug method usage in E2E tests with public API alternatives or remove if unnecessary

**Test Files Using Debug Methods**:
1. `test-app/tests/e2e/helpers/test-helpers.js` (line 67)
2. `test-app/tests/e2e/vad-redundancy-and-agent-timeout.spec.js` (line 265-266)
3. `test-app/tests/e2e/lazy-initialization-e2e.spec.js` (extensive usage - 27 instances)
4. `test-app/tests/e2e/vad-transcript-analysis.spec.js` (line 309-310)
5. `test-app/tests/e2e/vad-realistic-audio.spec.js` (line 110-123)
6. `test-app/tests/e2e/vad-debug-test.spec.js` (line 72-85)
7. `test-app/tests/e2e/user-stopped-speaking-callback.spec.js` (line 76-82, 174)
8. `test-app/tests/e2e/vad-solution-test.spec.js` (line 61-62)
9. `test-app/tests/e2e/vad-event-validation.spec.js` (line 87 - uses transcriptionManagerRef directly)
10. `test-app/tests/e2e/transcription-config-test.spec.js` (line 34-40)

**Tasks**:
1. ✅ For each test, determine if debug method usage is necessary
2. ✅ Replace with callback-based state tracking where needed
3. ✅ Remove debug method checks that are redundant
4. ✅ Use page.evaluate() with callbacks if needed for E2E state verification

**E2E Test Migration Strategy**:

**Pattern 1: Callback-Based State Tracking** (Recommended for most cases)
```javascript
// Setup state tracking in page context
await page.evaluate(() => {
  window.testConnectionStates = {
    agent: 'closed',
    transcription: 'closed'
  };
  
  // Override onConnectionStateChange to track state
  const originalCallback = window.onConnectionStateChange;
  window.onConnectionStateChange = (service, state) => {
    window.testConnectionStates[service] = state;
    if (originalCallback) originalCallback(service, state);
  };
});

// Wait for expected state
await page.waitForFunction(
  ({ expectedService, expectedState }) => {
    return window.testConnectionStates[expectedService] === expectedState;
  },
  { expectedService: 'agent', expectedState: 'connected' },
  { timeout: 5000 }
);
```

**Pattern 2: Verify via Observable Behavior**
```javascript
// Instead of checking connection state, verify behavior:
// - If connected, messages should be received
// - If disconnected, messages should not be received
await page.waitForFunction(
  () => {
    const logs = document.querySelector('[data-testid="logs"]');
    return logs?.textContent.includes('agent connection state: connected');
  },
  { timeout: 5000 }
);
```

**Pattern 3: Track State Changes During Operation**
```javascript
// For before/after comparisons
await page.evaluate(() => {
  window.stateChangeLog = [];
  const originalCallback = window.onConnectionStateChange;
  window.onConnectionStateChange = (service, state) => {
    window.stateChangeLog.push({ service, state, timestamp: Date.now() });
    if (originalCallback) originalCallback(service, state);
  };
});

const beforeTime = Date.now();
// ... perform operation ...
await page.waitForTimeout(500);

const stateChanges = await page.evaluate(() => {
  return window.stateChangeLog.filter(c => c.timestamp >= beforeTime);
});
```

**Pattern 4: Settings Applied Helper**
```javascript
// Wait for settings applied using new callback
async function waitForSettingsApplied(page, timeout = 10000) {
  await page.evaluate(() => {
    window.settingsApplied = false;
    const originalCallback = window.onSettingsApplied;
    window.onSettingsApplied = () => {
      window.settingsApplied = true;
      if (originalCallback) originalCallback();
    };
  });
  
  await page.waitForFunction(
    () => window.settingsApplied === true,
    { timeout }
  );
}
```

### Phase 5: Verify Coverage ✅ TODO

**Objective**: Ensure all functionality previously accessible via debug methods is available through public API

**Checklist**:
- [ ] Settings applied state - Available via `onSettingsApplied()` callback (Phase 0)
- [ ] Connection state (transcription) - Available via `onConnectionStateChange('transcription', state)`
- [ ] Connection state (agent) - Available via `onConnectionStateChange('agent', state)`
- [ ] Component ready state - Available via `onReady(isReady)`
- [ ] Agent state - Available via `onAgentStateChange(state)`
- [ ] Playback state - Available via `onPlaybackStateChange(isPlaying)`
- [ ] Any missing state information identified

**Potential Gaps**:
- Review `VoiceInteractionState` interface to identify any state not exposed via callbacks
- Document any legitimate need for debug methods (should be rare)
- Consider adding missing callbacks if needed

## Test Status

### Current API Validation Test

**Location**: `tests/voice-agent-api-validation.test.tsx`

**Current Behavior**:
- Line 854-855: Methods excluded from validation with comment
- Should be: Methods cause test failure (not approved for v0.5.0)

**Expected After Phase 1**:
- Methods listed in `METHODS_TO_REMOVE`
- Test fails if methods still exist in component
- Validates they're not part of public API

### Component Tests

**Impact**: Some component tests may use debug methods
- Check `tests/` directory for usage
- Update tests to use public API alternatives

## Files Summary

### To Remove Methods From:
1. `src/types/index.ts` - Type definitions (lines 288-298)
2. `src/components/DeepgramVoiceInteraction/index.tsx` - Implementation (lines 2202-2208)

### To Update API Validation:
1. `tests/api-baseline/approved-additions.ts` - Move to `METHODS_TO_REMOVE`
2. `tests/voice-agent-api-validation.test.tsx` - Remove exclusion, validate removal

### To Migrate (Test-App):
1. `test-app/src/App.tsx` - 4 usages (lines 231, 328, 332, 548, 890)

### To Migrate (E2E Tests):
1. `test-app/tests/e2e/helpers/test-helpers.js` - 1 usage
2. `test-app/tests/e2e/vad-redundancy-and-agent-timeout.spec.js` - 1 usage
3. `test-app/tests/e2e/lazy-initialization-e2e.spec.js` - 27 usages
4. `test-app/tests/e2e/vad-transcript-analysis.spec.js` - 1 usage
5. `test-app/tests/e2e/vad-realistic-audio.spec.js` - 2 usages
6. `test-app/tests/e2e/vad-debug-test.spec.js` - 2 usages
7. `test-app/tests/e2e/user-stopped-speaking-callback.spec.js` - 3 usages
8. `test-app/tests/e2e/vad-solution-test.spec.js` - 1 usage
9. `test-app/tests/e2e/vad-event-validation.spec.js` - 1 usage (direct ref access)
10. `test-app/tests/e2e/transcription-config-test.spec.js` - 2 usages

**Total**: ~45 usages across test-app and E2E tests

## Migration Examples

### Example 1: Connection State Check (test-app)

**Before**:
```typescript
const connectionStates = deepgramRef.current.getConnectionStates();
if (!connectionStates.agentConnected) {
  await deepgramRef.current.start();
}
```

**After**:
```typescript
const [agentConnected, setAgentConnected] = useState(false);

<DeepgramVoiceInteraction
  onConnectionStateChange={(service, state) => {
    if (service === 'agent') {
      setAgentConnected(state === 'connected');
    }
  }}
/>

// Later in code
if (!agentConnected) {
  await deepgramRef.current.start();
}
```

### Example 2: Component State Check (test-app)

**Before**:
```typescript
const state = deepgramRef.current?.getState?.();
if (state?.isReady && state?.agentState === 'idle') {
  // handle ready state
}
```

**After**:
```typescript
const [isReady, setIsReady] = useState(false);
const [agentState, setAgentState] = useState<AgentState>('idle');

<DeepgramVoiceInteraction
  onReady={setIsReady}
  onAgentStateChange={setAgentState}
/>

// Later in code
if (isReady && agentState === 'idle') {
  // handle ready state
}
```

### Example 3: E2E Test State Verification

**Before**:
```javascript
const states = await page.evaluate(() => {
  return deepgramComponent.getConnectionStates();
});
expect(states.agentConnected).toBe(true);
```

**After (Callback-Based Tracking)**:
```javascript
// Setup state tracking
await page.evaluate(() => {
  window.testConnectionStates = { agent: 'closed', transcription: 'closed' };
  const originalCallback = window.onConnectionStateChange;
  window.onConnectionStateChange = (service, state) => {
    window.testConnectionStates[service] = state;
    if (originalCallback) originalCallback(service, state);
  };
});

// Wait for expected state
await page.waitForFunction(
  () => window.testConnectionStates.agent === 'connected',
  { timeout: 5000 }
);
```

### Example 4: Settings Applied Check

**Before**:
```javascript
await page.waitForFunction(
  () => {
    const state = deepgramRef.current.getState();
    return state?.hasSentSettings === true;
  },
  { timeout: 10000 }
);
```

**After**:
```javascript
await page.evaluate(() => {
  window.settingsApplied = false;
  const originalCallback = window.onSettingsApplied;
  window.onSettingsApplied = () => {
    window.settingsApplied = true;
    if (originalCallback) originalCallback();
  };
});

await page.waitForFunction(
  () => window.settingsApplied === true,
  { timeout: 10000 }
);
```

## Success Criteria

### Phase 0: Add Missing Callback
- [ ] `onSettingsApplied` callback added to component props
- [ ] Callback called when `SettingsApplied` event received
- [ ] TypeScript types updated
- [ ] API reference documentation updated

### Phase 1: API Validation
- [ ] Methods moved to `METHODS_TO_REMOVE` in `approved-additions.ts`
- [ ] API validation test fails when methods exist (confirms they shouldn't be public API)
- [ ] Test passes after methods removed

### Phase 2: Component Removal
- [ ] Methods removed from `DeepgramVoiceInteractionHandle` interface
- [ ] Methods removed from component implementation
- [ ] TypeScript compilation succeeds
- [ ] Component builds successfully

### Phase 3: Test-App Migration
- [ ] All `hasSentSettings` polling replaced with `onSettingsApplied` callback
- [ ] All `getConnectionStates()` usages replaced with `onConnectionStateChange` callback
- [ ] All `getState()` usages replaced with appropriate callbacks
- [ ] Application maintains same functionality
- [ ] No regressions in test-app behavior

### Phase 4: E2E Test Migration
- [ ] All E2E tests updated or debug method usage removed
- [ ] Tests pass with callback-based state tracking
- [ ] No test functionality lost

### Phase 5: Verification
- [ ] All previous debug method functionality available via public API
- [ ] No missing state information identified
- [ ] All tests pass using callback-based alternatives
- [ ] Documentation updated if needed

## Remediation Status

**✅ Debate Settled**: All test usages have been analyzed and have clear remediation paths:
- **Connection State**: 35 usages → Use `onConnectionStateChange` callback tracking
- **Settings Applied**: 3 usages → Use new `onSettingsApplied` callback (requires Phase 0 - adding the callback)
- **Component State**: 5 usages → Use existing callbacks or remove debug code
- **Method Existence**: 1 usage → Convert to negative test
- **Direct Ref Access**: 1 usage → Needs review (may require test utility)

**Conclusion**: Removal is **safe and feasible** once `onSettingsApplied` callback is added (Phase 0). The new callback provides the missing public API needed to replace debug method usage. All test functionality can be preserved using public API alternatives.

## Related Issues

- **Issue #153**: Documentation review that identified implementation detail exposure
- **Issue #159**: Session management migration (similar API cleanup)
- **Issue #161**: Remove redundant reconnection methods (similar cleanup effort)
- **Issue #195**: Remove `isPlaybackActive()` method (similar pattern)

## References

- Voice Agent API Documentation: https://developers.deepgram.com/docs/voice-agent
- Component API Reference: `src/types/index.ts`
- API Baseline: `tests/api-baseline/approved-additions.ts`
- API Validation Tests: `tests/voice-agent-api-validation.test.tsx`

---

**Last Updated**: [Date TBD]  
**Status**: Ready for implementation planning
