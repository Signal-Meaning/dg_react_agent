# TDD Plan: 3 Remaining OpenAI Proxy E2E Failures

**Scope:** Resolve the 3 failing tests when running `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js` from test-app (13 passed, 3 failed, 2 skipped).

**Reference:** [E2E-FAILURES-RESOLUTION.md](./E2E-FAILURES-RESOLUTION.md) — "OpenAI proxy E2E only (reduced to 3 failures)."

---

## The 3 failures

| # | Test | Error | Phase |
|---|------|------|-------|
| 1 | **3b.** Multi-turn after disconnect – session history preserved | Expected 3 assistant messages, received **5** | Multi-turn / history |
| 2 | **6.** Simple function calling – assert response in agent-response | Expected time/UTC pattern; received greeting | Function-call reply |
| 3 | **6b.** Issue #462 / #470 – function-call flow (partner scenario) | Same as 6; sometimes "I'm having some trouble getting the exact time..." | Function-call reply |

---

## Failure 1: 3b – assistant count 5 vs 3

**RED:** Test expects `[data-role="assistant"]` count === 3 (greeting + r1 + r2). With transcript mapping we now get 5. Likely causes: (a) same logical message sent multiple times (e.g. conversation.item.created + .added + .done with different item ids), (b) session history on reconnect adds duplicate items, (c) test expectation too strict.

**GREEN (candidates):** (1) Relax test to assert ≥3 assistant and that r1 (Paris) is in history. (2) Or deduplicate in proxy/app by content or sequence so we only show 3. (3) Or document real API sends 5 and update test expected count.

**Refactor:** Align test with chosen behavior; update E2E-FAILURES-RESOLUTION.

---

## Failure 2 & 3: 6 and 6b – function-call reply (time/UTC)

**RED:** After "What time is it?" and function call, agent-response stays greeting (or "I'm having some trouble..."). Test expects `/\d{1,2}:\d{2}|UTC/`. Model reply with time never reaches UI.

**GREEN (candidates):** (1) Ensure proxy sends ConversationText (assistant) for the post–function-call model reply from conversation.item.done (output_audio.transcript) or equivalent. (2) Backend /function-call must return time; API must send model reply; proxy must map it. (3) Add integration test: after FunctionCallResponse, client receives ConversationText with time-like content when API provides it.

**Refactor:** See [TDD-PLAN-REAL-API-E2E-FAILURES.md](./TDD-PLAN-REAL-API-E2E-FAILURES.md) Phase 5.

---

## TDD workflow

1. **RED:** Reproduce (or add failing unit/integration test).
2. **GREEN:** Minimal change to pass.
3. **REFACTOR:** Clean up; keep tests green.

---

## Success criteria

- [ ] 3b passes (assistant count and r1-in-history).
- [ ] 6 and 6b pass (agent-response shows time/UTC after function call).
- [ ] `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js` → 0 failures (excluding existing skips).

---

## How to run

From test-app:

```bash
USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js
```

Single test:

```bash
USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "3b"
```
