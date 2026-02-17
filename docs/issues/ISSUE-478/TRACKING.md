# Issue #478 – Tracking: Assert presentation of agent response (function result content)

Use this checklist to drive the fix to completion. **Update this file and [README.md](./README.md)** as each step is completed.

**GitHub:** [#478](https://github.com/Signal-Meaning/dg_react_agent/issues/478)

---

## Goal

Function-call tests already exercise the real API path (real OpenAI, proxy, backend HTTP). They do **not** yet assert that the agent's reply **presents the function result** to the user. Add assertions so we verify:

1. **Integration:** The assistant `ConversationText` content includes the function result (e.g. `12:00` or `UTC`).
2. **E2E:** The `agent-response` element text includes the function result (e.g. `12:00`).

---

## TDD workflow

1. **RED** – Add or adjust assertions that require the function result in the response content; run tests and confirm they **fail** (or fail in the right way) if the content is missing.
2. **GREEN** – Ensure the flow produces that content (or relax assertion if needed); tests **pass**.
3. **REFACTOR** – Tidy test code while keeping tests green.

---

## Phase 1 – Integration test: assert ConversationText includes function result

| Step | Status |
|------|--------|
| Identify the integration test: *"Issue #470 real-API: function-call flow completes without conversation_already_has_active_response"* in `tests/integration/openai-proxy-integration.test.ts` | ⬜ |
| Determine the function result shape (e.g. time like `12:00` or timezone like `UTC`) returned by the test backend / proxy flow | ⬜ |
| Add assertion: at least one assistant `ConversationText` has `content` that includes the function result (e.g. `12:00` or `UTC`) | ⬜ |
| Run integration test (mock and, when available, real API); confirm RED then GREEN | ⬜ |
| **Update README:** Mark Phase 1 complete | ⬜ |

---

## Phase 2 – E2E: assert agent-response text includes function result

| Step | Status |
|------|--------|
| Identify E2E tests 6 and 6b in `test-app/tests/e2e/openai-proxy-e2e.spec.js` | ⬜ |
| Determine the function result text the user should see (e.g. `12:00`) in the test scenario | ⬜ |
| Add assertion: `[data-testid="agent-response"]` text includes the function result (e.g. `12:00`) | ⬜ |
| Run E2E (proxy mode; real API when available); confirm RED then GREEN | ⬜ |
| **Update README:** Mark Phase 2 complete | ⬜ |

---

## Phase 3 – Document and close

| Step | Status |
|------|--------|
| Document any constraints (e.g. assertion is flexible if backend response shape varies) in this folder or test file comments | ⬜ |
| Full test run: lint, integration, E2E — no regressions | ⬜ |
| Close #478 on GitHub with comment linking to `docs/issues/ISSUE-478/` | ⬜ |
