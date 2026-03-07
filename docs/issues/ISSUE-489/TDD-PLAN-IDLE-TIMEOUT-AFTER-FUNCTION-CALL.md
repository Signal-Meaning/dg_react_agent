# TDD Plan: Resolve “should re-enable idle timeout after function calls complete” (Issue #373 / #489)

**Goal:** Fix the single remaining E2E failure in `issue-373-idle-timeout-during-function-calls.spec.js`: after the component receives `AgentAudioDone`, the idle timeout must start and fire (or the connection must close) within the test window.

**Reference:** [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) — “Current focus: single remaining failure” and §1.

**Status: Resolved.** E2E “should re-enable idle timeout after function calls complete” passes. See “Resolution (completed)” below.

---

## Resolution (completed)

**Root cause:** The timeout was started after AgentAudioDone (push idle + handleMeaningfulActivity), but the hook’s `useEffect` (state change) then ran with **stale state** (e.g. `agentState: 'thinking'`, `isPlaying: true`) before React had committed the AgentAudioDone dispatches. That led to `AGENT_STATE_CHANGED('thinking')`, `updateStateDirectly(blocking state)`, and/or `updateTimeoutBehavior()` calling `disableResets()` → `stopTimeout()`, so the timer was cleared and never fired.

**Fixes applied:**

1. **Component** — Always call `pushIdleStateToIdleTimeoutService()` on AgentDone/AgentAudioDone (remove condition on agentState). Push full idle state including `isUserSpeaking: false` (in hook).
2. **Hook** — Sync **full state** to the service at the **start** of the state effect (before emitting any events) so the service has the latest state when handling the first event.
3. **IdleTimeoutService.updateStateDirectly** — When there is an **active timeout** and the update would disable resets, **defer** and re-read from **stateGetter** next tick; if stateGetter still returns blocking state, **do not merge** (avoid overwriting with stale state and stopping the timeout).
4. **IdleTimeoutService.disableResets(skipStopIfTimeoutActive)** — When the only blocking reason is **isPlaying** or **agentState** (thinking/speaking), call `disableResets(true)` so we **do not** stop an active timeout. For isUserSpeaking, function calls, or waiting we still stop (`disableResets(false)`).
5. **IdleTimeoutService** — In **checkAndStartTimeoutIfNeeded**, when there is an active timeout and stateGetter returns `isUserSpeaking: true`, **skip overwriting** state so we do not stop the timeout on stale refs.
6. **AGENT_STATE_CHANGED('thinking')** — When there is an **active timeout**, do **not** call `stopTimeout()` so a single stale “thinking” event from the hook does not clear the timer.

**Diagnostics added (E2E):** `__idleTimeoutStarted__`, `__idleTimeoutStopped__`, `__idleTimeoutMs`; E2E spec logs these and documents proxy log grep for completion signals.

---

## 1. Current state (pre-resolution)

- **Observed:** `__agentAudioDoneReceived__ === true`, but `__idleTimeoutFired__ === false` and connection does not close.
- **Done so far:** Proxy sends completion; component clears waiting flag and transitions to idle on AgentAudioDone; `pushIdleStateToIdleTimeoutService()` runs before `handleMeaningfulActivity`. Unit test in `unified-timeout-coordination.test.js` covers MEANINGFUL_USER_ACTIVITY(AgentAudioDone) clearing the waiting flag.
- **Suspected causes:**  
  - IdleTimeoutService never sees “idle” in this path (e.g. `pushIdleStateToIdleTimeoutService` only called when `agentState` is speaking/listening/thinking; if it’s already `idle`, we don’t push and service state can stay stale).  
  - Or another condition in `canStartTimeout` remains false (e.g. `hasSeenUserActivityThisSession`, or ordering/timing so the timeout never starts in the same tick).  
  - **Actual cause:** Timeout was started but then **stopped** by stale state from the hook’s effect (see Resolution above).

---

## 2. TDD workflow (mandatory)

Follow **Red → Green → Refactor** for each change:

1. **Red:** Add or extend a failing test that encodes the desired behavior.
2. **Green:** Implement the minimal change so the test passes.
3. **Refactor:** Clean up without changing behavior; keep tests green.

---

## 3. Phase 1: Unit tests (IdleTimeoutService + component path)

### 3.1 IdleTimeoutService: AgentAudioDone with stale “thinking” state

**Hypothesis:** When MEANINGFUL_USER_ACTIVITY(AgentAudioDone) is processed, if the service’s `currentState.agentState` is still `'thinking'` (e.g. no prior push of idle), the code takes the `else` branch and only calls `updateTimeoutBehavior()`. Then `canStartTimeout()` sees `agentState === 'thinking'` and does not start the timeout.

**Red:**

- In `tests/integration/unified-timeout-coordination.test.js`, add a test:
  - Establish session (user activity, idle state).
  - FUNCTION_CALL_STARTED → FUNCTION_CALL_COMPLETED (so `waitingForNextAgentMessageAfterFunctionResult === true`).
  - Do **not** send AGENT_STATE_CHANGED(idle) or PLAYBACK_STATE_CHANGED.
  - Send MEANINGFUL_USER_ACTIVITY(activity: `'AgentAudioDone'`) only (simulate “AgentAudioDone with stale service state”).
  - Assert: after advancing timers by `timeoutMs`, `onTimeout` is **not** called (because with current logic the service never sees idle, so timeout doesn’t start).
- Then add a second variant: before MEANINGFUL_USER_ACTIVITY(AgentAudioDone), call `updateStateDirectly({ agentState: 'idle', isPlaying: false })` (simulating the component always pushing idle before AgentAudioDone). Assert: after advancing by `timeoutMs`, `onTimeout` **is** called once.

**Green:**

- In `IdleTimeoutService.handleEvent` for MEANINGFUL_USER_ACTIVITY when activity is AgentAudioDone/AgentDone: after clearing the waiting flag, if we are about to check `isAgentIdle(this.currentState)` and we have a `stateGetter`, optionally read from `stateGetter()` and merge “idle + not playing” into the state used for that branch (so we treat “agent done” as implying idle for starting the timeout).  
  **Or** (simpler and recommended): no change in IdleTimeoutService; instead ensure the component **always** pushes idle before handleMeaningfulActivity (see Phase 2). Then the first test remains “without push, timeout does not start”; the second test “with push, timeout fires” already passes with current service logic.

**Refactor:** Keep test names and service logic clear; avoid duplicate logic.

---

### 3.2 Component: Always push idle before AgentAudioDone/AgentDone

**Hypothesis:** If `stateRef.current.agentState` is already `'idle'` when we handle AgentAudioDone (e.g. race or earlier transition), we skip `pushIdleStateToIdleTimeoutService()`. The service then keeps stale state (e.g. `'thinking'`) and does not start the timeout.

**Red:**

- Add a unit/integration test (e.g. in `issue-487-idle-timeout-after-function-result-component.test.tsx` or a new small spec) that:
  - Renders the component with function calling and idle timeout.
  - Simulates: user message → function call → app sends result → **only** AgentDone/AgentAudioDone (no extra ConversationText or AGENT_STATE_CHANGED from the test).
  - Optionally mock or force `stateRef.current.agentState === 'idle'` at the moment of handling AgentAudioDone (if feasible without invasive refactor).
  - Assert: after advancing past idle timeout, the connection closes (or the idle timeout callback is invoked).
- If we cannot easily simulate “agentState already idle” in the component test, the **E2E test is the Red**: we know E2E fails today; the fix is “always push.”

**Green:**

- In `DeepgramVoiceInteraction/index.tsx`, in the AgentDone/AgentAudioDone block (~2254–2285): **always** call `pushIdleStateToIdleTimeoutService()` when we receive AgentDone or AgentAudioDone, not only when `agentState === 'speaking' || agentState === 'listening' || agentState === 'thinking'`.  
  Rationale: “Agent done” means the turn is over; the service should see idle so it can start the timeout. Removing the condition ensures the service always gets the correct state.

**Refactor:** Add a one-line comment: “Always push idle so IdleTimeoutService can start timeout (even if component state is already idle).”

---

## 4. Phase 2: E2E assertion and diagnostics (optional but useful)

**Red:**

- The existing E2E “should re-enable idle timeout after function calls complete” is the integration Red: it already fails with the current behavior.

**Green (same as Phase 1):**

- The component change (always push idle) should make the E2E pass, assuming no other blocker (e.g. proxy never sending AgentAudioDone in this path is already ruled out by the doc and `__agentAudioDoneReceived__` assertion).

**Optional diagnostics (no TDD requirement):**

- In the E2E run, log or expose (e.g. via `window.__idleTimeoutDebug__`) from the component or hook:
  - Whether `pushIdleStateToIdleTimeoutService` was called for the AgentAudioDone in question.
  - Whether `IdleTimeoutService.startTimeout` (or equivalent) was invoked after that (could be a debug flag set in the service when `startTimeout` runs).
- Run with `LOG_LEVEL=info` on the proxy and confirm `response.done` or `response.output_text.done` (and thus AgentAudioDone) for the function-call turn, as in E2E-FAILURES-RESOLUTION.md Phase 1.

---

## 5. Phase 3: Lock in with tests and remove temporary E2E flag

1. **Unit/integration:** Ensure the new/updated tests from Phase 1 are committed and run in CI.
2. **E2E:** Run from test-app:  
   `USE_REAL_APIS=1 npm run test:e2e -- issue-373-idle-timeout-during-function-calls.spec.js --grep "re-enable idle timeout"`  
   and confirm the test passes.
3. **Cleanup:** Remove or repurpose the temporary E2E flag `__agentAudioDoneReceived__` if it was only for Issue #489 debugging (see TODO in index.tsx ~2287). If it remains for diagnostics, document it and keep the assertion that uses it.

---

## 6. Summary of changes (implemented)

| Step | Type | Action |
|------|------|--------|
| 1 | Unit test | Added in unified-timeout-coordination: “AgentAudioDone without prior state push (stale thinking) does NOT start timeout”; “AgentAudioDone with prior updateStateDirectly(idle) starts timeout and it fires.” |
| 2 | Component | In AgentDone/AgentAudioDone handler: always call `pushIdleStateToIdleTimeoutService()` (removed the condition on `agentState === 'speaking' \|\| ...`). |
| 3 | Hook | `pushIdleStateToIdleTimeoutService` pushes full idle state (`isUserSpeaking: false` included). State effect syncs full state to the service **before** emitting transition events. |
| 4 | IdleTimeoutService | updateStateDirectly: defer and re-read from stateGetter when update would disable and timeout is active; skip merge if stateGetter still blocking. disableResets(skipStopIfTimeoutActive): do not stop active timeout when only isPlaying/agentState. checkAndStartTimeoutIfNeeded: skip overwrite when timeout active and stateGetter says isUserSpeaking. AGENT_STATE_CHANGED(thinking): do not stop when timeout active. |
| 5 | E2E diagnostics | `__idleTimeoutStarted__`, `__idleTimeoutStopped__`, `__idleTimeoutMs`; spec logs these and documents proxy log grep. |
| 6 | E2E | issue-373 “re-enable idle timeout” spec passes. |
| 7 | Cleanup | `__agentAudioDoneReceived__` retained for assertion; optional removal later (see Phase 3). |

---

## 7. If E2E still fails after the component fix

Then dig deeper in this order:

1. **Timing:** Confirm `VITE_IDLE_TIMEOUT_MS` (e.g. 1000 in Playwright) and that the test waits long enough (e.g. 12s) for 1s idle timeout to fire.
2. **Order of operations:** In the component, verify that nothing else (e.g. another message handler or effect) sets the service state back to non-idle or clears the timeout after AgentAudioDone.
3. **stateGetter:** In the E2E path, ensure the hook’s `stateGetter` is set and that it returns the latest component state (e.g. idle) when the service polls; add a unit test that stateGetter is used in `checkAndStartTimeoutIfNeeded` when the service state was updated by `updateStateDirectly` and that the timeout then starts.
4. **Proxy:** Confirm with proxy logs that AgentAudioDone is sent for the in-browser function-call turn (real API); see E2E-FAILURES-RESOLUTION.md Phase 1.

---

## 8. References

- E2E spec: `test-app/tests/e2e/issue-373-idle-timeout-during-function-calls.spec.js` (“should re-enable idle timeout after function calls complete”).
- Component: `src/components/DeepgramVoiceInteraction/index.tsx` (AgentDone/AgentAudioDone block ~2252–2290).
- Hook: `src/hooks/useIdleTimeoutManager.ts` (`pushIdleStateToIdleTimeoutService`).
- Service: `src/utils/IdleTimeoutService.ts` (`canStartTimeout`, MEANINGFUL_USER_ACTIVITY, `updateStateDirectly`, `resetTimeout`).
- Unit tests: `tests/integration/unified-timeout-coordination.test.js` (e.g. “should clear waiting-for-next-message when MEANINGFUL_USER_ACTIVITY is AgentAudioDone or AgentDone”).
