# Issue #459: session.update race condition → conversation_already_has_active_response (OpenAI proxy)

**GitHub:** [#459 Bug: session.update race condition causes conversation_already_has_active_response (OpenAI proxy)](https://github.com/Signal-Meaning/dg_react_agent/issues/459)

**From:** voice-commerce (consumer of component and OpenAI proxy). Related: voice-commerce Issue #901.

---

## Summary

When using the **OpenAI proxy** path, the OpenAI Realtime API returns **`conversation_already_has_active_response`** during normal function-call flows (e.g. user message → function call → host sends result). The translation proxy (or component wiring) is believed to send **`session.update`** (or equivalent) while the API already has an active response in progress. The proxy must **not** send session/config updates while a response is active.

**Suggested fix:** Gate any `session.update` (or equivalent) on “no active response.” Send Settings / session config only on initial connection/session setup or after the current response/turn is finished (e.g. after `response.done` or equivalent).

---

## Acceptance Criteria

- [ ] **Root cause identified** – Code paths that send session/config updates (e.g. Settings → `session.update`) are located in component and/or voice-agent-backend (OpenAI proxy).
- [ ] **Gating implemented** – Session/config updates are not sent while the OpenAI Realtime API has an active response in progress.
- [x] **Tests added/updated** – Integration test added in `tests/integration/openai-proxy-integration.test.ts`; red confirmed (Phase 2). **TDD:** Phase 3 (implement gating) next; see [TRACKING.md](./TRACKING.md#tdd-workflow-mandatory-order).
- [ ] **No regression** – Existing tests (mock and, where applicable, real-API) still pass.
- [ ] **Docs updated** – This README and [TRACKING.md](./TRACKING.md) updated as work progresses; any new behavior or constraints documented where appropriate.
- [ ] **Issue closed** – #459 closed with resolution; closure comment links to this folder.

---

## Status

| Criterion              | Status   |
|------------------------|----------|
| Root cause identified  | ✅ Phase 1 complete; see [INVESTIGATION.md](./INVESTIGATION.md) |
| Gating implemented     | ✅ Phase 3 complete (proxy server.ts) |
| Tests added/updated     | ✅ Phase 2 complete; integration test added, red confirmed |
| No regression          | ✅ openai-proxy-integration suite passes |
| Docs updated           | ✅ README + TRACKING + INVESTIGATION |
| Issue closed           | ⬜ |

---

## Docs in this folder

- **[TRACKING.md](./TRACKING.md)** – Step-by-step tracking for resolving the issue (investigation, implementation, tests, closure).
- **[INVESTIGATION.md](./INVESTIGATION.md)** – Phase 1 findings: where session.update is sent, responseInProgress gap, suggested fix (gate session.update on no active response).
