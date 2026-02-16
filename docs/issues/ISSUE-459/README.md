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
- [ ] **Tests added/updated** – Tests (unit and/or integration/E2E) cover the “no session update during active response” behavior; TDD: tests first, then implementation.
- [ ] **No regression** – Existing tests (mock and, where applicable, real-API) still pass.
- [ ] **Docs updated** – This README and [TRACKING.md](./TRACKING.md) updated as work progresses; any new behavior or constraints documented where appropriate.
- [ ] **Issue closed** – #459 closed with resolution; closure comment links to this folder.

---

## Status

| Criterion              | Status   |
|------------------------|----------|
| Root cause identified  | ⬜ Not started |
| Gating implemented     | ⬜ Not started |
| Tests added/updated     | ⬜ Not started |
| No regression          | ⬜ Not started |
| Docs updated           | ⬜ In progress (this README + TRACKING) |
| Issue closed           | ⬜ |

---

## Docs in this folder

- **[TRACKING.md](./TRACKING.md)** – Step-by-step tracking for resolving the issue (investigation, implementation, tests, closure).
