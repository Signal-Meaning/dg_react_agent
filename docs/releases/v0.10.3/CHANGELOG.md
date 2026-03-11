# Changelog - v0.10.3

**Release Date**: March 2026  
**Release Type**: Patch Release

All changes in this release are documented here. [Keep a Changelog](https://keepachangelog.com/) format.

## Fixed

- **Issue #522 (voice-commerce #1066):** After a successful function call (host sends `FunctionCallResponse`), the OpenAI proxy no longer sends `response.create` immediately to the upstream. It defers `response.create` until the upstream sends `response.done` or `response.output_text.done`, so the API no longer returns `conversation_already_has_active_response` ("Conversation already has an active response in progress"). This prevents duplicate function calls and agent fallback when the first call already succeeded.

- **Issue #522 (error handling):** When the OpenAI Realtime API returns error code `conversation_already_has_active_response`, the proxy now logs it at INFO and does **not** forward the error to the client. The component therefore does not treat it as a fatal connection failure and does not trigger reconnection, re-Settings, or retries that would cause the same function to be invoked multiple times for a single user utterance.

## Backward Compatibility

✅ **Fully backward compatible** — No breaking changes to the public component API.

## References

- Issue [#522](https://github.com/Signal-Meaning/dg_react_agent/issues/522) — conversation_already_has_active_response after successful function call (voice-commerce #1066)
- docs/issues/ISSUE-522/TDD-PLAN.md — TDD plan and validation
