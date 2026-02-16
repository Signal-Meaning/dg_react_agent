# Issue #459: session.update race condition → conversation_already_has_active_response (OpenAI proxy)

**GitHub:** [#459 Bug: session.update race condition causes conversation_already_has_active_response (OpenAI proxy)](https://github.com/Signal-Meaning/dg_react_agent/issues/459)

**From:** voice-commerce (consumer of component and OpenAI proxy). Related: voice-commerce Issue #901.

---

## Summary

When using the **OpenAI proxy** path, the OpenAI Realtime API returns **`conversation_already_has_active_response`** during normal function-call flows (e.g. user message → function call → host sends result). The translation proxy (or component wiring) is believed to send **`session.update`** (or equivalent) while the API already has an active response in progress. The proxy must **not** send session/config updates while a response is active.

**Suggested fix:** Gate any `session.update` (or equivalent) on “no active response.” Send Settings / session config only on initial connection/session setup or after the current response/turn is finished (e.g. after `response.done` or equivalent).

---

## Acceptance Criteria

- [x] **Root cause identified** – Code paths located in voice-agent-backend (OpenAI proxy); see [INVESTIGATION.md](./INVESTIGATION.md).
- [x] **Gating implemented** – Session/config updates not sent while API has active response (proxy server.ts).
- [x] **Tests added/updated** – Integration test; TDD red then green; see [TRACKING.md](./TRACKING.md#tdd-workflow-mandatory-order).
- [x] **No regression** – Lint, test:mock, openai-proxy-integration pass. E2E: OpenAI proxy subset (`openai-proxy-e2e`, `openai-inject-connection-stability`) or `test-app`: `npm run test:e2e:openai`; full E2E only per release checklist.
- [x] **Docs updated** – README, TRACKING, INVESTIGATION, [PROTOCOL-AND-MESSAGE-ORDERING.md](../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md).
- [ ] **Issue closed** – #459 closed with resolution; closure comment links to this folder.

---

## Status

| Criterion              | Status   |
|------------------------|----------|
| Root cause identified  | ✅ Phase 1 complete; see [INVESTIGATION.md](./INVESTIGATION.md) |
| Gating implemented     | ✅ Phase 3 complete (proxy server.ts) |
| Tests added/updated     | ✅ Phase 2 complete; integration test added, red confirmed |
| No regression          | ✅ Lint, test:mock, openai-proxy-integration; E2E: OpenAI proxy subset (see TRACKING) |
| Docs updated           | ✅ README, TRACKING, INVESTIGATION, PROTOCOL-AND-MESSAGE-ORDERING |
| Issue closed           | ⬜ Phase 5 |

---

## Docs in this folder

- **[TRACKING.md](./TRACKING.md)** – Step-by-step tracking for resolving the issue (investigation, implementation, tests, closure).
- **[INVESTIGATION.md](./INVESTIGATION.md)** – Phase 1 findings: where session.update is sent, responseInProgress gap, suggested fix (gate session.update on no active response).
