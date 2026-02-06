# Changelog - v0.7.18

**Release Date**: February 2026  
**Release Type**: Patch Release

## Fixed (Issue #406)

### OpenAI proxy readiness and protocol

- **Readiness contract:** E2E and integration tests now require Settings applied before first message. Docs updated (Component–Proxy Contract, Interface Contract). When the OpenAI proxy or upstream fails to deliver SettingsApplied, tests fail clearly instead of passing with "Settings optional."
- **Proxy protocol fix:** Context (conversation.item.create) is now deferred until after `session.updated` in the OpenAI proxy. Previously the proxy sent context immediately after session.update, violating OpenAI Realtime API ordering and causing upstream to close (e.g. 1005/1006). Fix in `scripts/openai-proxy/server.ts`; regression test in `tests/integration/openai-proxy-integration.test.ts`.
- **Proxy mitigation:** When upstream closes before the proxy has sent SettingsApplied, the proxy sends component Error `upstream_closed_before_session_ready` (with close code/reason) so the host sees a clear error.

## Added (Issue #406)

### Conversation persistence and test-app refactor

- **Component:** Optional `conversationStorage` (interface: `getItem(key)`, `setItem(key, value)`) and `conversationStorageKey`. On mount the component restores from storage; when ConversationText is received it appends and persists (last 50 messages). Exposes `ref.getConversationHistory()`. See [CONVERSATION-STORAGE](../../CONVERSATION-STORAGE.md). Unit tests: `tests/conversation-storage-issue406.test.tsx`.
- **Test-app:** Uses component storage: passes localStorage-backed `conversationStorage` and `conversationStorageKey`; Conversation History UI and agentOptions.context driven from `ref.getConversationHistory()` (synced in onAgentUtterance / onUserMessage and after inject). Conversation survives full page refresh.
- **E2E:** `readiness-contract-e2e.spec.js` includes test that sends a unique message, reloads the page, and asserts the message still appears in conversation history. Integration test `tests/integration/readiness-contract.test.ts` asserts protocol contract (SettingsApplied before first InjectUserMessage).

### Documentation and test docs

- **Docs:** [CONVERSATION-STORAGE](../../CONVERSATION-STORAGE.md), [Component–Proxy Contract](../../BACKEND-PROXY/COMPONENT-PROXY-CONTRACT.md), [Interface Contract](../../BACKEND-PROXY/INTERFACE-CONTRACT.md). Issue #406 README and INVESTIGATION.md.
- **Test docs:** Moved to `tests/docs/` (E2E_CI_TEST_STRATEGY, PLAYWRIGHT_TESTING_PLAN, TEST-COVERAGE-*, TEST-UTILITIES, TESTING.md, etc.). `WHY-TESTS-PASS-ISSUE-318.md` moved to `docs/issues/`.

## Backward Compatibility

✅ **Fully backward compatible** — New optional props (`conversationStorage`, `conversationStorageKey`); existing behavior unchanged when not provided. Proxy and test-app changes are additive.

## References

- **Issue #406**: OpenAI proxy – conversation after refresh + readiness — [Issue #406](https://github.com/Signal-Meaning/dg_react_agent/issues/406)
- **PR #408**: Merge davidrmcgee/issue406 into main
