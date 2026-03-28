# Release Notes - v0.10.5

**Release Date**: March 2026  
**Type**: Patch release

## Summary

v0.10.5 ships **[Epic #542](https://github.com/Signal-Meaning/dg_react_agent/issues/542)** (Voice Commerce OpenAI proxy defect register, §1–§6), merged in **[PR #543](https://github.com/Signal-Meaning/dg_react_agent/pull/543)**. It publishes the proxy hardening, Settings → Realtime mapping, component alignment, integration and E2E coverage, and protocol or contract documentation developed under that epic. **@signal-meaning/voice-agent-backend** is **0.2.10** for this line.

## Packages

- **@signal-meaning/voice-agent-react** — 0.10.5
- **@signal-meaning/voice-agent-backend** — 0.2.10

## Validation

- **CI-equivalent (mock):** `npm run lint`, `npm run test:mock`, `npm audit --audit-level=high`.
- **Proxy / OpenAI (required for this release):** With `OPENAI_API_KEY`, `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`; `npm test -- tests/openai-proxy-event-coverage.test.ts`. Partner function-call expectations: see `.cursorrules` and [ISSUE-462](../../issues/ISSUE-462/README.md).
- **E2E (proxy mode):** From `test-app`, with backend running: `USE_PROXY_MODE=true npm run test:e2e` (see [test-app/tests/e2e/README.md](../../../test-app/tests/e2e/README.md)).

## See also

- [CHANGELOG.md](./CHANGELOG.md) — Full changelog
- [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) — Package contents and entry points
- [Issue #544](https://github.com/Signal-Meaning/dg_react_agent/issues/544) — release checklist
