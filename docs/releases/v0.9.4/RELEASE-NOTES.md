# Release Notes - v0.9.4

**Release Date**: February 2026  
**Type**: Patch (backward compatible)

## Summary

v0.9.4 is a **patch** release that fixes `conversation_already_has_active_response` in the **function-call flow** (OpenAI Realtime proxy) and adds coverage for the #462 partner (voice-commerce) scenario.

## Highlights

- **Proxy fix (#470):** After the client sends `FunctionCallResponse`, the proxy now defers sending `response.create` until the API sends `response.output_text.done`. Sending it immediately had caused the real API to return "Conversation already has an active response in progress." See `docs/issues/ISSUE-470/INVESTIGATION.md`.
- **E2E test 6b:** Full partner scenario (connect → Settings → user message → function call → backend HTTP → FunctionCallResponse → response) with assertion of no `conversation_already_has_active_response`.
- **Real-API integration tests:** Additional integration tests that run with `USE_REAL_APIS=1` for protocol requirements (session.update gating, InjectUserMessage flow, function-call flow).
- **Protocol audit:** `PROTOCOL-REQUIREMENTS-AND-TEST-COVERAGE.md` documents learned requirements and test coverage; TDD plans for partner-scenario and missing-requirement coverage.

## Upgrade

No code changes required. Install `@signal-meaning/voice-agent-react@0.9.4` and `@signal-meaning/voice-agent-backend@0.2.4` for the proxy fix and new tests/docs. Partners using the OpenAI proxy with function calling (e.g. voice-commerce) should upgrade to avoid `conversation_already_has_active_response` in that flow.

See [CHANGELOG.md](./CHANGELOG.md) for details.
