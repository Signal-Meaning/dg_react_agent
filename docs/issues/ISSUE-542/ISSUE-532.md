# Issue #532: Protocol Error after Settings with functions (tools path, close frames)

**GitHub:** [#532](https://github.com/Signal-Meaning/dg_react_agent/issues/532)

**Epic:** [#542](./README.md) · **TDD bundle:** B (ordering / protocol) with [#534](./ISSUE-534.md)

**Status (mock):** Section **2b** regression test and mock mode `mockIssue532Section2bToolsThenInject` added; client WebSocket **close** code/reason logged at INFO (`ATTR_CLIENT_CLOSE_CODE` / `ATTR_CLIENT_CLOSE_REASON`). **Real-API:** full `openai-proxy-integration` suite with `USE_REAL_APIS=1` qualified (including partner-grade `Issue #470 real-API: function-call flow completes` with `outputModalities: ['text']` and early test order to avoid cross-test upstream pressure).

---

## Problem (Section 2)

After `Settings` **with** `agent.think.functions`, integrators see component `Error` and/or WebSocket teardown (browser **1005** vs upstream **1000**). Control run: Settings **without** functions succeeds. Defect localizes to tools / `session.update` path or timing with `InjectUserMessage` / function round-trip.

**Additional ask:** When upstream closes with 1000, log **client** close code/reason actually sent (Section 2a follow-up in report).

**Note:** Error text may **not** be `conversation_already_has_active_response` (different class from voice-commerce #1066); long HTTP tool execution concurrency is a separate hypothesis if repro confirms.

---

## Repro (Section 2b — component protocol)

GitHub issue lists exact steps: WS to proxy; UTF-8 JSON only; Settings without functions (pass); Settings with synthetic `example_echo` tool; wait for `SettingsApplied` or ~800ms; `InjectUserMessage` to invoke tool; on `FunctionCallResponse` reply on same socket without HTTP executor. **Fail** if any inbound `{"type":"Error"}` before success.

---

## TDD plan

**Phases:** - [x] RED · - [x] GREEN · - [x] REFACTOR · - [x] Verified (real API) · - [ ] Verified (optional E2E)

### RED

- [x] Integration (mock): `Issue #532 Section 2b: Settings with example_echo…` — Settings with `example_echo` tool → `SettingsApplied` → `InjectUserMessage` → FCR → in-socket `FunctionCallResponse` → assistant `Hello from mock`; fail on any component `Error`.
- [x] Close observability: `clientWs` `close` handler emits INFO log with `client.close_code` / `client.close_reason` (Issue #532 triage vs upstream 1000 vs browser 1005).

### GREEN

- [x] Mock path passes with existing proxy (ordering improved by [#534](./ISSUE-534.md) inject queue + deferred `response.create` rules). No protocol-fake success.
- [x] Behavior matches [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) and Issues #462 / #522.

### REFACTOR

- [x] Mock logic scoped to flags `mockIssue532Section2bToolsThenInject` + per-connection counters (no new helper file yet).

### Verified

- [x] Full mock `openai-proxy-integration` suite (65+ tests) green.
- [x] **Real API:** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` with `OPENAI_API_KEY` — all real-API cases in that file, including Settings+tools+inject and **partner-grade** `Issue #470 real-API: function-call flow completes` (backend HTTP before `FunctionCallResponse`; `outputModalities: ['text']` only — Realtime rejects `['text','audio']` together). The #470 test is ordered **early** in the suite (after SettingsApplied) to limit cross-test upstream load.
- [ ] If partner scenario matches, E2E with **real** backend HTTP before `FunctionCallResponse` (ISSUE-462).

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — Settings, inject, function call, upstream error, close handlers
- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `mapSettingsToSessionUpdate`, `mapErrorToComponentError`
- `tests/integration/openai-proxy-integration.test.ts`
- Optional E2E under `test-app/tests/e2e/` if full-stack qualification is needed
