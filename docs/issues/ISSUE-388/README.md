# Issue #388: OpenAI upstream closes after first user message — no agent reply (follow-up to #380)

**Branch:** `davidrmcgee/issue388`  
**GitHub:** [Issue #388](https://github.com/Signal-Meaning/dg_react_agent/issues/388)  
**Related:** #380 (closed), customer refs #881, #894

---

## Summary

After upgrading to 0.7.11, the proxy/send/onUserMessage contract works. **What still fails:** after the first user message via `injectUserMessage`, no agent reply is received; the connection closes ~2.7–3 s later (upstream OpenAI closes with code 1000). The component correctly sends the message and reports `onConnectionStateChange('agent', 'closed')`; the issue is upstream closing before any response.

## What "resolved" means

**The defect is resolved when the E2E test with real API passes** — no mocks. That test: `test-app/tests/e2e/openai-inject-connection-stability.spec.js` — "should receive agent response after first text message (real OpenAI proxy)". It requires a real OpenAI proxy; when the bug is present (upstream closes before reply), this test fails (timeout). Resolution means proxy/upstream/config is fixed so the connection stays open and the test passes. Unit tests with mocks do **not** substitute; see [RESOLUTION-PLAN.md](./RESOLUTION-PLAN.md) for why unit tests passed without code change and the "manager level" mock explanation.

## Objectives for this issue

1. **Real API first:** Get the OpenAI proxy E2E test passing with a real proxy — that is the resolution criterion.
2. **Supporting unit tests:** Mock-based tests that document "closed" reported, no utterance when closed, utterance when connection stays open (see RESOLUTION-PLAN).
3. **Optional (product):** Document or investigate OpenAI Realtime API close code 1000; consider keep-alive/reconnection/session-extend for multi-turn.

## Documents in this folder

| Document | Purpose |
|----------|--------|
| [README.md](./README.md) | This file — summary, what \"resolved\" means, objectives |
| [RESOLUTION-PLAN.md](./RESOLUTION-PLAN.md) | Real-API-first, why unit tests passed without change, mock explanation, test list |
| [OPENAI-REALTIME-API-REVIEW.md](./OPENAI-REALTIME-API-REVIEW.md) | OpenAI Realtime API review: event order, session lifecycle, keep-alive; proxy gap (wait for conversation.item.added before response.create) |

## Acceptance criteria (resolution)

- [x] **E2E with real proxy passes:** `openai-inject-connection-stability.spec.js` — “should receive agent response after first text message” — passes when run with real OpenAI proxy. **This is the resolution criterion.**
- [x] **Supporting unit tests:** Closing mock and #388 tests in `tests/issue-380-inject-upstream-close.test.tsx` (closed reported, no utterance when closed, utterance when we simulate reply; one skipped test for “reply within 10s with closing mock”).
- [x] **Docs:** RESOLUTION-PLAN explains real-API-first, why unit tests passed without code change, and “manager level” mock; draft issue/body files removed.

## References

- #380 — OpenAI injectUserMessage / connection closes (closed; root cause: upstream close).
- Voice-commerce bug report 2026-02-02 (customer provided closing mock + failing test).
- E2E: `test-app/tests/e2e/openai-inject-connection-stability.spec.js` (agent response after first text message with real proxy).
