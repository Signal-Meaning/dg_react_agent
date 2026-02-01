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
