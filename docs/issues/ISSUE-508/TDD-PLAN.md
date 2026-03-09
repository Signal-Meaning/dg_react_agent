# TDD Plan: Idle timeout must not fire between function result and next agent message when next message is a function call (Issue #508)

**Goal:** Fix the component so the idle timeout does **not** fire after the app sends a function result while the next agent message (which may be another function call) has not yet been received. Chained function calls (e.g. create_mandate → create_cart_mandate → execute_mandate) must complete without the connection closing on idle.

**Reference:** [README.md](./README.md) · **GitHub:** [#508](https://github.com/Signal-Meaning/dg_react_agent/issues/508)

**Status: Implemented.** IdleTimeoutService now clears `waitingForNextAgentMessageAfterFunctionResult` and stops the max-wait timer when handling `FUNCTION_CALL_STARTED`, so the next agent message (including chained function calls) is treated as "agent message received" and the idle timeout does not start from the max-wait firing before the chained call is processed.

---

## Required contract (state machine)

- After `FUNCTION_CALL_COMPLETED`, `waitingForNextAgentMessageAfterFunctionResult = true`.
- It must be cleared on `AGENT_MESSAGE_RECEIVED` **or** on the next `FUNCTION_CALL_STARTED` (chained call).
- `canStartTimeout` must be false while `waitingForNextAgentMessageAfterFunctionResult` or when `activeFunctionCalls.size > 0`.

**Root cause:** The component today clears `waitingForNextAgentMessageAfterFunctionResult` only when it receives an agent message that triggers `onAgentMessageReceived` (e.g. ConversationText, AgentAudioDone). When the **next** agent message is a **function call**, that message may not be delivered in a way that calls `onAgentMessageReceived` before the idle timeout runs—or the component does not treat FUNCTION_CALL_STARTED as “next agent message received.” So we must **also** clear the waiting flag when a new function call starts (FUNCTION_CALL_STARTED).

---

## TDD workflow (mandatory)

Follow **Red → Green → Refactor** for each change:

1. **Red:** Add or extend a failing test that encodes the desired behavior.
2. **Green:** Implement the minimal change so the test passes.
3. **Refactor:** Clean up without changing behavior; keep tests green.

---

## Phase 1: Unit tests — IdleTimeoutService contract (RED then GREEN)

### 1.1 Executable spec: FUNCTION_CALL_STARTED clears waitingForNextAgentMessageAfterFunctionResult

**Red:**

- Add a test (e.g. in `tests/agent-state-handling.test.ts` or a new `tests/idle-timeout-chained-function-calls-508.test.ts`) that encodes the partner’s state machine:
  1. Apply: `FUNCTION_CALL_STARTED('create_mandate')` → `FUNCTION_CALL_COMPLETED('create_mandate')`.
  2. Assert: `waitingForNextAgentMessageAfterFunctionResult === true` (or equivalent: `canStartTimeout()` is false when only this flag would block).
  3. Apply: `FUNCTION_CALL_STARTED('create_cart_mandate')` (chained call).
  4. Assert: `waitingForNextAgentMessageAfterFunctionResult === false` (cleared by the next function call).
  5. Assert: `canStartTimeout()` is still false because `activeFunctionCalls.size > 0`.
- If the service does not expose the flag directly, assert **behavior**: e.g. after step 2, advancing the idle timeout clock must **not** cause the timeout callback to fire before step 3; after step 3, timeout still must not fire while there is an active function call; after FUNCTION_CALL_COMPLETED for the last call and AGENT_MESSAGE_RECEIVED, timeout **can** start and fire.
- Run tests → **RED** (current implementation does not clear the waiting flag on FUNCTION_CALL_STARTED, so either the assertion fails or the “timeout must not fire” assertion fails).

**Green:**

- In `IdleTimeoutService.handleEvent`, in the `FUNCTION_CALL_STARTED` branch: set `waitingForNextAgentMessageAfterFunctionResult = false`. Rationale: the next agent message has been received (it was a function call); we are no longer “waiting for next agent message after function result.”
- Run tests → **GREEN**.

**Refactor:**

- Add a short comment in the service: e.g. “Issue #508: Clear waiting when next agent message is a function call (chained calls).”
- Optionally add the partner’s full mandate-flow test (create_mandate → create_cart_mandate → execute_mandate → AGENT_MESSAGE_RECEIVED → canStartTimeout true).

---

### 1.2 Optional: Full mandate-flow sequence test

**Red (optional):**

- Test that after each `FUNCTION_CALL_COMPLETED` in the sequence [create_mandate, create_cart_mandate, execute_mandate], `canStartTimeout()` is false until the next `FUNCTION_CALL_STARTED` or `AGENT_MESSAGE_RECEIVED`.
- After the final `AGENT_MESSAGE_RECEIVED`, `canStartTimeout()` is true (with other conditions idle).

**Green:** Same implementation as 1.1; this test locks in the full chained-flow contract.

### 1.3 Failing test for the gap (Issue #508 fix)

**Red:** A test that **fails when the fix is reverted** so the gap is covered by a failing test:

- **File:** `tests/integration/unified-timeout-coordination.test.js`
- **Test:** `Issue #508: FUNCTION_CALL_STARTED must cancel max-wait timer (chained call; would fail without fix)`
- **Behavior:** After `FUNCTION_CALL_COMPLETED`, the max-wait timer is running. When we dispatch `FUNCTION_CALL_STARTED` (chained call) before the max-wait fires, the service must call `clearTimeout` (cancel the max-wait timer). The test spies on `global.clearTimeout` and asserts it was called when we handle `FUNCTION_CALL_STARTED`.
- **Without the fix:** The service does not call `stopMaxWaitForAgentReplyTimer()` in the `FUNCTION_CALL_STARTED` branch, so `clearTimeout` is never invoked for that timer → **test fails**.
- **With the fix:** The service cancels the max-wait timer → **test passes**.

The "must eventually close when no agent message arrives" gap is covered by the existing unit test `should start and fire timeout after maxWaitForAgentReplyMs when no agent message arrives` in the same file.

---

## Phase 2: Integration / E2E (partner-reported defect coverage)

### 2.1 E2E: Chained function calls (added)

**File:** `test-app/tests/e2e/issue-508-idle-timeout-chained-function-calls.spec.js`

- Exercises the partner scenario: after the app sends the first function result, the next agent turn is another function call (`chained_step_one` → `chained_step_two`).
- Uses proxy mode + real API; `setupFunctionCallingTest` with two functions; user message "Run both steps: do step one then step two."
- **Assert:** `functionCallRequests` contains both calls in order; connection did not close with "Idle timeout reached" before the second call.
- Run from test-app: `npm run test:e2e -- issue-508-idle-timeout-chained-function-calls.spec.js` (with real API and backend).

### 2.2 Protocol-level repro (Option A from defect report) — **implemented**

- Connect with `idle_timeout` = 10000 ms and a function the model can call.
- User/test sends a message that causes the model to call that function.
- App sends the function result; **do not** send any further messages from the model (simulate “next message will be a function call but has not arrived yet”).
- Wait up to `idle_timeout` seconds.
- **Assert:** Connection is still open; component does **not** close with “Idle timeout reached - closing agent connection.”

**Implementation:** Component integration test in `tests/integration/issue-487-idle-timeout-after-function-result-component.test.tsx`: **`Issue #508 Option A: connection still open for up to idle_timeout after function result with no second message`**. Injects one FunctionCallRequest, app sends result, advances time by `idle_timeout` (10s) with no further messages, asserts `close()` not called.

### 2.3 Full mandate flow (voice-commerce)

- When voice-commerce runs the full mandate flow with real API, their E2E that asserts `create_mandate` → `create_cart_mandate` → `execute_mandate` in order should pass once the component fix is in place (connection stays open until the full chain completes or agent sends text).

---

## Phase 3: Summary of changes

| Step | Type | Action |
|------|------|--------|
| 1 | Unit test | Add test(s) that after FUNCTION_CALL_COMPLETED, waiting is true; after FUNCTION_CALL_STARTED (chained), waiting is false; timeout does not fire in the gap. |
| 2 | IdleTimeoutService | In FUNCTION_CALL_STARTED handler, set `waitingForNextAgentMessageAfterFunctionResult = false`. |
| 3 | Refactor | Comment in service; optional full mandate-flow unit test. |
| 4 | E2E | Added `issue-508-idle-timeout-chained-function-calls.spec.js`: chained function-call flow; assert both calls received in order and connection did not close on idle before second call. |
| 5 | Integration (Option A) | Added `Issue #508 Option A: connection still open for up to idle_timeout after function result with no second message` in `issue-487-idle-timeout-after-function-result-component.test.tsx`. |

---

## Copy-paste: Partner’s executable spec (for reference)

The partner provided a Jest-style state machine and two tests. These can be added to our suite as an executable specification of the contract (see GitHub issue #508 body). The component fix (clear waiting on FUNCTION_CALL_STARTED) satisfies this spec.

```javascript
// Events: MEANINGFUL_USER_ACTIVITY | FUNCTION_CALL_STARTED | FUNCTION_CALL_COMPLETED | AGENT_MESSAGE_RECEIVED
// Required: after FUNCTION_CALL_COMPLETED, waitingForNextAgentMessageAfterFunctionResult = true.
// Cleared on AGENT_MESSAGE_RECEIVED OR on next FUNCTION_CALL_STARTED (chained call).
// canStartTimeout must be false while waitingForNextAgentMessageAfterFunctionResult or activeFunctionCalls.size > 0.

function applyContract(event, state) {
  switch (event.type) {
    case 'FUNCTION_CALL_STARTED':
      state.activeFunctionCalls.add(event.functionCallId);
      state.waitingForNextAgentMessageAfterFunctionResult = false; // next agent message can be a function call
      break;
    case 'FUNCTION_CALL_COMPLETED':
      state.activeFunctionCalls.delete(event.functionCallId);
      if (state.activeFunctionCalls.size === 0) state.waitingForNextAgentMessageAfterFunctionResult = true;
      break;
    case 'AGENT_MESSAGE_RECEIVED':
      state.waitingForNextAgentMessageAfterFunctionResult = false;
      break;
    // ...
  }
}
```

---

## References

- [IdleTimeoutService](../../../src/utils/IdleTimeoutService.ts) — `FUNCTION_CALL_STARTED` / `FUNCTION_CALL_COMPLETED` / `AGENT_MESSAGE_RECEIVED` handling; `canStartTimeout`, `waitingForNextAgentMessageAfterFunctionResult`.
- [useIdleTimeoutManager](../../../src/hooks/useIdleTimeoutManager.ts) — `handleFunctionCallStarted`, `handleFunctionCallCompleted`, `notifyAgentMessageReceived`.
- [ISSUE-489 TDD-PLAN-IDLE-TIMEOUT-AFTER-FUNCTION-CALL.md](../ISSUE-489/TDD-PLAN-IDLE-TIMEOUT-AFTER-FUNCTION-CALL.md) — previous fix for “waiting for next message after function result” (single function + text).
- Partner defect report (voice-commerce #1058): summary, Option A repro, executable protocol spec, suggested component fix.
