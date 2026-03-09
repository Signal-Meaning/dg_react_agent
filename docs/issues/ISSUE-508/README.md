# Issue #508: Idle timeout fires before next agent turn when that turn is a function call (chained function calls)

**GitHub:** [#508](https://github.com/Signal-Meaning/dg_react_agent/issues/508)  
**Partner:** Voice-commerce ([#1058](https://github.com/Signal-Meaning/voice-commerce/issues/1058), AP2 mandate flow)  
**Package:** @signal-meaning/voice-agent-react@0.10.0 (OpenAI proxy)  
**Date reported:** 2026-03-08  
**Status:** Open

---

## Summary

When the app sends a function result, the next agent turn may be **another function call** (e.g. `create_cart_mandate` after `create_mandate`), not a text message. The component must **not** close the connection on idle while waiting for that next agent message. Currently, in a chained function-call flow, the idle timeout fires after the first function result and closes the connection before the model sends the next function call.

**Expected:** Idle timeout is deactivated while the agent is active. Agent activity includes: (1) the model has requested a function call and we have not yet sent the result, and (2) we have sent a function result and the next agent message (text or **function call**) has not yet been received.

**Actual:** After the first function result, "Idle timeout reached - closing agent connection" and WebSocket closes before the next function call in the chain (e.g. only `create_mandate` observed; `create_cart_mandate` and `execute_mandate` never received).

---

## Docs in this folder

| Document | Purpose |
|----------|---------|
| [TDD-PLAN.md](./TDD-PLAN.md) | Test-driven development plan: Red → Green → Refactor for the fix. |

## E2E coverage (partner scenario)

**File:** `test-app/tests/e2e/issue-508-idle-timeout-chained-function-calls.spec.js`

- Exercises the reported scenario: after first function result, next agent message is a (chained) function call; connection must stay open until that call is received.
- Run from test-app with real API: `npm run test:e2e -- issue-508-idle-timeout-chained-function-calls.spec.js`

---

## References

- Earlier idle-after–function-result behavior: fixed in v0.9.8 (Issue #487 / #373); this is the **reraise** for the **chained function call** case.
- [IdleTimeoutService](../../../src/utils/IdleTimeoutService.ts): `waitingForNextAgentMessageAfterFunctionResult`, `FUNCTION_CALL_STARTED` / `FUNCTION_CALL_COMPLETED` / `AGENT_MESSAGE_RECEIVED` handling.
- [ISSUE-489/IDLE-TIMEOUT-AFTER-FUNCTION-RESULT-DESIGN.md](../ISSUE-489/IDLE-TIMEOUT-AFTER-FUNCTION-RESULT-DESIGN.md) — design for clearing the waiting flag on agent message received.
