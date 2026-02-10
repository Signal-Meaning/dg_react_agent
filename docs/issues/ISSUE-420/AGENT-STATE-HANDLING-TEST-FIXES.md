# Resolve Failing Unit Tests in `agent-state-handling.test.ts`

**Status:** Resolved  
**Created:** 2025-02-10  
**Resolved:** 2025-02-10  
**Release:** v0.7.19 (Issue #420)

---

## Resolution (product behavior fix)

The idle timeout was incorrectly gated only on **USER_STARTED_SPEAKING**. The correct behavior is: **timeout is paused until first user activity** (speaking, sending text, or other meaningful activity); after any such event, the timeout is allowed to run when conditions are idle.

**Changes made:**

1. **`IdleTimeoutService`** (`src/utils/IdleTimeoutService.ts`):
   - Renamed `userHasSpokenThisSession` → `hasSeenUserActivityThisSession`.
   - Set this flag to `true` on **USER_STARTED_SPEAKING**, **USER_STOPPED_SPEAKING**, **UTTERANCE_END**, and **MEANINGFUL_USER_ACTIVITY** (so speaking or sending text—or any meaningful user activity—unpauses the timeout).
   - Updated comments to describe “pause until first user activity” instead of “user has spoken”.
   - `canStartTimeout()` still requires `hasSeenUserActivityThisSession` so the timeout does not fire before the user has interacted.
   - Added a synchronous `checkAndStartTimeoutIfNeeded()` call in `updateTimeoutBehavior()` so the timeout starts in the same tick and `onStateChange` callbacks see it.

2. **Test** (`tests/agent-state-handling.test.ts`):
   - In “should call onIdleTimeoutActiveChange when timeout active state changes”, added **USER_STARTED_SPEAKING** before the transition to idle so the final **USER_STOPPED_SPEAKING** causes a state change and the callback runs.

- **Tests:** All 45 tests in `agent-state-handling.test.ts` pass. Integration test `unified-timeout-coordination.test.js` was updated so “should handle agent speaking state” sends user activity (e.g. `MEANINGFUL_USER_ACTIVITY` + `PLAYBACK_STATE_CHANGED` false) so the timeout can start; that test now passes.

---

## Summary (original issue)

All failures were in `tests/agent-state-handling.test.ts` in the `IdleTimeoutService` describe block. Every failure was the same assertion: `expect(idleTimeoutService.isTimeoutActive()).toBe(true)` — **Expected: true, Received: false**.

The timeout never starts in these tests because the service requires "user has spoken at least once this session" before it will start the idle timeout. The tests that expect the timeout to be active do not set that condition.

---

## Root Cause

**File:** `src/utils/IdleTimeoutService.ts`

- **`isTimeoutActive()`** returns `this.timeoutId !== null` (line 486).
- **`startTimeout()`** is only called when **`canStartTimeout()`** returns true (line 408).
- **`canStartTimeout()`** (lines 258–265) requires:
  - `this.userHasSpokenThisSession` ← **this is false in failing tests**
  - `this.isAgentIdle(state)`
  - `!state.isUserSpeaking`
  - `!state.isPlaying`
  - `!this.isDisabled`
  - `!this.hasActiveFunctionCalls()`

**`userHasSpokenThisSession`** is set to `true` only when handling **`USER_STARTED_SPEAKING`** (line 133). It is never set by `AGENT_STATE_CHANGED`, `PLAYBACK_STATE_CHANGED`, or `UTTERANCE_END`.

Many tests only send:

- `AGENT_STATE_CHANGED` (state: `'idle'`)
- `PLAYBACK_STATE_CHANGED` (isPlaying: false)
- `UTTERANCE_END`

So the service correctly refuses to start the timeout (user has not spoken this session). The tests were written assuming the timeout would start when "all conditions are idle" but did not account for the product requirement that the timeout only starts after the user has spoken at least once.

---

## Failing Tests (8 in this file)

All in `tests/agent-state-handling.test.ts`. Line = failing `expect(idleTimeoutService.isTimeoutActive()).toBe(true)`.

| # | Test name | Line |
|---|-----------|------|
| 1 | Agent state → idle transition › should enable idle timeout resets when playback completes and agent transitions to idle | 197 |
| 2 | Agent state → idle transition › should start idle timeout after playback stops and agent state transitions to idle | 266 |
| 3 | Issue #262/#430: USER_STOPPED_SPEAKING should start timeout after re-enabling › should start timeout after USER_STOPPED_SPEAKING re-enables when all conditions are idle | 567 |
| 4 | Issue #262/#430: USER_STOPPED_SPEAKING should start timeout after re-enabling › should start timeout after USER_STOPPED_SPEAKING when agent is already idle | 606 |
| 5 | Issue #262/#430: Timeout callback should fire when timeout reaches › should fire callback when timeout reaches 10 seconds | 672 |
| 6 | Issue #262/#430: Timeout callback should fire when timeout reaches › should fire callback even if timeout was stopped and restarted | 693 |
| 7 | Issue #262/#430: Assistant ConversationText should not reset timeout › should reset timeout when user ConversationText message arrives | 742 |

**Note:** Full `npm test` may report more failures (e.g. 20) if other suites depend on the same behavior. Fixing these 8 by ensuring `userHasSpokenThisSession` is set (Option A) should address all.

---

## Resolution Options

### Option A (recommended): Fix tests to satisfy `userHasSpokenThisSession`

For every test that expects the idle timeout to start when agent is idle and playback has stopped:

1. **Before** the sequence that should start the timeout, ensure the user has "spoken" in the session by sending:
   - `USER_STARTED_SPEAKING`
   - then `USER_STOPPED_SPEAKING` or `UTTERANCE_END`
2. Then send the existing events (e.g. `AGENT_STATE_CHANGED` idle, `PLAYBACK_STATE_CHANGED` false, `UTTERANCE_END` as needed).

This keeps product behavior unchanged and makes tests match the real contract.

**Example (pattern to apply):**

```ts
// Before (timeout never starts):
idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
idleTimeoutService.handleEvent({ type: 'UTTERANCE_END' });
expect(idleTimeoutService.isTimeoutActive()).toBe(true); // FAILS

// After (timeout starts):
idleTimeoutService.handleEvent({ type: 'USER_STARTED_SPEAKING' });
idleTimeoutService.handleEvent({ type: 'USER_STOPPED_SPEAKING' });
idleTimeoutService.handleEvent({ type: 'AGENT_STATE_CHANGED', state: 'idle' });
idleTimeoutService.handleEvent({ type: 'PLAYBACK_STATE_CHANGED', isPlaying: false });
idleTimeoutService.handleEvent({ type: 'UTTERANCE_END' });
expect(idleTimeoutService.isTimeoutActive()).toBe(true); // PASSES
```

**Tests to update:** Every test that currently sends only idle + playback false + UTTERANCE_END and then asserts `isTimeoutActive() === true`. Add the two-event "user has spoken" sequence at the start of that scenario (or at the start of the test if the whole test assumes an active session).

### Option B: Test-only bypass for `userHasSpokenThisSession`

- Add a constructor option or setter (e.g. `setUserHasSpokenThisSessionForTesting(true)`) used only in tests so that existing test sequences don’t need to send USER_STARTED_SPEAKING.
- **Downside:** Tests no longer validate the real "only start after user has spoken" behavior; product code gains test-only surface.

### Option C: Change product behavior

- Remove or relax the `userHasSpokenThisSession` requirement in `canStartTimeout()`.
- **Downside:** Would change runtime behavior (timeout could start before user has spoken); likely undesirable.

---

## Implementation Plan (Option A)

1. **Audit**  
   In `tests/agent-state-handling.test.ts`, find every `expect(idleTimeoutService.isTimeoutActive()).toBe(true)` (and equivalent for `testService`). For each, check whether the test has already sent `USER_STARTED_SPEAKING` earlier in the same scenario. List tests that don’t.

2. **Fix each failing scenario**  
   For each test that expects the timeout to be active but never sets "user has spoken":
   - Insert at the appropriate point (usually before the "all idle" sequence):
     - `handleEvent({ type: 'USER_STARTED_SPEAKING' })`
     - `handleEvent({ type: 'USER_STOPPED_SPEAKING' })` or `handleEvent({ type: 'UTTERANCE_END' })`
   - Use `jest.useFakeTimers()` where needed so that any `setTimeout(..., 0)` in `updateTimeoutBehavior()` is flushed (e.g. `jest.advanceTimersByTime(0)` or `jest.runAllTimers()` as appropriate) before asserting `isTimeoutActive()`.

3. **Run tests**  
   - `npm test -- tests/agent-state-handling.test.ts`  
   - Confirm all 20 previously failing cases pass and no other regressions.

4. **Update this doc**  
   - Set **Status** to **Resolved** and add a short "Resolution" section (e.g. "Applied Option A: added USER_STARTED_SPEAKING + USER_STOPPED_SPEAKING in N tests.").

---

## Acceptance Criteria

- [x] All 8 failing tests in `tests/agent-state-handling.test.ts` pass (and full `npm test` for that file passes).
- [x] Integration test `unified-timeout-coordination.test.js` updated and passing.
- [x] Production behavior of `IdleTimeoutService` updated as intended: timeout paused until first user activity (any of: speaking, text, meaningful activity).
- [x] This tracking doc updated with resolution.

---

## References

- `src/utils/IdleTimeoutService.ts` — `canStartTimeout()`, `userHasSpokenThisSession`, `startTimeout()`, `isTimeoutActive()`
- `tests/agent-state-handling.test.ts` — all `IdleTimeoutService` tests
- Issue #262 / #430 — timeout callback and assistant ConversationText behavior
- Release checklist: `docs/issues/ISSUE-420/RELEASE-CHECKLIST.md`
