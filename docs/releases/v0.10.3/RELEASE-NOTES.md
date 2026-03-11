# Release Notes - v0.10.3

**Release Date**: March 2026  
**Type**: Patch release

## Summary

v0.10.3 patches the OpenAI proxy for **voice-commerce #1066** (Issue #522): `conversation_already_has_active_response` after a successful function call no longer occurs, and when the API does return that error it is not forwarded to the client, so the component does not trigger retries or duplicate function calls. No API changes.

## Fixes included

- **#522 (voice-commerce #1066):** After the host sends `FunctionCallResponse`, the proxy no longer sends `response.create` immediately to the OpenAI Realtime API. It defers `response.create` until the upstream sends `response.done` or `response.output_text.done`, respecting the API rule that only one response can be active at a time. This eliminates `conversation_already_has_active_response` in the function-call flow.
- **#522 (non-fatal error):** When the upstream sends error code `conversation_already_has_active_response`, the proxy logs at INFO and does **not** forward the error to the client, so the component does not treat it as a fatal connection failure and does not trigger re-Settings or retries (no duplicate function calls).

## Packages

- **@signal-meaning/voice-agent-react** — 0.10.3
- **@signal-meaning/voice-agent-backend** — 0.2.8 (includes OpenAI proxy fix #522; voice-commerce #1066)

## Validation

- Integration tests: `npm test -- tests/integration/openai-proxy-integration.test.ts` (mock and real-API paths).
- E2E test 6b (partner scenario): From test-app, `USE_REAL_APIS=1 npm run test:e2e -- openai-proxy-e2e.spec.js --grep "6b"` — function-call flow completes without `conversation_already_has_active_response`; agent returns time; 0 recoverable errors.

## See also

- [CHANGELOG.md](./CHANGELOG.md) — Full changelog
- [PACKAGE-STRUCTURE.md](./PACKAGE-STRUCTURE.md) — Package contents and entry points
- docs/issues/ISSUE-522/TDD-PLAN.md — Fix and validation plan
