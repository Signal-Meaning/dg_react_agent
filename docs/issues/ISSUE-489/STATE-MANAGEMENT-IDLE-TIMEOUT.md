# Issue #489: Why Idle Timeout State Management Feels Unreliable and What to Do

## Summary

E2E tests for “greeting → idle → connection closes after 10s” keep failing even after fixes (AgentAudioDone → idle + isPlaying false, Deepgram proxy sending AgentAudioDone, etc.). Unit and integration tests should isolate where the contract breaks so we fail in CI instead of only in E2E.

---

## Why State Management Feels Unreliable

### 1. Multiple sources of truth

- **Component:** Reducer state (`agentState`, `isPlaying`, `isUserSpeaking`) and refs (`stateRef`, etc.).
- **useIdleTimeoutManager:** `currentStateRef` (used by the IdleTimeoutService’s `stateGetter`) and `prevStateRef`. The hook turns state changes into events and a fallback `updateStateDirectly` call.
- **IdleTimeoutService:** Internal `currentState` (updated from events or from `stateGetter()`), plus `hasSeenUserActivityThisSession`, `waitingForNextAgentMessageAfterFunctionResult`, etc.

If any of these gets out of sync (e.g. `currentStateRef` not updated when state changes), the service can see stale data and never start the timeout.

### 2. Stale ref in the hook (fixed for Issue #489)

The service’s `checkAndStartTimeoutIfNeeded()` uses `stateGetter()` to read “current” state from the component. The hook’s `stateGetter` was implemented as `() => ({ ...currentStateRef.current })`, but **`currentStateRef` was never updated** when `state` changed. So the service always saw the initial state and could never start the timeout when the real state was idle + isPlaying false.

**Fix applied:** In `useIdleTimeoutManager`, at the start of the state-change effect we set `currentStateRef.current = state` so the getter returns the latest state.

### 3. Event ordering and batching

React batches updates. When the component dispatches `PLAYBACK_STATE_CHANGE` and `AGENT_STATE_CHANGE` in the same tick, the hook’s effect runs once with the new state. The service receives both events and/or `updateStateDirectly`. If the service’s logic assumes one order (e.g. isPlaying before agentState) and events arrive in another order, or if `stateGetter` was stale, the timeout might not start. The deferred `setTimeout(..., 0)` in `updateTimeoutBehavior` is there to catch out-of-order updates but depends on the getter returning fresh state.

### 4. E2E as the first feedback loop

Without unit/integration tests that assert “when service has idle + !isPlaying + user activity, timeout starts” and “when component receives AgentAudioDone, it dispatches idle + isPlaying false,” we only see failures in E2E. That makes it hard to tell whether the bug is in the service, the hook, the component, or the proxy.

---

## What Could Be Done

### A. Unit tests (done)

- **IdleTimeoutService** (`tests/integration/unified-timeout-coordination.test.js`):
  - **Issue #489: stateGetter and updateStateDirectly:**
    - `updateStateDirectly` with idle + isPlaying false after user activity → timeout starts and fires.
    - When `stateGetter` returns idle + !isPlaying, the path that uses it (`updateStateDirectly` → `updateTimeoutBehavior` → `checkAndStartTimeoutIfNeeded`) starts the timeout.
    - After agent was “speaking” (isPlaying true), `updateStateDirectly` with idle + isPlaying false → timeout starts and fires.

These lock in the service contract so we fail in CI if the service stops starting the timeout when given the right state.

### B. Integration tests

1. **Component + AgentAudioDone → idle timeout starts** (added: `tests/integration/issue-489-greeting-idle-timeout-component.test.tsx`)
   - Mount component with agent options and `idleTimeoutMs: 10000`, connect via existing helpers.
   - Trigger “user activity” by calling the mock’s captured `onMeaningfulActivity` (same as real manager would on agent activity).
   - Inject `AgentStartedSpeaking` then `AgentAudioDone` via the agent message listener.
   - Advance fake timers by 10.5s.
   - Assert `close()` was called.
   - Run: `npm test -- tests/integration/issue-489-greeting-idle-timeout-component.test.tsx`

2. **Hook + stateGetter freshness (optional)**
   - Test that when `useIdleTimeoutManager`’s `state` changes to idle + isPlaying false, the IdleTimeoutService’s `stateGetter` returns that state when called (e.g. by exposing a test-only getter or by asserting timeout starts after the state change).

### C. State management improvements

1. **Single source of truth**
   - Have the service rely only on `stateGetter` for “should I start the timeout?” and ensure the getter always reads the component’s current state (e.g. a ref updated on every render or on every state change). The fix above does this for the hook’s ref.

2. **Explicit “start timeout” API (optional)**
   - Instead of the service inferring from events, the component could call something like `idleTimeoutManager.startTimeoutNow()` when it knows the agent is done (e.g. on AgentAudioDone). That would make the contract explicit and easier to test, at the cost of a new API and possible duplication with the event path.

3. **Logging in tests**
   - In E2E or integration tests, log or expose `isTimeoutActive()` and the state passed to the service so we can see whether the timeout failed to start or failed to fire.

---

## Next Steps

1. Run the new unit tests:  
   `npm test -- tests/integration/unified-timeout-coordination.test.js -t "Issue #489"`  
   and keep them green.

2. Add the component integration test (AgentAudioDone → advance timers → assert close) so the full path is covered.

3. If E2E still fails, confirm the test-app bundle includes the latest component (e.g. rebuild or ensure the dev server serves the updated code) and that the Deepgram proxy in use sends AgentAudioDone after the first assistant ConversationText.

4. Context-retention E2E failure (“Agent responded with greeting instead of using context”) is a different issue: context is sent in Settings but the model/upstream returns the greeting again. That is likely backend/Deepgram behavior or context format, not the idle-timeout state management in the component.
