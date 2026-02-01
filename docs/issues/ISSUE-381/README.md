# Issue #381: OpenAI Realtime Proxy – TDD Implementation

**GitHub Issue**: [#381](https://github.com/Signal-Meaning/dg_react_agent/issues/381)  
**Objective**: Add the missing OpenAI Realtime proxy to the backend and validate unit, integration, and E2E tests. Existing component tests must pass with the OpenAI backend.

**OpenAI Realtime API**: https://platform.openai.com/docs/guides/realtime

---

## Documents

| Document | Purpose |
|----------|---------|
| [TDD-OVERVIEW.md](./TDD-OVERVIEW.md) | TDD workflow (Red–Green–Refactor), test-first rules, and order of work |
| [UNIT-TEST-PLAN.md](./UNIT-TEST-PLAN.md) | Unit tests for the OpenAI proxy: write failing tests first, then implement |
| [INTEGRATION-TEST-PLAN.md](./INTEGRATION-TEST-PLAN.md) | Integration tests: proxy WebSocket behavior and component integration |
| [E2E-TEST-PLAN.md](./E2E-TEST-PLAN.md) | E2E test suite: connection, inject, multi-turn, reconnection, settings, errors |
| [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md) | Phased implementation: tests first (RED), then implementation (GREEN), then refactor |

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

- [ ] **Document in code**  
  Proxy contract is documented in the codebase so implementers know what the proxy must send and accept.  
  **Done**: Short "Proxy contract" comment (and link to [API-DISCONTINUITIES.md](./API-DISCONTINUITIES.md)) in `src/types/connection.ts` and `src/types/agent.ts`.

- [ ] **Phase 1 – Unit tests and proxy core logic**  
  Unit tests for translation (Settings → session.update, InjectUserMessage → conversation.item.create, server events → SettingsApplied / ConversationText / Error) pass.  
  **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-1), `tests/openai-proxy.test.ts`.

- [ ] **Phase 2 – Integration tests and WebSocket server**  
  Proxy runs as a WebSocket server; integration tests (session bootstrap, InjectUserMessage round-trip, component contract) pass.  
  **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-2), `tests/integration/openai-proxy-integration.test.ts`.

- [ ] **Phase 3 – E2E tests and full stack**  
  Test-app works end-to-end with the OpenAI proxy; E2E suite (connection, single message, multi-turn, reconnection, basic audio, function calling, error handling) passes when `VITE_OPENAI_PROXY_ENDPOINT` is set.  
  **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-3), `test-app/tests/e2e/openai-proxy-e2e.spec.js`.

- [ ] **Phase 4 – Component tests with OpenAI backend**  
  Full component test suite passes with the OpenAI proxy where applicable; no regressions; Deepgram-only exceptions documented if any.  
  **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-4).

- [ ] **Phase 5 – Documentation and CI**  
  ENVIRONMENT_VARIABLES.md (or equivalent) and CI describe proxy env, how to run the proxy, and how to run proxy tests.  
  **Ref**: [IMPLEMENTATION-PHASES.md](./IMPLEMENTATION-PHASES.md#phase-5).

- [ ] **Greeting**  
  The component is provided a greeting (e.g. in agent options) and sends it in **Settings**. The proxy must **use** that greeting: after session is ready, inject the component-provided greeting as an initial assistant message (e.g. via **conversation.item.create**) so the component receives it.  
  **Ref**: [API-DISCONTINUITIES.md](./API-DISCONTINUITIES.md) section 6 (Greeting).
