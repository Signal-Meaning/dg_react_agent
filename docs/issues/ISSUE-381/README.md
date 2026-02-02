# Issue #381: OpenAI Realtime Proxy – TDD Implementation

**GitHub Issue**: [#381](https://github.com/Signal-Meaning/dg_react_agent/issues/381)  
**Objective**: Add the missing OpenAI Realtime proxy to the backend and validate unit, integration, and E2E tests. Existing component tests must pass with the OpenAI backend.

**OpenAI Realtime API**: https://platform.openai.com/docs/guides/realtime

---

## Progress overview

**[→ PROGRESS.md](./PROGRESS.md)** — Single overview of progress against Issue #381: phase status, test counts (unit 28, integration 12, E2E), what’s done vs remaining, and links to all other docs.

**[→ RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md)** — Phase 5: environment variables, how to run the proxy, and how to run unit, integration, and E2E tests.

---

## Progress (2026-02-02) — detail

- **Proxy unit tests** (`tests/openai-proxy.test.ts`): 28 tests. All translator mappings covered (incl. greeting). Run: `npm run test -- tests/openai-proxy.test.ts`.
- **Proxy integration tests** (`tests/integration/openai-proxy-integration.test.ts`): 12 tests. Function-call round-trip, FCR then CT order, transcript-only path (no FCR), transcript then .done order, user echo, context in Settings, **greeting** (agent.greeting → ConversationText + conversation.item.create after session.updated). Run: `npm run test -- tests/integration/openai-proxy-integration.test.ts`. See [INTEGRATION-TEST-PLAN.md](./INTEGRATION-TEST-PLAN.md).
- **E2E – context retention**: context-retention-agent-usage and context-retention-with-function-calling **pass** when running against OpenAI proxy (proxy running; real API sends `response.function_call_arguments.done` for the function-calling spec). Test app adds user message optimistically in `handleTextSubmit`; context retained after reconnect.
- **E2E – declarative-props (Deepgram function-call)**: Tests **skip** when OpenAI proxy; when run (e.g. Deepgram), they require a real function call. OpenAI flow covered by openai-proxy-e2e “Simple function calling” and integration tests.
- **E2E – Deepgram-only specs**: backend-proxy-mode (Deepgram), callback-test (Deepgram transcript/VAD) skip when OpenAI proxy. See [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md).
- **Phase 5 – Run and env**: [RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md) documents env vars, how to run the proxy, and how to run unit, integration, and E2E tests.

---

## Documents

| Document | Purpose |
|----------|---------|
| **[PROGRESS.md](./PROGRESS.md)** | **Progress overview** — phase status, test counts, done vs remaining, links to all below |
| **[RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md)** | **Phase 5** — env vars, run proxy, run unit/integration/E2E tests, CI notes |
| [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md) | E2E run order, commands, remaining specs when running with OpenAI proxy |
| [API-DISCONTINUITIES.md](./API-DISCONTINUITIES.md) | Component vs OpenAI Realtime protocol; discontinuities and proxy mapping |
| [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md) | Phased implementation: tests first (RED), then implementation (GREEN), then refactor |
| [TDD-OVERVIEW.md](./TDD-OVERVIEW.md) | TDD workflow (Red–Green–Refactor), test-first rules, and order of work |
| [UNIT-TEST-PLAN.md](./UNIT-TEST-PLAN.md) | Unit tests for the OpenAI proxy: write failing tests first, then implement |
| [INTEGRATION-TEST-PLAN.md](./INTEGRATION-TEST-PLAN.md) | Integration tests: proxy WebSocket behavior and component integration |
| [E2E-TEST-PLAN.md](./E2E-TEST-PLAN.md) | E2E test suite: connection, inject, multi-turn, reconnection, settings, errors |

---

## TDD Principle

Tests are written **first** and define the behavior. Implementation is done to make those tests pass. No production code for a behavior without a failing test for it.

---

## Quick Reference

- **Backend proxy**: Implement at `/openai` (e.g. `ws://localhost:8080/openai`), aligned with [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime).
- **Component**: dg_react_agent must work with both Deepgram and OpenAI proxy backends; existing tests must remain green.
- **Existing OpenAI E2E**: `test-app/tests/e2e/openai-inject-connection-stability.spec.js` (single test); expand into full suite per E2E-TEST-PLAN.
- **Proxy contract in code**: `src/types/connection.ts` and `src/types/agent.ts` include a short "Proxy contract" comment linking to [API-DISCONTINUITIES.md](./API-DISCONTINUITIES.md). All open questions in that doc are resolved (section 6).

---

## Acceptance criteria for resolving #381

Use this checklist to confirm the issue is complete before closing.

- [x] **Document in code**  
  Proxy contract is documented in the codebase so implementers know what the proxy must send and accept.  
  **Done**: Short "Proxy contract" comment (and link to [API-DISCONTINUITIES.md](./API-DISCONTINUITIES.md)) in `src/types/connection.ts` and `src/types/agent.ts`.

- [x] **Phase 1 – Unit tests and proxy core logic**  
  Unit tests for translation (Settings → session.update, InjectUserMessage → conversation.item.create, server events → SettingsApplied / ConversationText / Error, greeting) pass.  
  **Done**: 28 tests in `tests/openai-proxy.test.ts`. **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-1).

- [x] **Phase 2 – Integration tests and WebSocket server**  
  Proxy runs as a WebSocket server; integration tests (session bootstrap, InjectUserMessage round-trip, component contract, greeting injection) pass.  
  **Done**: 12 tests in `tests/integration/openai-proxy-integration.test.ts` (function-call round-trip, transcript-only path, user echo, context in Settings, greeting). **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-2).

- [x] **Phase 3 – E2E tests and full stack**  
  Test-app works end-to-end with the OpenAI proxy; E2E suite (connection, single message, multi-turn, reconnection, basic audio, function calling, error handling) passes when `VITE_OPENAI_PROXY_ENDPOINT` is set.  
  **Done**: 9 tests in openai-proxy-e2e + openai-inject-connection-stability (8 pass, 1 flaky). **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-3).

- [x] **Phase 4 – Component tests with OpenAI backend**  
  Full component test suite passes with the OpenAI proxy where applicable; no regressions; Deepgram-only exceptions documented if any.  
  **Done**: context-retention and context-retention-with-function-calling pass; declarative-props (Deepgram function-call), backend-proxy-mode (Deepgram), callback-test (Deepgram transcript/VAD) skip when OpenAI; documented in [PROGRESS.md](./PROGRESS.md) and [E2E-PRIORITY-RUN-LIST.md](./E2E-PRIORITY-RUN-LIST.md). **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-4).

- [x] **Phase 5 – Documentation and CI**  
  [RUN-OPENAI-PROXY.md](./RUN-OPENAI-PROXY.md) describes proxy env, how to run the proxy, and how to run unit, integration, and E2E tests; CI runs proxy unit and integration tests in existing Jest job.  
  **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-5).

- [x] **Greeting**  
  The component is provided a greeting (e.g. in agent options) and sends it in **Settings**. The proxy **uses** that greeting: after **session.updated**, injects the greeting via **conversation.item.create** (upstream) and **ConversationText** (component).  
  **Done**: Translator `mapGreetingToConversationItemCreate` / `mapGreetingToConversationText`; server stores `agent.greeting` on Settings and injects after session.updated. Unit + integration tests; E2E validates greeting-sent when connecting through proxy. **Ref**: [API-DISCONTINUITIES.md](./API-DISCONTINUITIES.md) section 6 (Greeting).
