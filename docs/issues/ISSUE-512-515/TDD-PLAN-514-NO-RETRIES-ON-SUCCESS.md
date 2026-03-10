# TDD Plan: No retries when function call succeeds (Issue #514)

**Goal:** Ensure that when a function call completes successfully (host sends result, agent receives it), the component does **not** retry the same call or re-send Settings in a way that causes the model to issue the same function call again. Retries/re-Settings should be reserved for actual failures (network error, timeout, explicit error from host).

**Reference:** [README.md](./README.md) · **GitHub:** [#514](https://github.com/Signal-Meaning/dg_react_agent/issues/514) · voice-commerce #908

---

## Root cause (from voice-commerce)

- **Bug #512** is the driver: unmapped upstream events were treated as fatal → proxy sent Error → component/test-app treated it as “Error after Settings with functions” → retry/re-Settings → model issued same function call again.
- Fixing **#512** (unmapped → warning only) should remove the main trigger for these retries.
- This issue (#514) tracks: (1) **verifying** that after #512, retries no longer occur on successful function calls, and (2) **if needed**, tightening retry logic so it does not fire on success.

---

## Current behavior (suspected)

- Component or test-app receives Error (e.g. `unmapped_upstream_event`) after sending Settings with functions → triggers “Error received after sending Settings with functions” and may reconnect, re-Send Settings, or otherwise cause the model to issue the same function call again.
- Success path: host sends `FunctionCallResponse` → proxy sends `function_call_output` to API → model may reply with text/audio; no Error. So in theory, no Error ⇒ no retry. The problem is unmapped events were emitting Error.

## Target behavior

- After successful function call (host sent result, no fatal error): **no** retry, **no** duplicate function call for the same user message.
- Retry/re-Settings only on actual failures (e.g. connection closed, auth failure, timeout, host returned error).

---

## TDD workflow (Red → Green → Refactor)

### Phase 1: RED — Tests that would fail if retries occur on success

- [ ] **1.1** E2E or integration test: single user message that triggers **one** function call (e.g. “roses” → `search_products`) → host executes and sends **one** successful `FunctionCallResponse` → assert **exactly one** function call request received (or at most one per user message), and assert no reconnection/re-Settings triggered by an error after the function result.
  - **File:** e.g. `test-app/tests/e2e/openai-proxy-e2e.spec.js` or a dedicated spec; or `tests/integration/openai-proxy-integration.test.ts` with real API or fixture.
  - **Assertions:** function call count for that turn === 1; no “Error received after sending Settings with functions” due to unmapped event; optional: assert assistant message count or response content consistent with single execution.
- [ ] **1.2** Optional: Integration test with **mock** that sends an unmapped event **after** function result; assert client does **not** retry (no second function call request). Depends on #512 (no Error sent for unmapped).
- [ ] Run tests: with **current** behavior (unmapped → Error), test may **fail** (multiple function calls or retry observed). After #512, test should **pass** (no Error ⇒ no retry). If test passes only after #512, that confirms #512 fixes the driver; #514 is “verify and lock in.”

### Phase 2: GREEN — Implementation

- [ ] **2.1** **Primary:** Land #512 (unmapped → warning only) so that unmapped events no longer send Error and no longer trigger retry/re-Settings.
- [ ] **2.2** **If needed:** In component or test-app, ensure retry/re-Settings logic does **not** run when the only “error” was a successful function call (e.g. do not treat successful `FunctionCallResponse` as failure). Current code may already be correct once no Error is sent for unmapped events.
- [ ] **2.3** Add or adjust test so it passes: single user message → single function call → single result → no duplicate calls.

### Phase 3: REFACTOR

- [ ] **3.1** Document retry conditions in code or docs: retry only on real failures; success path does not trigger retry.
- [ ] **3.2** Update [README.md](./README.md) master progress: check off #514.

### Phase 4: Verification

- [ ] **4.1** E2E: flow that triggers one function call (e.g. “roses” or “What time is it?”) runs without duplicate function calls when backend and proxy behave correctly.
- [ ] **4.2** Real-API run (if available): same flow; no duplicate calls.
- [ ] **4.3** Update README and close #514 when acceptance criteria met.

---

## Files to touch

| File | Change |
|------|--------|
| `test-app/tests/e2e/*.spec.js` or `tests/integration/openai-proxy-integration.test.ts` | Add or extend test: single function call per user message; no duplicate after success. |
| Component or test-app error/retry logic | Only if needed: ensure success path does not trigger retry. |
| `docs/issues/ISSUE-512-515/README.md` | Check off #514 progress. |

---

## Completion criteria (from issue #514)

- [ ] After #512 (and any component/proxy changes), a single successful function call does not trigger retries or duplicate function calls for the same user message.
- [ ] Retry/re-Settings logic is reserved for actual failures; success path does not trigger it.

---

## Dependency

- **#512** should be merged first (unmapped events → warnings). Then run #514 tests to verify no retries on success; add explicit test(s) to lock in behavior.
