# Changelog - v0.9.4

**Release Date**: February 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #462 / #470:** OpenAI proxy no longer sends `response.create` immediately after `conversation.item.create` (function_call_output). The API still has the previous response (the function-call request) active until it processes our item and sends `response.output_text.done`. Deferring `response.create` until we receive that event eliminates `conversation_already_has_active_response` in the function-call flow (partner/voice-commerce scenario).

## Added

- **E2E test 6b:** Partner-scenario test in `test-app/tests/e2e/openai-proxy-e2e.spec.js` — connect → Settings → one user message that triggers a function call → backend HTTP → FunctionCallResponse → API response; asserts no `conversation_already_has_active_response` (strict 0 agent errors). See `docs/issues/ISSUE-470/SCOPE.md`.
- **Real-API integration tests:** Issue #470 TDD plan — real-API integration tests for protocol requirements: Req 1 (session.update not sent while response active), Req 3 (InjectUserMessage → response without error), Req 4 (function-call flow without conversation_already_has_active_response). See `docs/issues/ISSUE-470/TDD-PLAN-MISSING-REQUIREMENTS.md`.
- **Docs:** `docs/issues/ISSUE-470/INVESTIGATION.md`, `PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md`, `TDD-PLAN.md`, `TDD-PLAN-MISSING-REQUIREMENTS.md`; protocol doc updated (FunctionCallResponse defer response.create); ISSUE-462 TRACKING updated with partner-scenario coverage.

## Backward Compatibility

✅ **Fully backward compatible** — No component or backend API changes. Proxy wire behavior is corrected so the real API no longer returns `conversation_already_has_active_response` in the function-call path.

## References

- Issue #470: Release v0.9.4 — correct the defect (partner-scenario coverage + proxy fix)
- Issue #462: conversation_already_has_active_response (fix in 0.9.2; coverage and defer fix in 0.9.4)
