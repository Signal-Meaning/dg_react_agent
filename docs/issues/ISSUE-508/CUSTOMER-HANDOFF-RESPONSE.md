# Response to customer handoff: Idle timeout chained function calls — test coverage

**Customer issue:** [#1058](https://github.com/Signal-Meaning/voice-commerce/issues/1058)  
**Component issue:** [#508](https://github.com/Signal-Meaning/dg_react_agent/issues/508)  
**Date:** 2026-03-09

---

## 1. We agree

The customer correctly identified a gap in our test coverage:

- **Issue #487** component test injects a **single** FunctionCallRequest, the app sends the result, we wait just under `idle_timeout` with **no further messages**, and assert `close()` is not called.
- We did **not** have a test that delivers a **second** FunctionCallRequest (in a separate message) **after** the app has sent the result for the first — i.e. the **chained** case where the next agent turn is another function call.

The fix for #508 (IdleTimeoutService: clear `waitingForNextAgentMessageAfterFunctionResult` and stop max-wait on `FUNCTION_CALL_STARTED`) was correct and is necessary. The missing piece was a **component-level** test that drives the chained sequence so the requirement is fully tested.

---

## 2. What we added

**Component integration test (chained case):**

- **File:** `tests/integration/issue-487-idle-timeout-after-function-result-component.test.tsx`
- **Test:** `should NOT close when next agent message is a second FunctionCallRequest (chained)`
- **Sequence:**
  1. Inject first FunctionCallRequest (`create_mandate`).
  2. App sends FunctionCallResponse (handler runs).
  3. Advance time 2s (simulate delay before model sends next call).
  4. Inject **second** FunctionCallRequest (`create_cart_mandate`) — next agent message is a function call.
  5. Assert `close()` was not called and both calls were received (`receivedCalls` = `['create_mandate', 'create_cart_mandate']`).

This test drives the **component** with the exact chained sequence the customer described. It passes with the #508 fix in place.

---

## 3. Coverage summary

| Test | Level | What it covers |
|------|--------|----------------|
| `unified-timeout-coordination.test.js` (Issue #508) | IdleTimeoutService only | Event sequence: COMPLETED → STARTED (chained) clears waiting; mandate flow. |
| **`unified-timeout-coordination.test.js` (failing test for gap)** | **IdleTimeoutService** | **Asserts that when FUNCTION_CALL_STARTED is received (chained), the service cancels the max-wait timer (clearTimeout). Fails when the #508 fix is reverted.** |
| `issue-487-idle-timeout-after-function-result-component.test.tsx` (single) | Component | One FunctionCallRequest → result → wait; connection must stay open. |
| **`issue-487-idle-timeout-after-function-result-component.test.tsx` (chained)** | **Component** | **First FunctionCallRequest → result → delay → second FunctionCallRequest; connection must stay open; both calls received.** |
| `issue-508-idle-timeout-chained-function-calls.spec.js` | E2E | Real API; two tools; user prompt; assert both function calls received in order. |

The "must eventually close when no agent message arrives" behavior is covered by the unit test `should start and fire timeout after maxWaitForAgentReplyMs when no agent message arrives` in `unified-timeout-coordination.test.js`.

---

## 4. References

- Customer handoff: defect in one sentence, observed behavior, why our E2E differs, requested fix, repro/spec (Option A + executable spec).
- Companion: COMPONENT-DEFECT-IDLE-TIMEOUT-CHAINED-FUNCTION-CALLS.md (full repro, spec, references).
- Component fix: `src/utils/IdleTimeoutService.ts` — FUNCTION_CALL_STARTED clears waiting and stops max-wait timer.
