# Issue #462: conversation_already_has_active_response still occurs on 0.9.1/0.2.1 (follow-up to #459)

**GitHub:** [#462 Fix: conversation_already_has_active_response still occurs on 0.9.1/0.2.1 (follow-up to #459)](https://github.com/Signal-Meaning/dg_react_agent/issues/462)

**Parent:** [#459](https://github.com/Signal-Meaning/dg_react_agent/issues/459) — session.update race → conversation_already_has_active_response (OpenAI proxy). We implemented gating in 0.9.1/0.2.1; error still occurs in voice-commerce’s function-call flow.

---

## Summary

voice-commerce upgraded to `@signal-meaning/voice-agent-react@0.9.1` and `@signal-meaning/voice-agent-backend@0.2.1` (released to address #459). The error **conversation_already_has_active_response** still occurs in their OpenAI function-call flow (user message → function call → host sends result → `sendFunctionCallResponse`).

We need to investigate, fix, release, then follow up with voice-commerce. **No follow-up to them until we have a release.**

---

## Context

- **#459:** We implemented gating (`responseInProgress`, no `session.update` while response active) and shipped in 0.9.1/0.2.1; error still occurs in their scenario.
- **Docs (this repo):**
  - [docs/issues/ISSUE-459/README.md](../ISSUE-459/README.md), [INVESTIGATION.md](../ISSUE-459/INVESTIGATION.md), [TRACKING.md](../ISSUE-459/TRACKING.md)
  - [RESPONSE-TO-VOICE-COMMERCE-FOLLOW-UP.md](../ISSUE-459/RESPONSE-TO-VOICE-COMMERCE-FOLLOW-UP.md) — our response to their bug report
  - [VOICE-COMMERCE-RESPONSE-2026-02-16.md](../ISSUE-459/VOICE-COMMERCE-RESPONSE-2026-02-16.md) — their response (proxy log capture steps, no double `sendFunctionCallResponse`, optional minimal repro)

---

## Acceptance criteria

- [x] Get proxy log excerpt for one failing run (from voice-commerce follow-up or our own capture with `LOG_LEVEL=debug`). See [VOICE-COMMERCE-RESPONSE-2026-02-16.md](../ISSUE-459/VOICE-COMMERCE-RESPONSE-2026-02-16.md) for their capture steps.
- [x] Analyse: session.update count (expect 1 per connection), response.create count for the turn (expect 1 for function-call result), message order. Look for second session.update, second response.create, or responseInProgress cleared too early.
- [ ] Fix the root cause (proxy or component as needed).
- [ ] Tests: Add/update tests; lint and test:mock and openai-proxy-integration pass; E2E as per release checklist.
- [ ] Release: Patch release (e.g. 0.9.2 / 0.2.2) and publish.
- [ ] Follow up with voice-commerce with release and resolution (they are not to be contacted until we have a release).
- [ ] Close this issue and update #459 with resolution pointer.

---

## Status

| Criterion              | Status   |
|------------------------|----------|
| Proxy log excerpt      | ✅ Local capture (mock); see [ANALYSIS.md](./ANALYSIS.md) and capture-*.log |
| Analysis               | ✅ [ANALYSIS.md](./ANALYSIS.md) – hypothesis: responseInProgress cleared too early (on output_audio.done before output_text.done) |
| Root cause fix         | ⬜       |
| Tests / no regression  | ⬜       |
| Patch release          | ⬜       |
| Follow up voice-commerce | ⬜    |
| Close #462, update #459 | ⬜     |

---

## Docs in this folder

- **[TRACKING.md](./TRACKING.md)** – Step-by-step tracking for investigation, fix, tests, release, and closure.
- **[ANALYSIS.md](./ANALYSIS.md)** – Log capture method, message-order excerpt, and root-cause hypothesis (responseInProgress cleared on first of output_audio.done / output_text.done).
- **capture-issue459-test.log** – Proxy log (LOG_LEVEL=debug) from Issue #459 integration test.
- **capture-function-call-test.log** – Proxy log (LOG_LEVEL=debug) from function-call integration test.
