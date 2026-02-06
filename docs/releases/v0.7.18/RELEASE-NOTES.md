# Release Notes - v0.7.18

**Release Date**: February 2026  
**Type**: Patch

## Summary

This patch release delivers **Issue #406**: OpenAI proxy readiness contract, protocol fix (defer context until after session.updated), and conversation-after-refresh support via optional component storage and test-app refactor.

## Changes

- **OpenAI proxy:** Context is deferred until after `session.updated` to satisfy API ordering; regression test enforces this. When upstream closes before SettingsApplied, the proxy sends Error `upstream_closed_before_session_ready`.
- **Readiness:** E2E and integration tests require Settings applied before first message; docs (Component–Proxy Contract, Interface Contract) updated.
- **Component:** Optional `conversationStorage` and `conversationStorageKey`; restores on mount, persists on ConversationText, exposes `ref.getConversationHistory()`. See [CONVERSATION-STORAGE](../../CONVERSATION-STORAGE.md).
- **Test-app:** Uses component storage (localStorage) and `getConversationHistory()` for Conversation History UI and context; conversation survives full page refresh.
- **E2E:** Readiness contract and conversation-reload-after-refresh tests; real API E2E validated (11 tests passed).

## References

- **Issue #406**: [OpenAI proxy – conversation after refresh + readiness](https://github.com/Signal-Meaning/dg_react_agent/issues/406)
- **PR #408**: Merge davidrmcgee/issue406 into main
