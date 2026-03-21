# Issue #532: Protocol Error after Settings with functions (tools path, close frames)

**GitHub:** [#532](https://github.com/Signal-Meaning/dg_react_agent/issues/532)

**Epic:** [#542](./README.md) · **TDD bundle:** B (ordering / protocol) with [#534](./ISSUE-534.md)

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

**Phases:** - [ ] RED · - [ ] GREEN · - [ ] REFACTOR · - [ ] Verified (all items below)

### RED

- [ ] Integration (mock upstream): Section 2b flow in `tests/integration/openai-proxy-integration.test.ts` (or sibling) — `Settings` with tools → `session.updated` / `SettingsApplied` → `InjectUserMessage` → item acks → `response.function_call_arguments.done` → `FunctionCallResponse` → deferred `response.create`; assert no premature component `Error` (or assert golden message order).
- [ ] Close-frame: test or log assertion that when upstream closes 1000, **client** leg close code/reason is logged (`server.ts` `clientWs` close handler if extended).

### GREEN

- [ ] Fix root cause in `server.ts` / `translator.ts` (ordering, `session.update`, `response.create`, tools schema, etc.) driven by failing tests — no fake success.
- [ ] Behavior matches [PROTOCOL-AND-MESSAGE-ORDERING.md](../../../packages/voice-agent-backend/scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md) and Issues #462 / #522 deferred `response.create` rules.

### REFACTOR

- [ ] Extract long mock upstream scripts into fixtures/helpers if tests exceed ~80 lines.

### Verified

- [ ] Mock integration test green.
- [ ] **Real API:** `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` (or targeted describe) with `OPENAI_API_KEY` for Settings+tools+inject — required per `.cursorrules` when root cause is ordering/timing.
- [ ] If partner scenario matches, E2E with **real** backend HTTP before `FunctionCallResponse` (ISSUE-462).

---

## Files

- `packages/voice-agent-backend/scripts/openai-proxy/server.ts` — Settings, inject, function call, upstream error, close handlers
- `packages/voice-agent-backend/scripts/openai-proxy/translator.ts` — `mapSettingsToSessionUpdate`, `mapErrorToComponentError`
- `tests/integration/openai-proxy-integration.test.ts`
- Optional E2E under `test-app/tests/e2e/` if full-stack qualification is needed
