# Issue #470 / Release v0.9.4 — Scope: Correct the Defect

## The scenario

The #462 partner (voice-commerce) scenario that must be covered is:

1. **Connect** to the proxy (real OpenAI Realtime API upstream).
2. **Settings** → session.update → session.updated.
3. **One user message** (text or voice) that triggers the model to request a function call.
4. **API returns** `response.function_call_arguments.done` (or equivalent); client receives FunctionCallRequest.
5. **Backend HTTP** — host handles the call (e.g. `POST /api/function-call` or equivalent) and produces a result.
6. **Component sends** `FunctionCallResponse`; proxy sends `conversation.item.create` + `response.create` to upstream.
7. **API responds** (audio, text, etc.). No **conversation_already_has_active_response** error at any point in this flow.

So: **connect → Settings → one user message → one function call → one backend HTTP → one FunctionCallResponse → API response**, against the **real** API (or E2E with real backend). Coverage must assert the error does not occur in this flow. Our current real-API test (Settings → InjectUserMessage → second Settings) does **not** exercise this path; it has no function call and no backend HTTP.

## Definition of done

This release **corrects the found defect**, not just the test/docs. The defect was: we did not have comprehensive testing around the #462 partner-reported issue (voice-commerce); we added policy docs but the **testing gap** remains.

Therefore this branch/release **must** include **both**:

1. **Policy and docs (done)**  
   - .cursorrules, tests/docs, and docs/development/TEST-STRATEGY.md updated so backend/proxy defects must use real APIs and partner-reported defects require E2E (or equivalent) for the reported scenario.

2. **Correct the testing gap (required before release)**  
   - **Add coverage that exercises the #462 partner’s scenario** (function-call flow, real API). Options:
     - **E2E:** Add or extend an E2E test in `test-app/tests/e2e/` that runs the partner’s flow (connect → Settings → user message → function call → backend HTTP → response) in proxy mode with real backend/API, and asserts no `conversation_already_has_active_response`.
     - **Or** an integration test that reproduces the same message/timing path (function-call path) against the real API.
   - Document how the new test covers the partner’s scenario (e.g. in `docs/issues/ISSUE-462/` or TRACKING).

**The release is not complete until (2) is done.** Do not ship v0.9.4 with only the docs change.

## Reference

- Partner scenario: voice-commerce E2E — function-call flow, real OpenAI via proxy (`conversation_already_has_active_response`).
- `tests/docs/BACKEND-PROXY-DEFECTS-REAL-API.md`, `.cursorrules` (Backend / Proxy Defects).
- **TDD plan:** [TDD-PLAN.md](./TDD-PLAN.md) — Red/Green/Refactor steps to add the partner-scenario coverage (E2E first, optional integration, then docs).
